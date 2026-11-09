@echo off
setlocal
cd /d "%~dp0"
set "ARC_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined ARC_NODE set "ARC_NODE=%%N"
if not defined ARC_NODE for /f "delims=" %%N in ('powershell -NoProfile -Command "(Get-AppxPackage OpenAI.CodexPrimaryRuntime*).InstallLocation | ForEach-Object {Join-Path $_ 'dependencies\node\bin\node.exe'} | Where-Object {Test-Path $_} | Select-Object -First 1"') do set "ARC_NODE=%%N"
if not defined ARC_NODE (
 echo Node.js could not be located.
 pause
 exit /b 1
)
set "ARC_URL=http://127.0.0.1:5174/WoodworkingShop/?tab=preview&view=3d"
curl.exe -fsS --max-time 2 "%ARC_URL%" 2>nul | findstr /i "WoodworkingShop" >nul
if not errorlevel 1 (
 start "" chrome "%ARC_URL%"
 exit /b
)
set "BROWSER=chrome"
"%ARC_NODE%" node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5174 --strictPort --open "/WoodworkingShop/?tab=preview&view=3d"
if errorlevel 1 pause
