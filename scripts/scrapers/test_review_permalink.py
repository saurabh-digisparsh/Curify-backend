"""Locks the Google Maps review deep-link format.

EXPECTED is not hand-derived: it is the `googleMapsUri` the Places API itself
returned for that review of Apollo Hospital Greams Lane. If _review_permalink
stops reproducing it, the "View on Google Maps" button on review cards starts
landing on a blank map instead of the review.

Run: python test_review_permalink.py
"""
from run_scrape import _review_permalink

RID = "Ci9DQUlRQUNvZENodHljRjlvT25CWGMwTnhhV05CTTFZM1oyeENjbGgzV1VWVFFrRRAB"
FID = "0x3a52666accdfbb59:0x2e0d1b10a5e06d2f"
EXPECTED = (
    "https://www.google.com/maps/reviews/data=!4m6!14m5!1m4!2m3!1s" + RID +
    "!2m1!1s" + FID
)

assert _review_permalink(RID, FID) == EXPECTED, _review_permalink(RID, FID)
# Missing pieces must degrade to the profile URL, never to "" or a broken link.
assert _review_permalink("", FID, "prof") == "prof"
assert _review_permalink(RID, "", "prof") == "prof"
# The half-fid form Google no longer resolves must not be emitted.
assert _review_permalink(RID, "0x2e0d1b10a5e06d2f", "prof") == "prof"
print("ok")
