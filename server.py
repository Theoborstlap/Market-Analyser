"""Unified single-port server: mounts JSE, US and Crypto engines unchanged.

Routes (same-origin, consumed by unified_frontend):
    /engine/jse/api/*     /engine/jse/ws/live
    /engine/us/api/*      /engine/us/ws/live
    /engine/crypto/api/*  /engine/crypto/ws/live
    /health               aggregate engine status
    /                     built unified_frontend/dist (if present)

Each backend uses identical top-level module names (config, database, main, ...).
They are loaded in isolated module namespaces; a builtins.__import__ router resolves
runtime (function-level) imports by caller file location. Engine code is not modified.
"""
import asyncio
import builtins
import contextlib
import importlib.util
import logging
import os
import sys
import threading
from contextlib import asynccontextmanager
from typing import Any, Dict, List

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
log = logging.getLogger("unified_server")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

ENGINES: Dict[str, str] = {
    "jse": os.path.join(ROOT_DIR, "JSE Stock market", "backend"),
    "us": os.path.join(ROOT_DIR, "US Stock market", "backend"),
    "crypto": os.path.join(ROOT_DIR, "Crypto Stock market", "backend"),
}
# Shared across engines (symlinked to ROOT/shared_core); never isolated.
_SHARED = {"shared_core"}
_IGNORED_DIRS = {"__pycache__", "data", "venv", ".venv", "tests"}

_orig_import = builtins.__import__
_swap_lock = threading.RLock()
_tls = threading.local()

_local_names: Dict[str, set] = {}  # engine -> top-level local module names
_registry: Dict[str, Dict[str, Any]] = {k: {} for k in ENGINES}  # engine -> {modname: module}


def _discover_local_names(backend_dir: str) -> set:
    names = set()
    for entry in os.listdir(backend_dir):
        full = os.path.join(backend_dir, entry)
        if entry.endswith(".py"):
            names.add(entry[:-3])
        elif os.path.isdir(full) and entry not in _IGNORED_DIRS and not entry.startswith("."):
            if os.path.exists(os.path.join(full, "__init__.py")) and entry not in _SHARED:
                names.add(entry)
    return names - _SHARED


for _eng, _dir in ENGINES.items():
    _local_names[_eng] = _discover_local_names(_dir)

_all_local = set().union(*_local_names.values())


def _engine_of_file(path: Any) -> str:
    if not isinstance(path, str):
        return ""
    for eng, d in ENGINES.items():
        if path.startswith(d + os.sep):
            return eng
    return ""


def _is_engine_module(mod_name: str, eng: str) -> bool:
    return mod_name.split(".")[0] in _local_names[eng]


@contextlib.contextmanager
def _activate(eng: str):
    """Install engine's modules + sys.path in sys.modules; restore on exit and capture new modules."""
    with _swap_lock:
        active = getattr(_tls, "active", None)
        if active == eng:
            yield
            return
        backend_dir = ENGINES[eng]
        saved: Dict[str, Any] = {}
        for name in [n for n in list(sys.modules) if n.split(".")[0] in _all_local]:
            saved[name] = sys.modules.pop(name)
        sys.modules.update(_registry[eng])
        sys.path.insert(0, backend_dir)
        _tls.active = eng
        try:
            yield
        finally:
            _tls.active = active
            for name in [n for n in list(sys.modules) if _is_engine_module(n, eng)]:
                _registry[eng][name] = sys.modules.pop(name)
            with contextlib.suppress(ValueError):
                sys.path.remove(backend_dir)
            sys.modules.update(saved)


def _routed_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level == 0 and globals is not None and name.split(".")[0] in _all_local:
        eng = _engine_of_file(globals.get("__file__"))
        if eng and _is_engine_module(name, eng):
            with _activate(eng):
                return _orig_import(name, globals, locals, fromlist, level)
    return _orig_import(name, globals, locals, fromlist, level)


builtins.__import__ = _routed_import


def _load_engine(eng: str) -> FastAPI:
    backend_dir = ENGINES[eng]
    main_path = os.path.join(backend_dir, "main.py")
    with _activate(eng):
        spec = importlib.util.spec_from_file_location("main", main_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules["main"] = module
        spec.loader.exec_module(module)
    return module.app


_engine_apps: Dict[str, FastAPI] = {}
_engine_state: Dict[str, Dict[str, Any]] = {
    k: {"loaded": False, "started": False, "error": None} for k in ENGINES
}
_stop_event: asyncio.Event


async def _run_engine_lifespan(eng: str, sub: FastAPI) -> None:
    """Enter the sub-app's lifespan (Mount does not) and hold it until shutdown."""
    try:
        async with sub.router.lifespan_context(sub):
            _engine_state[eng]["started"] = True
            log.info("engine %s started", eng)
            await _stop_event.wait()
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # isolate engine failures
        _engine_state[eng]["error"] = f"{type(exc).__name__}: {exc}"
        log.exception("engine %s lifespan failed", eng)
    finally:
        _engine_state[eng]["started"] = False


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _stop_event
    _stop_event = asyncio.Event()
    tasks: List[asyncio.Task] = []
    for eng, sub in _engine_apps.items():
        tasks.append(asyncio.create_task(_run_engine_lifespan(eng, sub), name=f"engine-{eng}"))
    try:
        yield
    finally:
        _stop_event.set()
        await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(title="Sovereign Omni-Market Unified Server", version="13.0.0", lifespan=lifespan)

for _eng in ENGINES:
    try:
        _sub = _load_engine(_eng)
        _engine_apps[_eng] = _sub
        _engine_state[_eng]["loaded"] = True
        app.mount(f"/engine/{_eng}", _sub)
        log.info("engine %s mounted at /engine/%s", _eng, _eng)
    except Exception as exc:
        _engine_state[_eng]["error"] = f"{type(exc).__name__}: {exc}"
        log.exception("engine %s failed to load", _eng)

        async def _unavailable(_request, _e=_eng):
            return JSONResponse({"ok": False, "error": f"engine {_e} unavailable"}, status_code=503)

        _stub = FastAPI()
        _stub.add_route("/{path:path}", _unavailable)
        app.mount(f"/engine/{_eng}", _stub)


@app.get("/health")
async def health() -> Dict[str, Any]:
    ok = any(s["started"] for s in _engine_state.values())
    return {"ok": ok, "status": "ok" if ok else "starting", "engines": _engine_state}


_DIST = os.path.join(ROOT_DIR, "unified_frontend", "dist")
if os.path.isdir(_DIST):
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        reload=False,
    )
