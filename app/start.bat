@echo off
REM Keep this file ASCII-only: cmd.exe parses .bat with system codepage; UTF-8 Chinese breaks IF (...) blocks.
cd /d "%~dp0"

if not exist "%~dp0node_modules\" (
  echo [First run] npm install...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
  echo.
)

echo ==========================================
echo   A-Level - local dev
echo ==========================================
echo   API:  http://localhost:3001
echo   Web:  http://localhost:5173 ^(or next port if busy^)
echo.
echo   If server shows better-sqlite3 / NODE_MODULE_VERSION error:
echo   Close this window, run: npm run native:node
echo.
echo   After git pull / dependency change: npm install
echo ==========================================
echo   Press Ctrl+C to stop.
echo ==========================================
echo.

call npm run start
