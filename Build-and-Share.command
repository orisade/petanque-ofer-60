#!/bin/bash
# Double-click this file to build both shareable copies of the game.
#   1. Petanque-Ofer-60.html         — playable, just double-click it
#   2. Petanque-Ofer-60-source.zip   — the editable project
cd "$(dirname "$0")" || exit 1

echo ""
echo "=============================================="
echo "   Petanque Ofer 60 — building your copies"
echo "=============================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "!! Node.js is not installed."
  echo "   Get it from https://nodejs.org (take the LTS version),"
  echo "   then double-click this file again."
  echo ""
  read -n 1 -r -p "Press any key to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run — installing dependencies (one minute or so)..."
  npm install --silent || { echo "!! npm install failed"; read -n 1 -r -p "Press any key..."; exit 1; }
  echo ""
fi

echo "Building..."
if npm run release --silent; then
  echo ""
  echo "=============================================="
  echo "  Done. Both files are in this folder:"
  echo ""
  ls -lh Petanque-Ofer-60.html Petanque-Ofer-60-source.zip 2>/dev/null | awk '{print "   " $9 "   " $5}'
  echo ""
  echo "  Send the .html to someone who wants to PLAY."
  echo "  Send the .zip to someone who wants to EDIT."
  echo "=============================================="
  open . 2>/dev/null
else
  echo ""
  echo "!! Build failed — see the messages above."
fi

echo ""
read -n 1 -r -p "Press any key to close..."
