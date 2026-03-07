# PM2 部署配置示例
# 使用 PM2 管理 Node.js 后端进程（生产环境推荐）

module.exports = {
  apps: [
    {
      name: 'cd-quote-backend',
      script: './backend/src/index.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/cd-quote-error.log',
      out_file: './logs/cd-quote-out.log'
    }
  ]
};
