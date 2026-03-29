# cd-quote 项目一键部署脚本 (Windows PowerShell)
# 功能：代码同步、MD5 校验、服务重启、状态检查

$ErrorActionPreference = "Stop"

$SERVER_IP = "121.40.35.46"
$PROJECT_DIR = "/var/www/auto-quote"
$SSH_CMD = "ssh -o StrictHostKeyChecking=no root@$SERVER_IP"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    cd-quote 部署 + 验证脚本 (PowerShell)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========== 第一阶段：生成本地文件哈希 ==========
Write-Host "阶段 1: 生成本地代码哈希值..." -ForegroundColor Yellow

$local_hashes = @{}
$files_to_check = @(
    "backend/src/index.js",
    "backend/src/crawler/chinamoney.js",
    "backend/src/crawler/scheduler.js",
    "backend/src/database.js",
    "backend/src/routes/api.js",
    "frontend/src/App.tsx",
    "frontend/src/components/TempQuoteManager.tsx"
)

foreach ($file in $files_to_check) {
    if (Test-Path $file) {
        $hash = Get-FileHash -Path $file -Algorithm MD5
        $local_hashes[$file] = $hash.Hash.ToLower()
        Write-Host "  $file : $($hash.Hash.ToLower())" -ForegroundColor Gray
    } else {
        Write-Host "  [缺失] $file" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[OK] 本地哈希生成完成" -ForegroundColor Green

# ========== 第二阶段：获取服务器哈希并比较 ==========
Write-Host ""
Write-Host "阶段 2: 检查服务器代码哈希..." -ForegroundColor Yellow

$server_hashes = @{}
$mismatch_files = @()

foreach ($file in $files_to_check) {
    $remote_file = "$PROJECT_DIR/$file"
    try {
        $hash_output = Invoke-Expression "$SSH_CMD 'md5sum $remote_file 2>/dev/null'" 2>&1
        $hash = ($hash_output -split '\s+')[0]

        if ($hash) {
            $server_hashes[$file] = $hash.ToLower()

            if ($local_hashes.ContainsKey($file)) {
                if ($local_hashes[$file] -eq $hash.ToLower()) {
                    Write-Host "  [一致] $file" -ForegroundColor Green
                } else {
                    Write-Host "  [不一致] $file" -ForegroundColor Red
                    Write-Host "    本地：$($local_hashes[$file])" -ForegroundColor Gray
                    Write-Host "    服务器：$hash" -ForegroundColor Gray
                    $mismatch_files += $file
                }
            } else {
                Write-Host "  [跳过] $file (本地不存在)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  [缺失] $file" -ForegroundColor Red
            $mismatch_files += $file
        }
    } catch {
        Write-Host "  [错误] $file : $($_.Exception.Message)" -ForegroundColor Red
        $mismatch_files += $file
    }
}

Write-Host ""

if ($mismatch_files.Count -gt 0) {
    Write-Host "[警告] 发现 $($mismatch_files.Count) 个文件不一致" -ForegroundColor Yellow
    Write-Host "需要同步的文件：$($mismatch_files -join ', ')" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "是否继续部署？(Y/N)"
    if ($response -ne 'Y' -and $response -ne 'y') {
        Write-Host "部署已取消" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "[OK] 所有文件已同步" -ForegroundColor Green
}

# ========== 第三阶段：上传代码 ==========
Write-Host ""
Write-Host "阶段 3: 上传代码到服务器..." -ForegroundColor Yellow

# 使用 pscp 或 scp 上传
$pscp_path = "pscp"  # 需要安装 PuTTY

# 检查是否有 pscp
if (Get-Command $pscp_path -ErrorAction SilentlyContinue) {
    Write-Host "使用 pscp 上传..." -ForegroundColor Gray

    # 上传后端代码
    Write-Host "上传后端代码..." -ForegroundColor Gray
    $files_to_upload = @(
        "backend/src/index.js",
        "backend/src/crawler/chinamoney.js",
        "backend/src/crawler/scheduler.js",
        "backend/src/database.js",
        "backend/src/routes/api.js"
    )

    foreach ($file in $files_to_upload) {
        if (Test-Path $file) {
            $remote_path = "root@$SERVER_IP`:$PROJECT_DIR/$file"
            Invoke-Expression "& $pscp -q $file $remote_path"
            Write-Host "  已上传：$file" -ForegroundColor Green
        }
    }

    # 上传前端代码
    Write-Host "上传前端代码..." -ForegroundColor Gray
    $frontend_files = @(
        "frontend/src/App.tsx",
        "frontend/src/components/TempQuoteManager.tsx"
    )

    foreach ($file in $frontend_files) {
        if (Test-Path $file) {
            $remote_path = "root@$SERVER_IP`:$PROJECT_DIR/$file"
            Invoke-Expression "& $pscp -q $file $remote_path"
            Write-Host "  已上传：$file" -ForegroundColor Green
        }
    }
} else {
    # 使用 scp (Git Bash)
    Write-Host "使用 scp 上传..." -ForegroundColor Gray
    $scp_cmd = "scp -o StrictHostKeyChecking=no"

    foreach ($file in $files_to_check) {
        if (Test-Path $file) {
            Invoke-Expression "$scp_cmd $file root@$SERVER_IP`:$PROJECT_DIR/$file"
            Write-Host "  已上传：$file" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "[OK] 代码上传完成" -ForegroundColor Green

# ========== 第四阶段：重启服务 ==========
Write-Host ""
Write-Host "阶段 4: 重启服务..." -ForegroundColor Yellow

Write-Host "重启 PM2 进程..." -ForegroundColor Gray
Invoke-Expression "$SSH_CMD 'pm2 restart auto-quote-server'"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "进程状态:" -ForegroundColor Gray
Invoke-Expression "$SSH_CMD 'pm2 status auto-quote-server'"

Write-Host ""
Write-Host "[OK] 服务重启完成" -ForegroundColor Green

# ========== 第五阶段：健康检查 ==========
Write-Host ""
Write-Host "阶段 5: 健康检查..." -ForegroundColor Yellow

Write-Host "检查后端健康..." -ForegroundColor Gray
try {
    $health_response = Invoke-WebRequest -Uri "http://$SERVER_IP`:3002/health" -TimeoutSec 10 -UseBasicParsing
    if ($health_response.StatusCode -eq 200) {
        Write-Host "  [OK] 后端健康检查通过 (HTTP 200)" -ForegroundColor Green
        Write-Host "  响应：$($health_response.Content)" -ForegroundColor Gray
    } else {
        Write-Host "  [失败] 后端健康检查失败 (HTTP $($health_response.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "  [失败] 无法连接到后端服务" -ForegroundColor Red
    Write-Host "  错误：$($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    部署完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址：http://$SERVER_IP:5174/" -ForegroundColor White
Write-Host "API 地址：http://$SERVER_IP:3002/" -ForegroundColor White
Write-Host "健康检查：http://$SERVER_IP:3002/health" -ForegroundColor White
Write-Host ""
Write-Host "查看日志：ssh root@$SERVER_IP 'pm2 logs auto-quote-server --lines 50'" -ForegroundColor White
Write-Host "重启服务：ssh root@$SERVER_IP 'pm2 restart auto-quote-server'" -ForegroundColor White
Write-Host ""
