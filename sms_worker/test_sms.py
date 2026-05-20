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

    # 1. Ask for Gateway URL or read from env
    env_gateway = os.getenv("SMS_GATEWAY_URL", "")
    default_gateway = env_gateway if env_gateway else "http://192.168.1.15:8080/send"
    
    print(f"Default Gateway URL: {default_gateway}")
    gateway_url = input(f"Enter Gateway URL [Press Enter to keep default]: ").strip()
    if not gateway_url:
        gateway_url = default_gateway

    # 2. Ask for recipient phone number
    phone = input("Enter phone number to send test SMS to (e.g. 064123456): ").strip()
    if not phone:
        print("Error: Phone number is required.")
        return

    # 3. Enter message content
    message = input("Enter test message [Default: SP DENT Test SMS]: ").strip()
    if not message:
        message = "SP DENT Test SMS — Veza sa gateway-om uspesno uspostavljena!"

    print("\nSending POST request to Android Gateway...")
    print(f"Target URL: {gateway_url}")
    print(f"Payload: {{'phone': '{phone}', 'message': '{message}'}}")
    print("-" * 60)

    payload = {
        "phone": phone,
        "message": message
    }

    try:
        resp = requests.post(gateway_url, json=payload, timeout=10)
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

if __name__ == "__main__":
    main()
