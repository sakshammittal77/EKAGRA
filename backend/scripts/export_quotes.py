"""
Copies the verified quotes from backend/quotes_library.py into the website
(frontend/src/data/verified_quotes.json), so the Teachings pages show the same exact words.

    python backend/scripts/export_quotes.py

Run it again whenever quotes_library.py changes.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from quotes_library import APP_THEMES, QUOTES, source_line  # noqa: E402

# Website theme for each quote theme. A quote is listed under every website theme it fits;
# `themeId` (its main one) is used where only one theme can be shown.
SITE_THEME = {
    "courage": "courage",
    "strength": "self-confidence", "self-confidence": "self-confidence", "failure": "self-confidence",
    "goal": "concentration", "concentration": "concentration", "thoughts": "concentration", "calm": "concentration",
    "education": "education", "character": "education",
    "work": "service", "service": "service",
}

out = [{
    "id": q["id"],
    "themeId": SITE_THEME[q["themes"][0]],
    # Same grouping the reel maker uses (APP_THEMES in quotes_library.py).
    "themeIds": [site for site, fits in APP_THEMES.items() if any(t in fits for t in q["themes"])],
    "text": q["text"],
    "source": source_line(q),
    "url": q["url"],
    "fits": q["situations"],
} for q in QUOTES]

dest = ROOT / "frontend" / "src" / "data" / "verified_quotes.json"
dest.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
counts = {}
for q in out:
    for t in q["themeIds"]:
        counts[t] = counts.get(t, 0) + 1
print(f"Wrote {len(out)} quotes to {dest.relative_to(ROOT)}: {counts}")
