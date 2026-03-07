@echo off
echo ============================================
echo   Mavco Beverage Box — Backend Startup
echo ============================================

cd /d "%~dp0"

:: Check if venv exists, create if not
if not exist "venv\" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
)

echo [2/3] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/3] Installing dependencies...
venv\Scripts\python.exe -m pip install -r requirements.txt --quiet

echo.
echo [Seed] Populating database with sample data...
python seed_data.py

echo.
echo ============================================
echo   Starting Flask API on http://localhost:5000
echo ============================================
python app.py
