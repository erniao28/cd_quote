// 中国货币网爬虫模块
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { insertDailyPrice, getAllPrices, getPricesByDate, insertCrawlHistory } from '../database.js';
import { formatDate, isWorkday, getNextWorkday } from './holiday.js';

const BASE_URL = 'https://www.chinamoney.com.cn';
const LIST_URL = 'https://www.chinamoney.com.cn/chinese/tycdfxxx/?issueStType=1';

// 银行名称映射表
const BANK_NAME_MAP = {
  '兴业银行': ['兴业银行', '兴业', 'CIB'],
  '浦发银行': ['浦发银行', '浦发', 'SPDB'],
  '中信银行': ['中信银行', '中信', 'CITIC'],
  '招商银行': ['招商银行', '招行', 'CMB'],
  '民生银行': ['民生银行', '民生', 'CMBC'],
  '光大银行': ['光大银行', '光大', 'CEB'],
  '平安银行': ['平安银行', '平安', 'PAB'],
  '工商银行': ['工商银行', '工行', 'ICBC'],
  '农业银行': ['农业银行', '农行', 'ABC'],
  '中国银行': ['中国银行', '中行', 'BOC'],
  '建设银行': ['建设银行', '建行', 'CCB'],
  '交通银行': ['交通银行', '交行', 'BOCOM'],
  '北京银行': ['北京银行', '北京'],
  '上海银行': ['上海银行', '上海'],
  '江苏银行': ['江苏银行', '江苏'],
  '南京银行': ['南京银行', '南京'],
  '宁波银行': ['宁波银行', '宁波'],
  '杭州银行': ['杭州银行', '杭州'],
  '长沙银行': ['长沙银行', '长沙'],
  '成都银行': ['成都银行', '成都'],
};

/**
 * 从简称提取银行名称
 */
export function extractBankName(issueName) {
  for (const [bankName, aliases] of Object.entries(BANK_NAME_MAP)) {
    for (const alias of aliases) {
      if (issueName.includes(alias)) {
        return bankName;
      }
    }
  }
  // 如果都不匹配，尝试从存单简称提取（一般格式：XX 银行 CDxxx）
  const match = issueName.match(/^(.+?)(?:CD|存单)/i);
  if (match) {
    return match[1].trim();
  }
  return issueName;
}

/**
 * 使用 Puppeteer 爬取货币网数据 - 增强反检测，支持增量爬取
 */
export async function crawlChinamoney(targetDate, incremental = false, existingNames = new Set()) {
  console.log(`[爬虫] 开始爬取发行日期：${targetDate}，增量模式：${incremental}`);

  let browser = null;
  try {
    // 启动浏览器 - 增强反检测配置
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();

    // 设置更真实的 User-Agent（使用最新的 Chrome 版本）
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    // 设置 viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // 添加反检测脚本
    await page.evaluateOnNewDocument(() => {
      // 移除 webdriver 属性
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // 设置 plugins
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      // 设置 languages
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
      // 添加 chrome 属性
      Object.defineProperty(navigator, 'chrome', {
        value: { runtime: {} }
      });
    });

    // 访问列表页
    console.log(`[爬虫] 访问：${LIST_URL}`);

    // 先等待 2 秒再访问，模拟真人
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.goto(LIST_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // 等待页面完全加载
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 尝试点击任何可能出现的弹窗
    try {
      await page.click('button[aria-label="Close"], .close-btn, .modal-close').catch(() => {});
    } catch (e) {}

    // 等待列表加载
    const tableLoaded = await page.waitForSelector('.m-table, .data-table, table', { timeout: 20000 })
      .then(() => true)
      .catch(() => false);

    if (!tableLoaded) {
      console.log('[爬虫] 未找到表格，尝试滚动页面...');
      // 尝试滚动页面触发加载
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 获取页面内容长度用于调试
    const content = await page.content();
    console.log('[爬虫] 页面内容长度:', content.length);

    // 截图调试
    try {
      await page.screenshot({ path: `/tmp/crawl_debug_${Date.now()}.png`, fullPage: false });
      console.log('[爬虫] 已保存调试截图');
    } catch (e) {
      console.log('[爬虫] 截图失败:', e.message);
    }

    // 获取所有存单链接 - 使用更宽的选择器，支持翻页
    const allItems = [];
    let pageNum = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`[爬虫] 爬取第 ${pageNum} 页...`);

      const items = await page.evaluate(() => {
        // 尝试多种选择器
        const selectors = [
          'table tbody tr',
          '.m-table tbody tr',
          '.data-table tbody tr',
          'tr[class*="row"]',
          'tr'
        ];

        let rows = [];
        for (const selector of selectors) {
          rows = document.querySelectorAll(selector);
          if (rows.length > 0) break;
        }

        const result = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          // 至少要有 8 列才可能是有效数据（新表格有 10 列）
          if (cells.length >= 8) {
            // 新表格结构：第 1 列=存单代码，第 2 列=存单简称，第 3 列=发行日期，第 4 列=期限...
            const issueCode = cells[0]?.textContent?.trim() || '';
            // 链接在第 2 列（存单简称）中
            const linkEl = cells[1]?.querySelector('a');
            const issueName = linkEl?.textContent?.trim() || cells[1]?.textContent?.trim() || '';
            // 日期格式转换：2026/03/30 -> 2026-03-30
            const rawDate = cells[2]?.textContent?.trim() || '';
            const issueDate = rawDate.replace(/\//g, '-');
            // const issueMethod = cells[3]?.textContent?.trim() || '';  // 发行方式（未使用）
            const tenor = cells[4]?.textContent?.trim() || '';  // 期限
            // const interestType = cells[5]?.textContent?.trim() || '';  // 息票类型（未使用）
            // const couponRate = cells[6]?.textContent?.trim() || '';  // 票面利率（未使用）
            const refYield = cells[7]?.textContent?.trim() || '';  // 参考收益率
            const volume = cells[8]?.textContent?.trim() || '';  // 计划发行量
            const rating = cells[9]?.textContent?.trim() || '';  // 主体评级

            // 跳过表头行（第一列是"存单代码"）
            if (issueCode === '存单代码') {
              return;
            }

            // 过滤：第一列是数字（存单代码）且第二列包含银行名称
            const isCodeRow = /^\d+$/.test(issueCode);
            const hasBankName = issueName && (issueName.includes('银行') || issueName.includes('CD') || issueName.includes('存单'));

            if (isCodeRow && hasBankName) {
              // 从第 2 列的链接中提取 bondDefinedCode
              const fullHref = linkEl?.getAttribute('href') || '';
              let bondDefinedCode = '';
              if (fullHref && fullHref.includes('bondDefinedCode=')) {
                const match = fullHref.match(/bondDefinedCode=([^&]+)/);
                if (match) bondDefinedCode = match[1];
              }

              result.push({
                issueCode: issueCode,
                issueName: issueName,
                link: linkEl?.href || '',
                bondDefinedCode: bondDefinedCode,  // 详情页参数
                issueDate: issueDate,
                tenor: tenor,
                refYield: refYield,
                volume: volume,
                rating: rating
              });
            }
          }
        });

        return result;
      });

      console.log(`[爬虫] 第 ${pageNum} 页爬取到 ${items.length} 条记录`);
      allItems.push(...items);

      // 尝试翻页
      const canClickNext = await page.evaluate(() => {
        const nextBtn = document.querySelector('.page-btn.page-next:not(.disabled)');
        return !!nextBtn;
      });

      if (canClickNext) {
        console.log('[爬虫] 点击下一页按钮...');
        await page.click('.page-btn.page-next:not(.disabled)');
        await new Promise(resolve => setTimeout(resolve, 3000));
        pageNum++;

        // 检查是否还有更多页
        const currentPageInfo = await page.evaluate(() => {
          const pageText = document.querySelector('.page-size')?.textContent?.trim() || '';
          const match = pageText.match(/(\d+)\/(\d+)/);
          return match ? { current: parseInt(match[1]), total: parseInt(match[2]) } : null;
        });

        if (currentPageInfo) {
          console.log(`[爬虫] 当前页码：${currentPageInfo.current}/${currentPageInfo.total}`);
          if (currentPageInfo.current >= currentPageInfo.total) {
            console.log('[爬虫] 已到达最后一页');
            hasMorePages = false;
          }
        }

        // 限制最多爬取 10 页
        if (pageNum > 10) {
          console.log('[爬虫] 已达到最大页数限制，停止翻页');
          hasMorePages = false;
        }
      } else {
        console.log('[爬虫] 没有找到下一页，停止翻页');
        hasMorePages = false;
      }
    }

    console.log(`[爬虫] 共爬取到 ${allItems.length} 条记录`);

    // 如果没有找到数据，尝试备用方案
    if (allItems.length === 0) {
      console.log('[爬虫] 主选择器未找到数据，尝试备用方案...');

      // 尝试获取所有链接
      const allLinks = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/chinese/"]');
        const result = [];
        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          if (text.includes('银行') || text.includes('CD') || text.includes('存单')) {
            result.push({
              text: text,
              href: link.href
            });
          }
        });
        return result;
      });

      console.log('[爬虫] 找到相关链接:', allLinks.length);

      // 尝试访问几个链接获取详情
      for (const linkInfo of allLinks.slice(0, 5)) {
        try {
          await page.goto(linkInfo.href, { waitUntil: 'networkidle2', timeout: 10000 });
          await new Promise(resolve => setTimeout(resolve, 2000));

          const detailData = await page.evaluate(() => {
            const text = document.body.innerText;
            const issueName = document.querySelector('h1, h2, h3, .title')?.textContent?.trim() || '';

            // 尝试从文本中提取信息
            const issueDateMatch = text.match(/发行日期 [：:]\s*(\d{4}-\d{2}-\d{2})/);
            const tenorMatch = text.match(/期限 [（(]?(\d+)[)）]?[个年月]/);
            const priceMatch = text.match(/发行价格 [：:]\s*([\d.]+)/);

            return {
              issueName,
              issueDate: issueDateMatch?.[1] || '',
              tenor: tenorMatch?.[1] || '',
              price: priceMatch?.[1] || ''
            };
          });

          if (detailData.issueName) {
            allItems.push({
              issueCode: '',
              issueName: detailData.issueName,
              link: linkInfo.href,
              issueDate: detailData.issueDate,
              tenor: detailData.tenor
            });
          }

          await page.goBack({ waitUntil: 'networkidle2', timeout: 10000 });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.log('[爬虫] 获取详情失败:', linkInfo.href);
        }
      }
    }

    // 如果没有找到数据，抛出错误
    if (allItems.length === 0) {
      throw new Error('未找到存单数据，网站可能需要登录或存在反爬机制');
    }

    console.log(`[爬虫] 原始数据 ${allItems.length} 条记录`);

    // 遍历每个存单获取详情
    const prices = [];
    for (const item of allItems) {
      // 检查发行日期是否匹配
      if (targetDate && item.issueDate !== targetDate) {
        continue;
      }

      // 增量模式：跳过已存在的存单
      if (incremental && existingNames.has(item.issueName)) {
        console.log(`[爬虫] 跳过已存在的存单：${item.issueName}`);
        continue;
      }

      const priceData = {
        id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        issue_code: item.issueCode || '',
        issue_name: item.issueName,
        issue_date: item.issueDate,
        tenor: item.tenor || '',
        ref_yield: item.refYield || '',
        volume: item.volume || '',
        rating: item.rating || '',
        price: item.price || '',
        bank_name: extractBankName(item.issueName),
        created_at: Date.now(),
        updated_at: Date.now()
      };

      prices.push(priceData);
    }

    console.log(`[爬虫] 过滤后 ${prices.length} 条记录匹配目标日期`);

    // 记录爬取历史
    insertCrawlHistory({
      id: `history_${Date.now()}`,
      crawl_date: formatDate(new Date()),
      target_date: targetDate,
      status: 'success',
      count: prices.length,
      created_at: Date.now()
    });

    return prices;

  } catch (error) {
    console.error('[爬虫] 爬取失败:', error.message);

    // 记录失败
    insertCrawlHistory({
      id: `history_${Date.now()}`,
      crawl_date: formatDate(new Date()),
      target_date: targetDate,
      status: 'failed',
      count: 0,
      created_at: Date.now()
    });

    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 使用 Puppeteer 拦截网络请求下载 Excel
 * 通过监听 XHR 请求来获取真实的 Excel 文件
 */
export async function downloadExcelFromChinamoney(targetDate) {
  console.log(`[下载 Excel] 开始下载发行日期：${targetDate}`);

  let browser = null;
  try {
    // 启动浏览器
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();

    // 设置更真实的 User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    // 添加反检测脚本
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh'] });
    });

    // 拦截响应，查找 Excel 文件
    let excelBuffer = null;
    await page.setRequestInterception(true);

    page.on('request', request => {
      request.continue();
    });

    page.on('response', async response => {
      try {
        const url = response.url();
        const headers = response.headers();
        const contentType = headers['content-type'] || '';

        // 检查是否是 Excel 文件
        if (contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
            contentType.includes('application/vnd.ms-excel') ||
            url.endsWith('.xlsx') || url.endsWith('.xls')) {
          console.log('[下载 Excel] 找到 Excel 响应:', url);
          console.log('[下载 Excel] Content-Type:', contentType);
          const buffer = await response.buffer();
          console.log('[下载 Excel] Buffer 大小:', buffer.length);
          if (buffer.length > 1000) {  // 确保不是空文件
            excelBuffer = buffer;
            console.log('[下载 Excel] Excel 文件已捕获');
          }
        }
      } catch (e) {
        // 忽略某些响应解析错误
        console.log('[下载 Excel] 响应解析错误:', e.message);
      }
    });

    // 访问列表页
    console.log(`[下载 Excel] 访问：${LIST_URL}`);
    await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 等待页面加载
    await page.waitForSelector('.m-table, .data-table, table', { timeout: 15000 }).catch(() => {
      console.log('[下载 Excel] 未找到表格，尝试继续...');
    });

    // 等待一段时间让页面完全渲染
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 查找页面上所有的按钮，输出调试信息
    const allButtonsInfo = await page.evaluate(() => {
      const elements = document.querySelectorAll('button, a, span[role="button"], div[role="button"], input[type="button"]');
      const result = [];
      elements.forEach((el, idx) => {
        const text = el.textContent?.trim() || '';
        const href = el.href || '';
        const onclick = el.getAttribute('onclick') || '';
        const className = el.className || '';
        const id = el.id || '';
        if (text && idx < 100) {
          result.push({
            idx,
            tagName: el.tagName,
            text: text.substring(0, 50),
            href: href.substring(0, 80),
            onclick: onclick.substring(0, 100),
            className: className.substring(0, 50),
            id
          });
        }
      });
      return result;
    });

    console.log('[下载 Excel] 页面上所有的按钮:');
    allButtonsInfo.forEach(btn => {
      console.log(`  [${btn.idx}] <${btn.tagName}> "${btn.text}" | href:${btn.href || 'none'} | onclick:${btn.onclick || 'none'}`);
    });

    // 查找导出/下载按钮并点击
    const foundButton = await page.evaluate(() => {
      // 查找各种可能的导出/下载按钮
      const selectors = [
        'button[onclick*="export"]',
        'a[onclick*="export"]',
        'button[onclick*="Excel"]',
        'a[onclick*="Excel"]',
        'button[onclick*="excel"]',
        'a[onclick*="excel"]',
        'button[onclick*="download"]',
        'a[onclick*="download"]'
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) return { selector, type: 'onclick' };
      }

      // 查找包含导出、下载、Excel 文字的按钮
      const allButtons = document.querySelectorAll('button, a, input[type="button"], span[role="button"], div[role="button"]');
      for (const btn of allButtons) {
        const text = btn.textContent?.trim() || '';
        if (text.includes('导出') || text.includes('下载') || text.toLowerCase().includes('excel') || text.toLowerCase().includes('export')) {
          // 排除导航链接
          const href = btn.href || '';
          if (href && !href.includes('whsc') && !href.includes('form')) {
            return { text, type: 'href', href };
          }
        }
      }

      return null;
    });

    console.log('[下载 Excel] 找到按钮:', foundButton);

    // 如果是 onclick 类型，尝试点击
    if (foundButton?.type === 'onclick') {
      console.log('[下载 Excel] 点击导出按钮...');
      await page.evaluate(() => {
        const btn = document.querySelector('button[onclick*="export"], a[onclick*="export"], button[onclick*="Excel"], button[onclick*="excel"]');
        if (btn) btn.click();
      });

      // 等待下载请求
      console.log('[下载 Excel] 等待下载请求...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // 如果已经找到 Excel buffer，直接解析
    if (excelBuffer) {
      console.log('[下载 Excel] 成功捕获 Excel 文件');
      const prices = await parseExcelFile(excelBuffer);
      console.log(`[下载 Excel] Excel 解析完成，共 ${prices.length} 条数据`);

      // 爬取详情页补充发行价格 - 使用新标签页模式，避免 goBack() 不稳定问题
      console.log('[下载 Excel] 开始爬取详情页补充发行价格...');
      console.log('[下载 Excel] 调试：browser 类型 =', typeof browser, browser ? '已定义' : '未定义');
      let priceCount = 0;
      let errorCount = 0;

      for (let i = 0; i < Math.min(prices.length, 60); i++) {
        const item = prices[i];
        if (!item.issue_code) continue;

        try {
          // 构建详情页 URL
          const codeSuffix = item.issue_code.slice(-5);
          const bankPrefix = item.issue_code.substring(4, 6);
          const bondDefinedCode = `jcc${bankPrefix}${codeSuffix}`;
          const detailUrl = `https://www.chinamoney.com.cn/chinese/zqjc/?bondDefinedCode=${bondDefinedCode}`;

          // 创建新标签页访问详情页
          const detailPage = await browser.newPage();
          await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

          await detailPage.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          });

          await detailPage.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 500));

          const priceData = await detailPage.evaluate(() => {
            const text = document.body.innerText;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);

            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i].toLowerCase();
              const nextLine = lines[i + 1];
              if ((line.includes('发行价格') || line.includes('净价') || line.includes('发行净价')) &&
                  !line.includes('元') && /^[0-9.]+$/.test(nextLine)) {
                return nextLine;
              }
            }

            // 备用：查找表格中的价格
            const priceElements = document.querySelectorAll('td, .price, .value');
            for (const el of priceElements) {
              const text = el.textContent?.trim();
              if (text && (text.includes('发行价格') || text.includes('净价'))) {
                const nextEl = el.nextElementSibling;
                if (nextEl && /^[0-9.]+$/.test(nextEl.textContent?.trim())) {
                  return nextEl.textContent.trim();
                }
              }
            }

            return null;
          });

          await detailPage.close();

          if (priceData) {
            item.price = priceData;
            priceCount++;
          }

          // 随机延迟 200-500ms
          const randomDelay = Math.floor(Math.random() * 300) + 200;
          await new Promise(resolve => setTimeout(resolve, randomDelay));

        } catch (e) {
          errorCount++;
          console.log(`[下载 Excel] 爬取详情页失败 [${i + 1}/${prices.length}]：${item.issue_name || item.issue_code}`, e.message);
        }
      }

      console.log(`[下载 Excel] 成功获取 ${priceCount} 条发行价格数据`);
      console.log(`[下载 Excel] 详情页爬取错误数：${errorCount}/${prices.length}`);
      return prices;
    }

    // 如果没找到 Excel，改用爬取表格方式（包含详情页爬取）
    console.log('[下载 Excel] 未找到 Excel 文件，改用爬取表格方式');
    return await crawlTableData(page, targetDate, browser);

  } catch (error) {
    console.error('[下载 Excel] 失败:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 爬取表格数据并生成 Excel - 支持翻页和详情页爬取
 */
async function crawlTableData(page, targetDate, browser) {
  console.log('[下载 Excel] 爬取表格数据（含翻页）...');
  console.log('[下载 Excel] 调试：crawlTableData 中 browser 类型 =', typeof browser, browser ? '已定义' : '未定义');

  const allItems = [];

  // 爬取所有页面的数据
  let pageNum = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    console.log(`[下载 Excel] 爬取第 ${pageNum} 页...`);

    // 爬取当前页数据
    const pageData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr, .m-table tbody tr, .data-table tbody tr');
      const result = [];

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {  // 新表格有 10 列
          // 表格结构：第 1 列=存单代码，第 2 列=存单简称，第 3 列=发行日期，第 4 列=发行方式，第 5 列=期限，第 6 列=息票类型，第 7 列=票面利率，第 8 列=参考收益率，第 9 列=计划发行量，第 10 列=主体评级
          const issueCode = cells[0]?.textContent?.trim() || '';
          // 链接在第 2 列（存单简称）中
          const linkEl = cells[1]?.querySelector('a');
          const issueName = linkEl?.textContent?.trim() || cells[1]?.textContent?.trim() || '';
          const issueDate = cells[2]?.textContent?.trim() || '';
          // const issueMethod = cells[3]?.textContent?.trim() || '';  // 发行方式（未使用）
          const tenor = cells[4]?.textContent?.trim() || '';  // 期限
          // const interestType = cells[5]?.textContent?.trim() || '';  // 息票类型（未使用）
          // const couponRate = cells[6]?.textContent?.trim() || '';  // 票面利率（未使用）
          const refYield = cells[7]?.textContent?.trim() || '';  // 参考收益率
          const volume = cells[8]?.textContent?.trim() || '';  // 计划发行量
          const rating = cells[9]?.textContent?.trim() || '';  // 主体评级
          // 从第 2 列的链接中获取 href
          const link = linkEl?.getAttribute('href') || '';

          // 过滤：第一列是数字（存单代码）且第二列包含银行名称
          const isCodeRow = /^\d+$/.test(issueCode);
          const hasBankName = issueName && (issueName.includes('银行') || issueName.includes('CD') || issueName.includes('存单'));

          if (isCodeRow && hasBankName) {
            // 从链接中提取 bondDefinedCode - 使用正则解析，避免 URL 构造函数在某些环境下的问题
            let bondDefinedCode = '';
            if (link && link.includes('bondDefinedCode=')) {
              const match = link.match(/bondDefinedCode=([^&]+)/);
              if (match) bondDefinedCode = match[1];
            }

            result.push({
              issue_code: issueCode,
              issue_name: issueName,
              issue_date: issueDate,
              tenor: tenor,
              ref_yield: refYield,
              volume: volume,
              rating: rating,
              link: link,
              bondDefinedCode: bondDefinedCode
            });
          }
        }
      });

      return result;
    });

    console.log(`[下载 Excel] 第 ${pageNum} 页爬取到 ${pageData.length} 条数据`);
    allItems.push(...pageData);

    // 尝试翻页 - 使用点击按钮方式（货币网使用 JavaScript 翻页）
    const canClickNext = await page.evaluate(() => {
      // 查找下一页按钮（货币网的翻页按钮类名）
      const nextBtn = document.querySelector('.page-btn.page-next:not(.disabled)');
      if (nextBtn) {
        // 检查是否有"上一页"按钮来判断不是第一页（确保可以翻页）
        const prevBtn = document.querySelector('.page-btn.page-prev:not(.disabled)');
        return { found: true, hasPrev: !!prevBtn };
      }
      return { found: false };
    });

    if (canClickNext.found) {
      console.log('[下载 Excel] 点击下一页按钮...');
      // 点击下一页按钮
      await page.click('.page-btn.page-next:not(.disabled)');
      await new Promise(resolve => setTimeout(resolve, 3000));  // 等待页面加载
      pageNum++;

      // 检查是否还有更多页
      const currentPageInfo = await page.evaluate(() => {
        const pageText = document.querySelector('.page-size')?.textContent?.trim() || '';
        const match = pageText.match(/(\d+)\/(\d+)/);
        return match ? { current: parseInt(match[1]), total: parseInt(match[2]) } : null;
      });

      if (currentPageInfo) {
        console.log(`[下载 Excel] 当前页码：${currentPageInfo.current}/${currentPageInfo.total}`);
        if (currentPageInfo.current >= currentPageInfo.total) {
          console.log('[下载 Excel] 已到达最后一页');
          hasMorePages = false;
        }
      }

      // 限制最多爬取 10 页
      if (pageNum > 10) {
        console.log('[下载 Excel] 已达到最大页数限制，停止翻页');
        hasMorePages = false;
      }
    } else {
      console.log('[下载 Excel] 没有找到下一页，停止翻页');
      hasMorePages = false;
    }
  }

  console.log(`[下载 Excel] 共爬取到 ${allItems.length} 条数据`);

  // 爬取详情页获取发行价格 - 使用新标签页模式，避免 goBack() 不稳定问题
  console.log('[下载 Excel] 开始爬取详情页获取发行价格...');
  let detailCount = 0;
  let emptyCodeCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const bondDefinedCode = item.bondDefinedCode || '';

    if (!bondDefinedCode) {
      emptyCodeCount++;
      continue;
    }

    try {
      const detailUrl = `https://www.chinamoney.com.cn/chinese/zqjc/?bondDefinedCode=${bondDefinedCode}`;

      // 创建新标签页访问详情页（避免 goBack 问题）
      const detailPage = await browser.newPage();
      await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

      // 添加反检测
      await detailPage.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      // 访问详情页 - 使用 domcontentloaded 更快
      await detailPage.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // 等待内容加载
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 调试：输出页面 HTML 结构，帮助找到正确的选择器
      const pageStructure = await detailPage.evaluate(() => {
        const result = {
          title: document.title,
          bodyText: document.body.innerText.substring(0, 2000),
          tabs: [],
          buttons: []
        };

        // 查找所有可能的标签页元素
        const tabSelectors = ['[role="tab"]', '.tab', '.ant-tabs-tab', '.page-btn', '[data-tab]'];
        tabSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach((el, idx) => {
            if (idx < 5) {
              result.tabs.push({
                selector: selector,
                text: el.textContent?.trim(),
                html: el.outerHTML?.substring(0, 200)
              });
            }
          });
        });

        // 查找所有按钮
        document.querySelectorAll('button, a, span[role="button"], div[role="button"]').forEach((el, idx) => {
          if (idx < 20) {
            result.buttons.push({
              tag: el.tagName,
              text: el.textContent?.trim().substring(0, 20),
              class: el.className?.substring(0, 50)
            });
          }
        });

        return result;
      });

      console.log(`[下载 Excel] 详情页结构 [${i + 1}/${allItems.length}]:`, JSON.stringify(pageStructure).substring(0, 1000));

      // 尝试点击第二页/价格标签页（用户在详情页第二页）
      // 先尝试点击"价格信息"或第二页标签
      await detailPage.evaluate(async () => {
        // 辅助函数：查找包含特定文本的元素
        const findElementByText = (tag, text) => {
          const elements = document.querySelectorAll(tag);
          for (const el of elements) {
            if (el.textContent && el.textContent.includes(text)) {
              return el;
            }
          }
          return null;
        };

        // 尝试多种可能的选择器
        const selectors = [
          '[role="tab"]:nth-child(2)',  // 第二个标签页
          '.tab:nth-child(2)',
          '.ant-tabs-tab:nth-child(2)',
          '.page-btn:nth-child(2)',
          '[data-tab="price"]',
          '[data-tab="2"]'
        ];

        // 先尝试 CSS 选择器
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) {
            el.click();
            console.log('Clicked (CSS):', selector);
            return;
          }
        }

        // 再尝试按文本查找（原生方式）
        const textButtons = [
          findElementByText('button', '价格'),
          findElementByText('button', '详情'),
          findElementByText('a', '价格'),
          findElementByText('a', '详情'),
          findElementByText('span', '价格'),
          findElementByText('div', '价格')
        ];

        for (const btn of textButtons) {
          if (btn) {
            btn.click();
            console.log('Clicked (text):', btn.textContent);
            return;
          }
        }
      });

      // 等待价格内容加载
      await new Promise(resolve => setTimeout(resolve, 1500));

      const priceData = await detailPage.evaluate(() => {
        const text = document.body.innerText;

        // 方法 1：直接使用正则表达式查找"发行价格 (元)"后面的数值
        // 匹配格式：发行价格 (元)\n\t\n99.2486 或 发行价格 (元)     99.2486
        const priceMatch = text.match(/发行价格\s*\([^)]*\)\s*[\t\n\r\s]*([0-9.]+)/);
        if (priceMatch && priceMatch[1]) {
          return priceMatch[1];
        }

        // 方法 2：查找表格中的值标签对
        const tableRows = document.querySelectorAll('table tr, .m-table tr, .data-table tr');
        for (const row of tableRows) {
          const cells = row.querySelectorAll('td, th');
          for (let j = 0; j < cells.length - 1; j++) {
            const labelText = cells[j].textContent?.trim().toLowerCase() || '';
            if (labelText.includes('发行价格') || labelText.includes('发行净价')) {
              const valueText = cells[j + 1].textContent?.trim() || '';
              if (/^[0-9.]+$/.test(valueText)) {
                return valueText;
              }
            }
          }
        }

        // 方法 3：逐行查找
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          const nextLine = lines[i + 1];

          // 如果当前行包含"发行价格"且下一行是纯数字
          if (line.includes('发行价格') && /^[0-9.]+$/.test(nextLine)) {
            return nextLine;
          }
        }

        return null;
      });

      // 调试：记录爬取结果
      if (priceData) {
        console.log(`[下载 Excel] 详情页爬取成功 [${i + 1}/${allItems.length}]: ${item.issue_name} = ${priceData}`);
      }

      await detailPage.close();

      if (priceData) {
        item.price = priceData;
        detailCount++;
      }

      // 随机延迟 200-500ms，模拟真人行为
      const randomDelay = Math.floor(Math.random() * 300) + 200;
      await new Promise(resolve => setTimeout(resolve, randomDelay));

    } catch (e) {
      errorCount++;
      console.log(`[下载 Excel] 爬取详情页失败 [${i + 1}/${allItems.length}]：${item.issue_name}`, e.message);
    }
  }

  console.log(`[下载 Excel] 成功获取 ${detailCount} 条发行价格数据`);
  console.log(`[下载 Excel] bondDefinedCode 为空的记录数：${emptyCodeCount}/${allItems.length}`);
  console.log(`[下载 Excel] 详情页爬取错误数：${errorCount}/${allItems.length}`);

  if (allItems.length === 0) {
    throw new Error('未找到存单数据，网站可能需要登录');
  }

  // 生成 Excel
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('存单价格');

  worksheet.columns = [
    { header: '存单代码', key: 'issue_code', width: 15 },
    { header: '存单简称', key: 'issue_name', width: 25 },
    { header: '发行日期', key: 'issue_date', width: 12 },
    { header: '期限', key: 'tenor', width: 10 },
    { header: '参考收益率', key: 'ref_yield', width: 12 },
    { header: '计划发行量', key: 'volume', width: 12 },
    { header: '评级', key: 'rating', width: 10 },
    { header: '发行净价', key: 'price', width: 10 }
  ];

  allItems.forEach(item => worksheet.addRow(item));

  const buffer = await workbook.xlsx.writeBuffer();
  console.log('[下载 Excel] 生成 Excel 缓冲，大小:', buffer.length);
  return await parseExcelFile(buffer);
}

/**
 * 从 Excel 解析数据 - 智能列映射
 */
export async function parseExcelFile(buffer) {
  // 使用 exceljs 解析 Excel
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet(1);

  // 读取表头，建立列名到列索引的映射
  const headerRow = worksheet.getRow(1);
  const columnMap = {};
  const usedColumns = new Set();  // 避免重复映射

  // 更精确的映射规则 - 按优先级匹配
  const mappingRules = [
    { field: 'issue_code', keywords: ['存单代码', '代码', '债券代码', '证券代码'], exact: ['代码'] },
    { field: 'issue_name', keywords: ['存单简称', '简称', '债券简称', '证券简称', '名称'], exact: ['简称'] },
    { field: 'issue_date', keywords: ['发行日期', '起息日期', '发行日', '起息日', '日期'], exact: ['发行日期'] },
    { field: 'tenor', keywords: ['期限', '存续期限', '久期'], exact: ['期限'] },
    { field: 'ref_yield', keywords: ['参考收益率', '收益率', '票面利率', '利率', '票息'], exact: ['参考收益率', '收益率'] },
    { field: 'volume', keywords: ['发行量', '计划发行量', '发行金额', '总量', '量'], exact: ['发行量'] },
    { field: 'rating', keywords: ['评级', '主体评级', '债项评级', '信用等级'], exact: ['评级'] },
    { field: 'price', keywords: ['发行价格', '价格', '净价', '全价', '单价'], exact: ['发行价格', '价格'] },
    { field: 'bank_name', keywords: ['银行名称', '银行', '发行人', '发行银行'], exact: ['银行名称'] }
  ];

  headerRow.eachCell((cell, colNumber) => {
    const headerName = cell.text.trim();
    if (!headerName || usedColumns.has(colNumber)) return;

    // 遍历映射规则
    for (const rule of mappingRules) {
      // 检查是否需要排除
      if (rule.exclude && rule.exclude.some(ex => headerName.includes(ex))) {
        continue;
      }

      // 精确匹配优先
      if (rule.exact && rule.exact.includes(headerName)) {
        columnMap[rule.field] = colNumber;
        usedColumns.add(colNumber);
        break;
      }

      // 关键词匹配
      if (rule.keywords && rule.keywords.some(kw => headerName.includes(kw))) {
        // 确保该列还没有被映射
        if (!columnMap[rule.field]) {
          columnMap[rule.field] = colNumber;
          usedColumns.add(colNumber);
          break;
        }
      }
    }
  });

  console.log('[Excel 导入] 表头内容:', Array.from({ length: headerRow.cellCount }, (_, i) => headerRow.getCell(i + 1).text).filter(Boolean));
  console.log('[Excel 导入] 列映射:', columnMap);

  const prices = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // 跳过表头

    const getText = (fieldName) => {
      const colNum = columnMap[fieldName];
      if (!colNum) return '';
      const cell = row.getCell(colNum);
      // 尝试多种获取值的方式
      return cell.text || cell.value?.toString() || '';
    };

    const rawDate = getText('issue_date');
    // 日期格式转换：2026/03/30 -> 2026-03-30
    const issueDate = rawDate.replace(/\//g, '-');

    const price = {
      id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      issue_code: getText('issue_code'),
      issue_name: getText('issue_name'),
      issue_date: issueDate,
      tenor: getText('tenor'),
      ref_yield: getText('ref_yield'),
      volume: getText('volume'),
      rating: getText('rating'),
      price: getText('price') || '',
      bank_name: getText('bank_name') || extractBankName(getText('issue_name')),
      created_at: Date.now(),
      updated_at: Date.now()
    };

    prices.push(price);
  });

  console.log('[Excel 导入] 解析到', prices.length, '条数据');
  // 调试：输出前 3 条数据的价格字段
  prices.slice(0, 3).forEach((p, i) => {
    console.log(`[Excel 导入] 样例数据 ${i+1}: issue_name=${p.issue_name}, price=${p.price}, ref_yield=${p.ref_yield}`);
  });
  return prices;
}

/**
 * 保存爬取结果到数据库
 */
export function savePrices(prices) {
  for (const price of prices) {
    // 如果没有 issue_code，使用 issue_name + issue_date 生成
    if (!price.issue_code) {
      price.issue_code = `${price.issue_name}_${price.issue_date}`.replace(/\s/g, '');
    }
    insertDailyPrice(price);
  }
  return prices;
}
