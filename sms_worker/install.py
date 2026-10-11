"""
SP DENT SMS Worker — Installer (Autostart + Desktop Shortcut)
=============================================================
Run this AFTER building the .exe:
    python install.py

What it does:
  1. Copies SP_DENT_SMS folder to C:\\SP_DENT_SMS (or user-chosen location)
  2. Creates a Desktop shortcut with SP DENT logo
  3. Adds to Windows Startup (auto-runs when PC boots)
  4. Ensures .env is present and editable

IMPORTANT: Run this as Administrator for best results.
"""

import os
import sys
import shutil
import subprocess
import ctypes

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR     = os.path.join(SCRIPT_DIR, "dist", "SP_DENT_SMS")
INSTALL_DIR   = r"C:\SP_DENT_SMS"
APP_NAME      = "SP DENT SMS Podsetnik"
EXE_NAME      = "SP_DENT_SMS.exe"
ICON_FILE     = os.path.join(SCRIPT_DIR, "sp_dent_logo.ico")


def is_admin():
    """Check if running with administrator privileges."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False


def create_shortcut_vbs(shortcut_path, target_path, working_dir, icon_path, description):
    """Create a Windows shortcut using VBScript."""
    vbs_code = f'''Set oWS = WScript.CreateObject("WScript.Shell")
Set oLink = oWS.CreateShortcut("{shortcut_path}")
oLink.TargetPath = "{target_path}"
oLink.WorkingDirectory = "{working_dir}"
oLink.IconLocation = "{icon_path}, 0"
oLink.Description = "{description}"
oLink.Save
'''
    vbs_path = os.path.join(SCRIPT_DIR, "_tmp_shortcut.vbs")
    with open(vbs_path, 'w', encoding='utf-8') as f:
        f.write(vbs_code)

    result = subprocess.run(
        ['cscript', '//nologo', vbs_path],
        capture_output=True, text=True
    )
    if os.path.exists(vbs_path):
        os.remove(vbs_path)

    return result.returncode == 0


def main():
    print("=" * 60)
    print(f"  {APP_NAME} — Instalacija")
    print("=" * 60)
    print()

    # Check build exists
    if not os.path.exists(BUILD_DIR):
        print(f"❌ GREŠKA: Build folder nije pronađen: {BUILD_DIR}")
        print(f"   Prvo pokreni: python build_exe.py")
        sys.exit(1)

    exe_src = os.path.join(BUILD_DIR, EXE_NAME)
    if not os.path.exists(exe_src):
        print(f"❌ GREŠKA: {EXE_NAME} nije pronađen u {BUILD_DIR}")
        sys.exit(1)

    # -------------------------------------------------------------------
    # Step 1: Copy to install directory
    # -------------------------------------------------------------------
    print(f"[*] Instalacija u: {INSTALL_DIR}")

    if os.path.exists(INSTALL_DIR):
        print(f"   Folder vec postoji. Azuriram fajlove...")
        # Preserve existing .env
        existing_env = os.path.join(INSTALL_DIR, ".env")
        env_backup = None
        if os.path.exists(existing_env):
            env_backup = existing_env + ".backup"
            shutil.copy2(existing_env, env_backup)
            print(f"   Sacuvana kopija postojeceg .env -> .env.backup")

        # Remove old files but keep .env
        for item in os.listdir(INSTALL_DIR):
            item_path = os.path.join(INSTALL_DIR, item)
            if item == ".env" or item == ".env.backup" or item == "reminder.log":
                continue
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            else:
                os.remove(item_path)
    else:
        os.makedirs(INSTALL_DIR)

    # Copy all files from build
    for item in os.listdir(BUILD_DIR):
        src = os.path.join(BUILD_DIR, item)
        dst = os.path.join(INSTALL_DIR, item)
        if item == ".env" and os.path.exists(dst):
            # Don't overwrite existing .env
            continue
        if os.path.isdir(src):
            if os.path.exists(dst):
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    # Copy icon to install dir
    icon_dst = os.path.join(INSTALL_DIR, "sp_dent_logo.ico")
    if os.path.exists(ICON_FILE) and not os.path.exists(icon_dst):
        shutil.copy2(ICON_FILE, icon_dst)

    print(f"   [OK] Fajlovi kopirani u {INSTALL_DIR}")

    # -------------------------------------------------------------------
    # Step 2: Verify .env exists
    # -------------------------------------------------------------------
    env_path = os.path.join(INSTALL_DIR, ".env")
    if not os.path.exists(env_path):
        env_example = os.path.join(INSTALL_DIR, ".env.example")
        if os.path.exists(env_example):
            shutil.copy2(env_example, env_path)
            print(f"   [!] Kreiran .env od sablona. OBAVEZNO unesi ispravne podatke!")
        else:
            # Create a default .env
            with open(env_path, 'w', encoding='utf-8') as f:
                f.write("SUPABASE_URL=\n")
                f.write("SUPABASE_SERVICE_ROLE_KEY=\n")
                f.write("SMS_GATEWAY_URL=http://192.168.1.15:8080/send-sms\n")
                f.write("SMS_GATEWAY_TOKEN=\n")
                f.write("BYPASS_TIME_WINDOW=false\n")
            print(f"   [!] Kreiran prazan .env. OBAVEZNO unesi podatke pre pokretanja!")
    else:
        print(f"   [OK] Postojeci .env sacuvan (tvoja konfiguracija ostaje)")

    # -------------------------------------------------------------------
    # Step 3: Create Desktop shortcut
    # -------------------------------------------------------------------
    desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
    shortcut_path = os.path.join(desktop_path, f"{APP_NAME}.lnk")
    exe_path = os.path.join(INSTALL_DIR, EXE_NAME)
    icon_install = os.path.join(INSTALL_DIR, "sp_dent_logo.ico")

    if create_shortcut_vbs(shortcut_path, exe_path, INSTALL_DIR, icon_install, APP_NAME):
        print(f"   [OK] Precica na Desktop-u kreirana: {APP_NAME}")
    else:
        print(f"   [!] Nije uspelo pravljenje precice na Desktop-u.")

    # -------------------------------------------------------------------
    # Step 4: Add to Windows Startup (auto-run on boot)
    # -------------------------------------------------------------------
    startup_dir = os.path.join(
        os.getenv("APPDATA", ""),
        "Microsoft", "Windows", "Start Menu", "Programs", "Startup"
    )
    startup_shortcut = os.path.join(startup_dir, f"{APP_NAME}.lnk")

    if os.path.exists(startup_dir):
        if create_shortcut_vbs(startup_shortcut, exe_path, INSTALL_DIR, icon_install, f"{APP_NAME} - Automatsko pokretanje"):
            print(f"   [OK] Dodato u Windows Startup (pali se automatski sa racunarom)")
        else:
            print(f"   [!] Nije uspelo dodavanje u Startup.")
    else:
        print(f"   [!] Startup folder nije pronadjen: {startup_dir}")

    # -------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------
    print()
    print("=" * 60)
    print(f"  [OK] INSTALACIJA ZAVRSENA!")
    print("=" * 60)
    print()
    print(f"  Program instaliran u:  {INSTALL_DIR}")
    print(f"  Precica na Desktop-u:  {shortcut_path}")
    print(f"  Auto-start:            Ukljucen (pali se sa Windows-om)")
    print()
    print(f"  Za promenu IP adrese Android telefona:")
    print(f"     Otvori:  {env_path}")
    print(f"     Izmeni liniju:  SMS_GATEWAY_URL=http://NOVA_IP:8080/send-sms")
    print(f"     Sacuvaj i restartuj program.")
    print()
    print(f"  Log fajl (za pracenje rada):")
    print(f"     {os.path.join(INSTALL_DIR, 'reminder.log')}")
    print()

    input("Pritisni ENTER za zatvaranje...")


if __name__ == "__main__":
    main()
