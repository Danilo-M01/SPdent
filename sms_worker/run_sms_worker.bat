@echo off
title SP DENT SMS Reminder Daemon
cd /d "%~dp0"

echo =======================================================
echo SP DENT -- Pokretanje SMS Remindera u pozadini
echo =======================================================
echo.

:: Provera da li je Python instaliran
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [GRESKA] Python nije pronadjen na sistemu!
    echo Molimo instalirajte Python 3.9 ili noviji i oznacite "Add to PATH" tokom instalacije.
    pause
    exit /b 1
)

:: Instalacija zavisnosti
echo Instalacija potrebnih biblioteka (requests, python-dotenv, supabase)...
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [UPOZORENJE] Doslo je do greske prilikom instalacije paketa. Pokusavam nastavak rada...
)

echo.
echo Pokretanje SMS Remindera u neprekidnom (daemon) modu...
echo Skripta proverava sutrasnje termine svakih 10 minuta.
echo Mozete zatvoriti ovaj prozor ili stisnuti Ctrl+C za zaustavljanje.
echo.

:run
python reminder.py
echo.
echo [UPOZORENJE] Skripta se neocekivano ugasila. Ponovno pokretanje za 10 sekundi...
timeout /t 10 >nul
goto run
