#!/bin/sh
# Removes the Apple Foundation Models helper and its Chrome registration.
set -eu
rm -f "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.lentochist.fm.json"
rm -rf "$HOME/Library/Application Support/lentochist"
echo "Removed the lentochist Apple FM helper."
