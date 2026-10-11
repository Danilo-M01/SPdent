"""
SP DENT SMS Worker — PyInstaller Build Script
==============================================
Run this from the sms_worker directory:
    python build_exe.py

Produces:  dist/SP_DENT_SMS/SP_DENT_SMS.exe  (one-folder mode)
           dist/SP_DENT_SMS/.env              (copied for convenience)
"""

import os
import sys
import shutil
import subprocess

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
ENTRY_POINT  = os.path.join(SCRIPT_DIR, "reminder_exe.py")
ICON_FILE    = os.path.join(SCRIPT_DIR, "sp_dent_logo.ico")
DIST_DIR     = os.path.join(SCRIPT_DIR, "dist")
OUTPUT_NAME  = "SP_DENT_SMS"
OUTPUT_DIR   = os.path.join(DIST_DIR, OUTPUT_NAME)


def main():
    print("=" * 60)
    print("  SP DENT SMS Worker — Building .exe")
    print("=" * 60)

    # Verify files exist
    if not os.path.exists(ENTRY_POINT):
        print(f"ERROR: {ENTRY_POINT} not found!")
        sys.exit(1)
    if not os.path.exists(ICON_FILE):
        print(f"WARNING: Icon file {ICON_FILE} not found. Building without icon.")
        icon_arg = []
    else:
        icon_arg = [f"--icon={ICON_FILE}"]

    # Build command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--name", OUTPUT_NAME,
        # One-folder mode (more reliable than one-file for long-running daemons)
        "--distpath", DIST_DIR,
        # Hidden imports that PyInstaller sometimes misses
        "--hidden-import", "dotenv",
        "--hidden-import", "supabase",
        "--hidden-import", "gotrue",
        "--hidden-import", "postgrest",
        "--hidden-import", "storage3",
        "--hidden-import", "supafunc",
        "--hidden-import", "realtime",
        "--hidden-import", "httpx",
        "--hidden-import", "httpcore",
        "--hidden-import", "h11",
        "--hidden-import", "anyio",
        "--hidden-import", "sniffio",
        "--hidden-import", "certifi",
        "--hidden-import", "charset_normalizer",
        "--hidden-import", "idna",
        "--hidden-import", "pytz",
        "--hidden-import", "websockets",
        # Collect all data for packages that need it
        "--collect-all", "certifi",
        "--collect-all", "pytz",
        *icon_arg,
        # Console app (shows the CMD window with logs)
        "--console",
        ENTRY_POINT,
    ]

    print(f"\nRunning PyInstaller...")
    print(f"  Command: {' '.join(cmd)}\n")

    result = subprocess.run(cmd, cwd=SCRIPT_DIR)

    if result.returncode != 0:
        print(f"\n❌ PyInstaller failed with exit code {result.returncode}")
        sys.exit(1)

    # Copy .env.example into the dist folder so the user has a template
    env_example_src = os.path.join(SCRIPT_DIR, ".env.example")
    env_example_dst = os.path.join(OUTPUT_DIR, ".env.example")
    env_dst = os.path.join(OUTPUT_DIR, ".env")

    if os.path.exists(env_example_src):
        shutil.copy2(env_example_src, env_example_dst)
        print(f"  Copied .env.example -> {env_example_dst}")

    # Also copy the actual .env if it exists (for convenience on this machine)
    env_src = os.path.join(SCRIPT_DIR, ".env")
    if os.path.exists(env_src):
        shutil.copy2(env_src, env_dst)
        print(f"  Copied .env -> {env_dst}")

    # Copy icon to dist folder so it's completely self-contained
    icon_dst = os.path.join(OUTPUT_DIR, "sp_dent_logo.ico")
    if os.path.exists(ICON_FILE):
        shutil.copy2(ICON_FILE, icon_dst)
        print(f"  Copied icon -> {icon_dst}")

    # Copy 1-click batch installer
    installer_src = os.path.join(SCRIPT_DIR, "Instaliraj_Precice.bat")
    installer_dst = os.path.join(OUTPUT_DIR, "Instaliraj_Precice.bat")
    if os.path.exists(installer_src):
        shutil.copy2(installer_src, installer_dst)
        print(f"  Copied Instaliraj_Precice.bat -> {installer_dst}")

    print(f"\n{'=' * 60}")
    print(f"  [OK] BUILD SUCCESSFUL!")
    print(f"  Output: {OUTPUT_DIR}")
    print(f"  EXE:    {os.path.join(OUTPUT_DIR, OUTPUT_NAME + '.exe')}")
    print(f"{'=' * 60}")
    print(f"\nNAPOMENA: Pre pokretanja na drugom racunaru,")
    print(f"  kopiraj ceo folder '{OUTPUT_NAME}' i stavi .env fajl unutra")
    print(f"  sa ispravnim SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY i SMS_GATEWAY_URL.")


if __name__ == "__main__":
    main()
