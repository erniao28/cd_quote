# 货币网爬虫系统 (CD.Quote)

## 项目结构

```
cd_quote/
├── backend/               # 后端服务
│   ├── src/
│   │   ├── index.js       # 入口文件
│   │   ├── database.js    # 数据库操作
│   │   ├── crawler/       # 爬虫模块
│   │   └── routes/        # API 接口
│   ├── data/              # 数据库文件
│   ├── .env               # 本地环境配置
│   ├── .env.production    # 生产环境配置
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
├── nginx.conf.example     # Nginx 配置示例
├── ecosystem.config.js    # PM2 部署配置
└── README.md
```

---

## 本地开发

### 安装依赖

```bash
cd E:\file\project_ai\cc_test\cd_quote

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

### 1. 构建前端

```bash
cd frontend
npm run build
# 生成 dist/ 目录
```

### 2. 使用 PM2 启动后端

```bash
# 安装 PM2
npm install -g pm2

# 启动后端服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 保存 PM2 配置（开机自启）
pm2 save
pm2 startup
```

### 3. 使用 PM2 启动前端（生产模式）

```bash
# 安装 serve
npm install -g serve

# 启动前端（端口 5174）
serve -s frontend/dist -l 5174
```

### 4. Nginx 配置

将 `nginx.conf.example` 中的配置复制到你的 Nginx 配置中：

```bash
# 编辑 Nginx 配置
sudo vim /etc/nginx/sites-available/default

# 重启 Nginx
sudo systemctl restart nginx
```

---

## 部署到同一服务器（与一级报价整合）

### 端口分配

| 项目 | 前端端口 | 后端端口 |
|------|----------|----------|
| 一级报价 | 5173 | 3000 |
| 爬虫系统 | 5174 | 3001 |

### Nginx 配置

```nginx
# 一级报价
location /cd-pricing {
    proxy_pass http://localhost:5173;
}

# 爬虫系统
location /cd-quote {
    proxy_pass http://localhost:5174;
}

# 一级报价 API
location /cd-pricing-api {
    proxy_pass http://localhost:3000;
}

# 爬虫系统 API
location /cd-quote-api {
    proxy_pass http://localhost:3001;
}
```

### 访问地址

- 一级报价：`http://你的服务器 IP/cd-pricing`
- 爬虫系统：`http://你的服务器 IP/cd-quote`

---

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 后端端口 | 3001 |
| DB_PATH | 数据库路径 | ./data/cd_quote.db |
| CORS_ORIGIN | CORS 白名单 | * (生产环境) |

---

## 注意事项

1. 服务器部署需要开放相应端口（3001, 5174）
2. 建议使用 PM2 管理 Node.js 进程
3. 数据库文件会保存在 `backend/data/` 目录
4. 定期备份数据库文件
