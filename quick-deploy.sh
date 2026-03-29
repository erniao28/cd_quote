# 快速部署和验证脚本
# 用法：bash quick-deploy.sh [文件名]

SERVER_IP="121.40.35.46"
PROJECT_DIR="/var/www/auto-quote"

echo "========================================"
echo "    快速部署工具"
echo "========================================"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$1" == "verify" ] || [ "$1" == "check" ]; then
    # 验证模式
    echo ""
    echo "检查代码同步状态..."
    echo ""

    mismatch=0
    files="backend/src/index.js backend/src/crawler/chinamoney.js backend/src/crawler/scheduler.js backend/src/database.js backend/src/routes/api.js frontend/src/App.tsx frontend/src/components/TempQuoteManager.tsx frontend/src/services/api.ts"

    for file in $files; do
        local_hash=$(md5sum "$file" 2>/dev/null | awk '{print $1}')
        remote_hash=$(ssh -o StrictHostKeyChecking=no root@$SERVER_IP "md5sum $PROJECT_DIR/$file 2>/dev/null | awk '{print \$1}'" 2>/dev/null)

        if [ "$local_hash" = "$remote_hash" ] && [ -n "$local_hash" ]; then
            echo -e "${GREEN}[一致]${NC} $file"
        else
            echo -e "${RED}[不一致]${NC} $file"
            ((mismatch++))
        fi
    done

    echo ""
    if [ $mismatch -eq 0 ]; then
        echo -e "${GREEN}所有文件已同步！${NC}"
    else
        echo -e "${YELLOW}有 $mismatch 个文件未同步${NC}"
        echo "运行以下命令部署："
        echo "  bash quick-deploy.sh deploy"
    fi

    echo ""
    echo "服务状态:"
    ssh -o StrictHostKeyChecking=no root@$SERVER_IP "pm2 status auto-quote-server" 2>/dev/null

    echo ""
    echo "健康检查:"
    curl -s --connect-timeout 5 http://$SERVER_IP:3002/health 2>/dev/null || echo "无法访问健康检查端点"

elif [ "$1" == "deploy" ] || [ "$1" == "sync" ]; then
    # 部署模式
    echo ""
    echo "上传代码..."

    files="backend/src/index.js backend/src/crawler/chinamoney.js backend/src/crawler/scheduler.js backend/src/database.js backend/src/routes/api.js frontend/src/App.tsx frontend/src/components/TempQuoteManager.tsx frontend/src/services/api.ts"

    for file in $files; do
        echo "上传 $file..."
        cat "$file" | ssh -o StrictHostKeyChecking=no root@$SERVER_IP "cat > $PROJECT_DIR/$file" 2>/dev/null
    done

    echo ""
    echo "重启服务..."
    ssh -o StrictHostKeyChecking=no root@$SERVER_IP "pm2 restart auto-quote-server --update-env" 2>/dev/null

    echo ""
    echo "构建前端..."
    ssh -o StrictHostKeyChecking=no root@$SERVER_IP "cd $PROJECT_DIR/frontend && npm run build" 2>/dev/null

    sleep 3

    echo ""
    echo "验证部署..."
    echo ""
    bash "$0" verify

else
    echo "用法：bash quick-deploy.sh [deploy|verify]"
    echo ""
    echo "  deploy  - 上传代码并重启服务"
    echo "  verify  - 检查代码同步状态"
    echo ""
fi
