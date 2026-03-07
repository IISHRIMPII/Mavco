@echo off
echo ============================================
echo   Mavco Beverage Box — Frontend Startup
echo ============================================

cd /d "%~dp0"

:: Add Node.js to PATH for this session
set PATH=C:\Program Files\nodejs;%PATH%

echo [1/2] Installing npm packages...
call npm install --loglevel=error

echo.
echo ============================================
echo   Starting React app on http://localhost:3000
echo ============================================
npm start
