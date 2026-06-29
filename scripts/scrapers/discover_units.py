"""Discover MAIN hospital units (high foreign-patient likelihood) of the target
chains, restricted to a fixed set of cities, via the Google Places API.

A unit is kept only if: it belongs to the chain (brand name in its title), is a
HOSPITAL (not a pharmacy/clinic/diagnostic/eye/dental/etc. sub-unit), is in an
allowed city, and is large (review count >= MIN_REVIEWS — a proxy for a flagship
multi-specialty hospital that international patients use)."""
import json, os, re, time, urllib.request
from collections import Counter

KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "AIzaSyAMYKPFhaZnNLFvlH5AwvMne8L_ox5wJXs")
MIN_REVIEWS = int(os.environ.get("MIN_REVIEWS", "1000"))   # flagship threshold

# (search term, brand token to require in the unit name)
CHAINS = [
    ("Lilavati Hospital", "lilavati"), ("Manipal Hospital", "manipal"),
    ("Apollo Hospitals", "apollo"), ("Fortis Hospital", "fortis"),
    ("Max Hospital", "max"), ("Kokilaben Dhirubhai Ambani Hospital", "kokilaben"),
    ("Saifee Hospital", "saifee"), ("Medicover Hospitals", "medicover"),
    ("AIG Hospitals", "aig"), ("Medanta", "medanta"),
    ("Shalby Hospitals", "shalby"), ("Gleneagles Hospital", "gleneagles"),
    ("Sahyadri Hospitals", "sahyadri"), ("Rainbow Children's Hospital", "rainbow"),
]

CITIES = ["Bengaluru", "Mumbai", "Navi Mumbai", "Delhi", "New Delhi", "Kolkata",
          "Hyderabad", "Chennai", "Gurugram", "Noida", "Ahmedabad", "Chhatrapati Sambhajinagar", "Pune"]
ALLOWED = {"bengaluru", "bangalore", "mumbai", "navi mumbai", "delhi", "new delhi",
           "kolkata", "hyderabad", "chennai", "gurugram", "gurgaon", "noida",
           "ahmedabad", "chhatrapati sambhajinagar", "sambhajinagar", "aurangabad", "pune"}

# Sub-units that are NOT a main hospital → exclude.
EXCLUDE = ["pharmacy", "clinic", "diagnostic", "dental", "eye", "fertility", "ivf",
           "dialysis", "laborator", "polyclinic", "blood bank", "cradle", "spectra",
           "skin", "cosmetic", "physio", "imaging", "scan", "lab ", "nmc", "academy",
           "college", "institute of", "research centre for"]


def search(query):
    body = {"textQuery": query, "regionCode": "IN", "pageSize": 20}
    req = urllib.request.Request(
        "https://places.googleapis.com/v1/places:searchText",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-Goog-Api-Key": KEY,
                 "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,"
                                     "places.rating,places.userRatingCount,places.addressComponents"},
        method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r).get("places", [])


def city_of(p):
    comps = p.get("addressComponents", [])
    def c(t): return next((x["longText"] for x in comps if t in x.get("types", [])), None)
    return (c("locality") or c("administrative_area_level_3")
            or c("administrative_area_level_2") or c("administrative_area_level_1") or "")


def main():
    worklist, seen = [], set()
    summary = {}
    for chain, brand in CHAINS:
        n = 0
        for city in CITIES:
            try:
                places = search(f"{chain} {city}")
            except Exception as e:
                print(f"   {chain}/{city}: ERR {e}"); continue
            for p in places:
                pid = p["id"]
                if pid in seen:
                    continue
                name = (p.get("displayName") or {}).get("text", "")
                low = name.lower()
                pcity = city_of(p)
                rc = p.get("userRatingCount", 0) or 0
                # must be this chain, a hospital, big, in an allowed city, not a sub-unit
                if not re.search(r"\b" + re.escape(brand) + r"\b", low):
                    continue
                if "hospital" not in low and "medicity" not in low and "health city" not in low:
                    continue
                if any(x in low for x in EXCLUDE):
                    continue
                if pcity.strip().lower() not in ALLOWED:
                    continue
                if rc < MIN_REVIEWS:
                    continue
                seen.add(pid)
                worklist.append({"placeId": pid, "name": name, "city": pcity,
                                 "address": p.get("formattedAddress", ""), "rating": p.get("rating"),
                                 "userRatingCount": rc, "chain": chain})
                n += 1
            time.sleep(0.3)
        summary[chain] = n
        print(f"  {chain:<42} {n}")

    worklist.sort(key=lambda u: u["userRatingCount"], reverse=True)
    out = os.path.join(os.path.dirname(__file__), "..", "data", "units_worklist.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(worklist, f, indent=2, ensure_ascii=False)
    print(f"\nMIN_REVIEWS={MIN_REVIEWS} | TOTAL main units: {len(worklist)}")
    print("by city:", dict(Counter(u["city"] for u in worklist).most_common()))
    print("\ntop 12 by review count:")
    for u in worklist[:12]:
        print(f"  {u['userRatingCount']:>7}  {u['name'][:46]:<46} {u['city']}")
    print("→", out)


if __name__ == "__main__":
    main()
