// 后端 API 服务 - 生产环境配置

// 自动获取当前页面域名，适配本地和服务器部署
const API_HOST = window.location.hostname;
const API_PORT = 3001;  // 后端端口固定

// 本地开发用 HTTP，生产环境自动用 HTTPS
const API_BASE = `${window.location.protocol}//${API_HOST}:${API_PORT}/api`;

// ========== 价格数据 API ==========

export async function fetchPrices(date?: string) {
  const url = date ? `${API_BASE}/prices/${date}` : `${API_BASE}/prices`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('获取价格失败');
  return res.json();
}

export async function fetchLatestPrices() {
  const res = await fetch(`${API_BASE}/prices/latest`);
  if (!res.ok) throw new Error('获取最新价格失败');
  return res.json();
}

// ========== 爬取控制 API ==========

export async function triggerCrawl(targetDate?: string) {
  const res = await fetch(`${API_BASE}/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetDate })
  });
  if (!res.ok) throw new Error('触发爬取失败');
  return res.json();
}

export async function fetchCrawlHistory() {
  const res = await fetch(`${API_BASE}/crawl-history`);
  if (!res.ok) throw new Error('获取爬取历史失败');
  return res.json();
}

// ========== Excel 上传 ==========

export async function uploadExcel(excelData: string) {
  const res = await fetch(`${API_BASE}/upload-excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ excelData })
  });
  if (!res.ok) throw new Error('上传 Excel 失败');
  return res.json();
}

// ========== 用户配置 ==========

export async function fetchConfig() {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error('获取配置失败');
  return res.json();
}

export async function saveConfig(config: object) {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error('保存配置失败');
  return res.json();
}

// ========== 工具 API ==========

export async function getNextWorkday(date?: string, days: number = 1) {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  params.append('days', days.toString());

  const res = await fetch(`${API_BASE}/next-workday?${params}`);
  if (!res.ok) throw new Error('获取工作日失败');
  return res.json();
}

export async function checkIsWorkday(date: string) {
  const res = await fetch(`${API_BASE}/is-workday?date=${date}`);
  if (!res.ok) throw new Error('检查工作日失败');
  return res.json();
}

export async function matchBankName(name: string) {
  const res = await fetch(`${API_BASE}/match-bank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('匹配银行名称失败');
  return res.json();
}
