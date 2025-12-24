@echo off
title Zero-Trust Redactor Pro
echo.
echo ========================================
echo   Zero-Trust Redactor Pro v2.0.0
echo   Production Mode
echo ========================================
echo.

:: Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install Python 3.9+
    pause
    exit /b 1
)

:: Install Python deps (user-level, no venv needed for simplicity)
echo [*] Checking dependencies...
pip install -q --user -r requirements.txt 2>nul

echo.
echo [*] Starting server...
echo [*] Open http://localhost:5000 in your browser
echo.
echo Press Ctrl+C to stop the server
echo.

python server_prod.py