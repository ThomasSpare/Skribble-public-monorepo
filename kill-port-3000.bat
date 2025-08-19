@echo off
echo Checking for processes on port 3000...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :3000') do (
    echo Killing PID %%i
    taskkill /PID %%i /F
)
echo Port 3000 cleared