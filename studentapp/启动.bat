@echo off
chcp 65001 >nul
echo ========================================
echo       StudentApp 开发服务器启动
echo ========================================
echo.
cd /d "%~dp0"
echo 当前目录: %cd%
echo.

:: 检查 node_modules 是否存在
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败！
        pause
        exit /b 1
    )
)

echo 正在启动开发服务器...
echo.
npm run dev

pause
