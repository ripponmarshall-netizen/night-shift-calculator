#!/usr/bin/env bash
set -euo pipefail
python -m json.tool manifest.json >/dev/null
for f in index.html styles.css app.js sw.js; do
  test -s "$f"
done
node calc.test.js
echo "Basic checks passed"
