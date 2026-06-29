"""Backfill address/lat/lng/googleMapsUri for hospitals already in the DB, via the
Places API (re-search by name + city → place details). Fast, no browser."""
import os, json, time, urllib.request, importlib.util

B = os.environ.get("CURIFY_API", "http://localhost:4000/api")
KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "AIzaSyAMYKPFhaZnNLFvlH5AwvMne8L_ox5wJXs")
EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "rubenlazarus19@gmail.com")
PW = os.environ.get("SEED_ADMIN_PASSWORD", "Ruben@123")

# import _places_search/_places_details from the scraper module
spec = importlib.util.spec_from_file_location("rs", os.path.join(os.path.dirname(__file__), "run_scrape.py"))
rs = importlib.util.module_from_spec(spec); spec.loader.exec_module(rs)


def api(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(B + path, data=data, method=method, headers=h)
    with urllib.request.urlopen(r, timeout=60) as x: return json.load(x)


def main():
    token = api("POST", "/auth/login", {"email": EMAIL, "password": PW})["token"]
    hospitals = api("GET", "/admin/data/hospitals?take=300", token=token)["items"]
    todo = [h for h in hospitals if not h.get("latitude")]
    print(f"{len(hospitals)} hospitals, {len(todo)} missing location")
    done = 0
    for h in todo:
        try:
            pid = rs._places_search(f"{h['name']} {h.get('city','')}".strip(), KEY)
            if not pid:
                print(f"  no place: {h['name'][:40]}"); continue
            place, _ = rs._places_details(pid, KEY)
            api("PATCH", f"/admin/data/hospitals/{h['id']}", {
                "address": place.get("address") or None,
                "latitude": place.get("latitude"),
                "longitude": place.get("longitude"),
                "googleMapsUri": place.get("googleMapsUri") or None,
            }, token=token)
            done += 1
            print(f"  ✓ {h['name'][:42]:<42} {place.get('latitude')},{place.get('longitude')}")
            time.sleep(0.25)
        except Exception as e:
            print(f"  ERR {h['name'][:40]}: {e}")
    print(f"backfilled {done}/{len(todo)}")


if __name__ == "__main__":
    main()
