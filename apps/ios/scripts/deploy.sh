#!/usr/bin/env bash
# Build Glasses Lab, install it on the connected iPhone and launch it. No Xcode clicks.
#
#   scripts/deploy.sh            build, install, launch once
#   scripts/deploy.sh --logs     same, then stream the app's console output here
#   scripts/deploy.sh --watch    redeploy every time a Swift file or project.yml changes
#
# The iPhone must be unlocked, trusted and connected by cable or on the same Wi-Fi
# ("Connect via network" in Xcode's Devices window). Set DEVICE=<UDID> to pick one.
set -euo pipefail
cd "$(dirname "$0")/.."

BUNDLE_ID="com.davidvasilescu.junction.glasseslab"
DERIVED=".build/DerivedData"
APP="$DERIVED/Build/Products/Debug-iphoneos/GlassesLab.app"
MODE="${1:-}"

log() { printf '\033[1m[deploy %s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*"; }

find_device() {
  if [[ -n "${DEVICE:-}" ]]; then echo "$DEVICE"; return; fi
  local json; json="$(mktemp)"
  xcrun devicectl list devices --json-output "$json" >/dev/null 2>&1 || true
  python3 - "$json" <<'PY'
import json, sys
try:
    devices = json.load(open(sys.argv[1]))["result"]["devices"]
except Exception:
    sys.exit(0)
for d in devices:
    hw, conn = d.get("hardwareProperties", {}), d.get("connectionProperties", {})
    if hw.get("platform") == "iOS" and hw.get("reality") == "physical" and conn.get("pairingState") == "paired":
        print(hw.get("udid", "")); break
PY
  rm -f "$json"
}

deploy() {
  local udid; udid="$(find_device)"
  if [[ -z "$udid" ]]; then
    log "No paired iPhone found. Connect it, unlock it, and try again."
    return 1
  fi

  # Wake phrase libraries (not in git). A no-op once they are in Vendor/.
  scripts/fetch-wake-word-libs.sh

  if [[ ! -d GlassesLab.xcodeproj || project.yml -nt GlassesLab.xcodeproj ]]; then
    log "project.yml changed: regenerating the Xcode project"
    xcodegen generate --quiet
  fi

  # Build for a generic iPhone: xcodebuild then never has to reach the phone, which
  # times out over the network. devicectl does the install.
  log "Building"
  local build_log; build_log="$(mktemp)"
  if ! xcodebuild -project GlassesLab.xcodeproj -scheme GlassesLab \
      -destination "generic/platform=iOS" -derivedDataPath "$DERIVED" \
      -allowProvisioningUpdates build >"$build_log" 2>&1; then
    log "Build failed:"
    grep -E 'error:' "$build_log" | sort -u || tail -30 "$build_log"
    rm -f "$build_log"
    return 1
  fi
  grep -E 'warning:.*GlassesLab/' "$build_log" | sort -u || true
  rm -f "$build_log"

  log "Installing"
  local attempt
  for attempt in 1 2 3; do
    if xcrun devicectl device install app --device "$udid" "$APP" >/dev/null 2>&1; then break; fi
    if [[ $attempt == 3 ]]; then
      log "Can't reach the iPhone. Unlock it, and plug it in by cable: while a glasses stream"
      log "runs, the phone sits on the glasses' Wi-Fi and the Mac can't see it over the network."
      return 1
    fi
    log "iPhone not reachable, retrying in 3 s (unlock it)"
    sleep 3
  done

  log "Launching"
  if [[ "$MODE" == "--logs" ]]; then
    log "Streaming app output (Ctrl-C to stop)"
    xcrun devicectl device process launch --device "$udid" --terminate-existing --console "$BUNDLE_ID"
  else
    if xcrun devicectl device process launch --device "$udid" --terminate-existing "$BUNDLE_ID" >/dev/null 2>&1; then
      log "Running on the iPhone"
    else
      log "Installed. Open Glasses Lab on the iPhone (launch needs it unlocked)."
    fi
  fi
}

fingerprint() {
  # Sources and config only; the generated Info.plist is excluded to avoid loops.
  find GlassesLab project.yml -type f \
    \( -name '*.swift' -o -name '*.yml' -o -name '*.entitlements' -o -name '*.xcassets' \) \
    -exec stat -f '%m %N' {} + 2>/dev/null | sort | shasum
}

if [[ "$MODE" == "--watch" ]]; then
  log "Watching apps/ios for changes (Ctrl-C to stop)"
  last=""
  while true; do
    now="$(fingerprint)"
    if [[ "$now" != "$last" ]]; then
      last="$now"
      deploy || log "Waiting for the next change"
    fi
    sleep 2
  done
else
  deploy
fi
