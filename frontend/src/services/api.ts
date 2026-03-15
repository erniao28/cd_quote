// 本地开发用 localhost:3002（根路径），生产环境通过 Nginx /auto-quote-api 路径访问
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isDev
  ? `http://localhost:3002`
  : `/auto-quote-api`;

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

// ========== Excel 导出 ==========

export async function exportExcel(date: string) {
  const url = `${API_BASE}/export-excel/${date}`;
  const res = await fetch(url);

  // 尝试获取错误详情
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: '导出 Excel 失败' }));
    throw new Error(errorData.message || '导出 Excel 失败');
  }

  return res.blob();
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

// ========== 临时报价管理（在线编辑） ==========

// 获取临时报价
export async function fetchTempQuotes() {
  const res = await fetch(`${API_BASE}/temp-quotes`);
  if (!res.ok) throw new Error('获取临时报价失败');
  return res.json();
}

// 保存临时报价
export async function saveTempQuotes(quotes: any[]) {
  const res = await fetch(`${API_BASE}/temp-quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quotes })
  });
  if (!res.ok) throw new Error('保存临时报价失败');
  return res.json();
}

// 删除单条临时报价
export async function deleteTempQuote(id: string) {
  const res = await fetch(`${API_BASE}/temp-quotes/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('删除临时报价失败');
  return res.json();
}

// 清空所有临时报价
export async function clearTempQuotes() {
  const res = await fetch(`${API_BASE}/temp-quotes`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('清空临时报价失败');
  return res.json();
}

// 确认临时报价（转入正式表）
export async function confirmTempQuotes() {
  const res = await fetch(`${API_BASE}/temp-quotes/confirm`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('确认临时报价失败');
  return res.json();
}

// 导出临时报价 Excel
export async function exportTempExcel(date?: string) {
  const url = date ? `${API_BASE}/export-temp-excel?date=${date}` : `${API_BASE}/export-temp-excel`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('导出临时 Excel 失败');
  return res.blob();
}
