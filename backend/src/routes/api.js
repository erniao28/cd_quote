import express from 'express';
import {
  getAllPrices,
  getPricesByDate,
  getLatestPrices,
  getUserConfig,
  saveUserConfig,
  getCrawlHistory,
  getTempQuotes,
  saveTempQuotes,
  deleteTempQuote,
  clearTempQuotes,
  confirmTempQuotes
} from '../database.js';
import { manualCrawl } from '../crawler/scheduler.js';
import { parseExcelFile, savePrices, extractBankName } from '../crawler/chinamoney.js';
import { formatDate, getNextWorkday, isWorkday } from '../crawler/holiday.js';

const router = express.Router();

// ========== 价格数据 API ==========

// 获取所有价格
router.get('/prices', (req, res) => {
  try {
    const prices = getAllPrices();
    res.json({ code: 200, data: prices, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 按日期获取价格
router.get('/prices/:date', (req, res) => {
  try {
    const prices = getPricesByDate(req.params.date);
    res.json({ code: 200, data: prices, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取最新价格
router.get('/prices/latest', (req, res) => {
  try {
    const prices = getLatestPrices();
    res.json({ code: 200, data: prices, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ========== 爬取控制 API ==========

// 手动触发爬取
router.post('/crawl', async (req, res) => {
  try {
    const { targetDate } = req.body;
    const result = await manualCrawl(targetDate);

    if (result.success) {
      res.json({ code: 200, data: result, message: 'success' });
    } else {
      res.status(500).json({ code: 500, message: result.message });
    }
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取爬取历史
router.get('/crawl-history', (req, res) => {
  try {
    const history = getCrawlHistory();
    res.json({ code: 200, data: history, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ========== Excel 上传解析 ==========

router.post('/upload-excel', async (req, res) => {
  try {
    const { excelData } = req.body;  // base64 编码的 Excel 数据
    const buffer = Buffer.from(excelData, 'base64');

    const prices = await parseExcelFile(buffer);
    savePrices(prices);

    res.json({ code: 200, data: { count: prices.length }, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ========== Excel 导出 ==========

// 导出正式数据
router.get('/export-excel/:date', async (req, res) => {
  try {
    const { date } = req.params;

    // 验证日期格式
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ code: 400, message: '日期格式不正确，应为 YYYY-MM-DD' });
    }

    console.log(`[导出 Excel] 请求日期：${date}`);

    const prices = getPricesByDate(date);
    console.log(`[导出 Excel] 查询到 ${prices.length} 条数据`);

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('存单价格');

    // 设置表头
    worksheet.columns = [
      { header: '存单代码', key: 'issue_code', width: 15 },
      { header: '存单简称', key: 'issue_name', width: 20 },
      { header: '发行日期', key: 'issue_date', width: 12 },
      { header: '期限', key: 'tenor', width: 10 },
      { header: '发行价格', key: 'price', width: 10 },
      { header: '参考收益率', key: 'ref_yield', width: 12 },
      { header: '计划发行量', key: 'volume', width: 12 },
      { header: '评级', key: 'rating', width: 10 },
      { header: '银行名称', key: 'bank_name', width: 15 }
    ];

    // 添加数据（如果没有数据，只导出表头）
    if (prices && prices.length > 0) {
      prices.forEach(price => {
        worksheet.addRow({
          issue_code: price.issue_code || '',
          issue_name: price.issue_name || '',
          issue_date: price.issue_date || '',
          tenor: price.tenor || '',
          price: price.price || '',
          ref_yield: price.ref_yield || '',
          volume: price.volume || '',
          rating: price.rating || '',
          bank_name: price.bank_name || ''
        });
      });
    }

    // 生成 buffer
    const buffer = await workbook.xlsx.writeBuffer();
    console.log(`[导出 Excel] 生成成功，大小：${buffer.length} bytes`);

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="cd_quote_${date}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('[导出 Excel] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 导出临时报价（在线编辑后的数据）
router.get('/export-temp-excel', async (req, res) => {
  try {
    const { date } = req.query;

    console.log(`[导出临时 Excel] 请求日期：${date}`);

    const prices = getTempQuotes();
    console.log(`[导出临时 Excel] 查询到 ${prices.length} 条数据`);

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('存单价格');

    // 设置表头
    worksheet.columns = [
      { header: '存单代码', key: 'issue_code', width: 15 },
      { header: '存单简称', key: 'issue_name', width: 20 },
      { header: '发行日期', key: 'issue_date', width: 12 },
      { header: '期限', key: 'tenor', width: 10 },
      { header: '发行价格', key: 'price', width: 10 },
      { header: '参考收益率', key: 'ref_yield', width: 12 },
      { header: '计划发行量', key: 'volume', width: 12 },
      { header: '评级', key: 'rating', width: 10 },
      { header: '银行名称', key: 'bank_name', width: 15 }
    ];

    // 添加数据
    if (prices && prices.length > 0) {
      prices.forEach(price => {
        worksheet.addRow({
          issue_code: price.issue_code || '',
          issue_name: price.issue_name || '',
          issue_date: price.issue_date || date || '',
          tenor: price.tenor || '',
          price: price.price || '',
          ref_yield: price.ref_yield || '',
          volume: price.volume || '',
          rating: price.rating || '',
          bank_name: price.bank_name || ''
        });
      });
    }

    // 生成 buffer
    const buffer = await workbook.xlsx.writeBuffer();
    console.log(`[导出临时 Excel] 生成成功，大小：${buffer.length} bytes`);

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="cd_quote_temp_${date || 'draft'}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('[导出临时 Excel] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ========== 用户配置 API ==========

router.get('/config', (req, res) => {
  try {
    const config = getUserConfig();
    res.json({ code: 200, data: config || {}, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

router.post('/config', (req, res) => {
  try {
    const config = req.body;
    saveUserConfig(config);
    res.json({ code: 200, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ========== 工具 API ==========

// 获取下一个工作日
router.get('/next-workday', (req, res) => {
  try {
    const { date, days } = req.query;
    const startDate = date || formatDate(new Date());
    const nextDay = getNextWorkday(startDate, parseInt(days) || 1);
    res.json({ code: 200, data: { date: nextDay }, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 检查是否是工作日
router.get('/is-workday', (req, res) => {
  try {
    const { date } = req.query;
    const workday = isWorkday(date);
    res.json({ code: 200, data: { isWorkday: workday }, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 银行名称匹配
router.post('/match-bank', (req, res) => {
  try {
    const { name } = req.body;
    const bankName = extractBankName(name);
    res.json({ code: 200, data: { bankName }, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ========== 临时报价管理（所有用户共享） ==========

// 获取临时报价
router.get('/temp-quotes', (req, res) => {
  try {
    const quotes = getTempQuotes();
    res.json({ code: 200, data: quotes, message: 'success' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 保存临时报价（覆盖所有现有数据）
router.post('/temp-quotes', async (req, res) => {
  try {
    const { quotes } = req.body;  // 报价数组

    if (!quotes || !Array.isArray(quotes)) {
      return res.status(400).json({ code: 400, message: '数据格式不正确' });
    }

    saveTempQuotes(quotes);
    res.json({ code: 200, data: { count: quotes.length }, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除单条临时报价
router.delete('/temp-quotes/:id', (req, res) => {
  try {
    const { id } = req.params;
    deleteTempQuote(id);
    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 清空所有临时报价
router.delete('/temp-quotes', (req, res) => {
  try {
    clearTempQuotes();
    res.json({ code: 200, message: '清空成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 确认临时报价（转入正式表）
router.post('/temp-quotes/confirm', (req, res) => {
  try {
    const count = confirmTempQuotes();
    res.json({ code: 200, data: { count }, message: `已确认 ${count} 条报价` });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
