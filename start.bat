@echo off
title Openfy
cd /d "%~dp0"

echo ============================================
echo              Openfy - Music Player
echo ============================================
echo.
echo  1) Run in browser (dev mode)
echo  2) Build installer + portable exe
echo.
set /p choice="Choose [1/2]: "

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Download it from https://nodejs.org
    pause
    exit /b 1
)

:: Install root dependencies if needed
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: Install client dependencies if needed
if not exist "client\node_modules\" (
    echo Installing client dependencies...
    cd client
    call npm install
    cd ..
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install client dependencies.
        pause
        exit /b 1
    )
)

if "%choice%"=="2" goto build

:: ── Option 1: Dev mode ──
echo.
echo Starting Openfy in dev mode...
echo   Server: http://localhost:3001
echo   Client: http://localhost:5173
echo.
echo Press Ctrl+C to stop.
echo.
call npm run dev
goto end

:: ── Option 2: Build ──
:build
echo.
echo Building Openfy desktop app...
echo This may take a few minutes on the first run.
echo.
call npm run electron:build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed.
    pause
    exit /b 1
)
echo.
echo ============================================
echo  Build complete!
echo  Output: dist-electron\
echo ============================================
echo.
explorer dist-electron
pause

:end
