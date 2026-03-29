// 用户输入解析工具 - 规则匹配方案

// ========== 银行名称映射表 ==========
const BANK_MAP: Record<string, string[]> = {
  // 国有大行
  '工商银行': ['工商银行', '工行', 'ICBC', '宇宙行'],
  '农业银行': ['农业银行', '农行', 'ABC'],
  '中国银行': ['中国银行', '中行', 'BOC'],
  '建设银行': ['建设银行', '建行', 'CCB'],
  '交通银行': ['交通银行', '交行', 'BOCOM'],
  '邮储银行': ['邮储银行', '邮储', 'PSBC'],

  // 股份制银行
  '招商银行': ['招商银行', '招行', 'CMB'],
  '浦发银行': ['浦发银行', '浦发', 'SPDB'],
  '中信银行': ['中信银行', '中信', 'CITIC'],
  '光大银行': ['光大银行', '光大', 'CEB'],
  '民生银行': ['民生银行', '民生', 'CMBC'],
  '兴业银行': ['兴业银行', '兴业', 'CIB'],
  '平安银行': ['平安银行', '平安', 'PAB'],
  '华夏银行': ['华夏银行', '华夏', 'HXB'],
  '浙商银行': ['浙商银行', '浙商', 'CZBank'],
  '渤海银行': ['渤海银行', '渤海', 'CBHB'],
  '恒丰银行': ['恒丰银行', '恒丰', 'HFBank'],

  // 城商行
  '北京银行': ['北京银行', '北京', 'BHB'],
  '上海银行': ['上海银行', '上海', 'BOS'],
  '江苏银行': ['江苏银行', '江苏', 'JSB'],
  '南京银行': ['南京银行', '南京', 'NJB'],
  '宁波银行': ['宁波银行', '宁波', 'NBB'],
  '杭州银行': ['杭州银行', '杭州', 'HZB'],
  '长沙银行': ['长沙银行', '长沙', 'CSB'],
  '成都银行': ['成都银行', '成都', 'CDB'],
  '重庆银行': ['重庆银行', '重庆', 'CQB'],
  '西安银行': ['西安银行', '西安', 'XAB'],
  '青岛银行': ['青岛银行', '青岛', 'QDB'],
  '郑州银行': ['郑州银行', '郑州', 'ZZB'],
  '贵阳银行': ['贵阳银行', '贵阳', 'GYB'],
  '苏州银行': ['苏州银行', '苏州', 'SZB'],
  '齐鲁银行': ['齐鲁银行', '齐鲁', 'QLB'],
};

// ========== 期限映射表 ==========
const TENOR_MAP: Record<string, string> = {
  // 月度表示法
  '1M': '1M', '1 个月': '1M', '一月': '1M', '1 月': '1M',
  '2M': '2M', '2 个月': '2M', '二月': '2M', '2 月': '2M',
  '3M': '3M', '3 个月': '3M', '三月': '3M', '3 月': '3M',
  '4M': '4M', '4 个月': '4M', '四月': '4M', '4 月': '4M',
  '5M': '5M', '5 个月': '5M', '五月': '5M', '5 月': '5M',
  '6M': '6M', '6 个月': '6M', '半年': '6M', '六月': '6M', '6 月': '6M',
  '7M': '7M', '7 个月': '7M', '七月': '7M', '7 月': '7M',
  '8M': '8M', '8 个月': '8M', '八月': '8M', '8 月': '8M',
  '9M': '9M', '9 个月': '9M', '九月': '9M', '9 月': '9M',
  '10M': '10M', '10 个月': '10M', '十月': '10M', '10 月': '10M',
  '11M': '11M', '11 个月': '11M', '十一月': '11M', '11 月': '11M',
  '12M': '12M', '12 个月': '12M', '十二月': '12M', '12 月': '12M',

  // 天数表示法
  '30': '1M', '30 天': '1M',
  '60': '2M', '60 天': '2M',
  '90': '3M', '90 天': '3M', '一季': '3M', '季度': '3M',
  '120': '4M', '120 天': '4M',
  '150': '5M', '150 天': '5M',
  '180': '6M', '180 天': '6M',
  '210': '7M', '210 天': '7M',
  '240': '8M', '240 天': '8M',
  '270': '9M', '270 天': '9M',
  '300': '10M', '300 天': '10M',
  '330': '11M', '330 天': '11M',
  '365': '1Y', '365 天': '1Y', '360': '1Y', '360 天': '1Y',

  // 年表示法
  '1Y': '1Y', '1 年': '1Y', '一年': '1Y',
  '2Y': '2Y', '2 年': '2Y', '两年': '2Y',
};

// ========== 评级映射表 ==========
const RATING_MAP: Record<string, string> = {
  'AAA': ['AAA', 'aaa', 'Aaa', '3A'],
  'AA+': ['AA+', 'aa+', 'Aa+', 'AA 加', 'AA 正'],
  'AA': ['AA', 'aa', 'Aa', '2A'],
  'AA-': ['AA-', 'aa-', 'Aa-', 'AA 减', 'AA 负'],
  'A+': ['A+', 'a+', 'A 加', 'A 正'],
  'A': ['A', 'a'],
  'A-': ['A-', 'a-', 'A 减', 'A 负'],
};

/**
 * 匹配银行名称
 */
export function matchBankName(input: string): string | null {
  const trimmed = input.trim();

  for (const [bankName, aliases] of Object.entries(BANK_MAP)) {
    // 完全匹配
    if (aliases.includes(trimmed)) {
      return bankName;
    }
    // 包含匹配
    if (trimmed.includes(bankName) || bankName.includes(trimmed)) {
      return bankName;
    }
    // 别名匹配
    for (const alias of aliases) {
      if (trimmed.includes(alias)) {
        return bankName;
      }
    }
  }

  return null;
}

/**
 * 标准化期限
 */
export function normalizeTenor(input: string): string | null {
  const trimmed = input.trim().toUpperCase();

  // 直接匹配
  if (TENOR_MAP[trimmed]) {
    return TENOR_MAP[trimmed];
  }

  // 正则匹配数字 + 单位
  const match = trimmed.match(/^(\d+)(M|D|Y|个月 | 天|年)?$/i);
  if (match) {
    const num = parseInt(match[1]);
    const unit = (match[2] || '').toUpperCase();

    // 按天数转换
    if (unit === 'D' || unit.includes('天')) {
      if (num <= 35) return '1M';
      if (num <= 65) return '2M';
      if (num <= 95) return '3M';
      if (num <= 125) return '4M';
      if (num <= 155) return '5M';
      if (num <= 185) return '6M';
      if (num <= 215) return '7M';
      if (num <= 245) return '8M';
      if (num <= 275) return '9M';
      if (num <= 305) return '10M';
      if (num <= 335) return '11M';
      return '1Y';
    }

    // 按月份转换
    if (unit === 'M' || unit.includes('月')) {
      if (num === 1) return '1M';
      if (num === 2) return '2M';
      if (num === 3) return '3M';
      if (num === 4) return '4M';
      if (num === 5) return '5M';
      if (num === 6) return '6M';
      if (num === 7) return '7M';
      if (num === 8) return '8M';
      if (num === 9) return '9M';
      if (num === 10) return '10M';
      if (num === 11) return '11M';
      if (num === 12) return '12M';
      return `${num}M`;
    }

    // 按年转换
    if (unit === 'Y' || unit.includes('年')) {
      return num === 1 ? '1Y' : `${num}Y`;
    }
  }

  return null;
}

/**
 * 标准化金额
 * 输入：6, 6 亿，6e, 6 亿元，60000 万 → 输出：6e
 */
export function normalizeVolume(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  // 提取数字
  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  let num = parseFloat(match[1]);

  // 判断单位
  if (trimmed.includes('万')) {
    // 60000 万 = 6 亿
    num = num / 10000;
  } else if (trimmed.includes('亿')) {
    // 已经是亿
  } else if (trimmed.includes('e')) {
    // 6e = 6 亿
  }
  // 纯数字默认是亿

  return `${num}e`;
}

/**
 * 标准化评级
 */
export function normalizeRating(input: string): string | null {
  const trimmed = input.trim();

  for (const [rating, aliases] of Object.entries(RATING_MAP)) {
    if (aliases.includes(trimmed) || trimmed.includes(rating)) {
      return rating;
    }
  }

  // 默认返回 AAA（存单大部分是 AAA）
  if (trimmed === '' || trimmed === '-') {
    return 'AAA';
  }

  return null;
}

/**
 * 解析单行输入
 * 格式：银行名称 评级 期限 收益率 量
 * 例：兴业银行 AAA 6M 1.62% 5 亿
 */
export interface ParsedLine {
  bankName?: string;
  rating?: string;
  tenor?: string;
  yield?: string;
  volume?: string;
  weekday?: string;
  raw: string;
  matched: boolean;
  issues: string[];  // 解析问题列表
  // 匹配到的完整数据字段（用于输出标准格式）
  issueCode?: string;
  issueName?: string;
  issueDate?: string;
  price?: string;
  refYield?: string;
  // 内部字段（匹配弹窗使用）
  _matches?: any[];
}

export function parseLine(input: string): ParsedLine {
  const result: ParsedLine = {
    raw: input,
    matched: false,
    issues: []
  };

  const parts = input.trim().split(/[\s,，、]+/).filter(Boolean);

  for (const part of parts) {
    // 尝试匹配银行
    if (!result.bankName) {
      const bank = matchBankName(part);
      if (bank) {
        result.bankName = bank;
        result.matched = true;

        // 检查是否银行名和期限/量连在一起（如"中信 1Y"、"浦发一年"、"浦发一年 5e"、"中信 360"）
        // 先提取银行名，然后递归解析剩余部分
        // 期限匹配模式：1Y/2Y/3Y、1M/2M/3M、一年/两年、360 天、270 天、180 天、90 天、30 天、或纯数字 (30/60/90/180/270/360)
        const bankMatch = part.match(/^(.+?)(\d+[YM]|一 |1[年 Y]|2[年 Y]|3[年 Y]|个月 | 个月 | 天|\d+[eE]|亿|(?:360|270|180|90|60|30)(?:天 |D)?)$/i);
        if (bankMatch) {
          const remainder = part.substring(bankMatch[1].length);
          // 递归解析剩余部分（期限和量）
          const remainderResult = parseLine(remainder);
          if (remainderResult.tenor) {
            result.tenor = remainderResult.tenor;
          }
          if (remainderResult.volume) {
            result.volume = remainderResult.volume;
          }
          if (remainderResult.yield) {
            result.yield = remainderResult.yield;
          }
        }
        continue;
      }
    }

    // 尝试匹配评级
    if (!result.rating) {
      const rating = normalizeRating(part);
      if (rating) {
        result.rating = rating;
        continue;
      }
    }

    // 尝试匹配期限
    if (!result.tenor) {
      const tenor = normalizeTenor(part);
      if (tenor) {
        result.tenor = tenor;
        result.matched = true;
        continue;
      }
    }

    // 尝试匹配量（带 e/亿/亿元的数字）- 优先级高于收益率
    if (!result.volume && /[0-9]/.test(part)) {
      // 检查是否是量的格式：数字+e 或 数字 + 亿
      if (part.toLowerCase().includes("e") || part.includes("亿") || part.includes("亿元")) {
        const volume = normalizeVolume(part);
        if (volume) {
          result.volume = volume;
          continue;
        }
      }
    }

    // 尝试匹配收益率（数字 +%）- 必须有%符号
    if (!result.yield && /[\d.]+%/.test(part)) {
      const yieldMatch = part.match(/([\d.]+)%/);
      if (yieldMatch) {
        result.yield = `${yieldMatch[1]}%`;
        continue;
      }
    }

    // 尝试匹配 weekday
    if (!result.weekday && /[周一二三四五六日]/.test(part)) {
      result.weekday = part;
      continue;
    }
  }

  // 检查必填字段
  if (!result.bankName) {
    result.issues.push("未识别银行名称");
  }
  if (!result.tenor) {
    result.issues.push("未识别期限");
  }

  return result;
}

/**
 * 批量解析输入
 */
export function parseBatchInput(input: string): ParsedLine[] {
  const lines = input.split('\n').filter(line => line.trim());
  return lines.map(line => parseLine(line));
}

/**
 * 格式化输出
 */
export interface OutputFormat {
  fields: ('code' | 'name' | 'volume' | 'netPrice' | 'yield' | 'date')[];
  order: string[];  // 排序
  dateFormat: 'issueDate+2' | 'fixed';
  volumeFormat: 'e' | '亿元';
}

export function formatOutput(
  items: ParsedLine[],
  format: OutputFormat
): string {
  return items.map(item => {
    const parts: string[] = [];

    if (item.bankName) parts.push(item.bankName);
    if (item.rating) parts.push(item.rating);
    if (item.tenor) parts.push(item.tenor);
    if (item.yield) parts.push(item.yield);
    if (item.volume) parts.push(item.volume);
    if (item.weekday) parts.push(item.weekday);

    return parts.join(' ');
  }).join('\n');
}
