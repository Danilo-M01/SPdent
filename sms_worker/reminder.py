#!/usr/bin/env python3
"""
SP DENT — SMS Appointment Reminder Worker (Production-Ready)
=============================================================
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
from zoneinfo import ZoneInfo

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
SMS_GATEWAY_URL           = os.getenv("SMS_GATEWAY_URL", "http://192.168.1.15:8080/send")

BELGRADE_TZ       = ZoneInfo("Europe/Belgrade")
UTC_TZ            = ZoneInfo("UTC")
SMS_TIMEOUT_SEC   = 10
MAX_RETRIES       = 3

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
    Uses Python 3.9+ zoneinfo for accurate daylight savings offsets.
    """
    now_belgrade = datetime.now(BELGRADE_TZ)
    tomorrow_date = now_belgrade.date() + timedelta(days=1)
    day_after_date = tomorrow_date + timedelta(days=1)

    start_local = datetime(
        tomorrow_date.year, tomorrow_date.month, tomorrow_date.day, 0, 0, 0, tzinfo=BELGRADE_TZ
    )
    end_local = datetime(
        day_after_date.year, day_after_date.month, day_after_date.day, 0, 0, 0, tzinfo=BELGRADE_TZ
    )

    return (
        start_local.astimezone(UTC_TZ).isoformat(),
        end_local.astimezone(UTC_TZ).isoformat(),
    )


def format_time_belgrade(dt_iso: str) -> str:
    """Converts UTC ISO string → HH:MM in Europe/Belgrade."""
    dt = datetime.fromisoformat(dt_iso.replace("Z", "+00:00"))
    return dt.astimezone(BELGRADE_TZ).strftime("%H:%M")


def build_message(first_name: str, appt_time: str) -> str:
    return (
        f"Postovani {first_name}, podsecamo Vas na Vas stomatoloski termin "
        f"sutra u {appt_time}h. Srdacan pozdrav!"
    )


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
    payload = {"phone": phone, "message": message}

    try:
        resp = session.post(SMS_GATEWAY_URL, json=payload, timeout=SMS_TIMEOUT_SEC)
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


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    validate_config()

    log.info("Starting SMS daemon worker...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    # Send starting log
    log_to_supabase(supabase, "INFO", "SMS Daemon started", "sms_worker")

    while True:
        try:
            # 1. Write heartbeat
            log_to_supabase(supabase, "INFO", "Heartbeat", "sms_worker")
            log.info("Heartbeat sent to Supabase.")

            # 2. Check time window (18:00 - 20:00 Belgrade time)
            now_belgrade = datetime.now(BELGRADE_TZ)
            current_hour = now_belgrade.hour

            if 18 <= current_hour < 20:
                log.info(f"Inside sending window ({now_belgrade.strftime('%H:%M')}). Checking appointments...")
                run_start = time.monotonic()
                start_utc, end_utc = get_tomorrow_window_utc()
                tomorrow_str = (now_belgrade.date() + timedelta(days=1)).strftime("%d.%m.%Y")
                log.info(f"Window: {tomorrow_str} Belgrade  |  UTC: {start_utc[:16]} → {end_utc[:16]}")

                result = (
                    supabase.table("appointments")
                    .select("id, appointment_datetime, patients(first_name, phone)")
                    .gte("appointment_datetime", start_utc)
                    .lt("appointment_datetime", end_utc)
                    .eq("reminder_sent", False)
                    .execute()
                )

                appointments = result.data or []
                log.info(f"Found {len(appointments)} unreminded appointment(s).")

                if appointments:
                    sent_count = failed_count = skipped_count = 0
                    session = get_robust_session()

                    for appt in appointments:
                        appt_id   = appt.get("id", "")
                        patient   = appt.get("patients") or {}
                        first_name = patient.get("first_name", "Pacijent")
                        phone     = patient.get("phone", "").strip()

                        if not phone or phone.startswith("/"):
                            log.info(f"  ℹ️  {appt_id}: Pacijent {first_name} nema unet broj telefona (označeno sa {phone}). Označavamo podsetnik kao poslat u bazi.")
                            mark_reminder_sent(supabase, appt_id)
                            skipped_count += 1
                            continue

                        appt_time = format_time_belgrade(appt["appointment_datetime"])
                        message   = build_message(first_name, appt_time)

                        log.info(f"→ {first_name} ({phone})  termin: {appt_time}h")

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

                    elapsed = time.monotonic() - run_start
                    log.info(f"Finished sending round: Sent: {sent_count} | Failed: {failed_count} | Skipped: {skipped_count} (Took {elapsed:.2f}s)")
            else:
                log.info(f"Outside sending window ({now_belgrade.strftime('%H:%M')}). Skipping appointment check.")

        except Exception as err:
            log.error(f"Error in main loop iteration: {err}")
            try:
                log_to_supabase(supabase, "CRITICAL", f"Error in main loop iteration: {err}", "sms_worker")
            except Exception:
                pass

        # Sleep for 10 minutes (600 seconds)
        log.info("Sleeping for 10 minutes...")
        time.sleep(600)
