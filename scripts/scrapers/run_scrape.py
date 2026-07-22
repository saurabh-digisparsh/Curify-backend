#!/usr/bin/env python3
"""
Curify admin scrape orchestrator (Strategy 2 — Botasaurus).

Invoked by the NestJS admin scrape API as a child process:

    python run_scrape.py --target jci --location Chennai --hospital "Apollo"

It scrapes the requested target, writes a CSV into ../data/ (the folder the
TypeScript importer reads), AND prints the rows as JSON to stdout between
ROWS markers so the backend can import them directly via Prisma:

    ===ROWS_BEGIN===
    [ { ... }, { ... } ]
    ===ROWS_END===

Set CURIFY_SCRAPE_MOCK=1 to return sample rows WITHOUT Botasaurus / network —
useful for wiring up and testing the admin flow before scrapers are tuned to
each site's live DOM.
"""
import argparse
import json
import os
import sys

ROWS_BEGIN = "===ROWS_BEGIN==="
ROWS_END = "===ROWS_END==="


def log(msg: str) -> None:
    # Human-readable progress goes to stderr so stdout stays parseable.
    print(msg, file=sys.stderr, flush=True)


# ── Mock data (CURIFY_SCRAPE_MOCK=1) ──────────────────────────────────────────
def mock_rows(target: str, location: str, hospital: str):
    loc = location or "Chennai"
    if target == "jci":
        return [
            {"id": "", "name": hospital or f"{loc} International Hospital", "city": loc, "country": "India", "jciAccredited": "true"},
            {"id": "", "name": f"{loc} Global Health City", "city": loc, "country": "India", "jciAccredited": "true"},
        ]
    if target == "surgeons":
        return [
            {"name": "Dr. Sample Surgeon", "title": "Senior Consultant", "specialization": "Orthopedic",
             "yearsExperience": "18", "hospital": hospital or f"{loc} International Hospital", "country": "India", "photoUrl": ""},
        ]
    if target == "prices":
        return [
            {"hospitalName": hospital or f"{loc} International Hospital", "procedure": "Knee Replacement", "price": "$5,200"},
        ]
    if target in ("reviews", "surgeon-reviews"):
        hosp = hospital or f"{loc} International Hospital"
        samples = [
            ("Adaeze N.", 5, "We travelled from Nigeria for my mother's surgery. Excellent international patient care from arrival to recovery."),
            ("James W.", 4, "I am from the UK. Good treatment but the international insurance desk was slow to respond."),
            ("Mohamed A.", 5, "Came from Maldives for treatment. The doctors and nurses were very professional. Thank you."),
        ]
        rows = []
        for i, (name, rating, text) in enumerate(samples):
            enr = enrich_review(text, "en")
            rows.append({
                "hospitalName": hosp, "id": f"mock-{target}-{i}", "name": name, "rating": rating,
                "date": "a month ago", "total_reviews": 3, "text": text,
                "link": "", "profile": "", **enr,
            })
        return rows
    if target == "foreign-pipeline":
        hosp = hospital or f"{loc} International Hospital"
        # one foreign review naming a doctor, one foreign review without
        revs = [
            ("Adaeze N.", 5, "We travelled from Nigeria. Dr. Rajesh Malhotra performed the surgery brilliantly and the care was excellent."),
            ("James W.", 4, "I am from the UK. Dr. Rajesh was attentive though the insurance desk was slow."),
            ("Mohamed A.", 5, "Came from Maldives for treatment. The nursing staff were very professional."),
        ]
        enriched = [{"id": f"mock-fp-{i}", "name": n, "rating": rt, "date": "a month ago",
                     "total_reviews": 3, "text": tx, "link": "", "profile": "", **enrich_review(tx, "en")}
                    for i, (n, rt, tx) in enumerate(revs)]
        rows = [{"kind": "hospital", "hospitalName": hosp, "hospitalCity": loc, "hospitalRating": 4.6, "hospitalAddress": ""}]
        for r in enriched:
            rows.append({"kind": "review", "hospitalName": hosp, "hospitalCity": loc, **r})
        # doctor mentioned in first two reviews
        rows.append({"kind": "surgeon", "surgeonName": "Rajesh Malhotra", "hospitalName": hosp, "hospitalCity": loc})
        for r in enriched[:2]:
            rows.append({"kind": "surgeon-review", "surgeonName": "Rajesh Malhotra", "hospitalName": hosp,
                         "hospitalCity": loc, "source": "mention", **r})
        return rows
    return []


# ── Real Botasaurus scrapers ──────────────────────────────────────────────────
# NOTE: the CSS selectors below are best-effort guesses. Each target site must be
# inspected and the selectors tuned to its real DOM. Until then a scrape returns 0
# rows (job DONE, with a reason logged) rather than crashing the job.

def _text(el, selector):
    """Safe get_text — returns '' if the selector isn't present."""
    try:
        return (el.get_text(selector) or "").strip()
    except Exception:
        return ""


# Live JCI directory (Sitecore/Next.js app behind Cloudflare). Each result card:
#   h1.title-two            → organization name
#   .text-fontNeutralThree  → "City, Country" (sometimes multi-line address)
# Listing is alphabetical, 20 per page, paged via <a aria-label="Go to next page">.
JCI_URL = "https://www.jointcommission.org/en/about-us/recognizing-excellence/find-accredited-international-organizations"
JCI_MAX_PAGES = int(os.environ.get("JCI_MAX_PAGES", "40"))

# Extract the current page's cards as {name, location} pairs.
JCI_EXTRACT_JS = """
return Array.from(document.querySelectorAll('h1.title-two')).map(h => {
  const card = h.parentElement;
  const loc = card ? card.querySelector('.text-fontNeutralThree') : null;
  return { name: (h.innerText||'').trim(), location: (loc ? loc.innerText : '').trim() };
});
"""


def scrape_jci(location: str, hospital: str):
    from botasaurus.browser import browser, Driver

    @browser(headless=True, reuse_driver=True)
    def _run(driver: Driver, data):
        # google_get visits with a Google referer + solves Cloudflare — looks organic.
        try:
            driver.google_get(JCI_URL, bypass_cloudflare=True)
        except Exception:
            driver.get(JCI_URL)
        driver.long_random_sleep()

        try:
            driver.select("h1.title-two", wait=20)
        except Exception:
            log("jci: result cards (h1.title-two) not found — page structure changed")
            return []

        rows, seen = [], set()
        loc_q = (location or "").lower()
        hosp_q = (hospital or "").lower()

        for page in range(JCI_MAX_PAGES):
            cards = driver.run_js(JCI_EXTRACT_JS) or []
            for c in cards:
                name = (c.get("name") or "").strip()
                loc_text = " ".join((c.get("location") or "").split())  # collapse newlines
                if not name or name.lower() in seen:
                    continue
                if loc_q and loc_q not in loc_text.lower():
                    continue
                if hosp_q and hosp_q not in name.lower():
                    continue
                seen.add(name.lower())
                # Derive city from "…City, Country" (take the part before the last comma).
                parts = [p.strip() for p in loc_text.split(",") if p.strip()]
                city = parts[-2] if len(parts) >= 2 else (location or "")
                country = parts[-1] if parts else "India"
                rows.append({"id": "", "name": name, "city": city, "country": country, "jciAccredited": "true"})

            # Early stop: a specific-hospital lookup (Rule 2 JCI verify) only needs one hit.
            if hosp_q and rows:
                log(f"jci: found '{rows[0]['name']}' on page {page + 1} — early stop")
                break

            # Advance to next page; stop when the Next control is gone/disabled.
            nxt = driver.run_js("""
                const a = document.querySelector('a[aria-label="Go to next page"]');
                if (!a) return false;
                const disabled = a.getAttribute('aria-disabled')==='true' || a.classList.contains('pointer-events-none') || a.hasAttribute('disabled');
                if (disabled) return false;
                a.scrollIntoView(); a.click(); return true;
            """)
            if not nxt:
                log(f"jci: reached last page at page {page + 1}")
                break
            driver.short_random_sleep()  # human-like pacing between pages
        else:
            log(f"jci: hit page cap ({JCI_MAX_PAGES}) — there may be more results beyond it")

        log(f"jci: collected {len(rows)} matches for location={location!r} hospital={hospital!r}")
        return rows

    try:
        return _run()
    except Exception as e:
        log(f"jci scrape error: {e}")
        return []


def scrape_surgeons(location: str, hospital: str):
    from botasaurus.browser import browser, Driver

    url = "https://www.apollohospitals.com/doctors"
    if location:
        url += f"?city={location}"

    @browser(headless=True, reuse_driver=True)
    def _run(driver: Driver, data):
        driver.get(url)
        rows = []
        try:
            driver.select(".doctor-card, .doctor-profile, [data-doctor]", wait=20)
        except Exception:
            log("surgeons: doctor-card selector not found — selectors need tuning to the live DOM")
            return rows
        for el in driver.select_all(".doctor-card, .doctor-profile, [data-doctor]"):
            name = _text(el, ".doctor-name, h3, h2")
            if not name or len(name) < 3 or any(c.isdigit() for c in name):
                continue
            try:
                photo = el.get_attribute("img", "src") or ""
            except Exception:
                photo = ""
            rows.append({
                "name": name,
                "title": _text(el, ".doctor-title, .designation"),
                "specialization": _text(el, ".specialization, .specialty"),
                "yearsExperience": _text(el, ".experience, .years"),
                "hospital": hospital or "",
                "country": "India",
                "photoUrl": photo,
            })
        return rows

    try:
        return _run()
    except Exception as e:
        log(f"surgeons scrape error: {e}")
        return []


def scrape_prices(location: str, hospital: str):
    from botasaurus.request import request, Request
    from botasaurus.soupify import soupify

    query = f"{hospital or 'hospital'} {location or 'India'}".strip()

    @request(max_retry=3)
    def _run(req: Request, data):
        resp = req.get(f"https://www.whatclinic.com/search?q={query.replace(' ', '+')}")
        soup = soupify(resp)
        rows = []
        items = soup.select(".clinic-item, .result-item")
        if not items:
            log("prices: no '.clinic-item' results found — selectors need tuning to the live DOM")
        for el in items[:20]:
            name_el = el.select_one(".clinic-name, h2")
            price_el = el.select_one(".price, .cost")
            name = name_el.get_text(strip=True) if name_el else ""
            if not name:
                continue
            rows.append({
                "hospitalName": name,
                "procedure": "",
                "price": price_el.get_text(strip=True) if price_el else "",
            })
        return rows

    try:
        return _run()
    except Exception as e:
        log(f"prices scrape error: {e}")
        return []


# ── Review enrichment (reproduces the country/region/tokens/flags shape) ──────
# Medical-tourism oriented: detect the reviewer's country/region and "international
# patient" signals from the review text, mirroring public/data/reviews/*.json.
_COUNTRY_SIGNALS = [
    # (regex, canonical country, region)
    (r"\bnigeri", "Nigeria", "africa"), (r"\b(kenya|kenyan|nairobi)\b", "Kenya", "africa"),
    (r"\b(ghana|ghanaian|accra)\b", "Ghana", "africa"), (r"\b(tanzania|tanzanian|dar es salaam)\b", "Tanzania", "africa"),
    (r"\b(uganda|ugandan|kampala)\b", "Uganda", "africa"), (r"\bsomalia\b", "Somalia", "africa"),
    (r"\b(ethiopia|addis)\b", "Ethiopia", "africa"), (r"\bmauritius\b", "Mauritius", "africa"),
    (r"\b(rwanda|kigali)\b", "Rwanda", "africa"), (r"\b(zambia|lusaka)\b", "Zambia", "africa"),
    (r"\b(south africa|johannesburg|jo'burg)\b", "South Africa", "africa"),
    (r"\b(uk|u\.k\.|britain|british|london|england)\b", "UK", "europe"),
    (r"\b(germany|german|berlin)\b", "Germany", "europe"), (r"\b(italy|italian|milan|rome)\b", "Italy", "europe"),
    (r"\b(france|french|paris)\b", "France", "europe"), (r"\b(ireland|dublin)\b", "Ireland", "europe"),
    (r"\b(netherlands|dutch|amsterdam)\b", "Netherlands", "europe"), (r"\b(spain|spanish|madrid)\b", "Spain", "europe"),
    (r"\b(maldives|male)\b", "Maldives", "south_asia"), (r"\b(bangladesh|bangladeshi|dhaka)\b", "Bangladesh", "south_asia"),
    (r"\b(sri lanka|colombo)\b", "Sri Lanka", "south_asia"), (r"\b(nepal|kathmandu)\b", "Nepal", "south_asia"),
    (r"\b(pakistan|karachi|lahore)\b", "Pakistan", "south_asia"),
    (r"\bindonesia\b", "Indonesia", "southeast_asia"), (r"\bsingapore\b", "Singapore", "southeast_asia"),
    (r"\b(myanmar|burma|yangon)\b", "Myanmar (Burma)", "southeast_asia"), (r"\b(malaysia|kuala lumpur)\b", "Malaysia", "southeast_asia"),
    (r"\b(thailand|bangkok)\b", "Thailand", "southeast_asia"), (r"\b(philippines|manila)\b", "Philippines", "southeast_asia"),
    (r"\b(uae|u\.a\.e\.|dubai|abu dhabi)\b", "UAE", "middle_east"), (r"\bbahrain\b", "Bahrain", "middle_east"),
    (r"\boman\b", "Oman", "middle_east"), (r"\bqatar\b", "Qatar", "middle_east"),
    (r"\b(saudi|riyadh|jeddah)\b", "Saudi Arabia", "middle_east"), (r"\b(kuwait)\b", "Kuwait", "middle_east"),
    (r"\b(iraq|iraqi|baghdad)\b", "Iraq", "middle_east"), (r"\b(yemen|yemeni)\b", "Yemen", "middle_east"),
    (r"\b(egypt|egyptian|cairo)\b", "Egypt", "africa"), (r"\b(sudan|sudanese|khartoum)\b", "Sudan", "africa"),
    (r"\b(afghanistan|afghan|kabul)\b", "Afghanistan", "south_asia"), (r"\b(djibouti)\b", "Djibouti", "africa"),
    (r"\b(congo|drc)\b", "Congo", "africa"), (r"\b(nigeria n|lagos|abuja)\b", "Nigeria", "africa"),
    (r"\b(usa|u\.s\.a\.|america|american|boston|new york|chicago)\b", "USA", "north_america"),
    (r"\b(canada|canadian|toronto)\b", "Canada", "north_america"),
    # More African countries
    (r"\b(mozambique|maputo)\b", "Mozambique", "africa"), (r"\b(malawi|lilongwe|blantyre)\b", "Malawi", "africa"),
    (r"\b(liberia|monrovia)\b", "Liberia", "africa"), (r"\b(zimbabwe|harare)\b", "Zimbabwe", "africa"),
    (r"\bseychelles\b", "Seychelles", "africa"), (r"\b(sierra leone|freetown)\b", "Sierra Leone", "africa"),
    (r"\b(south sudan|juba)\b", "South Sudan", "africa"), (r"\b(cameroon|yaounde|douala)\b", "Cameroon", "africa"),
    # More Middle East
    (r"\b(iran|iranian|tehran)\b", "Iran", "middle_east"), (r"\b(turkey|turkish|istanbul|ankara)\b", "Turkey", "middle_east"),
    (r"\b(syria|syrian|damascus)\b", "Syria", "middle_east"),
    # More Europe
    (r"\b(russia|russian|moscow)\b", "Russia", "europe"), (r"\b(portugal|portuguese|lisbon)\b", "Portugal", "europe"),
    (r"\b(denmark|danish|copenhagen)\b", "Denmark", "europe"), (r"\b(switzerland|swiss|zurich|geneva)\b", "Switzerland", "europe"),
    (r"\b(sweden|swedish|stockholm)\b", "Sweden", "europe"), (r"\b(ukraine|ukrainian|kyiv|kiev)\b", "Ukraine", "europe"),
    # South Asia
    (r"\b(bhutan|thimphu)\b", "Bhutan", "south_asia"),
    # East Asia
    (r"\b(china|chinese|beijing|shanghai)\b", "China", "east_asia"), (r"\b(japan|japanese|tokyo)\b", "Japan", "east_asia"),
    (r"\b(south korea|korean|seoul)\b", "South Korea", "east_asia"), (r"\b(hong kong)\b", "Hong Kong", "east_asia"),
    # Oceania
    (r"\b(australia|australian|sydney|melbourne)\b", "Australia", "oceania"),
    (r"\b(new zealand|auckland|wellington)\b", "New Zealand", "oceania"), (r"\bfiji\b", "Fiji", "oceania"),
]
_PHRASE_SIGNALS = [
    (r"travell?ed from", "travelled from"), (r"\binternational patients?\b", "international patient"),
    (r"\bforeign patient\b", "foreign patient"), (r"\bforeigner\b", "foreigner"),
    (r"\bforeign\b", "foreign"), (r"\babroad\b", "abroad"), (r"\boverseas\b", "overseas"),
]


# Indian languages — a review in these is a LOCAL, not a foreign patient.
INDIAN_LANGS = {"hi", "ta", "te", "kn", "ml", "bn", "gu", "mr", "pa", "or", "as", "ur", "sa", "sd", "ne", "kok", "mai"}

REVIEW_MAX_YEARS = int(os.environ.get("REVIEW_MAX_YEARS", "10"))


def _within_years(date_str, max_years=None):
    """Keep reviews newer than `max_years`. `0` (or negative) = NO recency cap.
    Google relative dates: 'a month ago', '2 years ago', '11 years ago'."""
    import re
    limit = max_years if max_years is not None else REVIEW_MAX_YEARS
    if limit <= 0:
        return True  # no recency cap (REVIEW_MAX_YEARS=0)
    s = (date_str or "").lower()
    m = re.search(r"(\d+)\s+year", s)
    if m:
        return int(m.group(1)) < limit
    return True  # 'a year ago', months/weeks/days/today, or unknown → keep


def enrich_review(text: str, lang: str = "en"):
    import re
    t = (text or "").lower()
    lang = (lang or "en").split("-")[0].lower()
    tokens, country, region = [], None, None
    for rx, c, reg in _COUNTRY_SIGNALS:
        if re.search(rx, t):
            tokens.append(c)
            if country is None:
                country, region = c, reg
    phrases = [label for rx, label in _PHRASE_SIGNALS if re.search(rx, t)]
    tokens.extend(phrases)
    flags = ["TRAVELED_FROM"] if re.search(r"travell?ed from", t) else []

    if country is None:
        if phrases:
            country, region = phrases[0], "phrase_signal"
        elif lang != "en" and lang not in INDIAN_LANGS:
            # non-English, non-Indian language → genuinely foreign (e.g. Arabic = Middle East)
            country, region = f"lang_{lang}", "foreign_language"
        else:
            country, region = "unknown", "unknown"
    # de-dupe tokens, preserve order
    seen, toks = set(), []
    for tk in tokens:
        if tk not in seen:
            seen.add(tk); toks.append(tk)
    return {"country": country, "region": region, "flags": flags, "tokens": toks, "lang": lang or "en"}


# ── Google Maps reviews scraper (Botasaurus — the engine omkarcloud uses) ──────
GMAPS_MAX_REVIEWS = int(os.environ.get("GMAPS_MAX_REVIEWS", "40"))

# "Apple Hospital Surat" yields a SEARCH LIST → click the first result to open its place.
_GMAPS_CLICK_RESULT_JS = r"""
const link = document.querySelector('div[role=feed] a.hfpxzc, div[role=feed] a[href*="/maps/place/"], a.hfpxzc');
if (link) { link.click(); return link.getAttribute('aria-label') || true; }
return false;  // already on a single place page
"""

# Open reviews. Two layouts exist: (a) result-click panel has a "Reviews" tab;
# (b) a directly-resolved place has no tab — use the rating/review-count button.
_GMAPS_REVIEWS_TAB_JS = r"""
// (a) Reviews tab
const tab = [...document.querySelectorAll('[role=tab],button')]
  .find(b => /^Reviews/i.test((b.innerText||'').trim()) || /reviews for/i.test(b.getAttribute('aria-label')||''));
if (tab) { tab.click(); return 'tab'; }
// (b) review-count / rating button that opens the reviews list
const btn = document.querySelector('button[jsaction*="moreReviews"], button[jsaction*="reviewChart"], button[jsaction*="pane.rating"]');
if (btn) { btn.click(); return 'btn'; }
const f = document.querySelector('.F7nice');
if (f) { (f.closest('button') || f).click(); return 'F7nice'; }
return false;
"""

_GMAPS_SCROLL_JS = r"""
// Scroll ALL candidate scroll containers (the right reviews feed among them),
// so we don't miss the feed if .jftiEf hasn't rendered on the first pass.
[...document.querySelectorAll('div[role=main], .m6QErb, .DxyBCb')]
  .forEach(c => { try { c.scrollTop = c.scrollHeight; } catch(e){} });
return document.querySelectorAll('.jftiEf').length;
"""

_GMAPS_EXPAND_JS = r"""
[...document.querySelectorAll('button.w8nwRe, button[aria-label="See more"], button[jsaction*=expand]')]
  .forEach(b => { try { b.click(); } catch(e){} });
"""

# Capture the place header so we can store the hospital ("data") too.
_GMAPS_PLACE_JS = r"""
const h1 = document.querySelector('h1.DUwDvf, h1');
const star = document.querySelector('div[role=main] [aria-label*="star"]');
let rating = 0;
if (star) { const m=(star.getAttribute('aria-label')||'').match(/(\d(?:\.\d)?)/); if(m) rating=parseFloat(m[1]); }
const addr = document.querySelector('button[data-item-id="address"]');
return { name: h1 ? (h1.innerText||'').trim() : '', rating, address: addr ? (addr.getAttribute('aria-label')||'').replace(/^Address:\s*/,'') : '' };
"""

_GMAPS_EXTRACT_JS = r"""
const blocks = [...document.querySelectorAll('div[data-review-id].jftiEf, .jftiEf[data-review-id], .jftiEf')];
const seen = new Set();
const out = [];
// The place pane URL carries the full feature id as !1s0x<hex>:0x<hex>. That plus
// each review's data-review-id is what builds a per-review permalink (done in Python,
// see _review_permalink) — emit it here so every extracted review carries it.
const placeFid = (location.href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/) || [])[1] || '';
for (const el of blocks) {
  const id = el.getAttribute('data-review-id') || '';
  if (id && seen.has(id)) continue; seen.add(id);
  const nameEl = el.querySelector('.d4r55');
  const name = (nameEl ? nameEl.innerText : el.getAttribute('aria-label') || '').trim();
  const textEl = el.querySelector('.wiI7pd, .MyEned');
  const dateEl = el.querySelector('.rsqaWe');
  const starEl = el.querySelector('[aria-label*="star"]');
  const prof = el.querySelector('button[data-href*="contrib"], a[href*="contrib"]');
  let rating = 0;
  if (starEl) { const m=(starEl.getAttribute('aria-label')||'').match(/(\d(?:\.\d)?)/); if(m) rating=Math.round(parseFloat(m[1])); }
  const profile = prof ? (prof.getAttribute('data-href') || prof.getAttribute('href') || '') : '';
  out.push({
    id,
    name,
    rating,
    date: dateEl ? (dateEl.innerText||'').trim() : '',
    text: textEl ? (textEl.innerText||'').trim() : '',
    profile,
    placeFid,
  });
}
return out.filter(r => r.name && r.text);
"""

# Lightweight: just the currently-loaded review texts (for cheap periodic foreign checks).
_GMAPS_TEXTS_JS = r"""
return [...document.querySelectorAll('.jftiEf')].map(el => {
  const t = el.querySelector('.wiI7pd, .MyEned');
  return t ? (t.innerText || '').trim() : '';
});
"""


def _review_permalink(review_id: str, place_fid: str, profile: str = "") -> str:
    """Build the Google Maps deep-link for one review.

    This is byte-for-byte the shape the Places API returns as a review's own
    `googleMapsUri` (see test_review_permalink.py) — `review_id` is the DOM's
    data-review-id, `place_fid` the FULL feature id `0x<hex>:0x<hex>` from the
    place pane URL. Both halves are required: the older `0x0:<cid>` form Google
    used to emit no longer resolves. Falls back to the reviewer's profile URL so
    a review always carries some Maps link.
    """
    if not review_id or ":" not in place_fid:
        return profile
    return ("https://www.google.com/maps/reviews/data=!4m6!14m5!1m4!2m3!1s"
            f"{review_id}!2m1!1s{place_fid}")


def _attach_links(rows):
    """Fill `link` on freshly extracted review rows (in place) and return them."""
    for r in rows:
        r["link"] = _review_permalink(r.get("id", ""), r.get("placeFid", ""), r.get("profile", ""))
    return rows


def _gmaps_load(driver, q: str):
    from urllib.parse import quote
    driver.google_get("https://www.google.com/maps/search/" + quote(q), bypass_cloudflare=True)
    driver.long_random_sleep()


def _gmaps_click_match(driver, token: str):
    """Click the search-result whose label best matches `token` (else the first)."""
    import json as _j
    return driver.run_js(f"""
        const links=[...document.querySelectorAll('div[role=feed] a.hfpxzc, div[role=feed] a[href*="/maps/place/"]')];
        if(!links.length) return false;
        const tok={_j.dumps((token or '').lower())};
        const m=links.find(l=>(l.getAttribute('aria-label')||'').toLowerCase().includes(tok))||links[0];
        m.click(); return m.getAttribute('aria-label')||true;
    """)


GMAPS_SORT = os.environ.get("GMAPS_SORT", "").lower()  # '', 'newest', 'lowest', 'highest'
_SORT_LABEL = {"newest": "Newest", "lowest": "Lowest", "highest": "Highest"}


def _gmaps_apply_sort(driver, sort_key: str):
    """Open the reviews Sort menu and pick Newest/Lowest/Highest. Best-effort."""
    import time, json as _j
    label = _SORT_LABEL.get(sort_key)
    if not label:
        return
    driver.run_js("""
        const b=[...document.querySelectorAll('button')].find(x=>/^sort|most relevant/i.test((x.innerText||'').trim())
            || /sort reviews/i.test(x.getAttribute('aria-label')||''));
        if(b) b.click();
    """)
    time.sleep(1.2)
    driver.run_js(f"""
        const want={_j.dumps(label)};
        const it=[...document.querySelectorAll('[role=menuitemradio],[role=menuitem],li,div[role=button]')]
            .find(x=>new RegExp('^'+want,'i').test((x.innerText||'').trim()));
        if(it) it.click();
    """)
    time.sleep(1.5)
    log(f"gmaps: sorted reviews by {label}")


def _gmaps_open_reviews(driver, attempts: int = 3):
    """Open the reviews list on the CURRENT place page and wait for it to render.
    Maps often needs more than one go: the tab exists but the pane hasn't hydrated,
    so a single click-then-count reports zero reviews on a place that has thousands.
    Returns (opened, have)."""
    import time
    opened = False
    for _ in range(attempts):
        opened = driver.run_js(_GMAPS_REVIEWS_TAB_JS) or opened
        driver.long_random_sleep()
        driver.run_js(_GMAPS_SCROLL_JS); time.sleep(1)
        have = driver.run_js("return document.querySelectorAll('.jftiEf').length") or 0
        if have:
            return opened, have
    return opened, 0


def _gmaps_open(driver, query: str):
    """Navigate to the place and OPEN its reviews. Handles search-LIST (click
    result → Reviews tab) and exact-match DIRECT place (re-search broader, which
    may itself resolve direct). Returns (place_meta, opened, have) where
    have = reviews are loaded."""
    words = query.split()
    _gmaps_load(driver, query)
    has_feed = driver.run_js("return !!document.querySelector('div[role=feed] a.hfpxzc')")
    if has_feed:
        _gmaps_click_match(driver, max(words, key=len) if words else query)
        driver.long_random_sleep()
    place = driver.run_js(_GMAPS_PLACE_JS) or {}
    opened, have = _gmaps_open_reviews(driver)

    if not have and len(words) >= 2:
        broad, token = f"{words[0]} {words[-1]}", max(words, key=len)
        log(f"reviews: place empty — retry via '{broad}' matching {token!r}")
        _gmaps_load(driver, broad)
        if driver.run_js("return !!document.querySelector('div[role=feed] a.hfpxzc')"):
            _gmaps_click_match(driver, token); driver.long_random_sleep()
        # No feed means the broad search ALSO resolved straight to the place page —
        # that is still the hospital we want, so open its reviews instead of bailing.
        # (Unambiguous names like "Lilavati Mumbai" always land here.)
        place = driver.run_js(_GMAPS_PLACE_JS) or place
        opened2, have = _gmaps_open_reviews(driver)
        opened = opened or opened2
    return place, opened, have


def _gmaps_scroll_extract(driver, max_n: int, target_foreign: int = 0):
    """Scroll the (already-open) reviews feed until enough foreign found / plateau
    / max_n, then extract. Used by the plain `reviews` target."""
    import time
    if GMAPS_SORT:
        _gmaps_apply_sort(driver, GMAPS_SORT)
    prev, stagnant = -1, 0
    max_iters = max(8, min(max_n, 8000) // 4 + 20)
    for it in range(max_iters):
        count = driver.run_js(_GMAPS_SCROLL_JS) or 0
        time.sleep(0.7)
        if target_foreign and (it % 8 == 7):
            texts = driver.run_js(_GMAPS_TEXTS_JS) or []
            fc = sum(1 for t in texts if enrich_review(t)["region"] in FOREIGN_REGIONS)
            log(f"gmaps: {count} reviews loaded, {fc} foreign so far")
            if fc >= target_foreign:
                break
        if count >= max_n:
            break
        if count == prev:
            stagnant += 1
            if stagnant >= 6:
                break
        else:
            stagnant, prev = 0, count
    try:
        driver.run_js(_GMAPS_EXPAND_JS); time.sleep(0.8)
    except Exception:
        pass
    raw = _attach_links(driver.run_js(_GMAPS_EXTRACT_JS) or [])
    log(f"gmaps: loaded {len(raw)} review nodes (cap {max_n})")
    return raw[:max_n]


def _gmaps_search_keywords(driver, keywords, target_foreign: int):
    """Use Google Maps' in-panel "Search reviews" box to filter reviews by foreign
    keywords (e.g. 'international', 'Nigeria') — surfaces foreign reviews directly
    without scrolling thousands. Returns enriched, confirmed-foreign reviews."""
    import time, json as _j
    collected = {}
    for kw in keywords:
        ok = driver.run_js(f"""
            const inp=document.querySelector('input[aria-label*="Search reviews" i], input[placeholder*="Search reviews" i], div[role=main] input[type=text], .DxyBCb input');
            if(!inp) return false;
            const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
            setter.call(inp, {_j.dumps(kw)});
            inp.dispatchEvent(new Event('input',{{bubbles:true}}));
            inp.dispatchEvent(new KeyboardEvent('keydown',{{key:'Enter',keyCode:13,bubbles:true}}));
            return true;
        """)
        if not ok:
            log("gmaps: no in-panel 'Search reviews' box found")
            break
        time.sleep(2.0)
        for _ in range(6):
            driver.run_js(_GMAPS_SCROLL_JS); time.sleep(0.6)
        try:
            driver.run_js(_GMAPS_EXPAND_JS); time.sleep(0.4)
        except Exception:
            pass
        for r in _attach_links(driver.run_js(_GMAPS_EXTRACT_JS) or []):
            key = r.get("id") or r.get("text", "")[:60]
            if key in collected:
                continue
            enr = enrich_review(r.get("text", ""))
            if enr["region"] in FOREIGN_REGIONS and _within_years(r.get("date")):
                collected[key] = {**r, **enr}
        log(f"gmaps[search {kw!r}]: {len(collected)} foreign so far")
        if target_foreign and len(collected) >= target_foreign:
            break
    return list(collected.values())


def _gmaps_collect(driver, query: str, max_n: int, target_foreign: int = 0):
    """Open a place and scroll-extract its reviews (plain `reviews` target)."""
    place, opened, have = _gmaps_open(driver, query)
    if not have:
        return place, [], opened
    return place, _gmaps_scroll_extract(driver, max_n, target_foreign), opened


def scrape_reviews(location: str, hospital: str):
    from botasaurus.browser import browser, Driver
    query = f"{hospital} {location}".strip()
    if not query:
        log("reviews: needs a hospital name (+ optional location) to search Google Maps")
        return []

    @browser(headless=True, reuse_driver=True)
    def _run(driver: Driver, data):
        place, raw, opened = _gmaps_collect(driver, query, GMAPS_MAX_REVIEWS)
        if not raw:
            log(f"reviews: reviewsTab={opened} but no review nodes — DOM tuning needed for {query!r}")
        return {"place": place, "reviews": raw}

    try:
        result = _run() or {}
    except Exception as e:
        log(f"reviews scrape error: {e}")
        return []

    place = result.get("place") or {}
    place_name = (place.get("name") or hospital or query).strip()
    rows = []
    for r in (result.get("reviews") or []):
        enr = enrich_review(r.get("text", ""), r.get("lang") or "en")
        rows.append({
            "hospitalName": place_name, "hospitalCity": location or "",
            "hospitalRating": place.get("rating") or None, "hospitalAddress": place.get("address") or "",
            "id": r.get("id", ""), "name": r.get("name", ""), "rating": r.get("rating", 0),
            "date": r.get("date", ""), "total_reviews": r.get("total_reviews", 1),
            "text": r.get("text", ""), "link": r.get("link", ""), "profile": r.get("profile", ""),
            **enr,
        })
    log(f"reviews: place={place_name!r} collected {len(rows)} reviews for {query!r}")
    return rows


def scrape_surgeon_reviews(location: str, hospital: str):
    log("surgeon-reviews: use the 'foreign-pipeline' target — it extracts doctors from foreign reviews")
    return []


# ── Foreign-patient pipeline ──────────────────────────────────────────────────
# hospital reviews → keep ONLY confirmed-foreign → (if any) save hospital+reviews →
# extract doctor names → link mentioning reviews + best-effort external per-doctor.
FOREIGN_REGIONS = {"africa", "europe", "middle_east", "south_asia",
                   "southeast_asia", "north_america", "east_asia", "oceania",
                   "foreign_language", "phrase_signal"}
# Keywords typed into Google Maps' "Search reviews" box to surface foreign reviews.
FOREIGN_KEYWORDS = ["international patient", "abroad", "overseas", "travelled from", "came from",
                    "foreigner", "Nigeria", "Maldives", "Bangladesh", "Tanzania", "Kenya", "Dubai",
                    "Oman", "Iraq", "Yemen", "Kuwait", "Qatar", "Bahrain", "Saudi", "Sudan", "Egypt",
                    "Uganda", "Mauritius", "Somalia", "Ethiopia", "Sri Lanka", "Nepal", "Myanmar",
                    "Singapore", "Afghanistan", "Rwanda", "Zambia", "Congo"]
# Region → { countries, langs, keywords } — narrows the review search + filtering to a
# specific source region for the chosen hospital (lang codes catch native-language reviews).
REGION_MAP = {
    "africa": {
        "countries": ["Nigeria", "Kenya", "Ghana", "Tanzania", "Uganda", "Ethiopia", "Sudan",
                      "Somalia", "Rwanda", "Zambia", "Mauritius", "South Africa", "Mozambique",
                      "Malawi", "Zimbabwe", "Cameroon", "Liberia"],
        "langs": ["sw", "am", "fr", "pt", "om"],
        "keywords": ["international patient", "travelled from", "came from", "Africa"],
    },
    "middle_east": {
        "countries": ["Iraq", "Oman", "Yemen", "UAE", "Dubai", "Saudi", "Kuwait", "Qatar",
                      "Bahrain", "Iran", "Egypt", "Syria", "Turkey"],
        "langs": ["ar", "fa", "tr"],
        "keywords": ["international patient", "abroad", "Middle East"],
    },
    "europe": {
        "countries": ["UK", "United Kingdom", "Germany", "France", "Italy", "Spain", "Netherlands",
                      "Ireland", "Russia", "Portugal", "Sweden", "Denmark", "Switzerland", "Ukraine"],
        "langs": ["de", "fr", "es", "it", "ru", "nl", "pt", "sv"],
        "keywords": ["international patient", "came from", "Europe"],
    },
    "south_asia": {
        "countries": ["Bangladesh", "Nepal", "Sri Lanka", "Maldives", "Pakistan", "Bhutan", "Afghanistan"],
        "langs": ["bn", "ne", "si", "ur", "dv"],
        "keywords": ["international patient", "came from"],
    },
    "southeast_asia": {
        "countries": ["Indonesia", "Malaysia", "Thailand", "Myanmar", "Singapore", "Philippines", "Vietnam"],
        "langs": ["id", "ms", "th", "my", "vi", "tl"],
        "keywords": ["international patient", "came from"],
    },
    "east_asia": {
        "countries": ["China", "Japan", "South Korea", "Hong Kong"],
        "langs": ["zh", "ja", "ko"],
        "keywords": ["international patient", "came from"],
    },
    "north_america": {
        "countries": ["USA", "United States", "America", "Canada"],
        "langs": ["en", "fr"],
        "keywords": ["international patient", "came from", "North America"],
    },
    "oceania": {
        "countries": ["Australia", "New Zealand", "Fiji"],
        "langs": ["en"],
        "keywords": ["international patient", "came from", "Australia"],
    },
}


def _in_region(item, region_key):
    """Does an (enriched) review belong to the selected region — by region tag, lang code, or country?"""
    rm = REGION_MAP.get(region_key)
    if not rm:
        return True  # no region filter
    if item.get("region") == region_key:
        return True
    if (item.get("lang") or "").lower() in rm["langs"]:
        return True
    c = (item.get("country") or "").lower()
    return any(cn.lower() in c or (c and c in cn.lower()) for cn in rm["countries"])


PIPELINE_MAX_DOCTORS = int(os.environ.get("PIPELINE_MAX_DOCTORS", "6"))
PIPELINE_TARGET_FOREIGN = int(os.environ.get("PIPELINE_TARGET_FOREIGN", "0"))  # 0 = off (no early stop)
_DOC_BAD_FIRST = {"and", "the", "for", "was", "who", "sir", "madam", "ji", "is", "my", "our",
                  "very", "all", "she", "his", "he", "they", "also", "but", "so", "had", "has",
                  "who's", "whom", "here", "there", "their", "your", "her", "him", "are", "were",
                  "did", "does", "said", "told", "gave", "made", "saw", "got", "took"}


# ── Google Places API (reliable hospital data + reviews with language codes) ──
def _places_search(query: str, key: str):
    import urllib.request, json
    req = urllib.request.Request(
        "https://places.googleapis.com/v1/places:searchText",
        data=json.dumps({"textQuery": query}).encode(),
        headers={"Content-Type": "application/json", "X-Goog-Api-Key": key,
                 "X-Goog-FieldMask": "places.id,places.displayName"},
        method="POST")
    with urllib.request.urlopen(req, timeout=25) as r:
        d = json.load(r)
    places = d.get("places", [])
    return places[0]["id"] if places else None


def _places_details(place_id: str, key: str):
    import urllib.request, json
    fm = ("id,displayName,rating,userRatingCount,nationalPhoneNumber,"
          "internationalPhoneNumber,websiteUri,addressComponents,formattedAddress,"
          "location,googleMapsUri,reviews")
    req = urllib.request.Request(
        f"https://places.googleapis.com/v1/places/{place_id}",
        headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": fm})
    with urllib.request.urlopen(req, timeout=25) as r:
        d = json.load(r)
    comps = d.get("addressComponents", [])
    def comp(t):
        return next((c["longText"] for c in comps if t in c.get("types", [])), None)
    city = comp("locality") or comp("administrative_area_level_2") or comp("administrative_area_level_1")
    reviews = []
    for rv in d.get("reviews", []):
        txt = (rv.get("text") or {}).get("text") or (rv.get("originalText") or {}).get("text") or ""
        lang = (rv.get("text") or {}).get("languageCode") or (rv.get("originalText") or {}).get("languageCode") or "en"
        author = rv.get("authorAttribution") or {}
        reviews.append({
            "id": (rv.get("name") or "").split("/")[-1],
            "name": author.get("displayName", "Anonymous"),
            "rating": rv.get("rating", 0),
            "date": rv.get("relativePublishTimeDescription", ""),
            "text": txt,
            "lang": lang.split("-")[0],
            # Prefer the review's own Maps permalink; the author profile URL is only
            # a fallback (it points at the reviewer, not at this review).
            "link": rv.get("googleMapsUri") or author.get("uri", ""),
            "profile": author.get("uri", ""),
            "total_reviews": 1,
        })
    loc = d.get("location") or {}
    place = {
        "name": (d.get("displayName") or {}).get("text", ""),
        "city": city, "rating": d.get("rating"),
        "phone": d.get("nationalPhoneNumber") or d.get("internationalPhoneNumber"),
        "website": d.get("websiteUri"),
        "address": d.get("formattedAddress", ""),
        "latitude": loc.get("latitude"),
        "longitude": loc.get("longitude"),
        "googleMapsUri": d.get("googleMapsUri"),
    }
    return place, reviews


def extract_doctors(text: str):
    """Pull 'Dr. Name [Surname [Surname]]' mentions out of review text.
    First token may be lower-case ('Dr manoj'); extra tokens must be Capitalized
    so we don't swallow following words ('Dr manoj because he' → 'Manoj')."""
    import re
    found = re.findall(r"\bDr\.?\s+((?:[A-Z]\.\s*){0,3}[A-Za-z][a-z]+(?:\s+[A-Z][a-zA-Z]+){0,2})", text or "")
    out, seen = [], set()
    for n in found:
        words = re.sub(r"\s+", " ", n.strip().rstrip(".")).split()
        if not words:
            continue
        first = words[0]
        if len(first) < 3 or first.lower() in _DOC_BAD_FIRST:
            continue
        name = " ".join(w[:1].upper() + w[1:] for w in words)   # title-case
        if name.lower() not in seen:
            seen.add(name.lower()); out.append(name)
    return out


def scrape_foreign_pipeline(location: str, hospital: str, region: str = "", min_reviews: int = 0):
    from botasaurus.browser import browser, Driver
    query = f"{hospital} {location}".strip()
    if not hospital.strip():
        log("foreign-pipeline: a hospital name is required")
        return []

    region = (region or "").strip().lower()
    rm = REGION_MAP.get(region)
    # When a region is chosen, search its countries (+ keywords) and keep only that region's
    # reviews; otherwise use the broad foreign keyword set.
    keywords = (rm["countries"] + rm["keywords"]) if rm else FOREIGN_KEYWORDS
    if rm:
        log(f"foreign-pipeline: region={region} ({len(rm['countries'])} countries, langs={rm['langs']})")
    # Minimum number of foreign reviews to collect before stopping (user-set "min fetch").
    target = int(min_reviews) or PIPELINE_TARGET_FOREIGN or 2
    log(f"foreign-pipeline: minimum target = {target} foreign reviews")

    # Places API (reliable hospital data + up to 5 language-coded reviews).
    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    api_place, api_reviews = {}, []
    if key:
        try:
            pid = _places_search(query, key)
            if pid:
                api_place, api_reviews = _places_details(pid, key)
                api_place["placeId"] = pid          # stable dedup key
                log(f"places-api: place={api_place.get('name')!r} city={api_place.get('city')!r} "
                    f"rating={api_place.get('rating')} reviews={len(api_reviews)}")
        except Exception as e:
            log(f"places-api error: {e}")

    @browser(headless=True, reuse_driver=True)
    def _run(driver: Driver, data):
        place, opened, have = _gmaps_open(driver, query)

        # Accumulate UNIQUE, confirmed-foreign (and region-matching) reviews. Each strategy
        # adds more; we keep running strategies until we reach `target` or exhaust them.
        collected: dict = {}

        def add(items, pre_enriched=False):
            for r in items:
                enr = r if pre_enriched else {**r, **enrich_review(r.get("text", ""), r.get("lang") or "en")}
                if enr.get("region") not in FOREIGN_REGIONS or not _within_years(r.get("date")):
                    continue
                if rm and not _in_region(enr, region):
                    continue
                k = enr.get("id") or (enr.get("text", "")[:60])
                if k and k not in collected:
                    collected[k] = enr
            return len(collected)

        # Strategy 1 — in-panel keyword search (fast, already foreign-enriched).
        if have:
            add(_gmaps_search_keywords(driver, keywords, target), pre_enriched=True)
            log(f"foreign-pipeline: {len(collected)}/{target} after keyword search")

        # Strategy 2 — keep deep-scrolling across sort orders until the minimum is met.
        if have and len(collected) < target:
            for sort_key in ["", "newest", "lowest", "highest"]:
                if len(collected) >= target:
                    break
                try:
                    if sort_key:
                        _gmaps_apply_sort(driver, sort_key)
                    add(_gmaps_scroll_extract(driver, GMAPS_MAX_REVIEWS, target))
                    log(f"foreign-pipeline: {len(collected)}/{target} after scroll (sort={sort_key or 'relevant'})")
                except Exception as e:
                    log(f"foreign-pipeline: scroll pass '{sort_key}' failed: {e}")

        # Strategy 3 — Places API reviews (language-coded), to top up.
        if api_reviews:
            add(api_reviews)
            log(f"foreign-pipeline: {len(collected)}/{target} after Places API")

        foreign = list(collected.values())
        if len(foreign) >= target:
            log(f"foreign-pipeline: ✓ reached minimum ({len(foreign)} ≥ {target})")
        else:
            log(f"foreign-pipeline: ⚠ only {len(foreign)} foreign reviews found (minimum {target}) — sources exhausted")

        result = {"place": place, "foreign": foreign, "doctors": {}, "external": {}}
        if not foreign:
            log(f"foreign-pipeline: 0 foreign reviews for {query!r} — nothing will be saved")
            return result

        # extract doctor names from the foreign reviews
        doctors = {}
        for i, r in enumerate(foreign):
            for d in extract_doctors(r.get("text", "")):
                doctors.setdefault(d, []).append(i)
        result["doctors"] = doctors

        # best-effort external per-doctor reviews (bounded); discard if it just
        # resolves back to the same hospital place.
        place_name = (place.get("name") or "").lower()
        external = {}
        for d in list(doctors)[:PIPELINE_MAX_DOCTORS]:
            try:
                p2, raw2, _ = _gmaps_collect(driver, f"Dr {d} {hospital} {location}", 8)
                if raw2 and (p2.get("name", "").lower() != place_name):
                    external[d] = raw2
                else:
                    external[d] = []
            except Exception:
                external[d] = []
        result["external"] = external
        return result

    try:
        res = _run() or {}
    except Exception as e:
        log(f"foreign-pipeline error: {e}")
        return []

    place = res.get("place") or {}
    foreign = res.get("foreign") or []
    if not foreign:
        return []  # conditional save: no foreign patients → save nothing

    # Prefer the Places API hospital data (more reliable than the scraped header).
    for k, v in (api_place or {}).items():
        if v:
            place[k] = v

    place_name = (place.get("name") or hospital or query).strip()
    city = (place.get("city") or location or "").strip()
    rows = [{
        "kind": "hospital", "hospitalName": place_name, "hospitalCity": city,
        "hospitalRating": place.get("rating") or None, "hospitalAddress": place.get("address") or "",
        "hospitalPhone": place.get("phone") or None, "hospitalWebsite": place.get("website") or None,
        "hospitalPlaceId": place.get("placeId") or None,   # stable Google place id for dedup
        "hospitalLat": place.get("latitude"), "hospitalLng": place.get("longitude"),
        "hospitalMapsUri": place.get("googleMapsUri") or None,
    }]

    def review_row(kind, r, **extra):
        return {"kind": kind, "hospitalName": place_name, "hospitalCity": city,
                "id": r.get("id", ""), "name": r.get("name", ""), "rating": r.get("rating", 0),
                "date": r.get("date", ""), "total_reviews": r.get("total_reviews", 1),
                "text": r.get("text", ""), "link": r.get("link", ""), "profile": r.get("profile", ""),
                "country": r.get("country"), "region": r.get("region"),
                "flags": r.get("flags"), "tokens": r.get("tokens"), "lang": r.get("lang", "en"), **extra}

    for r in foreign:
        rows.append(review_row("review", r))

    doctors = res.get("doctors") or {}
    external = res.get("external") or {}
    for dname, idxs in doctors.items():
        rows.append({"kind": "surgeon", "surgeonName": dname, "hospitalName": place_name, "hospitalCity": city})
        for i in idxs:                                    # mentioning reviews become the doctor's reviews
            rows.append(review_row("surgeon-review", foreign[i], surgeonName=dname, source="mention"))
        for r in external.get(dname, []):                 # bonus: external reviews that NAME this doctor and are foreign
            txt = r.get("text", "") or ""
            if dname.split()[0].lower() not in txt.lower():
                continue
            enr = enrich_review(txt, r.get("lang") or "en")
            if enr["region"] not in FOREIGN_REGIONS:
                continue
            rows.append(review_row("surgeon-review", {**r, **enr}, surgeonName=dname, source="external"))

    log(f"foreign-pipeline: place={place_name!r} foreign={len(foreign)} doctors={len(doctors)} "
        f"external={sum(len(v) for v in external.values())}")
    return rows


SCRAPERS = {
    "jci": scrape_jci,
    "reviews": scrape_reviews,
    "foreign-pipeline": scrape_foreign_pipeline,
    "surgeons": scrape_surgeons,
    "surgeon-reviews": scrape_surgeon_reviews,
    "prices": scrape_prices,
}
CSV_NAME = {
    "jci": "jci_hospitals.csv",
    "reviews": "reviews.csv",
    "foreign-pipeline": "foreign_pipeline.csv",
    "surgeons": "surgeons_import.csv",
    "surgeon-reviews": "surgeon_reviews.csv",
    "prices": "prices.csv",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True, choices=list(SCRAPERS.keys()))
    parser.add_argument("--location", default="")
    parser.add_argument("--hospital", default="")
    parser.add_argument("--region", default="")
    parser.add_argument("--min", type=int, default=0)
    args = parser.parse_args()

    if os.environ.get("CURIFY_SCRAPE_MOCK") == "1":
        log(f"[mock] scraping {args.target} location={args.location!r} hospital={args.hospital!r} region={args.region!r}")
        rows = mock_rows(args.target, args.location, args.hospital)
    elif args.target == "foreign-pipeline":
        log(f"scraping foreign-pipeline location={args.location!r} hospital={args.hospital!r} region={args.region!r} min={args.min}")
        rows = scrape_foreign_pipeline(args.location, args.hospital, args.region, args.min) or []
    else:
        log(f"scraping {args.target} location={args.location!r} hospital={args.hospital!r}")
        rows = SCRAPERS[args.target](args.location, args.hospital) or []

    # Write CSV alongside the TypeScript importer's data folder (best-effort).
    try:
        from botasaurus import bt
        out = os.path.join(os.path.dirname(__file__), "..", "data", CSV_NAME[args.target])
        bt.write_csv(rows, out)
        log(f"wrote {len(rows)} rows to {out}")
    except Exception as e:  # bt unavailable in mock/dev — not fatal
        log(f"csv write skipped: {e}")

    # Emit rows for the backend importer.
    print(ROWS_BEGIN)
    print(json.dumps(rows))
    print(ROWS_END)


if __name__ == "__main__":
    main()
