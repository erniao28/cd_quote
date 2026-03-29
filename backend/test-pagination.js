// 测试翻页功能
import puppeteer from 'puppeteer';

const LIST_URL = 'https://www.chinamoney.com.cn/chinese/tycdfxxx/?issueStType=1';

async function test() {
  console.log('启动浏览器...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('访问页面...');
  await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 查找翻页按钮
  const paginationInfo = await page.evaluate(() => {
    const result = {
      pagination: [],
      nextButton: null,
      pageLinks: []
    };

    // 查找翻页区域
    const paginationElements = document.querySelectorAll('.pagination, .pager, [class*="page"]');
    paginationElements.forEach((el, idx) => {
      result.pagination.push({
        idx,
        className: el.className,
        text: el.textContent?.substring(0, 100)
      });
    });

    // 查找下一页按钮
    const nextSelectors = [
      'a[title="下一页"]',
      'a[title="next"]',
      '.pagination a:last-child',
      '.pager a:last-child'
    ];

    for (const selector of nextSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        result.nextButton = {
          selector,
          text: el.textContent,
          href: el.href,
          onclick: el.getAttribute('onclick'),
          className: el.className
        };
        break;
      }
    }

    // 查找所有页码链接
    const pageLinks = document.querySelectorAll('.pagination a, .pager a');
    pageLinks.forEach((el, idx) => {
      result.pageLinks.push({
        idx,
        text: el.textContent?.trim(),
        href: el.href,
        onclick: el.getAttribute('onclick'),
        className: el.className
      });
    });

    return result;
  });

  console.log('翻页信息:', JSON.stringify(paginationInfo, null, 2));

  // 截图
  await page.screenshot({ path: '/tmp/pagination_test.png', fullPage: false });
  console.log('已保存截图');

  await browser.close();
  console.log('测试完成');
}

test().catch(console.error);
