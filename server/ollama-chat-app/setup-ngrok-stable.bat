@echo off
echo ================================
echo Stable ngrok Setup (Free Plan)
echo ================================

echo Checking if backend is running...
curl -s http://localhost:3001/api/health
if %errorlevel% neq 0 (
    echo Backend not running. Please start Docker first.
    pause
    exit
)

echo Backend is running. Starting ngrok...
echo.
echo This will create a stable tunnel URL (8 hour limit on free plan)
echo For permanent solution, upgrade to ngrok Pro ($8/month)
echo.

REM Download ngrok if not exists
if not exist ngrok.exe (
    echo Downloading ngrok...
    curl -L https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-stable-windows-amd64.zip -o ngrok.zip
    tar -xf ngrok.zip
    del ngrok.zip
    echo Please signup at https://dashboard.ngrok.com/get-started/your-authtoken
    echo Then run: ngrok.exe config add-authtoken YOUR_TOKEN
    pause
)

echo Starting ngrok tunnel...
ngrok.exe http 3001 --log=stdout