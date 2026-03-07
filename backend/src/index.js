import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import apiRouter from './routes/api.js';
import { startCrawlScheduler } from './crawler/scheduler.js';
import { initDatabase } from './database.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 配置 CORS
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

// 中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API 路由
app.use('/api', apiRouter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 启动服务器
async function startServer() {
  try {
    await initDatabase();
    console.log('[数据库] 初始化完成');

    // 启动定时爬取任务
    startCrawlScheduler();

    // 启动服务器
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║     货币网爬虫系统后端服务启动成功                 ║
╠═══════════════════════════════════════════════════╣
║  HTTP API:    http://localhost:${PORT}              ║
║  健康检查：http://localhost:${PORT}/health          ║
╚═══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('[错误] 启动失败:', error);
    process.exit(1);
  }
}

startServer();
