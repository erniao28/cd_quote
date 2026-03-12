#!/bin/bash
# 防火墙配置脚本 - 仅首次部署时运行
# 注意：如果服务器已配置过防火墙（如一级报价系统已部署），无需重复运行

echo "========================================"
echo "    防火墙配置检查"
echo "========================================"

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then
  echo "错误：请使用 sudo 运行此脚本"
  exit 1
fi

# 显示当前防火墙状态
echo "当前防火墙状态："
ufw status verbose

echo ""
echo "========================================"
echo "    端口说明"
echo "========================================"
echo "已开放端口（外部可访问）："
echo "  - 22/tcp   : SSH 远程管理"
echo "  - 80/tcp   : HTTP Web 访问"
echo "  - 443/tcp  : HTTPS 加密访问"
echo ""
echo "仅本地访问端口（外部不可访问）："
echo "  - 3000     : 一级报价系统后端 (NCD)"
echo "  - 3001     : auto-quote 后端"
echo "  - 3002+    : 其他项目后端"
echo ""
echo "如需配置防火墙，运行："
echo "  sudo ufw allow 22/tcp"
echo "  sudo ufw allow 80/tcp"
echo "  sudo ufw allow 443/tcp"
echo "  sudo ufw enable"
echo ""
