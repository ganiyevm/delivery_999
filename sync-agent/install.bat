@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

REM Run as administrator bosilganda working directory C:\Windows\system32 bo'lib qoladi.
REM Skript joylashgan papkaga o'tish kerak:
cd /d "%~dp0"

echo ==========================================================
echo   Apteka999 Sync Agent - Windows uchun avtomatik installer
echo ==========================================================
echo   Working directory: %cd%
echo.

REM 1. Admin huquqini tekshirish
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo XATO: Bu skript Administrator huquqi bilan ishga tushirilishi kerak.
    echo O'ng tugma -^> "Run as administrator" qiling.
    pause
    exit /b 1
)

REM 2. Node.js mavjudligini tekshirish
echo [1/5] Node.js mavjudligini tekshirish...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo XATO: Node.js o'rnatilmagan.
    echo.
    echo Avval Node.js v20 LTS o'rnating:
    echo   https://nodejs.org/en/download/
    echo.
    echo O'rnatib bo'lgach bu skriptni qayta ishga tushiring.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do set NODE_VERSION=%%v
echo     Node.js topildi: !NODE_VERSION!
echo.

REM 3. .env fayl mavjudligini tekshirish
echo [2/5] .env faylni tekshirish...
if not exist .env (
    echo.
    echo .env fayl topilmadi. .env.example dan nusxa olinmoqda...
    copy .env.example .env >nul
    echo.
    echo MUHIM: .env faylni notepad'da oching va to'ldiring:
    echo   - BACKEND_URL
    echo   - SYNC_API_KEY
    echo   - BRANCH_NUMBER  (bu filial raqami, masalan 4)
    echo   - MSSQL_PASSWORD (agar sa/1 emas bo'lsa)
    echo.
    notepad .env
    echo.
    echo .env to'ldirilgandan keyin Enter bosing...
    pause >nul
)
echo     .env mavjud
echo.

REM 4. npm install
echo [3/5] Dependency'larni o'rnatish (npm install)...
call npm install --production --no-fund --no-audit
if %errorlevel% neq 0 (
    echo XATO: npm install muvaffaqiyatsiz tugadi.
    pause
    exit /b 1
)
echo     Tayyor
echo.

REM 5. Test connection
echo [4/5] SQL Server'ga sinov ulanish...
call npm run test-connection
if %errorlevel% neq 0 (
    echo.
    echo OGOHLANTIRISH: Test ulanish muvaffaqiyatsiz.
    echo .env'dagi sozlamalarni tekshiring va qayta urinib ko'ring.
    echo Davom etishni xohlaysizmi? (Y/N)
    set /p CONTINUE=
    if /i not "!CONTINUE!"=="Y" exit /b 1
)
echo.

REM 6. Windows Service o'rnatish
echo [5/5] Windows Service sifatida o'rnatish...
call npm install node-windows --no-fund --no-audit 2>nul
call npm link node-windows 2>nul
call node install-service.js install
if %errorlevel% neq 0 (
    echo OGOHLANTIRISH: Service o'rnatib bo'lmadi. Qo'lda ishga tushirish mumkin:
    echo   npm start
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo   TAYYOR! Apteka999 Sync Agent o'rnatildi va ishga tushdi
echo ==========================================================
echo.
echo Service nomi: "Apteka999 Sync Agent"
echo Status tekshirish:  services.msc
echo To'xtatish:         net stop "Apteka999 Sync Agent"
echo Ishga tushirish:    net start "Apteka999 Sync Agent"
echo.
echo Log fayllarni ko'rish: daemon\apteka999-sync-agent.out.log
echo.
pause
