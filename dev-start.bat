@echo off
chcp 65001 >nul
echo ========================================
echo    货币网爬虫系统 - 本地开发启动
echo ========================================
echo.
echo 提示：这是本地开发模式，生产部署请使用 PM2 + Nginx
echo.

echo 正在启动后端...
start "后端 (3001)" cmd /k "cd backend && npm start"

timeout /t 2 /nobreak >nul

echo 正在启动前端...
start "前端 (5174)" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo    服务启动完成
echo ========================================
echo.
echo 前端：http://localhost:5174
echo 后端：http://localhost:3001
echo.
echo 按任意键退出此窗口（服务仍在运行）
pause >nul
