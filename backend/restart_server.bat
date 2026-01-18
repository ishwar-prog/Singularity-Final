@echo off
echo Stopping existing backend server...

REM Find and kill process on port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    echo Killing process %%a
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo Starting backend server...
python api.py
