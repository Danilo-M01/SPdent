@echo off
chcp 65001 >nul
title SP DENT SMS Podsetnik - Instalacija Precica
echo ====================================================================
echo             SP DENT SMS PODSETNIK - POSTAVLJANJE PREČICA
echo ====================================================================
echo.

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

set "EXE_PATH=%APP_DIR%\SP_DENT_SMS.exe"
set "ICON_PATH=%APP_DIR%\sp_dent_logo.ico"

if not exist "%EXE_PATH%" (
    echo [GRESKA] SP_DENT_SMS.exe nije pronadjen u ovom folderu!
    echo Proverite da li se ovaj fajl nalazi u istom folderu gde i SP_DENT_SMS.exe.
    echo.
    pause
    exit /b 1
)

echo [1/2] Pravljenje prečice sa SP DENT logoom na Radnoj Površini (Desktop)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\SP DENT SMS Podsetnik.lnk'); $s.TargetPath = '%EXE_PATH%'; $s.WorkingDirectory = '%APP_DIR%'; $s.IconLocation = '%ICON_PATH%,0'; $s.Description = 'SP DENT SMS Podsetnik'; $s.Save()"
if %errorlevel% equ 0 (
    echo       [USPESNO] Prečica na Desktop-u je napravljena!
) else (
    echo       [UPOZORENJE] Nije uspelo pravljenje Desktop prečice.
)

echo.
echo [2/2] Dodavanje u Windows Startup (automatsko pokretanje sa računarom)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Startup') + '\SP DENT SMS Podsetnik.lnk'); $s.TargetPath = '%EXE_PATH%'; $s.WorkingDirectory = '%APP_DIR%'; $s.IconLocation = '%ICON_PATH%,0'; $s.Description = 'SP DENT SMS Podsetnik - Automatski Start'; $s.Save()"
if %errorlevel% equ 0 (
    echo       [USPESNO] Program ce se automatski paliti sa Windows-om!
) else (
    echo       [UPOZORENJE] Nije uspelo dodavanje u Startup folder.
)

echo.
echo ====================================================================
echo                    SVE JE SPREMNO I INSTALIRANO!
echo ====================================================================
echo.
echo  * Za pokretanje odmah: dvokliknite na 'SP DENT SMS Podsetnik' na Desktop-u.
echo  * U slucaju promene IP adrese telefona:
echo    Otvorite fajl .env u ovom folderu i promenite liniju:
echo    SMS_GATEWAY_URL=http://NOVA_IP:8080/send-sms
echo.
pause
