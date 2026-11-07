#!/usr/bin/env zsh
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================================================================"
echo "🌐 STARTING ALL 3 SOVEREIGN V12.2 MARKETS ('THE SOVEREIGN APEX 95% FINALE')"
echo "--------------------------------------------------------------------------------"
echo "1. 🇿🇦 JSE Stock Market    -> UI: http://localhost:5173  | API: http://localhost:8000"
echo "2. 🇺🇸 US Wall Street      -> UI: http://localhost:5174  | API: http://localhost:8001"
echo "3. ⚡ Crypto 24/7 1x Spot -> UI: http://localhost:5175  | API: http://localhost:8002"
echo "================================================================================"

# Free any existing processes on ports 8000-8002 and 5173-5175
for port in 8000 8001 8002 5173 5174 5175; do
  lsof -ti tcp:$port | xargs kill -9 2>/dev/null || true
done

# 1. Start JSE Backend (8000) & Frontend (5173)
(cd "$ROOT_DIR/JSE Stock market/backend" && if [ -x "./venv/bin/python" ]; then ./venv/bin/python main.py; else python3 main.py; fi) &
PID_JSE_BACK=$!
(cd "$ROOT_DIR/JSE Stock market/frontend" && tail -f /dev/null | npm run dev -- --port 5173) &
PID_JSE_FRONT=$!

# 2. Start US Backend (8001) & Frontend (5174)
(cd "$ROOT_DIR/US Stock market/backend" && if [ -x "./venv/bin/python" ]; then ./venv/bin/python main.py; else python3 main.py; fi) &
PID_US_BACK=$!
(cd "$ROOT_DIR/US Stock market/frontend" && tail -f /dev/null | npm run dev -- --port 5174) &
PID_US_FRONT=$!

# 3. Start Crypto Backend (8002) & Frontend (5175)
(cd "$ROOT_DIR/Crypto Stock market/backend" && if [ -x "./venv/bin/python" ]; then ./venv/bin/python main.py; else python3 main.py; fi) &
PID_CRYPTO_BACK=$!
(cd "$ROOT_DIR/Crypto Stock market/frontend" && tail -f /dev/null | npm run dev -- --port 5175) &
PID_CRYPTO_FRONT=$!

trap "kill $PID_JSE_BACK $PID_JSE_FRONT $PID_US_BACK $PID_US_FRONT $PID_CRYPTO_BACK $PID_CRYPTO_FRONT 2>/dev/null || true" INT TERM EXIT
wait
