#!/usr/bin/env bash
# Downloads the two prebuilt iOS libraries the "Hey Facto" wake phrase detector links against
# (issue #53) into apps/ios/Vendor, which is not committed. About 47 MB, once.
#
#   sherpa-onnx 2.0.1  (Apache-2.0)  on-device keyword spotting
#   onnxruntime 1.28.2 (MIT)         the model runtime it uses
#
# xcodegen runs this before generating the project (options.preGenCommand in project.yml).
# Each archive is checked against a pinned SHA-256 before it is unpacked.
set -euo pipefail
cd "$(dirname "$0")/.."

VENDOR="Vendor"

fetch() { # name url sha256
  local name="$1" url="$2" sha="$3"
  if [[ -d "$VENDOR/$name.xcframework" && -f "$VENDOR/$name.sha256" && "$(cat "$VENDOR/$name.sha256")" == "$sha" ]]; then
    return
  fi
  echo "[wake-word] downloading $name"
  mkdir -p "$VENDOR"
  local zip; zip="$(mktemp)"
  if ! curl -fL --retry 3 --retry-delay 2 -o "$zip" "$url"; then
    rm -f "$zip"
    echo "[wake-word] download failed: $url" >&2
    exit 1
  fi
  local actual; actual="$(shasum -a 256 "$zip" | cut -d' ' -f1)"
  if [[ "$actual" != "$sha" ]]; then
    rm -f "$zip"
    echo "[wake-word] checksum mismatch for $name: expected $sha, got $actual" >&2
    exit 1
  fi
  rm -rf "$VENDOR/$name.xcframework"
  unzip -q -o "$zip" -d "$VENDOR"
  rm -f "$zip"
  echo "$sha" > "$VENDOR/$name.sha256"
}

fetch sherpa-onnx \
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/xcframework/sherpa-onnx-v2.0.1-ios-static.xcframework.zip" \
  "88aa569f71b7903e0bbdfbe6e2e114b3b95862b1ef0759eea3024f82926d7374"

fetch onnxruntime \
  "https://github.com/csukuangfj/onnxruntime-libs/releases/download/v1.28.2/onnxruntime-ios-static-xcframework-1.28.2.xcframework.zip" \
  "2c2299acbb461d26d4bac4bc85985d40e7c7177ed6072703ae0846d88b0b4599"
