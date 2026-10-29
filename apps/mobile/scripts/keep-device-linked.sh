#!/bin/sh
# Development only. A development build loads its code from Metro on this computer, through
# `adb reverse`. When a phone drops off (Wi-Fi debugging reconnects, a cable is unplugged), those
# forwards are lost and the app sits on the splash screen ("Unable to load script" in logcat).
# This puts them back every few seconds for every connected phone. Stop it with Ctrl+C.
# Ports: Metro, the local API and the local web (in-app pages, address lookups); override with PORTS="8081 3001 3000".
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
PORTS="${PORTS:-8081 3001 3000}"
echo "Keeping ports $PORTS forwarded to connected phones"
while true; do
  for serial in $("$ADB" devices | awk 'NR > 1 && $2 == "device" { print $1 }'); do
    linked=$("$ADB" -s "$serial" reverse --list 2>/dev/null)
    for port in $PORTS; do
      case "$linked" in
        *"tcp:$port tcp:$port"*) ;;
        *) "$ADB" -s "$serial" reverse "tcp:$port" "tcp:$port" >/dev/null && echo "$(date +%H:%M:%S) linked $serial tcp:$port" ;;
      esac
    done
  done
  sleep 3
done
