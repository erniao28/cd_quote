// 定时爬取任务调度器
import cron from 'node-cron';
import { crawlChinamoney, savePrices } from './chinamoney.js';
import { formatDate, isWorkday, getNextWorkday } from './holiday.js';
import { getCrawlHistory } from '../database.js';

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
 * 手动触发爬取
 */
export async function manualCrawl(targetDate) {
  console.log(`[调度器] 手动爬取：${targetDate}`);

  try {
    const prices = await crawlChinamoney(targetDate);
    savePrices(prices);

    return {
      success: true,
      count: prices.length,
      message: `爬取成功，共 ${prices.length} 条记录`
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      message: `爬取失败：${error.message}`
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
