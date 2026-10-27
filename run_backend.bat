@echo off
echo ========================================================
echo  Starting StockPilot Backend (Flask API on port 5000)...
echo ========================================================
cd /d "%~dp0backend"
if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe run.py
) else (
    python run.py
)
pause
