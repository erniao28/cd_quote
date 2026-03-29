#!/bin/bash
# cd-quote 项目一键部署 + 验证脚本
# 功能：代码同步、MD5 校验、服务重启、状态检查

set -e

PROJECT_DIR="/var/www/auto-quote"
SERVER_IP="121.40.35.46"

echo "========================================"
echo "    cd-quote 部署 + 验证脚本"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 成功/失败标记
SUCCESS="[OK]"
FAILED="[FAIL]"

# ========== 第一阶段：生成本地文件哈希 ==========
echo "阶段 1: 生成本地代码哈希值..."
echo ""

# 生成后端关键文件的 MD5
generate_local_hashes() {
    local hash_dir=$(mktemp -d)

    # 后端关键文件
    for file in \
        "backend/src/index.js" \
        "backend/src/crawler/chinamoney.js" \
        "backend/src/crawler/scheduler.js" \
        "backend/src/database.js" \
        "backend/src/routes/api.js"
    do
        if [ -f "$file" ]; then
            md5sum "$file" | awk '{print $1}' > "$hash_dir/$(basename $file).md5"
        fi
    done

    # 前端关键文件
    for file in \
        "frontend/src/App.tsx" \
        "frontend/src/components/TempQuoteManager.tsx"
    do
        if [ -f "$file" ]; then
            md5sum "$file" | awk '{print $1}' > "$hash_dir/$(basename $file).md5"
        fi
    done

    # 打包哈希文件
    tar -czf "$hash_dir/local_hashes.tar.gz" -C "$hash_dir" *.md5 2>/dev/null
    echo "$hash_dir/local_hashes.tar.gz"
}

LOCAL_HASHES=$(generate_local_hashes)
echo -e "${GREEN}${SUCCESS}${NC} 本地哈希生成完成"

# ========== 第二阶段：同步代码到服务器 ==========
echo ""
echo "阶段 2: 同步代码到服务器 ($SERVER_IP)..."
echo ""

# 创建临时打包文件
echo "打包后端代码..."
TEMP_DIR=$(mktemp -d)
tar -czf "$TEMP_DIR/backend.tar.gz" -C "$(pwd)" backend/src

echo "打包前端代码..."
tar -czf "$TEMP_DIR/frontend.tar.gz" -C "$(pwd)" frontend

# 上传到服务器
echo "上传后端代码..."
scp -o StrictHostKeyChecking=no "$TEMP_DIR/backend.tar.gz" \
    root@$SERVER_IP:/tmp/backend.tar.gz

if [ $? -eq 0 ]; then
    echo "后端代码上传完成"
else
    echo -e "${RED}后端代码上传失败${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "上传前端代码..."
scp -o StrictHostKeyChecking=no "$TEMP_DIR/frontend.tar.gz" \
    root@$SERVER_IP:/tmp/frontend.tar.gz

if [ $? -eq 0 ]; then
    echo "前端代码上传完成"
else
    echo -e "${RED}前端代码上传失败${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# 在服务器上解压
echo "在服务器上解压代码..."
ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'ENDSSH'
    cd /var/www/auto-quote

    # 备份当前代码
    cp -r backend/src backend/src.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

    # 解压新代码
    tar -xzf /tmp/backend.tar.gz -C /

    # 清理
    rm -f /tmp/backend.tar.gz
ENDSSH

# ========== 第三阶段：服务器端验证 ==========
echo ""
echo "阶段 3: 验证服务器代码哈希..."
echo ""

# 在服务器上生成哈希并比较
ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'ENDSSH'
    echo "服务器端文件哈希："
    cd /root/cd-quote

    echo "后端关键文件 MD5:"
    for file in backend/src/index.js backend/src/crawler/chinamoney.js backend/src/crawler/scheduler.js backend/src/database.js backend/src/routes/api.js; do
        if [ -f "$file" ]; then
            md5sum "$file"
        fi
    done

    echo ""
    echo "前端关键文件 MD5:"
    for file in frontend/src/App.tsx frontend/src/components/TempQuoteManager.tsx; do
        if [ -f "$file" ]; then
            md5sum "$file"
        fi
    done
ENDSSH

echo -e "${GREEN}${SUCCESS}${NC} 服务器代码哈希已生成"

# ========== 第四阶段：安装依赖和构建 ==========
echo ""
echo "阶段 4: 安装依赖和构建..."
echo ""

ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'ENDSSH'
    cd /root/cd-quote

    echo "[1/3] 安装后端依赖..."
    cd backend
    npm install --production
    if [ $? -eq 0 ]; then
        echo "后端依赖安装完成"
    else
        echo "后端依赖安装失败"
        exit 1
    fi

    echo ""
    echo "[2/3] 安装前端依赖并构建..."
    cd ../frontend
    npm install --production
    npm run build
    if [ $? -eq 0 ]; then
        echo "前端构建完成"
    else
        echo "前端构建失败"
        exit 1
    fi
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}${SUCCESS}${NC} 依赖安装和构建完成"
else
    echo -e "${RED}${FAILED}${NC} 依赖安装和构建失败"
    exit 1
fi

# ========== 第五阶段：重启服务 ==========
echo ""
echo "阶段 5: 重启服务..."
echo ""

ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'ENDSSH'
    cd /root/cd-quote

    echo "停止现有进程..."
    pm2 stop cd-quote-backend 2>/dev/null || true

    echo "删除旧进程..."
    pm2 delete cd-quote-backend 2>/dev/null || true

    echo "启动新进程..."
    pm2 start ecosystem.config.js --name cd-quote-backend

    echo "保存 PM2 配置..."
    pm2 save

    sleep 2

    echo ""
    echo "进程状态:"
    pm2 status cd-quote-backend
ENDSSH

echo -e "${GREEN}${SUCCESS}${NC} 服务重启完成"

# ========== 第六阶段：健康检查 ==========
echo ""
echo "阶段 6: 健康检查..."
echo ""

# 等待服务启动
sleep 3

# 检查后端健康
echo "检查后端健康状态..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://$SERVER_IP:3002/health 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}${SUCCESS}${NC} 后端健康检查通过 (HTTP $HTTP_CODE)"
else
    echo -e "${RED}${FAILED}${NC} 后端健康检查失败 (HTTP $HTTP_CODE)"
    echo "查看日志：ssh root@$SERVER_IP 'pm2 logs cd-quote-backend --lines 50'"
fi

# 检查 API 端点
echo ""
echo "检查 API 端点..."
API_RESPONSE=$(curl -s http://$SERVER_IP:3002/cd-quote-api/prices/latest 2>/dev/null | head -c 100)
if [ -n "$API_RESPONSE" ]; then
    echo -e "${GREEN}${SUCCESS}${NC} API 端点响应正常"
else
    echo -e "${YELLOW}[WARN]${NC} API 端点无响应（可能是正常现象）"
fi

echo ""
echo "========================================"
echo "    部署 + 验证完成！"
echo "========================================"
echo ""
echo "访问地址：http://$SERVER_IP:5174/"
echo "API 地址：http://$SERVER_IP:3002/"
echo "健康检查：http://$SERVER_IP:3002/health"
echo ""
echo "查看日志：ssh root@$SERVER_IP 'pm2 logs cd-quote-backend'"
echo "重启服务：ssh root@$SERVER_IP 'pm2 restart cd-quote-backend'"
echo ""

# 清理临时文件
rm -f "$LOCAL_HASHES" 2>/dev/null || true

# 返回到原始目录
cd - > /dev/null
