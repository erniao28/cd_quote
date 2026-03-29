// 测试货币网爬虫
import puppeteer from 'puppeteer';

const LIST_URL = 'https://www.chinamoney.com.cn/chinese/tycdfxxx/?issueStType=1';

async function test() {
  console.log('启动浏览器...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('访问页面...');
  await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 截图
  await page.screenshot({ path: '/tmp/chinamoney_test.png', fullPage: false });
  console.log('已保存截图到 /tmp/chinamoney_test.png');

  // 获取页面内容
  const content = await page.content();
  console.log('页面内容长度:', content.length);

  // 查找表格
  const tableInfo = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const rows = document.querySelectorAll('table tbody tr');
    const mTables = document.querySelectorAll('.m-table tbody tr');
    const dataTables = document.querySelectorAll('.data-table tbody tr');

    return {
      tableCount: tables.length,
      rowCount: rows.length,
      mTableCount: mTables.length,
      dataTableCount: dataTables.length,
      firstTableHtml: tables[0]?.outerHTML?.substring(0, 500) || 'none'
    };
  });

  console.log('表格信息:', JSON.stringify(tableInfo, null, 2));

  // 获取所有行数据
  const rowsInfo = await page.evaluate(() => {
    const allRows = document.querySelectorAll('tr');
    const result = [];
    allRows.forEach((row, idx) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 8) {
        const rowData = [];
        for (let i = 0; i < Math.min(10, cells.length); i++) {
          rowData.push(cells[i]?.textContent?.trim() || '');
        }
        result.push({
          idx,
          cells: rowData
        });
      }
    });
    return result.slice(0, 5);
  });

  console.log('前 5 行完整数据:');
  console.log('列：[0] 存单代码 [1] 存单简称 [2] 发行日期 [3] 发行方式 [4] 期限 [5] 息票类型 [6] 票面利率 [7] 参考收益率 [8] 计划发行量 [9] 评级');
  rowsInfo.forEach(row => {
    console.log(`行${row.idx}:`, row.cells.join(' | '));
  });

  await browser.close();
  console.log('测试完成');
}

test().catch(console.error);
