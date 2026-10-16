#!/bin/bash
# Double-click to play Poser. Opens the game in its own Chrome window that is allowed to play music
# straight away (normal browser tabs block sound until the first click). Uses a separate Chrome profile,
# so it works even if Chrome is already open and doesn't change your normal Chrome settings.
cd "$(dirname "$0")" || exit 1
PORT=8080
if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  nohup python3 -m http.server $PORT >/dev/null 2>&1 &
  sleep 1
fi
open -na "Google Chrome" --args --user-data-dir="$HOME/Library/Application Support/Poser-Chrome" \
  --autoplay-policy=no-user-gesture-required --app="http://localhost:$PORT"
