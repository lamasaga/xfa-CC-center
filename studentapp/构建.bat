@echo off
chcp 65001 >nul
echo ========================================
echo       StudentApp 构建项目
echo ========================================
echo.
cd /d "%~dp0"
echo 当前目录: %cd%
echo.

echo 正在构建项目...
echo.
call npm run build

if errorlevel 1 (
    echo.
    echo 构建失败！
    pause
    exit /b 1
)

echo.
echo ========================================
echo       构建成功！
echo ========================================
echo 输出目录: dist\
echo.
pause
