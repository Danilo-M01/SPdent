#!/usr/bin/env python3
"""
SP DENT — SMS Gateway Local Test Script
======================================
Use this script to test that your local Android SMS Gateway can receive
a POST command from this PC and send a physical SMS text.

Make sure the Android SMS Gateway application is running and you are
connected to the same Wi-Fi network.
"""

import os
import sys
import requests
from dotenv import load_dotenv

# Load env variables if they exist
load_dotenv()

def main():
    print("=" * 60)
    print("SP DENT — SMS Gateway Local Connection Test")
    print("=" * 60)

    # Load from env or prompt
    gateway_url = os.getenv("SMS_GATEWAY_URL", "http://192.168.0.3:8080/send-sms")
    token = os.getenv("SMS_GATEWAY_TOKEN", "")
    test_phone = os.getenv("TEST_PHONE_NUMBER", "").strip()

    if test_phone:
        print(f"Using TEST_PHONE_NUMBER from env: {test_phone}")
        phone = test_phone
        message = "Imate zakazan termin sutra u 10:00 u SP dent."
    else:
        # Fallback to interactive mode if no test phone is in .env
        print(f"Default Gateway URL: {gateway_url}")
        user_url = input(f"Enter Gateway URL [Press Enter to keep default]: ").strip()
        if user_url:
            gateway_url = user_url

        user_token = input(f"Enter API Token/Password [Press Enter for none or env value]: ").strip()
        if user_token:
            token = user_token

        phone = input("Enter phone number to send test SMS to (e.g. +38164123456): ").strip()
        if not phone:
            print("Error: Phone number is required.")
            return

        message = input("Enter test message [Press Enter for default]: ").strip()
        if not message:
            message = "Imate zakazan termin sutra u 10:00 u SP dent."

    print("\nSending POST request to Android Gateway...")
    print(f"Target URL: {gateway_url}")
    print(f"Payload: {{'phone': '{phone}', 'to': '{phone}', 'number': '{phone}', 'message': '{message}'}}")
    print("-" * 60)

    payload = {
        "phone": phone,
        "to": phone,
        "number": phone,
        "message": message
    }

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = requests.post(gateway_url, json=payload, headers=headers, timeout=10)
        print(f"Response Status Code: {resp.status_code}")
        print(f"Response Body: {resp.text}")
        print("-" * 60)
        
        if resp.status_code == 200:
            print("✅ USPEH! Gateway je potvrdio prijem. Proverite telefon da li je poslao SMS.")
        else:
            print(f"⚠️ Gateway je vratio HTTP status {resp.status_code}. Proverite konzolu na telefonu.")
            
    except requests.exceptions.Timeout:
        print("❌ GRESKA: Timeout! Nema odgovora od gateway-a (isteklo 10 sekundi).")
        print("   Proverite da li su telefon i PC na istoj Wi-Fi mrezi i da li je IP adresa tacna.")
    except requests.exceptions.ConnectionError:
        print("❌ GRESKA: Neuspesno povezivanje (Connection Refused).")
        print("   Proverite da li je gateway server na telefonu pokrenut i da li je port tacan.")
    except Exception as exc:
        print(f"❌ GRESKA: Neocekivana greska: {exc}")

    input("\nPritisnite Enter za izlaz...")

if __name__ == "__main__":
    main()
