@echo off
chcp 65001 >nul
echo ========================================
echo       StudentApp 安装依赖
echo ========================================
echo.
cd /d "%~dp0"
echo 当前目录: %cd%
echo.

echo 正在安装依赖...
echo.
call npm install

if errorlevel 1 (
    echo.
    echo 安装失败！
    pause
    exit /b 1
)

echo.
echo ========================================
echo       依赖安装成功！
echo ========================================
pause
