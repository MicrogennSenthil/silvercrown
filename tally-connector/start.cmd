@echo off
:: ============================================================
::  Tally Connector — Windows Launcher
::  Double-click this file or add it to Task Scheduler.
:: ============================================================

title Tally Connector
cd /d "%~dp0"

:: Check Node.js
node --version >nul 2>&1
if ERRORLEVEL 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Download Node.js 20+ from: https://nodejs.org/en/download
    pause
    exit /b 1
)

:: Check for .env or connector-config.json
if not exist ".env" (
    if not exist "connector-config.json" (
        echo WARNING: Neither .env nor connector-config.json found.
        echo Copy .env.example to .env and fill in your ERP details.
        pause
        exit /b 1
    )
)

:: Install dependencies if node_modules missing
if not exist "node_modules\" (
    echo Installing dependencies...
    npm install --omit=dev
    if ERRORLEVEL 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo Starting Tally Connector...
echo Press Ctrl+C to stop.
echo.

node src/index.js

:: If it exits unexpectedly, pause so the window stays open
echo.
echo Connector stopped. Exit code: %ERRORLEVEL%
pause
