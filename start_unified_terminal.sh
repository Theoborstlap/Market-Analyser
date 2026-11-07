#!/usr/bin/env zsh
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/.runtime_logs"
mkdir -p "$LOG_DIR"

echo "================================================================================"
echo "🌐 SOVEREIGN OMNI-MARKET TERMINAL V13.0 — MASTER LAUNCHER"
echo "--------------------------------------------------------------------------------"
echo "  🇿🇦 JSE Trading Engine     -> http://127.0.0.1:8000"
echo "  🇺🇸 US Wall Street Engine  -> http://127.0.0.1:8001"
echo "  ⚡ Crypto 24/7 Engine     -> http://127.0.0.1:8002"
echo "  🖥️  Unified Web Terminal  -> http://localhost:5173"
echo "================================================================================"

# Free any existing listeners on backend ports (8000-8002) & frontend ports (5173-5175)
for port in 8000 8001 8002 5173 5174 5175; do
  lsof -ti tcp:$port | xargs kill -9 2>/dev/null || true
done

# Ensure unified frontend dependencies are installed
if [ ! -d "$ROOT_DIR/unified_frontend/node_modules" ]; then
  echo "[setup] Installing unified_frontend dependencies..."
  (cd "$ROOT_DIR/unified_frontend" && npm install --no-audit --no-fund)
fi

# 1. Start JSE Backend Engine (Port 8000)
(
  cd "$ROOT_DIR/JSE Stock market/backend"
  if [ -x "./venv/bin/python" ]; then
    exec ./venv/bin/python main.py
  else
    exec python3 main.py
  fi
) > "$LOG_DIR/jse_backend.log" 2>&1 &
PID_JSE_BACK=$!

# 2. Start US Wall Street Backend Engine (Port 8001)
(
  cd "$ROOT_DIR/US Stock market/backend"
  if [ -x "./venv/bin/python" ]; then
    exec ./venv/bin/python main.py
  else
    exec python3 main.py
  fi
) > "$LOG_DIR/us_backend.log" 2>&1 &
PID_US_BACK=$!

# 3. Start Crypto 24/7 Spot Backend Engine (Port 8002)
(
  cd "$ROOT_DIR/Crypto Stock market/backend"
  if [ -x "./venv/bin/python" ]; then
    exec ./venv/bin/python main.py
  else
    exec python3 main.py
  fi
) > "$LOG_DIR/crypto_backend.log" 2>&1 &
PID_CRYPTO_BACK=$!

# 4. Start Unified Sovereign Omni-Market Frontend (Port 5173)
(
  cd "$ROOT_DIR/unified_frontend"
  tail -f /dev/null | npm run dev -- --port 5173 --strictPort
) > "$LOG_DIR/unified_frontend.log" 2>&1 &
PID_UNIFIED_FRONT=$!

cleanup() {
  kill "$PID_JSE_BACK" "$PID_US_BACK" "$PID_CRYPTO_BACK" "$PID_UNIFIED_FRONT" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# Wait until all 3 backend health endpoints and unified UI are reachable
python3 - <<'PY'
import time, urllib.request

targets = [
    ("JSE Engine (:8000)", "http://127.0.0.1:8000/api/health"),
    ("US Engine (:8001)", "http://127.0.0.1:8001/api/health"),
    ("Crypto Engine (:8002)", "http://127.0.0.1:8002/api/health"),
    ("Unified UI (:5173)", "http://localhost:5173/"),
]

deadline = time.time() + 45.0
ready = set()
while time.time() < deadline and len(ready) < len(targets):
    for label, url in targets:
        if label in ready:
            continue
        try:
            with urllib.request.urlopen(url, timeout=2.0) as resp:
                if resp.status < 400:
                    ready.add(label)
                    print(f"  [ONLINE] {label} -> {url}")
        except Exception:
            pass
    if len(ready) < len(targets):
        time.sleep(0.5)

if len(ready) == len(targets):
    print("================================================================================")
    print("ALL 3 TRADING ENGINES + UNIFIED WEB APP ACTIVE -> http://localhost:5173")
    print("================================================================================")
else:
    missing = [lbl for lbl, _ in targets if lbl not in ready]
    print(f"WARNING: Timed out waiting for: {missing}")
PY

wait
