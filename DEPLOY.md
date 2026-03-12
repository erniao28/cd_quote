# auto-quote 项目部署指南

## 部署前准备

确保服务器上已安装：
- Node.js 16+
- npm
- PM2 (`npm install -g pm2`)
- Nginx

---

## 部署步骤

### 步骤 1：上传代码到服务器

**方式 A - Git 克隆（推荐）：**
```bash
ssh root@121.40.35.46
cd /root
git clone <你的仓库地址> auto-quote
cd auto-quote
```

**方式 B - SCP 上传：**
```bash
# 在本地 PowerShell/CMD 运行
scp -r E:\file\project_ai\cc_test\cd_quote root@121.40.35.46:/root/auto-quote

# 然后 SSH 登录
ssh root@121.40.35.46
cd /root/auto-quote
```

---

### 步骤 2：运行部署脚本

```bash
chmod +x deploy.sh
./deploy.sh
```

脚本会自动完成：
1. 安装后端依赖
2. 安装前端依赖并构建
3. 启动 PM2 进程
4. 配置 Nginx
5. 验证部署

---

### 步骤 3：验证访问

```bash
# 检查进程
pm2 status

# 查看日志
pm2 logs auto-quote-backend

# 测试 API
curl http://localhost/auto-quote-api/health

# 浏览器访问
# http://121.40.35.46/auto-quote/
```

---

## 手动部署（如脚本失败）

```bash
# 1. 安装依赖
cd /root/auto-quote/backend
npm install --production

cd ../frontend
npm install --production
npm run build

# 2. 启动后端
cd /root/auto-quote
pm2 start ecosystem.config.js --name auto-quote-backend
pm2 save

# 3. 配置 Nginx
sudo cp nginx-auto-quote.conf /etc/nginx/sites-available/auto-quote
sudo ln -sf /etc/nginx/sites-available/auto-quote /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 常见问题

### 1. Nginx 配置冲突
如果 `nginx -t` 报错 "address already in use"，检查端口是否被占用：
```bash
netstat -tlnp | grep 80
```

### 2. 一级报价系统是否正常？
检查现有服务：
```bash
pm2 status | grep ncd-backend
curl http://localhost/api/health  # 一级报价 API
```

### 3. 前端 404
确保前端已构建：
```bash
ls -la /root/auto-quote/frontend/dist/
```

### 4. API 502 Bad Gateway
检查后端是否运行：
```bash
pm2 logs auto-quote-backend
netstat -tlnp | grep 3001  # 应该显示 127.0.0.1:3001
```

---

## 与一级报价系统的关系

| 项目 | 路径 | 后端端口 | PM2 名称 |
|------|------|----------|----------|
| 一级报价 | `/` | 3000 | ncd-backend |
| auto-quote | `/auto-quote` | 3001 | auto-quote-backend |

两个项目完全独立，互不影响！

---

## 回滚方案

如果需要恢复原样：

```bash
# 1. 停止服务
pm2 stop auto-quote-backend
pm2 delete auto-quote-backend

# 2. 移除 Nginx 配置
sudo rm /etc/nginx/sites-enabled/auto-quote
sudo nginx -t
sudo systemctl reload nginx

# 3. 一级报价系统不受影响
```
