@echo off
chcp 65001 >nul
title ゆうき整骨院 リハビリ管理システム

cd /d "C:\Users\PC\yuuki-rehab"

:: ポート3000でサーバーが起動済みか確認
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo サーバーは起動済みです。ブラウザを開きます...
    start "" "http://localhost:3000/patients/dashboard"
    exit /b 0
)

:: サーバーを起動（バックグラウンド）
echo サーバーを起動しています...
start /min "ゆうきリハブ サーバー" cmd /c "cd /d C:\Users\PC\yuuki-rehab && npm run dev"

:: サーバーの起動を待つ（最大30秒）
set /a count=0
:wait
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 goto open
set /a count+=1
if %count% lss 15 goto wait
echo サーバーの起動に時間がかかっています。手動でブラウザを開いてください。
pause
exit /b 1

:open
echo 起動完了！ブラウザを開きます...
start "" "http://localhost:3000/patients/dashboard"
exit /b 0
