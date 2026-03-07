// 数据类型定义

export interface DailyPrice {
  id: string;
  issue_code: string;      // 存单代码
  issue_name: string;      // 存单简称
  issue_date: string;      // 发行日期
  tenor: string;           // 期限
  ref_yield: string;       // 参考收益率
  volume: string;          // 计划发行量
  rating: string;          // 主体评级
  price: string;           // 发行价格（元）
  bank_name: string;       // 银行名称
  created_at: number;
  updated_at: number;
}

export interface CrawlHistory {
  id: string;
  crawl_date: string;
  target_date: string;
  status: string;
  count: number;
  created_at: number;
}

export interface UserConfig {
  id: string;
  output_format: string;
  date_format: string;
}

// 用户输入解析后的结果
export interface ParsedInput {
  bankName: string;
  tenor: string;
  volume: string;
  originalText: string;
  matched?: boolean;
}

// 输出格式配置
export interface OutputFormat {
  fields: string[];
  order: string[];
  dateFormat: string;
  volumeFormat: 'e' | '亿元' | '万';
}
