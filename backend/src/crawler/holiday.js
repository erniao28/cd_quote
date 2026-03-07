// 节假日和工作日判断工具

// 2025-2026 年节假日安排（需要手动维护或接入 API）
// 格式：'YYYY-MM-DD': 'holiday' 或 'workday'
const HOLIDAYS = {
  // 2025 年节假日
  '2025-01-01': 'holiday',  // 元旦
  '2025-01-28': 'holiday',  // 春节
  '2025-01-29': 'holiday',
  '2025-01-30': 'holiday',
  '2025-01-31': 'holiday',
  '2025-02-01': 'holiday',
  '2025-02-02': 'holiday',
  '2025-02-03': 'holiday',
  '2025-02-04': 'holiday',
  '2025-04-04': 'holiday',   // 清明
  '2025-05-01': 'holiday',   // 劳动节
  '2025-05-02': 'holiday',
  '2025-05-03': 'holiday',
  '2025-05-04': 'holiday',
  '2025-05-05': 'holiday',
  '2025-06-02': 'holiday',   // 端午
  '2025-10-01': 'holiday',   // 国庆
  '2025-10-02': 'holiday',
  '2025-10-03': 'holiday',
  '2025-10-04': 'holiday',
  '2025-10-05': 'holiday',
  '2025-10-06': 'holiday',
  '2025-10-07': 'holiday',
  '2025-10-08': 'holiday',
};

// 调休工作日（周末但需要上班）
const WORKDAY_ADJUSTMENTS = {
  '2025-01-26': 'workday',  // 周日上班
  '2025-02-08': 'workday',  // 周六上班
  '2025-04-27': 'workday',  // 周日上班
  '2025-09-28': 'workday',  // 周日上班
  '2025-10-11': 'workday',  // 周六上班
};

/**
 * 判断是否是工作日
 * @param {string} dateStr - 日期字符串 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isWorkday(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();

  // 检查特殊调整
  if (WORKDAY_ADJUSTMENTS[dateStr] === 'workday') {
    return true;
  }
  if (HOLIDAYS[dateStr] === 'holiday') {
    return false;
  }

  // 周六日休息
  return day !== 0 && day !== 6;
}

/**
 * 获取下一个工作日
 * @param {string} startDate - 起始日期 'YYYY-MM-DD'
 * @param {number} days - 往后推几天
 * @returns {string} 'YYYY-MM-DD'
 */
export function getNextWorkday(startDate, days = 1) {
  const date = new Date(startDate);
  let count = 0;

  while (count < days) {
    date.setDate(date.getDate() + 1);
    const dateStr = formatDate(date);
    if (isWorkday(dateStr)) {
      count++;
    }
  }

  return formatDate(date);
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 解析日期字符串
 */
export function parseDate(str) {
  // 支持多种格式：2025-01-15, 2025/01/15, 01/15/2025
  const formats = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{4})\/(\d{2})\/(\d{2})/,
    /(\d{2})\/(\d{2})\/(\d{4})/
  ];

  for (const regex of formats) {
    const match = str.match(regex);
    if (match) {
      if (regex.source.includes('YYYY')) {
        return new Date(`${match[1]}-${match[2]}-${match[3]}`);
      }
      return new Date(`${match[1]}-${match[2]}-${match[3]}`);
    }
  }

  return new Date(str);
}
