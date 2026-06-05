@echo off
echo ========================================
echo   MeetHub - Video Conferencing System
echo ========================================
echo.

echo [1/2] Starting Backend (port 3001)...
start "MeetHub Backend" cmd /k "cd /d %~dp0backend && node --no-warnings server.js"

echo [2/2] Starting Frontend (port 5173)...
timeout /t 2 /nobreak > nul
start "" "http://localhost:5173"
cd /d "%~dp0frontend"
npx vite

echo.
echo Servers stopped.
pause
