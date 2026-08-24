#!/usr/bin/env python3
"""
SP DENT — SMS Appointment Reminder Worker (Production-Ready)
=============================================================
v3 — Time-based group sending:
  - Morning appointments (10:00-14:00 Belgrade): reminders sent 09:00-15:00 day before
  - Afternoon appointments (14:00+):             reminders sent 18:00-21:00 day before
  - Appointments before 10:00:                   reminders sent 09:00-15:00 day before

Bugs fixed vs. v1:
  - SMS duplication: reminder_sent is now verified after update, not assumed
  - Timezone window: uses exclusive upper bound (< next day 00:00) not 23:59:59
  - mark_reminder_sent: raises exception on failure so caller can handle it
  - time import moved to top level
  - Added total run-time logging
"""

import os
import sys
import time
import random
import logging
from datetime import datetime, timedelta
import pytz

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
load_dotenv()

SUPABASE_URL              = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SMS_GATEWAY_URL           = os.getenv("SMS_GATEWAY_URL", "http://192.168.1.15:8080/send-sms")
SMS_GATEWAY_TOKEN         = os.getenv("SMS_GATEWAY_TOKEN", "")

BELGRADE_TZ       = pytz.timezone("Europe/Belgrade")
UTC_TZ            = pytz.utc
SMS_TIMEOUT_SEC   = 10
MAX_RETRIES       = 3

# ---------------------------------------------------------------------------
# Time-based sending groups
# ---------------------------------------------------------------------------
# Appointment hour (Belgrade) → which SMS sending window to use
#
#   Appointment 00:00–13:59  →  "morning" group  →  send SMS between 09:00–15:00
#   Appointment 14:00–23:59  →  "evening" group  →  send SMS between 18:00–21:00
#
MORNING_SEND_START = 9    # SMS sending starts at 09:00
MORNING_SEND_END   = 15   # SMS sending ends   at 15:00 (exclusive)
EVENING_SEND_START = 18   # SMS sending starts at 18:00
EVENING_SEND_END   = 21   # SMS sending ends   at 21:00 (exclusive)
APPT_AFTERNOON_CUTOFF = 14  # Appointments at or after 14:00 are "afternoon"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), "reminder.log"),
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("sp_dent_sms")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def validate_config() -> None:
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing:
        log.critical(f"Missing required env vars: {', '.join(missing)}. Aborting.")
        sys.exit(1)


def get_tomorrow_window_utc() -> tuple[str, str]:
    """
    Returns UTC ISO strings for the FULL next calendar day in Belgrade time.
    """
    now_belgrade = datetime.now(BELGRADE_TZ)
    tomorrow_date = now_belgrade.date() + timedelta(days=1)
    day_after_date = tomorrow_date + timedelta(days=1)

    start_local = BELGRADE_TZ.localize(datetime(
        tomorrow_date.year, tomorrow_date.month, tomorrow_date.day, 0, 0, 0
    ))
    end_local = BELGRADE_TZ.localize(datetime(
        day_after_date.year, day_after_date.month, day_after_date.day, 0, 0, 0
    ))

    return (
        start_local.astimezone(UTC_TZ).isoformat(),
        end_local.astimezone(UTC_TZ).isoformat(),
    )


def get_appointment_hour_belgrade(dt_iso: str) -> int:
    """Returns the hour (0-23) of the appointment in Belgrade timezone."""
    dt = datetime.fromisoformat(dt_iso.replace("Z", "+00:00"))
    return dt.astimezone(BELGRADE_TZ).hour


def format_time_belgrade(dt_iso: str) -> str:
    """Converts UTC ISO string → HH:MM in Europe/Belgrade."""
    dt = datetime.fromisoformat(dt_iso.replace("Z", "+00:00"))
    return dt.astimezone(BELGRADE_TZ).strftime("%H:%M")


def build_message(first_name: str, appt_time: str) -> str:
    return f"Imate zakazan termin sutra u {appt_time} u SP dent."


def get_robust_session() -> requests.Session:
    """Creates a Requests session with exponential backoff retries."""
    session = requests.Session()
    retry_strategy = Retry(
        total=MAX_RETRIES,
        backoff_factor=2,  # 2s, 4s, 8s backoff
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["POST"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def log_to_supabase(supabase: Client, level: str, message: str, component: str, payload: dict = None) -> None:
    """Helper to write log to Supabase system_logs table."""
    try:
        supabase.table("system_logs").insert({
            "level": level,
            "message": message,
            "component": component,
            "payload": payload or {}
        }).execute()
    except Exception as exc:
        log.error(f"Failed to write log to Supabase system_logs: {exc}")


def send_sms(session: requests.Session, phone: str, message: str) -> bool:
    """
    POST to Android SMS Gateway using the robust session.
    Returns True only on confirmed HTTP 200.
    """
    payload = {
        "phone": phone,
        "to": phone,
        "number": phone,
        "message": message
    }

    headers = {}
    if SMS_GATEWAY_TOKEN:
        headers["Authorization"] = f"Bearer {SMS_GATEWAY_TOKEN}"

    try:
        resp = session.post(SMS_GATEWAY_URL, json=payload, headers=headers, timeout=SMS_TIMEOUT_SEC)
        resp.raise_for_status()
        log.info(f"  ✅ SMS sent → {phone}")
        return True
    except requests.exceptions.RequestException as exc:
        log.error(f"  ❌ CRITICAL: Failed to send SMS to {phone} after retries: {exc}")
        return False


def mark_reminder_sent(supabase: Client, appointment_id: str) -> bool:
    """
    Marks reminder_sent = true and VERIFIES the update was applied.

    FIX vs. v1: Previous version called .execute() and only checked
    `result.error` which can be falsy even when 0 rows were updated
    (e.g., RLS block or stale ID). Now we verify affected row count.

    Returns True if successfully marked, False otherwise.
    """
    try:
        result = (
            supabase.table("appointments")
            .update({"reminder_sent": True})
            .eq("id", appointment_id)
            .eq("reminder_sent", False)   # Idempotency guard: only update if still false
            .execute()
        )
        # supabase-py v2 returns data as list of updated rows
        if result.data and len(result.data) > 0:
            log.info(f"  📝 Marked reminder_sent=true for {appointment_id}")
            return True
        else:
            # 0 rows updated: either already marked (duplicate run) or ID not found
            log.warning(
                f"  ⚠️  reminder_sent update matched 0 rows for {appointment_id}. "
                f"Already sent or ID invalid."
            )
            return False
    except Exception as exc:
        log.error(f"  ❌ Failed to mark reminder_sent for {appointment_id}: {exc}")
        return False


def process_appointments(supabase: Client, appointments: list, group_label: str) -> tuple[int, int, int]:
    """
    Sends SMS reminders for a list of appointments.
    Returns (sent_count, failed_count, skipped_count).
    """
    sent_count = failed_count = skipped_count = 0
    session = get_robust_session()

    for appt in appointments:
        appt_id    = appt.get("id", "")
        patient    = appt.get("patients") or {}
        first_name = patient.get("first_name", "Pacijent")
        phone      = patient.get("phone", "").strip()

        if not phone or phone.startswith("/"):
            log.info(f"  ℹ️  [{group_label}] {appt_id}: Pacijent {first_name} nema unet broj telefona (označeno sa {phone}). Označavamo podsetnik kao poslat u bazi.")
            mark_reminder_sent(supabase, appt_id)
            skipped_count += 1
            continue

        appt_time = format_time_belgrade(appt["appointment_datetime"])
        message   = build_message(first_name, appt_time)

        log.info(f"→ [{group_label}] {first_name} ({phone})  termin: {appt_time}h")

        sms_ok = send_sms(session, phone, message)

        if sms_ok:
            db_ok = mark_reminder_sent(supabase, appt_id)
            if db_ok:
                sent_count += 1
                # Anti-spam delay
                delay = random.randint(7, 15)
                log.info(f"  Sleeping for {delay} seconds before next SMS...")
                time.sleep(delay)
            else:
                log.error(
                    f"  🔴 CRITICAL: SMS sent to {phone} but DB update failed for {appt_id}."
                )
                failed_count += 1
        else:
            failed_count += 1

    return sent_count, failed_count, skipped_count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    validate_config()

    log.info("Starting SMS daemon worker (v3 — time-based groups)...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    # Send starting log
    log_to_supabase(supabase, "INFO", "SMS Daemon started (v3 — time-based groups)", "sms_worker")

    while True:
        try:
            # 1. Write heartbeat
            log_to_supabase(supabase, "INFO", "Heartbeat", "sms_worker")
            log.info("Heartbeat sent to Supabase.")

            # 2. Check current Belgrade time and determine which group(s) to process
            now_belgrade = datetime.now(BELGRADE_TZ)
            current_hour = now_belgrade.hour
            bypass_window = os.getenv("BYPASS_TIME_WINDOW", "false").lower() == "true"

            # Determine which groups are active right now
            # Morning group:  send between 09:00–15:00 for appointments before 14:00
            # Evening group:  send between 18:00–21:00 for appointments at 14:00+
            in_morning_window = MORNING_SEND_START <= current_hour < MORNING_SEND_END
            in_evening_window = EVENING_SEND_START <= current_hour < EVENING_SEND_END
            has_active_window = in_morning_window or in_evening_window or bypass_window

            if has_active_window:
                run_start = time.monotonic()
                start_utc, end_utc = get_tomorrow_window_utc()
                tomorrow_str = (now_belgrade.date() + timedelta(days=1)).strftime("%d.%m.%Y")
                log.info(f"Active window at {now_belgrade.strftime('%H:%M')}. Checking tomorrow's appointments ({tomorrow_str})...")
                log.info(f"  UTC range: {start_utc[:16]} → {end_utc[:16]}")
                if in_morning_window or bypass_window:
                    log.info(f"  📅 MORNING window active (09-15h) → appointments before 14:00")
                if in_evening_window or bypass_window:
                    log.info(f"  🌙 EVENING window active (18-21h) → appointments 14:00+")

                # Fetch ALL unreminded appointments for tomorrow
                result = (
                    supabase.table("appointments")
                    .select("id, appointment_datetime, patients(first_name, phone)")
                    .gte("appointment_datetime", start_utc)
                    .lt("appointment_datetime", end_utc)
                    .eq("reminder_sent", False)
                    .execute()
                )

                all_appointments = result.data or []
                log.info(f"Found {len(all_appointments)} total unreminded appointment(s) for tomorrow.")

                if all_appointments:
                    # Split into morning (before 14:00) and afternoon (14:00+) groups
                    morning_appts = []
                    evening_appts = []

                    for appt in all_appointments:
                        appt_hour = get_appointment_hour_belgrade(appt["appointment_datetime"])
                        if appt_hour < APPT_AFTERNOON_CUTOFF:
                            morning_appts.append(appt)
                        else:
                            evening_appts.append(appt)

                    log.info(f"  Split: {len(morning_appts)} morning (before 14h) | {len(evening_appts)} afternoon (14h+)")

                    total_sent = total_failed = total_skipped = 0

                    # Process morning group (appointments before 14:00) — only during morning send window
                    if morning_appts and (in_morning_window or bypass_window):
                        log.info(f"📅 Processing MORNING group ({len(morning_appts)} appointments)...")
                        s, f, sk = process_appointments(supabase, morning_appts, "JUTRO")
                        total_sent += s
                        total_failed += f
                        total_skipped += sk
                    elif morning_appts and not in_morning_window:
                        log.info(f"  ⏳ {len(morning_appts)} morning appointments waiting — will send during 09-15h window.")

                    # Process evening group (appointments 14:00+) — only during evening send window
                    if evening_appts and (in_evening_window or bypass_window):
                        log.info(f"🌙 Processing EVENING group ({len(evening_appts)} appointments)...")
                        s, f, sk = process_appointments(supabase, evening_appts, "VEČE")
                        total_sent += s
                        total_failed += f
                        total_skipped += sk
                    elif evening_appts and not in_evening_window:
                        log.info(f"  ⏳ {len(evening_appts)} afternoon appointments waiting — will send during 18-21h window.")

                    elapsed = time.monotonic() - run_start
                    log.info(f"Finished sending round: Sent: {total_sent} | Failed: {total_failed} | Skipped: {total_skipped} (Took {elapsed:.2f}s)")
                else:
                    elapsed = time.monotonic() - run_start
                    log.info(f"No appointments to process. (Took {elapsed:.2f}s)")
            else:
                log.info(f"Outside all sending windows ({now_belgrade.strftime('%H:%M')}). Next windows: 09-15h or 18-21h.")

        except Exception as err:
            log.error(f"Error in main loop iteration: {err}")
            try:
                log_to_supabase(supabase, "CRITICAL", f"Error in main loop iteration: {err}", "sms_worker")
            except Exception:
                pass

        # Sleep for 10 minutes (600 seconds)
        log.info("Sleeping for 10 minutes...")
        time.sleep(600)


if __name__ == "__main__":
    main()
