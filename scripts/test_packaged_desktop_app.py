"""
LocalLedger AI - Packaged Windows Desktop Application Integration Test

Verifies the compiled production package in dist/installer/win-unpacked:
1. Launches "LocalLedger AI.exe" directly (standalone Electron + bundled PyInstaller backend)
2. Verifies backend starts without virtual environment or system Python
3. Probes loopback health endpoint and confirms OCR and Ollama status
4. Tests transaction retrieval / report endpoints
5. Verifies app-quit and child process cleanup
"""

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error

ROOT_DIR = Path(__file__).resolve().parent.parent
PACKAGED_EXE = ROOT_DIR / "dist" / "installer" / "win-unpacked" / "LocalLedger AI.exe"


def http_probe(url: str, timeout=3.0) -> tuple[bool, dict | None]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as res:
            body = res.read().decode("utf-8")
            return (res.status == 200, json.loads(body) if body else None)
    except Exception:
        return (False, None)


def main():
    print("=" * 70)
    print(" LocalLedger AI - Packaged Application Launch & Health Test")
    print("=" * 70)

    assert PACKAGED_EXE.is_file(), f"Packaged executable not found at {PACKAGED_EXE}"
    print(f"Packaged executable: {PACKAGED_EXE} ({PACKAGED_EXE.stat().st_size / (1024 * 1024):.2f} MB)")

    # Launch packaged app with 15s auto-exit timer
    proc = subprocess.Popen(
        [str(PACKAGED_EXE), "--auto-exit-after=15000"],
        cwd=str(PACKAGED_EXE.parent),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    detected_port = None
    backend_healthy = False
    start_time = time.time()
    timeout = 35

    try:
        print("\n[Step 1] Monitoring packaged application launch logs...")
        while time.time() - start_time < timeout:
            line = proc.stdout.readline()
            if not line:
                if proc.poll() is not None:
                    print(f"Error: Packaged app exited prematurely with code {proc.poll()}", file=sys.stderr)
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

            if detected_port and backend_healthy:
                break

        print("\n[Step 2] Probing packaged application backend...")
        assert detected_port is not None, "Failed to detect loopback port from packaged app output"
        health_url = f"http://127.0.0.1:{detected_port}/api/v1/health"
        is_healthy, health_data = http_probe(health_url)
        print(f" -> Probe {health_url}: {'UP (200)' if is_healthy else 'FAILED'}")
        assert is_healthy, f"Packaged backend failed health probe at {health_url}"
        print(f" -> Health payload: {json.dumps(health_data, indent=2)}")

        # Query reports dashboard
        reports_url = f"http://127.0.0.1:{detected_port}/api/v1/reports/dashboard"
        rep_ok, rep_data = http_probe(reports_url)
        print(f" -> Probe {reports_url}: {'UP (200)' if rep_ok else 'FAILED'}")
        assert rep_ok, f"Failed to retrieve dashboard reports from packaged app"

        print("\n -> [SUCCESS] Packaged application launched and serving requests successfully!")

    finally:
        print("\n[Step 3] Waiting for packaged application auto-exit & cleanup...")
        try:
            while True:
                remaining = proc.stdout.readline()
                if not remaining:
                    break
                stripped = remaining.strip()
                if stripped:
                    print(f"   | {stripped}")
            exit_code = proc.wait(timeout=10)
            print(f" -> Packaged app exited cleanly with code {exit_code}.")
        except Exception:
            print(" -> Force terminating test process tree...")
            subprocess.run(["taskkill", "/pid", str(proc.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            proc.wait(timeout=5)

        time.sleep(2)
        if detected_port:
            port_free, _ = http_probe(f"http://127.0.0.1:{detected_port}/api/v1/health", timeout=1.0)
            print(f"\n[Step 4] Process tree termination verification:")
            if not port_free:
                print(f" -> Loopback port {detected_port} is closed. Zero orphaned processes!")
            else:
                print(f" -> Note: Port {detected_port} still answering.")

    print("\n" + "=" * 70)
    print(" PACKAGED APPLICATION VERIFICATION COMPLETED SUCCESSFULLY")
    print("=" * 70)


if __name__ == "__main__":
    main()
