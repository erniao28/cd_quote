# auto-quote 货币网爬虫系统

基于 Nginx 路径前缀隔离方案，与一级报价系统共用同一服务器和端口。

---

## 项目结构

```
auto-quote/
├── backend/               # 后端服务
│   ├── src/
│   │   ├── index.js       # 入口文件
│   │   ├── database.js    # 数据库操作
│   │   ├── crawler/       # 爬虫模块
│   │   └── routes/        # API 接口
│   ├── data/              # 数据库文件
│   ├── .env               # 本地环境配置
│   └── package.json
│
├── frontend/              # 前端服务
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── utils/         # 工具函数
│   │   ├── services/      # API 服务
│   │   └── App.tsx        # 主应用
│   └── package.json
│
├── nginx-auto-quote.conf  # Nginx 配置
├── ecosystem.config.js    # PM2 部署配置
└── README.md
```

---

## 本地开发

### 安装依赖

```bash
cd auto-quote

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 启动服务

```bash
# 后端（终端 1）
cd backend
npm start

# 前端（终端 2）
cd frontend
npm run dev
```

### 访问地址

- 前端：http://localhost:5174
- 后端 API：http://localhost:3001

---

## 服务器部署

### 一键部署脚本

```bash
# 上传代码到服务器后运行
chmod +x deploy-server.sh
./deploy-server.sh
```

### 手动部署

```bash
# 1. 构建前端
cd frontend
npm install --production
npm run build

# 2. 启动后端
cd ..
pm2 start ecosystem.config.js --name auto-quote-backend
pm2 save

# 3. 配置 Nginx（创建独立配置文件）
sudo cp nginx-auto-quote.conf /etc/nginx/sites-available/auto-quote
sudo ln -s /etc/nginx/sites-available/auto-quote /etc/nginx/sites-enabled/

# 4. 测试并重载 Nginx
sudo nginx -t && sudo systemctl reload nginx
```

---

## 访问地址

| 项目 | 访问路径 |
|------|----------|
| 一级报价 | `http://服务器 IP/` |
| auto-quote | `http://服务器 IP/auto-quote/` |

---

## 端口分配

| 项目 | 前端端口 | 后端端口 | Nginx 路径 |
|------|----------|----------|-----------|
| 一级报价 (NCD) | 5173 | 3000 | `/` 和 `/api` |
| auto-quote | 5174 | 3002 | `/auto-quote/` 和 `/auto-quote-api/` |

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 后端端口 | 3001 |
| HOST | 绑定地址 | 127.0.0.1 |
| DB_PATH | 数据库路径 | ./data/cd_quote.db |
| CORS_ORIGIN | CORS 白名单 | http://localhost:5173 |

---

## 注意事项

1. 后端仅监听 `127.0.0.1`，外部无法直接访问
2. 必须通过 Nginx 代理访问
3. 防火墙只需开放 80/443/22 端口
4. 使用 PM2 管理进程，`pm2 logs auto-quote-backend` 查看日志
