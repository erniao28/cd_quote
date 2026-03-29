// 定时爬取任务调度器
import cron from 'node-cron';
import { crawlChinamoney, savePrices, downloadExcelFromChinamoney, parseExcelFile } from './chinamoney.js';
import { formatDate, isWorkday, getNextWorkday } from './holiday.js';
import { getCrawlHistory, getPricesByDate, getTempQuotes, deletePricesByDate } from '../database.js';
import { saveTempQuotes } from '../database.js';

let crawlJobs = new Map();

/**
 * 启动定时爬取任务
 */
export function startCrawlScheduler() {
  console.log('[调度器] 启动定时任务...');

  // 每 10 分钟检查一次
  cron.schedule('*/10 * * * *', async () => {
    console.log('[调度器] 执行定时检查...');
    await checkAndCrawl();
  });

  console.log('[调度器] 已启动，每 10 分钟检查一次');
}

/**
 * 检查是否需要爬取
 */
async function checkAndCrawl() {
  try {
    // 获取下一个工作日的日期
    const today = new Date();
    const todayStr = formatDate(today);

    // 检查是否已爬取过今天
    const history = getCrawlHistory();
    const todayCrawl = history.find(h => h.crawl_date === todayStr && h.status === 'success');

    if (todayCrawl) {
      console.log('[调度器] 今日已爬取，跳过');
      return;
    }

    // 确定目标发行日期（下一个工作日）
    const targetDate = getNextWorkday(todayStr, 1);
    console.log(`[调度器] 目标发行日期：${targetDate}`);

    // 执行爬取
    const prices = await crawlChinamoney(targetDate);
    savePrices(prices);

    console.log(`[调度器] 爬取完成，共 ${prices.length} 条记录`);

  } catch (error) {
    console.error('[调度器] 执行失败:', error.message);
  }
}

/**
 * 手动触发爬取 - 优先使用下载 Excel 方式获取完整数据
 */
export async function manualCrawl(targetDate, incremental = false) {
  console.log(`[调度器] 手动爬取：${targetDate}，增量模式：${incremental}`);

  try {
    // 检查临时表是否为空
    const tempQuotes = getTempQuotes();
    const isTempEmpty = tempQuotes.length === 0;

    // 如果临时表为空且今天已爬取过，直接从正式库加载
    if (isTempEmpty) {
      const existingPrices = getPricesByDate(targetDate);
      if (existingPrices.length > 0) {
        await saveTempQuotes(existingPrices);
        return {
          success: true,
          count: existingPrices.length,
          message: `已从正式库加载 ${existingPrices.length} 条记录到临时报价表`
        };
      }
    }

    // 方案 1：优先尝试下载 Excel 获取完整数据（包含收益率、发行量、评级等）
    console.log(`[调度器] 尝试通过下载 Excel 方式获取完整数据...`);
    let prices = await downloadExcelFromChinamoney(targetDate);
    console.log(`[调度器] Excel 下载完成，获取到 ${prices.length} 条数据`);

    // 如果 Excel 下载失败或无数据，回退到列表页爬取
    if (prices.length === 0) {
      console.log(`[调度器] Excel 下载无数据，回退到列表页爬取...`);
      // 列表页爬取时使用增量模式
      const existingPrices = getPricesByDate(targetDate);
      const existingNames = new Set(existingPrices.map(p => p.issue_name));
      prices = await crawlChinamoney(targetDate, incremental, existingNames);
    }

    // 如果没有爬取到新数据，但用户可能需要看到已有数据
    if (prices.length === 0) {
      // 从正式库加载该日期的数据到临时表，供用户查看/编辑
      const existingPrices = getPricesByDate(targetDate);
      if (existingPrices.length > 0) {
        await saveTempQuotes(existingPrices);
        return {
          success: true,
          count: existingPrices.length,  // 返回实际加载的数据条数
          message: `没有新数据，已从正式库加载 ${existingPrices.length} 条记录到临时报价表`
        };
      }
      return {
        success: false,
        count: 0,
        message: '未找到新数据'
      };
    }

    // Excel 方式获取的数据使用覆盖模式（因为数据完整）
    // 先删除该日期的旧数据，再保存新数据
    if (prices.length > 0 && prices[0].ref_yield) {
      console.log(`[调度器] Excel 数据完整，使用覆盖模式...`);
      deletePricesByDate(targetDate);
    }

    // 保存到正式库
    savePrices(prices);

    // 同时保存到临时表
    await saveTempQuotes(prices);

    return {
      success: true,
      count: prices.length,
      message: `爬取成功，新增 ${prices.length} 条记录`
    };
  } catch (error) {
    console.error('[调度器] 爬取失败:', error.message);
    // 出错时尝试从正式库加载已有数据
    const existingPrices = getPricesByDate(targetDate);
    if (existingPrices.length > 0) {
      await saveTempQuotes(existingPrices);
      return {
        success: true,
        count: 0,
        message: `爬取出错，已从正式库加载 ${existingPrices.length} 条记录到临时报价表（错误：${error.message}）`
      };
    }
    return {
      success: false,
      count: 0,
      message: `爬取失败：${error.message}`
    };
  }
}

/**
 * 手动下载 Excel 并导入到临时表
 */
export async function manualDownloadExcel(targetDate) {
  console.log(`[调度器] 手动下载 Excel：${targetDate}`);

  try {
    // 从货币网下载并解析数据
    const prices = await downloadExcelFromChinamoney(targetDate);

    if (prices.length === 0) {
      return {
        success: false,
        message: '未找到数据'
      };
    }

    // 获取已存在的存单简称列表（用于去重）
    const existingPrices = getPricesByDate(targetDate);
    const existingNames = new Set(existingPrices.map(p => p.issue_name));

    // 过滤已存在的数据
    const newPrices = prices.filter(p => !existingNames.has(p.issue_name));

    console.log(`[调度器] 原始数据 ${prices.length} 条，去重后 ${newPrices.length} 条`);

    // 保存到临时表
    await saveTempQuotes(newPrices.length > 0 ? newPrices : prices);

    return {
      success: true,
      count: newPrices.length > 0 ? newPrices.length : prices.length,
      message: `下载并导入成功，共 ${newPrices.length > 0 ? newPrices.length : prices.length} 条记录`
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      message: `下载失败：${error.message}`
    };
  }
}

/**
 * 停止所有定时任务
 */
export function stopCrawlScheduler() {
  crawlJobs.forEach(job => job.stop());
  crawlJobs.clear();
  console.log('[调度器] 已停止');
}
