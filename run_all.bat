@echo off
echo ========================================================
echo  Starting StockPilot (Backend + Frontend)...
echo ========================================================
start "StockPilot Backend (Flask:5000)" cmd /k "%~dp0run_backend.bat"
start "StockPilot Frontend (Vite:5173)" cmd /k "%~dp0run_frontend.bat"
echo.
echo Both servers are launching!
echo Frontend will be available at: http://localhost:5173
echo Backend API is running at:      http://localhost:5000
echo.
