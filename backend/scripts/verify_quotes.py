"""
Checks that every quote in quotes_library.py appears WORD FOR WORD on its source page.

    python backend/scripts/verify_quotes.py

Only typography is relaxed (curly vs straight quotes, dash spacing, line breaks,
italics), never words or punctuation marks themselves. Exits with code 1 if any quote
is not found, so GitHub shows a red X.
"""

import difflib
import html
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from quotes_library import QUOTES  # noqa: E402


class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self._skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        elif tag in ("p", "br", "div", "td", "li", "h1", "h2", "h3", "h4"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def normalize(s: str) -> str:
    s = html.unescape(s)
    s = s.replace(" ", " ").replace("­", "")
    s = re.sub("[‘’‛′`]", "'", s)
    s = re.sub("[“”„″]", '"', s)
    s = re.sub(r"\s*(?:—|–|--)\s*", " — ", s)  # any dash style → one form
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([,.;:!?])", r"\1", s)
    return s.strip()


class SiteBusy(Exception):
    """The site showed its 'please wait, verifying your request' screen instead of the page."""


def _is_bot_screen(text: str) -> bool:
    return "request is being verified" in text or ("One moment, please" in text and len(text) < 3000)


def fetch(url: str, cache: dict) -> str:
    if url not in cache:
        req = urllib.request.Request(url, headers={"User-Agent": "EKAGRA-quote-check/1.0 (github.com/sakshammittal77/EKAGRA)"})
        text = ""
        for wait in (0, 20, 60, 120):
            time.sleep(wait or 2)  # be gentle with the site
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    raw = r.read().decode(r.headers.get_content_charset() or "windows-1252", errors="replace")
            except Exception:
                if wait == 120:
                    raise
                continue
            p = _Text()
            p.feed(raw)
            text = normalize("".join(p.parts))
            if not _is_bot_screen(text):
                break
        if _is_bot_screen(text):
            raise SiteBusy(url)
        cache[url] = text
    return cache[url]


def closest(page: str, quote: str) -> str:
    """The page text that looks most like the quote, to show what differs."""
    words = page.split(" ")
    n = len(quote.split(" "))
    first = quote.split(" ")[0]
    best, best_r = "", 0.0
    for i, w in enumerate(words):
        if w != first and i % 5:
            continue
        cand = " ".join(words[i:i + n])
        r = difflib.SequenceMatcher(None, cand, quote).ratio()
        if r > best_r:
            best, best_r = cand, r
    return best


def _annotate(problems):
    """On GitHub, also show problems as annotations (readable without opening the log)."""
    import os
    if not os.getenv("GITHUB_ACTIONS") or not problems:
        return
    for i in range(0, len(problems), 4):  # GitHub keeps at most 10 annotations per step
        msg = "\n\n".join(problems[i:i + 4])
        msg = msg.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
        print(f"::error title=Quote check::{msg}")


def main() -> int:
    cache, bad, problems = {}, 0, []
    seen = set()
    for q in QUOTES:
        if q["id"] in seen:
            print(f"DUPLICATE ID  {q['id']}")
            bad += 1
        seen.add(q["id"])
        try:
            page = fetch(q["url"], cache)
        except SiteBusy:
            print(f"SITE BUSY     {q['id']}: the website asked us to wait; run the check again later")
            problems.append(f"SITE BUSY {q['id']}: the website showed a 'please wait' screen, so this quote was not checked. Run again later.")
            bad += 1
            continue
        except Exception as exc:
            print(f"CAN'T FETCH   {q['id']}: {q['url']} ({exc})")
            problems.append(f"CAN'T FETCH {q['id']}: {q['url']} ({exc})")
            bad += 1
            continue
        if normalize(q["text"]) in page:
            print(f"OK            {q['id']}")
        else:
            bad += 1
            print(f"NOT FOUND     {q['id']}  ({q['url']})")
            print(f"    ours: {normalize(q['text'])}")
            near = closest(page, normalize(q['text']))
            print(f"    page: {near}")
            problems.append(f"NOT FOUND {q['id']}\nours: {normalize(q['text'])}\npage: {near}")
    print(f"\n{len(QUOTES) - bad}/{len(QUOTES)} quotes verified word for word.")
    _annotate(problems)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
