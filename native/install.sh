#!/bin/sh
# Builds the Apple Foundation Models helper and registers it with Google Chrome
# as a Native Messaging host for the lentochist extension. Needs macOS 26+,
# Xcode and Apple Intelligence turned on. Run again after pulling changes.
set -eu

HOST=com.lentochist.fm
EXTENSION_ID=nnpgkkggehcakagglofehockjhinfhie
HERE=$(cd "$(dirname "$0")" && pwd)
APP_DIR="$HOME/Library/Application Support/lentochist"
HOSTS_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

cd "$HERE"
swift build -c release
BIN="$(swift build -c release --show-bin-path)/lentochist-fm"

mkdir -p "$APP_DIR" "$HOSTS_DIR"
cp "$BIN" "$APP_DIR/lentochist-fm"

cat > "$HOSTS_DIR/$HOST.json" <<JSON
{
  "name": "$HOST",
  "description": "lentochist: Apple Foundation Models for tweet filtering",
  "path": "$APP_DIR/lentochist-fm",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
JSON

echo "Installed $APP_DIR/lentochist-fm"
echo "Registered $HOSTS_DIR/$HOST.json"
echo "Reload the extension in chrome://extensions to pick it up."
