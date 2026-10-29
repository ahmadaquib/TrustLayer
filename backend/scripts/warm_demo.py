#!/usr/bin/env python3
"""
TrustLayer Demo Warmer Script (Standard Library Only).

Sequentially posts the 4 canonical demo presets from data/demo/presets.json
to the running TrustLayer FastAPI server (http://localhost:8000/chat).
Populates REAL audit log and decision rows in PostgreSQL before Friday review.
"""

import json
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import urllib.error
import urllib.request
from pathlib import Path

# Resolve base paths
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
PRESETS_FILE = REPO_ROOT / "data" / "demo" / "presets.json"
BASE_URL = "http://localhost:8000"


def check_api_health() -> bool:
    """Verifies that the FastAPI server is reachable on port 8000."""
    try:
        req = urllib.request.Request(f"{BASE_URL}/health", method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("status") == "ok"
    except Exception:
        return False
    return False


def post_chat(payload: dict) -> dict:
    """Sends a chat message to the TrustLayer API gateway."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/chat",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_warm_demo() -> int:
    print("=" * 72)
    print(" TrustLayer — Automated Demo Warming Runner")
    print(" Populating real database rows for Friday panel review")
    print("=" * 72)

    # 1. Check API availability
    print(f"\n[1/3] Probing TrustLayer API at {BASE_URL}...")
    if not check_api_health():
        print(f"\n[ERROR] Could not connect to TrustLayer API at {BASE_URL}.")
        print("Please start the backend server first:")
        print("   npm start")
        print("   or: cd backend && uv run uvicorn trustlayer.main:app --port 8000")
        return 1
    print("      [OK] API online and responsive.")

    # 2. Load presets
    print(f"\n[2/3] Loading demo presets from {PRESETS_FILE}...")
    if not PRESETS_FILE.exists():
        print(f"[ERROR] Presets file not found: {PRESETS_FILE}")
        return 1

    try:
        with open(PRESETS_FILE, "r", encoding="utf-8") as f:
            presets = json.load(f)
    except Exception as exc:
        print(f"[ERROR] Failed to parse presets: {exc}")
        return 1

    print(f"      [OK] Loaded {len(presets)} demo scenarios.")

    # 3. Execute presets sequentially
    print(f"\n[3/3] Executing scenarios through /chat gateway...\n")
    preset_results = []

    for idx, preset in enumerate(presets, 1):
        preset_id = preset.get("id")
        label = preset.get("label")
        user = preset.get("user", {})
        user_id = user.get("id")
        role = user.get("role", "customer")
        message = preset.get("message")
        expected = preset.get("expected_decision", "").lower()

        print(f"--- Scenario {idx}/{len(presets)}: {label} [{preset_id}] ---")
        print(f"    User:     {user.get('name')} ({user_id}) [Role: {role.upper()}]")

        session_id = None
        # For drain pattern: execute balance check first to prime sequence anomaly window
        if preset_id == "drain_pattern":
            print("    Step 1/2: Checking balance to prime sequence-anomaly monitoring...")
            try:
                inq_resp = post_chat({
                    "user_id": user_id,
                    "role": role,
                    "message": "Check my checking account balance.",
                })
                session_id = inq_resp.get("session_id")
                print(f"              Balance checked (Session: {session_id[:8]}...)")
                time.sleep(0.5)
            except Exception as e:
                print(f"              Warning: Inquiry step failed: {e}")

        # Post main scenario message
        print(f"    Message:  \"{message}\"")
        try:
            t0 = time.time()
            payload = {
                "user_id": user_id,
                "role": role,
                "message": message,
            }
            if session_id:
                payload["session_id"] = session_id

            resp = post_chat(payload)
            elapsed_ms = round((time.time() - t0) * 1000)

            actual_decision = resp.get("decision", "").lower()
            final_risk = resp.get("final_risk", 0.0)
            grounding_score = resp.get("grounding_score")
            policy_risk = resp.get("policy_risk")
            tool_called = resp.get("tool_called")
            decision_id = resp.get("decision_id")
            request_id = resp.get("request_id")

            is_pass = actual_decision == expected
            status_tag = "PASS" if is_pass else "FAIL"
            preset_results.append({
                "id": preset_id,
                "label": label,
                "status": status_tag,
                "actual": actual_decision.upper(),
                "expected": expected.upper(),
            })

            print(f"    Result:   [{status_tag}] actual={actual_decision.upper()} | expected={expected.upper()} in {elapsed_ms}ms")
            print(f"    Risk:     Combined={final_risk:.2f} | Grounding={grounding_score} | Policy={policy_risk}")
            print(f"    Tool:     {tool_called or 'None'}")
            print(f"    Audit:    RequestID={request_id[:8]}... | DecisionID={decision_id[:8] if decision_id else 'N/A'}")
            print()
            time.sleep(0.5)

        except urllib.error.HTTPError as http_err:
            err_msg = http_err.read().decode('utf-8', errors='ignore')
            print(f"    Result:   [FAIL] HTTP {http_err.code}: {err_msg}")
            print()
            preset_results.append({
                "id": preset_id,
                "label": label,
                "status": "FAIL",
                "actual": f"HTTP {http_err.code}",
                "expected": expected.upper(),
            })
        except Exception as exc:
            print(f"    Result:   [FAIL] Request error: {exc}")
            print()
            preset_results.append({
                "id": preset_id,
                "label": label,
                "status": "FAIL",
                "actual": "ERROR",
                "expected": expected.upper(),
            })

    print("=" * 72)
    print(" Canonical Demo Presets Verification Summary:")
    print("=" * 72)
    all_passed = True
    for res in preset_results:
        print(f"  [{res['status']}] {res['id']:<24} : actual={res['actual']:<8} | expected={res['expected']:<8} ({res['label']})")
        if res["status"] != "PASS":
            all_passed = False
    print("=" * 72)

    passed_count = sum(1 for r in preset_results if r["status"] == "PASS")
    print(f" Total: {passed_count}/{len(presets)} passed.")
    print(" PostgreSQL tables (decisions, agent_actions, audit_log) are primed.")
    print("=" * 72)
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(run_warm_demo())

