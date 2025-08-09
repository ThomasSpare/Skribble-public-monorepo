@echo off
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :5000') do (
    taskkill /PID %%i /F >nul 2>&1
)
echo Port 5000 cleared