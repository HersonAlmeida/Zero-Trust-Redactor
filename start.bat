@echo off
title Zero-Trust Redactor
echo.
echo  ╔════════════════════════════════════════════╗
echo  ║     🔒 Zero-Trust Redactor Launcher        ║
echo  ╚════════════════════════════════════════════╝
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing Node dependencies...
    call npm install
)

:: Check if venv exists
if not exist ".venv" (
    echo 🐍 Creating Python virtual environment...
    python -m venv .venv
)

:: Activate venv and install Python deps
echo 🐍 Activating Python environment...
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

:: Start both servers
echo.
echo 🚀 Starting servers...
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:5000
echo.
echo    Press Ctrl+C to stop.
echo.

npm run start
