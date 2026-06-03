@echo off
chcp 65001 >nul
echo ========================================
echo       StudentApp 预览构建结果
echo ========================================
echo.
cd /d "%~dp0"
echo 当前目录: %cd%
echo.

:: 检查 dist 文件夹是否存在
if not exist "dist" (
    echo 未找到构建输出！请先运行"构建.bat"
    pause
    exit /b 1
)

echo 正在启动预览服务器...
echo.
npm run preview

pause
