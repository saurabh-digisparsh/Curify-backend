"""Batch foreign-review scrape over the discovered unit work-list.
Triggers the admin foreign-pipeline per unit, polls to completion, paces between
units (anti-detection), and is resumable (skips units already marked done)."""
import json, os, time, random, urllib.request

B = os.environ.get("CURIFY_API", "http://localhost:4000/api")
ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "rubenlazarus19@gmail.com")
ADMIN_PW = os.environ.get("SEED_ADMIN_PASSWORD", "Ruben@123")
HERE = os.path.dirname(__file__)
WORKLIST = os.path.join(HERE, "..", "data", "units_worklist.json")
PROGRESS = os.path.join(HERE, "..", "data", "batch_progress.json")
PER_UNIT_TIMEOUT = 900          # 15 min max per unit
PACE_MIN, PACE_MAX = 30, 75     # seconds between units (anti-detection)


def api(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(B + path, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def login():
    return api("POST", "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PW})["token"]


def load_json(p, default):
    try:
        with open(p, encoding="utf-8") as f: return json.load(f)
    except Exception:
        return default


def save_progress(prog):
    with open(PROGRESS, "w", encoding="utf-8") as f:
        json.dump(prog, f, indent=2, ensure_ascii=False)


def log(m):
    print(f"[batch] {m}", flush=True)


def main():
    units = load_json(WORKLIST, [])
    prog = load_json(PROGRESS, {})
    token = login()
    todo = [u for u in units if prog.get(u["placeId"], {}).get("status") != "DONE"]
    log(f"{len(units)} units total, {len(units)-len(todo)} already done, {len(todo)} to process")

    for i, u in enumerate(todo, 1):
        pid = u["placeId"]
        q_name, q_city = u["name"], u.get("city", "")
        log(f"[{i}/{len(todo)}] {q_name} ({q_city}) — {u['chain']}")
        try:
            token = token or login()
            job = api("POST", "/admin/scrape",
                      {"target": "foreign-pipeline", "hospitalName": q_name, "location": q_city}, token)
            jid = job["id"]
        except Exception as e:
            log(f"   trigger failed: {e}"); token = None; time.sleep(20); continue

        # poll
        deadline = time.time() + PER_UNIT_TIMEOUT
        status, created, skipped = "?", 0, 0
        while time.time() < deadline:
            time.sleep(10)
            try:
                j = api("GET", f"/admin/scrape/{jid}", token=token)
            except Exception:
                token = None; token = login(); continue
            status = j.get("status")
            if status in ("DONE", "FAILED"):
                created, skipped = j.get("created", 0), j.get("skipped", 0)
                break

        prog[pid] = {"status": status if status in ("DONE", "FAILED") else "TIMEOUT",
                     "name": q_name, "city": q_city, "chain": u["chain"],
                     "created": created, "skipped": skipped}
        save_progress(prog)
        done = sum(1 for v in prog.values() if v.get("status") == "DONE")
        log(f"   {status}  created={created}  | progress {done}/{len(units)} units done")

        if i < len(todo):
            pause = random.randint(PACE_MIN, PACE_MAX)
            log(f"   pacing {pause}s …")
            time.sleep(pause)

    log("BATCH COMPLETE")


if __name__ == "__main__":
    main()
