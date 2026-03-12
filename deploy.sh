#!/bin/bash
# auto-quote 项目一键部署脚本

set -e

echo "========================================"
echo "    auto-quote 部署脚本"
echo "========================================"

PROJECT_DIR="/root/auto-quote"

# 1. 安装依赖
echo "[1/6] 安装后端依赖..."
cd $PROJECT_DIR/backend
npm install --production

echo "[2/6] 安装前端依赖并构建..."
cd $PROJECT_DIR/frontend
npm install --production
npm run build

# 2. 安装 PM2（如果没有）
echo "[3/6] 检查 PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    npm install -g pm2
fi

# 3. 启动后端
echo "[4/6] 启动后端服务..."
cd $PROJECT_DIR
pm2 stop auto-quote-backend 2>/dev/null || true
pm2 delete auto-quote-backend 2>/dev/null || true
pm2 start ecosystem.config.js --name auto-quote-backend
pm2 save

# 4. 配置 Nginx
echo "[5/6] 配置 Nginx..."
sudo cp $PROJECT_DIR/nginx-auto-quote.conf /etc/nginx/sites-available/auto-quote
sudo ln -sf /etc/nginx/sites-available/auto-quote /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 5. 验证
echo "[6/6] 验证部署..."
sleep 2

echo ""
echo "进程状态："
pm2 status

echo ""
echo "端口监听："
netstat -tlnp | grep 3001 || echo "未找到 3001 端口"

echo ""
echo "========================================"
echo "    部署完成！"
echo "========================================"
echo ""
echo "访问地址：http://121.40.35.46/auto-quote/"
echo "查看日志：pm2 logs auto-quote-backend"
echo "重启服务：pm2 restart auto-quote-backend"
echo ""
