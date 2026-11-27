#!/usr/bin/env python3
"""SEO signal check for koreatravelbible.com (static GitHub Pages site).

Runs on every push and fails the run when the signals Google reads drift apart:

  1. every <loc> in sitemap.xml maps to a real file in the repo
  2. that page's <link rel="canonical"> is the page's own URL
  3. no unintended noindex  (/hub/ is exempt: the hub entry stub is noindex by design)
  4. hreflang alternates resolve to a real page, are declared back by their target,
     and the six language roots carry one identical set in both the HTML and the sitemap

No network access and no third-party packages: the check is done against the
files in the checkout, so it runs in a couple of seconds on the free runner.

Usage:  python .github/scripts/seo_check.py [--root .] [--verbose]
Exit:   0 = clean (warnings allowed), 1 = at least one error
"""

from __future__ import annotations

import argparse
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

SITE = "https://koreatravelbible.com"

# The one hreflang cluster every language root must declare, in both HTML and sitemap.
ROOT_LANGS = {
    "en": "/en/",
    "ja": "/ja/",
    "zh-Hant": "/tw/",
    "zh-Hans": "/cn/",
    "es": "/es/",
    "x-default": "/",
}
ROOT_URLS = ["/", "/en/", "/ja/", "/tw/", "/cn/", "/es/"]

# Paths allowed to carry <meta name="robots" content="noindex">: the hub stub at /hub/
# redirects to a language home with JS, so it is deliberately kept out of the index.
NOINDEX_EXEMPT_PREFIXES = ("/hub/",)

# Ordinary URLs that must stay out of every hreflang cluster. The cheat sheet is a
# standalone page in Simplified Chinese, not the zh-Hans entry of the language roots, so
# declaring it as an alternate (the 2026-11-27 GSC conflict) would split the signals again.
CLUSTER_EXCLUDED = ("/cheat-sheet/",)

SM = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
XH = "{http://www.w3.org/1999/xhtml}"


class HeadParser(HTMLParser):
    """Collects the head-level signals we care about."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.canonical: list[str] = []
        self.alternates: list[tuple[str, str]] = []
        self.robots: list[str] = []
        self.html_lang: str | None = None
        self._in_head = True

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "body":
            self._in_head = False
        if not self._in_head:
            return
        if tag == "html" and self.html_lang is None:
            self.html_lang = a.get("lang")
        elif tag == "link":
            rels = a.get("rel", "").lower().split()
            if "canonical" in rels and a.get("href"):
                self.canonical.append(a["href"].strip())
            if "alternate" in rels and a.get("hreflang") and a.get("href"):
                self.alternates.append((a["hreflang"].strip(), a["href"].strip()))
        elif tag == "meta":
            if a.get("name", "").lower() == "robots" and a.get("content"):
                self.robots.append(a["content"].lower())


def to_path(url: str) -> str:
    """URL -> site-relative path as served ('/' -> 'index.html', '/en/' -> 'en/index.html')."""
    parts = urlsplit(url)
    path = parts.path
    if path == "" or path.endswith("/"):
        path += "index.html"
    return path.lstrip("/")


def page_file(root: Path, url: str) -> Path:
    return root / to_path(url)


def norm_url(url: str) -> str:
    """Site-absolute URL of a href, without query or fragment."""
    parts = urlsplit(url.strip())
    path = parts.path or "/"
    if not path.startswith("/"):
        path = "/" + path
    return SITE + path


def has_query(url: str) -> bool:
    return bool(urlsplit(url.strip()).query)


def parse_page(path: Path) -> HeadParser:
    p = HeadParser()
    p.feed(path.read_text(encoding="utf-8", errors="replace"))
    p.close()
    return p


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="repository root (default: .)")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    errors: list[str] = []
    warnings: list[str] = []

    def err(msg: str) -> None:
        errors.append(msg)

    def warn(msg: str) -> None:
        warnings.append(msg)

    sitemap_path = root / "sitemap.xml"
    if not sitemap_path.is_file():
        print("ERROR: sitemap.xml not found")
        return 1

    try:
        tree = ET.parse(sitemap_path)
    except ET.ParseError as exc:
        print(f"ERROR: sitemap.xml is not valid XML: {exc}")
        return 1

    entries: list[tuple[str, list[tuple[str, str]]]] = []
    seen: set[str] = set()
    for url_el in tree.getroot().findall(f"{SM}url"):
        loc_el = url_el.find(f"{SM}loc")
        if loc_el is None or not (loc_el.text or "").strip():
            err("sitemap: <url> without <loc>")
            continue
        loc = loc_el.text.strip()
        if loc in seen:
            err(f"sitemap: duplicate <loc> {loc}")
        seen.add(loc)
        if not loc.startswith(SITE + "/"):
            err(f"sitemap: <loc> is not on {SITE}: {loc}")
        alts = []
        for link in url_el.findall(f"{XH}link"):
            if (link.get("rel") or "").lower() != "alternate":
                continue
            lang = (link.get("hreflang") or "").strip()
            href = (link.get("href") or "").strip()
            if not lang or not href:
                err(f"sitemap: alternate without hreflang/href under {loc}")
                continue
            alts.append((lang, href))
        langs = [lang for lang, _ in alts]
        dupes = {x for x in langs if langs.count(x) > 1}
        if dupes:
            err(f"sitemap: duplicate hreflang {sorted(dupes)} under {loc}")
        entries.append((loc, alts))

    if len(entries) < 10:
        err(f"sitemap: only {len(entries)} URLs parsed, the sitemap looks broken")

    pages: dict[str, HeadParser] = {}
    file_of: dict[str, Path] = {}

    # 1) file exists, 2) canonical is self, 3) no unintended noindex
    for loc, _alts in entries:
        f = page_file(root, loc)
        file_of[loc] = f
        if not f.is_file():
            err(f"[file] {loc} -> {to_path(loc)} not found in the repo")
            continue
        head = parse_page(f)
        pages[loc] = head

        if not head.canonical:
            err(f"[canonical] {loc} has no <link rel=\"canonical\">")
        elif len(head.canonical) > 1:
            err(f"[canonical] {loc} declares {len(head.canonical)} canonicals")
        elif norm_url(head.canonical[0]) != loc:
            err(f"[canonical] {loc} declares {head.canonical[0]}")

        noindex = any("noindex" in r for r in head.robots)
        exempt = loc.removeprefix(SITE).startswith(NOINDEX_EXEMPT_PREFIXES)
        if noindex and not exempt:
            err(f"[robots] {loc} is in the sitemap but has noindex")

    # 4) hreflang: exists, declared back, roots identical in HTML and sitemap
    sitemap_alts = dict(entries)
    for loc, alts in entries:
        if loc not in pages:
            continue
        html_alts = pages[loc].alternates
        html_map = {lang: norm_url(href) for lang, href in html_alts}

        for lang, href in html_alts:
            if has_query(href):
                warn(
                    f"[hreflang] {loc} -> {href} is a ?lang= variant of the same file; "
                    "Google ignores hreflang that does not point to a separate URL"
                )
        for lang, href in alts:
            if has_query(href):
                warn(
                    f"[sitemap] {loc} -> {href} is a ?lang= variant of the same file; "
                    "Google ignores hreflang that does not point to a separate URL"
                )

        # ordinary pages that must not join a cluster
        rel = loc.removeprefix(SITE)
        if rel in CLUSTER_EXCLUDED and (html_alts or alts):
            err(f"[hreflang] {rel} must stay out of the hreflang cluster "
                f"(HTML {len(html_alts)} / sitemap {len(alts)} alternates)")

        # the six language roots must agree exactly, page <-> sitemap
        if rel in ROOT_URLS:
            want = {lang: SITE + path for lang, path in ROOT_LANGS.items()}
            if html_map != want:
                missing = {k: v for k, v in want.items() if html_map.get(k) != v}
                extra = {k: v for k, v in html_map.items() if want.get(k) != v}
                err(f"[hreflang] {loc} HTML set != the language-root set (differs: "
                    f"{missing or {}} extra/wrong: {extra or {}})")
            sm_map = {lang: norm_url(href) for lang, href in alts}
            if sm_map != want:
                missing = {k: v for k, v in want.items() if sm_map.get(k) != v}
                extra = {k: v for k, v in sm_map.items() if want.get(k) != v}
                err(f"[hreflang] {loc} sitemap set != the language-root set (differs: "
                    f"{missing or {}} extra/wrong: {extra or {}})")
        elif html_map and alts:
            sm_map = {lang: norm_url(href) for lang, href in alts}
            if sm_map != html_map:
                err(f"[hreflang] {loc} sitemap alternates != HTML alternates "
                    f"(sitemap {sm_map} / html {html_map})")

        # every alternate must land on a page that links back (mutual confirmation)
        for lang, href in list(html_alts) + list(alts):
            target = norm_url(href)
            target_path = page_file(root, target)
            if not target_path.is_file():
                err(f"[hreflang] {loc} -> {href} ({lang}) does not exist")
                continue
            if target_path == file_of.get(loc):
                continue
            if target not in pages:
                pages[target] = parse_page(target_path)
                file_of[target] = target_path
                if target.removeprefix(SITE) not in sitemap_alts:
                    warn(f"[hreflang] {loc} -> {target} is not listed in sitemap.xml")
            back = {norm_url(h) for _l, h in pages[target].alternates}
            if loc not in back:
                err(
                    f"[hreflang] one-way: {loc} declares {lang} -> {target} "
                    f"but {target} does not declare {loc} back"
                )

    for w in dict.fromkeys(warnings):
        print(f"WARN  {w}")
    for e in dict.fromkeys(errors):
        print(f"ERROR {e}")
    print(
        f"\nchecked {len(entries)} sitemap URLs / {len(pages)} pages: "
        f"{len(errors)} error(s), {len(warnings)} warning(s)"
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
