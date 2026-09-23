#!/bin/sh
# PITTER-PATTER launcher
#   ./play.sh            open the game in your web browser
#   ./play.sh --server   serve it on http://127.0.0.1 instead (use this if a browser refuses local files)
DIR="$(cd "$(dirname "$0")" && pwd)"
GAME="$DIR/game"
URL="file://$GAME/index.html"

# Show a message in the terminal, or as a desktop pop-up when started by double-click.
say() {
  echo "$1"
  if [ ! -t 1 ]; then
    if command -v notify-send >/dev/null 2>&1; then notify-send "PITTER-PATTER" "$1"
    elif command -v zenity >/dev/null 2>&1; then zenity --info --title="PITTER-PATTER" --text="$1" >/dev/null 2>&1
    fi
  fi
}

# Try the desktop's default browser first, then any browser we can find.
open_url() {
  for cmd in xdg-open gio sensible-browser x-www-browser vivaldi vivaldi-stable google-chrome google-chrome-stable \
             chromium chromium-browser brave-browser microsoft-edge firefox; do
    command -v "$cmd" >/dev/null 2>&1 || continue
    case "$cmd" in
      xdg-open) xdg-open "$1" >/dev/null 2>&1 && return 0 ;;
      gio) gio open "$1" >/dev/null 2>&1 && return 0 ;;
      *) nohup "$cmd" "$1" >/dev/null 2>&1 & return 0 ;;
    esac
  done
  return 1
}

if [ ! -f "$GAME/index.html" ]; then
  say "Can't find the game at $GAME/index.html"
  exit 1
fi

if [ "$1" = "--server" ]; then
  if ! command -v python3 >/dev/null 2>&1; then say "--server needs python3."; exit 1; fi
  PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')
  cd "$GAME" || exit 1
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT INT TERM
  sleep 1
  open_url "http://127.0.0.1:$PORT/index.html" || say "Open http://127.0.0.1:$PORT/index.html in your browser."
  echo "PITTER-PATTER is running at http://127.0.0.1:$PORT/index.html  (press Ctrl+C here to stop)"
  wait "$SERVER"
  exit 0
fi

if ! open_url "$URL"; then
  say "Couldn't start a web browser. Open this file in your browser instead: $GAME/index.html"
  exit 1
fi
