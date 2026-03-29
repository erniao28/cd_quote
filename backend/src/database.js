import initSqlJs from 'sql.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/cd_quote.db');

let db = null;

export async function initDatabase() {
  const SQL = await initSqlJs();

  // 确保数据目录存在
  const dataDir = path.join(__dirname, '../data');
  await fs.mkdir(dataDir, { recursive: true });

  // 打开或创建数据库
  const dbBuffer = await fs.readFile(DB_PATH).catch(() => null);
  db = dbBuffer ? new SQL.Database(dbBuffer) : new SQL.Database();

  // 创建每日价格表
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_prices (
      id TEXT PRIMARY KEY,
      issue_code TEXT,           -- 存单代码
      issue_name TEXT,           -- 存单简称
      issue_date TEXT,           -- 发行日期
      tenor TEXT,                -- 期限
      ref_yield TEXT,            -- 参考收益率
      volume TEXT,               -- 计划发行量
      rating TEXT,               -- 主体评级
      price TEXT,                -- 发行价格（元）
      bank_name TEXT,            -- 银行名称（从简称提取）
      created_at INTEGER,
      updated_at INTEGER,
      UNIQUE(issue_code, issue_date)  -- 唯一约束：相同代码 + 日期自动覆盖
    )
  `);

  // 创建爬取历史表
  db.run(`
    CREATE TABLE IF NOT EXISTS crawl_history (
      id TEXT PRIMARY KEY,
      crawl_date TEXT,
      target_date TEXT,
      status TEXT,
      count INTEGER,
      created_at INTEGER
    )
  `);

  // 创建用户配置表
  db.run(`
    CREATE TABLE IF NOT EXISTS user_config (
      id TEXT PRIMARY KEY,
      output_format TEXT,
      date_format TEXT,
      created_at INTEGER
    )
  `);

  // 创建临时报价表（所有用户共享，只保留最新一份）
  db.run(`
    CREATE TABLE IF NOT EXISTS temp_quotes (
      id TEXT PRIMARY KEY,
      issue_code TEXT,           -- 存单代码
      issue_name TEXT,           -- 存单简称
      issue_date TEXT,           -- 发行日期
      tenor TEXT,                -- 期限
      ref_yield TEXT,            -- 参考收益率
      volume TEXT,               -- 计划发行量
      rating TEXT,               -- 主体评级
      price TEXT,                -- 发行价格（元）
      bank_name TEXT,            -- 银行名称
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  saveDatabase();
  console.log('[数据库] 初始化完成');
}

export function getDatabase() {
  return db;
}

export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFile(DB_PATH, buffer);
  }
}

// ========== 每日价格操作 ==========

export function insertDailyPrice(price) {
  // 使用 issue_code + issue_date 生成固定 ID，实现自动去重
  const uniqueId = `${price.issue_code || 'NO_CODE'}_${price.issue_date || 'NO_DATE'}`;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO daily_prices
    (id, issue_code, issue_name, issue_date, tenor, ref_yield, volume, rating, price, bank_name, created_at, updated_at)
    VALUES (@id, @issue_code, @issue_name, @issue_date, @tenor, @ref_yield, @volume, @rating, @price, @bank_name, @created_at, @updated_at)
  `);

  stmt.run({
    '@id': uniqueId,
    '@issue_code': price.issue_code,
    '@issue_name': price.issue_name,
    '@issue_date': price.issue_date,
    '@tenor': price.tenor,
    '@ref_yield': price.ref_yield,
    '@volume': price.volume,
    '@rating': price.rating,
    '@price': price.price,
    '@bank_name': price.bank_name,
    '@created_at': price.created_at || Date.now(),
    '@updated_at': Date.now()
  });

  stmt.free();
  saveDatabase();
}

export function getAllPrices() {
  const stmt = db.prepare('SELECT * FROM daily_prices ORDER BY issue_date DESC, issue_code');
  const results = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

export function getPricesByDate(date) {
  const stmt = db.prepare('SELECT * FROM daily_prices WHERE issue_date = ? ORDER BY issue_code');
  const results = [];

  stmt.bind([date]);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

// 删除指定日期的数据
export function deletePricesByDate(date) {
  const stmt = db.prepare('DELETE FROM daily_prices WHERE issue_date = ?');
  stmt.run([date]);
  stmt.free();
  saveDatabase();
}

export function getLatestPrices() {
  const stmt = db.prepare(`
    SELECT * FROM daily_prices
    WHERE issue_date = (SELECT MAX(issue_date) FROM daily_prices)
    ORDER BY issue_code
  `);
  const results = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

// ========== 爬取历史操作 ==========

export function insertCrawlHistory(history) {
  const stmt = db.prepare(`
    INSERT INTO crawl_history (id, crawl_date, target_date, status, count, created_at)
    VALUES (@id, @crawl_date, @target_date, @status, @count, @created_at)
  `);

  stmt.run({
    '@id': history.id,
    '@crawl_date': history.crawl_date,
    '@target_date': history.target_date,
    '@status': history.status,
    '@count': history.count,
    '@created_at': Date.now()
  });

  stmt.free();
  saveDatabase();
}

export function getCrawlHistory() {
  const stmt = db.prepare('SELECT * FROM crawl_history ORDER BY created_at DESC LIMIT 50');
  const results = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

// ========== 用户配置操作 ==========

export function getUserConfig() {
  const stmt = db.prepare('SELECT * FROM user_config LIMIT 1');
  let result = null;

  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();

  return result;
}

export function saveUserConfig(config) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO user_config (id, output_format, date_format, created_at)
    VALUES (@id, @output_format, @date_format, @created_at)
  `);

  stmt.run({
    '@id': 'default',
    '@output_format': config.output_format,
    '@date_format': config.date_format,
    '@created_at': Date.now()
  });

  stmt.free();
  saveDatabase();
}

// ========== 临时报价操作（所有用户共享） ==========

// 获取所有临时报价
export function getTempQuotes() {
  const stmt = db.prepare('SELECT * FROM temp_quotes ORDER BY issue_code');
  const results = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();

  return results;
}

// 保存/更新临时报价（覆盖所有现有数据，只保留最新一份）
export function saveTempQuotes(prices) {
  // 先清空现有临时数据
  db.run('DELETE FROM temp_quotes');

  // 批量插入新数据
  const stmt = db.prepare(`
    INSERT INTO temp_quotes
    (id, issue_code, issue_name, issue_date, tenor, ref_yield, volume, rating, price, bank_name, created_at, updated_at)
    VALUES (@id, @issue_code, @issue_name, @issue_date, @tenor, @ref_yield, @volume, @rating, @price, @bank_name, @created_at, @updated_at)
  `);

  const now = Date.now();
  prices.forEach(price => {
    stmt.run({
      '@id': price.id || `${price.issue_code}_${now}`,
      '@issue_code': price.issue_code,
      '@issue_name': price.issue_name,
      '@issue_date': price.issue_date,
      '@tenor': price.tenor,
      '@ref_yield': price.ref_yield,
      '@volume': price.volume,
      '@rating': price.rating,
      '@price': price.price,
      '@bank_name': price.bank_name,
      '@created_at': now,
      '@updated_at': now
    });
  });

  stmt.free();
  saveDatabase();
}

// 删除临时报价
export function deleteTempQuote(id) {
  const stmt = db.prepare('DELETE FROM temp_quotes WHERE id = ?');
  stmt.run([id]);
  stmt.free();
  saveDatabase();
}

// 清空所有临时报价
export function clearTempQuotes() {
  db.run('DELETE FROM temp_quotes');
  saveDatabase();
}

// 确认临时报价（转移到正式表）
export function confirmTempQuotes() {
  const tempQuotes = getTempQuotes();

  tempQuotes.forEach(price => {
    insertDailyPrice(price);
  });

  // 确认后清空临时表
  clearTempQuotes();

  return tempQuotes.length;
}
