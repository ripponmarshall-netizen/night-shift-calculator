#!/usr/bin/env bash
set -euo pipefail
python -m json.tool manifest.json >/dev/null
for f in index.html styles.css sw.js app.jsx helpers.jsx; do
  test -s "$f"
done
node calc.test.js
echo "Basic checks passed"
