import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import apiRouter from './routes/api.js';
import { startCrawlScheduler } from './crawler/scheduler.js';
import { initDatabase } from './database.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '127.0.0.1';

// 配置 CORS - 支持本地开发和生产环境（Nginx 代理）
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

// 中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API 路由
app.use(apiRouter);  // 根路径，与一级报价系统架构一致

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 启动服务器
async function startServer() {
  try {
    await initDatabase();
    console.log('[数据库] 初始化完成');

    // 启动定时爬取任务（已禁用，改为全手动触发）
    // startCrawlScheduler();

    // 启动服务器
    app.listen(PORT, HOST, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║     货币网爬虫系统后端服务启动成功                 ║
╠═══════════════════════════════════════════════════╣
║  HTTP API:    http://${HOST}:${PORT}              ║
║  健康检查：http://${HOST}:${PORT}/health          ║
╚═══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('[错误] 启动失败:', error);
    process.exit(1);
  }
}

startServer();
