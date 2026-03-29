#!/bin/bash
# 快速验证脚本 - 检查本地和服务器代码是否一致
# 用法：./verify-deploy.sh

SERVER_IP="121.40.35.46"
PROJECT_DIR="/var/www/auto-quote"

echo "========================================"
echo "    代码同步验证工具"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查本地和服务器文件哈希
check_file_hash() {
    local local_file=$1
    local remote_file=$2
    local name=$3

    # 本地哈希
    if [ -f "$local_file" ]; then
        local_hash=$(md5sum "$local_file" | awk '{print $1}')
    else
        echo -e "${RED}[缺失]${NC} 本地文件不存在：$local_file"
        return 1
    fi

    # 服务器哈希
    remote_hash=$(ssh -o StrictHostKeyChecking=no root@$SERVER_IP "md5sum $remote_file 2>/dev/null | awk '{print \$1}'" 2>/dev/null)

    if [ -z "$remote_hash" ]; then
        echo -e "${RED}[缺失]${NC} 服务器文件不存在：$remote_file"
        return 1
    fi

    # 比较
    if [ "$local_hash" = "$remote_hash" ]; then
        echo -e "${GREEN}[一致]${NC} $name"
        return 0
    else
        echo -e "${RED}[不一致]${NC} $name"
        echo "         本地：$local_hash"
        echo "         服务器：$remote_hash"
        return 1
    fi
}

cd "$(dirname "$0")"

mismatch_count=0

echo "检查后端关键文件..."
echo ""

check_file_hash "backend/src/index.js" "$PROJECT_DIR/backend/src/index.js" "index.js" || ((mismatch_count++))
check_file_hash "backend/src/crawler/chinamoney.js" "$PROJECT_DIR/backend/src/crawler/chinamoney.js" "chinamoney.js" || ((mismatch_count++))
check_file_hash "backend/src/crawler/scheduler.js" "$PROJECT_DIR/backend/src/crawler/scheduler.js" "scheduler.js" || ((mismatch_count++))
check_file_hash "backend/src/database.js" "$PROJECT_DIR/backend/src/database.js" "database.js" || ((mismatch_count++))
check_file_hash "backend/src/routes/api.js" "$PROJECT_DIR/backend/src/routes/api.js" "api.js" || ((mismatch_count++))

echo ""
echo "检查前端关键文件..."
echo ""

check_file_hash "frontend/src/App.tsx" "$PROJECT_DIR/frontend/src/App.tsx" "App.tsx" || ((mismatch_count++))
check_file_hash "frontend/src/components/TempQuoteManager.tsx" "$PROJECT_DIR/frontend/src/components/TempQuoteManager.tsx" "TempQuoteManager.tsx" || ((mismatch_count++))

echo ""
echo "========================================"

if [ $mismatch_count -eq 0 ]; then
    echo -e "${GREEN}所有文件已同步！${NC}"
    echo ""
    echo "检查服务状态..."
    ssh -o StrictHostKeyChecking=no root@$SERVER_IP "pm2 status cd-quote-backend"
    echo ""
    echo "检查后端健康..."
    curl -s http://$SERVER_IP:3002/health | head -c 200
    echo ""
else
    echo -e "${RED}发现 $mismatch_count 个文件不一致！${NC}"
    echo ""
    echo "运行以下命令同步代码："
    echo "  ./deploy-and-verify.sh"
fi

echo ""
