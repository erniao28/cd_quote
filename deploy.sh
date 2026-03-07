# 服务器一键部署脚本 (Linux)

# 1. 安装依赖
echo "安装依赖..."
cd backend && npm install --production
cd ../frontend && npm install && npm run build

# 2. 安装 PM2（如果没有）
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    npm install -g pm2
fi

# 3. 启动后端
echo "启动后端服务..."
pm2 start ecosystem.config.js

# 4. 启动前端（使用 serve 托管静态文件）
if ! command -v serve &> /dev/null; then
    echo "安装 serve..."
    npm install -g serve
fi

echo "启动前端服务..."
serve -s frontend/dist -l 5174 &

# 5. 保存 PM2 配置
pm2 save

echo ""
echo "========================================"
echo "    部署完成！"
echo "========================================"
echo ""
echo "前端：http://localhost:5174"
echo "后端：http://localhost:3001"
echo ""
echo "查看进程状态：pm2 status"
echo "查看日志：pm2 logs"
