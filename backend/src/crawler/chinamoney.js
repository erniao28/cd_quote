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
 * 使用 Puppeteer 爬取货币网数据
 */
export async function crawlChinamoney(targetDate) {
  console.log(`[爬虫] 开始爬取发行日期：${targetDate}`);

  let browser = null;
  try {
    // 启动浏览器
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 设置 User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 访问列表页
    console.log(`[爬虫] 访问：${LIST_URL}`);
    await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // 等待列表加载
    await page.waitForSelector('.m-table', { timeout: 10000 }).catch(() => {
      console.log('[爬虫] 未找到表格，可能需要登录或反爬');
    });

    // 获取所有存单链接
    const items = await page.evaluate(() => {
      const rows = document.querySelectorAll('.m-table tbody tr');
      const result = [];

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
          const issueName = cells[0]?.querySelector('a')?.textContent?.trim() || '';
          const link = cells[0]?.querySelector('a')?.href || '';
          const issueDate = cells[1]?.textContent?.trim() || '';
          const tenor = cells[2]?.textContent?.trim() || '';

          result.push({ issueName, link, issueDate, tenor });
        }
      });

      return result;
    });

    console.log(`[爬虫] 找到 ${items.length} 条记录`);

    // 遍历每个存单获取详情
    const prices = [];
    for (const item of items) {
      // 检查发行日期是否匹配
      if (targetDate && item.issueDate !== targetDate) {
        continue;
      }

      // 获取发行价格（需要点进详情页）
      let price = null;
      if (item.link) {
        try {
          await page.goto(item.link, { waitUntil: 'networkidle2', timeout: 10000 });

          // 查找发行价格
          const issuePrice = await page.evaluate(() => {
            const rows = document.querySelectorAll('.detail-row, .table-row, tr');
            for (const row of rows) {
              const text = row.textContent;
              if (text.includes('发行价格') || text.includes('发行价')) {
                const match = text.match(/[\d.]+/);
                return match ? match[0] : null;
              }
            }
            return null;
          });

          price = issuePrice;
          await page.goBack({ waitUntil: 'networkidle2' });
        } catch (err) {
          console.log(`[爬虫] 获取详情页失败：${item.link}`);
        }
      }

      const priceData = {
        id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        issue_code: '',  // 存单代码（从详情获取）
        issue_name: item.issueName,
        issue_date: item.issueDate,
        tenor: item.tenor,
        ref_yield: '',   // 参考收益率
        volume: '',      // 计划发行量
        rating: '',      // 主体评级
        price: price,
        bank_name: extractBankName(item.issueName),
        created_at: Date.now(),
        updated_at: Date.now()
      };

      prices.push(priceData);
    }

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
 * 从 Excel 解析数据（备用方案）
 */
export async function parseExcelFile(buffer) {
  // 使用 exceljs 解析 Excel
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet(1);

  const prices = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // 跳过表头

    const price = {
      id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      issue_code: row.getCell(1).text,
      issue_name: row.getCell(2).text,
      issue_date: row.getCell(3).text,
      tenor: row.getCell(4).text,
      ref_yield: row.getCell(5).text,
      volume: row.getCell(6).text,
      rating: row.getCell(7).text,
      price: '',  // Excel 中没有发行价格
      bank_name: extractBankName(row.getCell(2).text),
      created_at: Date.now(),
      updated_at: Date.now()
    };

    prices.push(price);
  });

  return prices;
}

/**
 * 保存爬取结果到数据库
 */
export function savePrices(prices) {
  for (const price of prices) {
    insertDailyPrice(price);
  }
  return prices;
}
