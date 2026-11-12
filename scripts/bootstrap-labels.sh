#!/usr/bin/env bash
# Create the routing and wave labels used by ticketize, dispatch and the GitHub Action.
set -euo pipefail
mk() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "label $1"; }
mk claude        "D97757" "Triggers the Claude GitHub Action on this issue"
mk agent:cloud   "D97757" "Dispatch to a Claude Code cloud session"
mk agent:copilot "6E40C9" "Dispatch to the Copilot cloud agent"
mk agent:codex   "10A37F" "Dispatch to Codex cloud"
mk human         "0E8A16" "A teammate owns this"
mk dispatched    "BFBFBF" "Already sent to an agent"
for w in 1 2 3 4 5; do mk "wave:$w" "FBCA04" "Parallel wave $w"; done
# Review cycle: fire reviewed by water, water by grass, grass by fire.
mk type:fire  "E25822" "🔥 Cipriamn owns; reviewed by 💧 water"
mk type:water "1F6FEB" "💧 erick-dsnk owns; reviewed by 🌱 grass"
mk type:grass "2DA44E" "🌱 Davidtzuke owns; reviewed by 🔥 fire"
