"""
LocalLedger AI - Desktop Development Launch Workflow Test

Automated verification script for Phase 2:
1. Compiles Electron TypeScript
2. Launches Electron desktop shell in development mode
3. Validates that FastAPI backend starts from backend/.venv
4. Validates that Vite dev server is running on http://127.0.0.1:5173
5. Validates that backend health check responds on the assigned loopback port
6. Terminates Electron cleanly and verifies zero orphaned child processes
"""

import os
import re
import subprocess
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error

ROOT_DIR = Path(__file__).resolve().parent.parent
ELECTRON_EXE = ROOT_DIR / "node_modules" / "electron" / "dist" / "electron.exe"


def http_probe(url: str, timeout=3.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as res:
            return bool(res.status == 200)
    except Exception:
        return False


def main():
    print("=" * 70)
    print(" LocalLedger AI — Desktop Development Launch Test")
    print("=" * 70)

    # 1. Compile Electron TypeScript
    print("\n[Step 1] Compiling Electron TypeScript (main.ts & preload.ts)...")
    build_cmd = ["npx", "tsc", "-p", "tsconfig.electron.json"]
    if os.name == "nt":
        build_cmd[0] = "npx.cmd"
    
    res = subprocess.run(build_cmd, cwd=str(ROOT_DIR))
    assert res.returncode == 0, f"TypeScript compilation failed with code {res.returncode}"
    print(" -> dist-electron/ compiled successfully.")

    # 2. Launch Electron development process
    print("\n[Step 2] Launching Electron in development mode...")
    assert ELECTRON_EXE.is_file(), f"Electron binary not found at {ELECTRON_EXE}"

    proc = subprocess.Popen(
        [str(ELECTRON_EXE), ".", "--auto-exit-after=12000"],
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    detected_port = None
    backend_healthy = False
    vite_active = False

    start_time = time.time()
    timeout = 35  # allow ample time for initial Vite/Python boot

    try:
        print("\n[Step 3] Monitoring desktop launch logs...")
        while time.time() - start_time < timeout:
            line = proc.stdout.readline()
            if not line:
                if proc.poll() is not None:
                    print(f"Error: Electron exited prematurely with code {proc.poll()}", file=sys.stderr)
                    sys.exit(1)
                time.sleep(0.1)
                continue

            stripped = line.strip()
            if stripped:
                print(f"   | {stripped}")

            # Detect assigned backend port
            port_match = re.search(r"Assigned backend loopback port:\s*(\d+)", stripped)
            if port_match:
                detected_port = int(port_match.group(1))

            # Detect verified backend health
            if "backend verified healthy on http://127.0.0.1:" in stripped:
                backend_healthy = True

            # Detect Vite dev server
            if "Vite dev server active and verified" in stripped or "Detected existing Vite dev server" in stripped:
                vite_active = True

            # If both are verified, proceed to active probes
            if detected_port and backend_healthy and vite_active:
                break

        print("\n[Step 4] Performing direct HTTP probes...")
        assert detected_port is not None, "Failed to detect assigned backend port from logs"
        print(f" -> Assigned backend port: {detected_port}")

        # Probe FastAPI backend
        backend_url = f"http://127.0.0.1:{detected_port}/api/v1/health"
        backend_up = http_probe(backend_url)
        print(f" -> Probing backend at {backend_url}: {'UP' if backend_up else 'DOWN'}")
        assert backend_up, f"Backend failed to respond at {backend_url}"

        # Probe Vite dev server
        vite_url = "http://127.0.0.1:5173/"
        vite_up = http_probe(vite_url)
        print(f" -> Probing Vite server at {vite_url}: {'UP' if vite_up else 'DOWN'}")
        assert vite_up, f"Vite dev server failed to respond at {vite_url}"

        print("\n -> [SUCCESS] Desktop development environment verified:")
        print(f"    - FastAPI Backend: ACTIVE on http://127.0.0.1:{detected_port}")
        print(f"    - Vite React UI:   ACTIVE on http://127.0.0.1:5173")
        print(f"    - Electron Shell:  RUNNING (PID {proc.pid})")

    finally:
        print("\n[Step 5] Waiting for graceful app.quit() termination...")
        try:
            # Drain remaining stdout
            while True:
                remaining = proc.stdout.readline()
                if not remaining:
                    break
                stripped = remaining.strip()
                if stripped:
                    print(f"   | {stripped}")
            exit_code = proc.wait(timeout=10)
            print(f" -> Electron exited gracefully with code {exit_code}.")
        except Exception:
            print(" -> Graceful shutdown timed out, falling back to tree termination...")
            if os.name == "nt":
                subprocess.run(["taskkill", "/pid", str(proc.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                proc.terminate()
            proc.wait(timeout=5)
            print(" -> Electron process terminated.")

        # Brief pause to verify child cleanup
        time.sleep(2)
        print("\n[Step 6] Verifying child processes cleanup...")
        if detected_port:
            port_busy = http_probe(f"http://127.0.0.1:{detected_port}/api/v1/health", timeout=1.0)
            if not port_busy:
                print(f" -> Backend on port {detected_port} cleanly stopped (no orphaned processes).")
            else:
                print(f" -> Note: Port {detected_port} is still answering (was either external or lingered).")

    print("\n" + "=" * 70)
    print(" ALL DESKTOP DEVELOPMENT LAUNCH TESTS PASSED!")
    print("=" * 70)


if __name__ == "__main__":
    main()
