#!/usr/bin/env python3
"""SiGrow theseis feed + embed builder.

Reads /workspace/sigrow/state.json (read-only) and writes, in --out:
  theseis.json          versioned JSON API
  theseis.css / theseis.js
  index.html            iframe-friendly listings page
  shortcode/embed-snippet.html
  README.md

Usage:
  python3 /workspace/sigrow/embed/build_embed.py
  python3 /workspace/sigrow/embed/build_embed.py --state PATH --out DIR [--date YYYY-MM-DD]

Does not modify state.json and does not send email.
"""
from __future__ import annotations

import argparse
import calendar
import datetime as dt
import json
import re
import shutil
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Nicosia")
HERE = Path(__file__).resolve().parent
DEFAULT_STATE = Path("/workspace/sigrow/state.json")
CATS = ("Α8–Α11", "Α13", "Α15", "Άλλη")
DEFAULT_HOST = "https://zizujr.github.io/sigrow-theseis"

def parse_d(s: str | None):
    try:
        return dt.datetime.strptime((s or "").strip(), "%d/%m/%Y").date()
    except Exception:
        return None

def parse_iso(s: str | None):
    try:
        return dt.date.fromisoformat((s or "").strip())
    except Exception:
        return None

def fmt_d(d: dt.date) -> str:
    return d.strftime("%d/%m/%Y")

def normalize_category(raw: str | None) -> str:
    if raw in CATS:
        return raw
    return "Άλλη"

def exam_status(exam_date: str) -> str:
    return f"Exam Confirmed — {exam_date}" if exam_date else "Pending"

def check_text(*parts: str) -> None:
    blob = " ".join(p for p in parts if p)
    if "€" in blob or "EUR" in blob:
        raise SystemExit("ERROR: euro amount found in theseis output")
    if re.search(r"\bMONITOR\b", blob, re.I):
        raise SystemExit("ERROR: forbidden word in theseis output")

def add_months(d: dt.date, months: int) -> dt.date:
    y, m = d.year, d.month - 1 + months
    y += m // 12
    m = m % 12 + 1
    return dt.date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def expiry_ref(deadline: str, exam_date: str, published_iso: str | None):
    """Date used for the 6-month expired cutoff: deadline, else exam, else published."""
    return parse_d(deadline) or parse_d(exam_date) or parse_iso(published_iso)


def is_expired(deadline: str, exam_date: str, run: dt.date) -> bool:
    dd, ed = parse_d(deadline), parse_d(exam_date)
    return bool((dd and dd < run) or (ed and ed < run))


def classify(state: dict, run: dt.date) -> list[dict]:
    """All posts in state.json, split later as open/expired.

    Open: application deadline has not passed (or there is no deadline) and the
    exam date has not passed. Expired: deadline or exam date has passed, except
    posts whose deadline (or exam/publication if no deadline) is more than
    6 months ago, which are omitted.
    """
    last_run = parse_iso(state.get("last_run")) or run
    last_s = last_run.isoformat()
    cutoff = add_months(run, -6)
    posts = []
    for it in state.get("items") or []:
        exam_date = (it.get("exam_date") or "").strip()
        deadline = it.get("deadline") or ""
        pub = parse_iso(it.get("published") or "")
        expired = is_expired(deadline, exam_date, run)
        if expired:
            ref = expiry_ref(deadline, exam_date, it.get("published"))
            if ref and ref < cutoff:
                continue
        if it.get("first_seen") == last_s and not it.get("baseline"):
            tag = "NEW"
        elif it.get("last_changed") == last_s and (it.get("first_seen") or last_s) < last_s:
            tag = "UPDATE"
        else:
            tag = "ACTIVE"
        published = fmt_d(pub) if pub else ""
        category = normalize_category(it.get("scale_category"))
        post = {
            "id": it["id"],
            "title": it.get("post") or "",
            "organisation": it.get("organisation") or "",
            "scale": it.get("scale") or "",
            "category": category,
            "positions": it.get("positions") or "",
            "deadline": deadline,
            "exam_status": exam_status(exam_date),
            "exam_date": exam_date,
            "tag": tag,
            "gazette": it.get("source_ref") or "",
            "link": it.get("link") or "",
            "published": published,
            "status": "expired" if expired else "open",
        }
        check_text(*[str(v) for v in post.values()])
        if not post["link"].startswith("http"):
            raise SystemExit(f"ERROR: missing official link for {post['id']}")
        posts.append(post)

    def pub_key(p):
        return parse_d(p.get("published")) or dt.date.min

    def exp_key(p):
        return expiry_ref(p.get("deadline") or "", p.get("exam_date") or "", None) or parse_d(p.get("published")) or dt.date.min

    open_posts = sorted(
        [p for p in posts if p["status"] == "open"],
        key=lambda p: (pub_key(p), p["organisation"], p["title"]),
        reverse=True,
    )
    # Most recently expired first (reverse chronological by expiry ref).
    expired_posts = sorted(
        [p for p in posts if p["status"] == "expired"],
        key=lambda p: (exp_key(p), pub_key(p), p["organisation"]),
        reverse=True,
    )
    # Stable organisation/title within the same date: re-sort expired by date desc
    # then org/title asc via a two-step key (dates already desc via reverse).
    expired_posts.sort(key=lambda p: (-exp_key(p).toordinal(), p["organisation"], p["title"]))
    open_posts.sort(key=lambda p: (-pub_key(p).toordinal(), p["organisation"], p["title"]))
    return open_posts + expired_posts


def payload(posts: list[dict], run: dt.date, state: dict, now: dt.datetime) -> dict:
    generated = now.isoformat(timespec="seconds")
    n_open = sum(1 for p in posts if p.get("status") == "open")
    n_exp = sum(1 for p in posts if p.get("status") == "expired")
    return {
        "version": 1,
        "generated_at": generated,
        "generated_at_display": fmt_d(run),
        "timezone": "Asia/Nicosia",
        "source_run": state.get("last_run") or "",
        "count": len(posts),
        "count_open": n_open,
        "count_expired": n_exp,
        "posts": posts,
    }


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def index_html(data: dict) -> str:
    data_js = json.dumps(data, ensure_ascii=False)
    check_text(data_js)
    title = f"Ανοιχτές θέσεις και εξετάσεις οργανισμών — {data.get('generated_at_display') or ''}"
    return f"""<!DOCTYPE html>
<html lang="el" class="sgr-th-iframe">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>{title}</title>
  <link rel="stylesheet" href="theseis.css">
</head>
<body class="sgr-th-iframe">
  <div id="theseis-app" class="sgr-th-root"></div>
  <script>window.SIGROW_THESEIS_DATA = {data_js};</script>
  <script src="theseis.js"></script>
  <script>
    SiGrowTheseis.mount("#theseis-app", {{ data: window.SIGROW_THESEIS_DATA }});
  </script>
</body>
</html>
"""


def snippet_html(host: str) -> str:
    host = host.rstrip("/")
    return f"""<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8">
  <title>SiGrow theseis — κώδικας ενσωμάτωσης για sigrow.net/theseis/</title>
  <style>
    body {{ font-family: Roboto, "Segoe UI", sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; color: #221E1D; line-height: 1.6; }}
    h1,h2 {{ letter-spacing: -0.02em; }}
    code, pre {{ font-family: ui-monospace, "Roboto Mono", monospace; font-size: 0.9rem; }}
    pre {{ background: #FBF9F4; border: 1px solid #E7E0D1; border-radius: 16px; padding: 1rem 1.25rem; overflow: auto; }}
    .note {{ background: #EEF4FB; border-radius: 16px; padding: 1rem 1.25rem; }}
  </style>
</head>
<body>
  <h1>Κώδικας ενσωμάτωσης για https://sigrow.net/theseis/</h1>
  <p class="note">Η σελίδα έχει ήδη το σημείο τοποθέτησης <code>#theseis-embed</code> (Elementor HTML widget, κλάση <code>theseis-embed</code>). Αντικαταστήστε το κείμενο-placeholder με μία από τις δύο παραλλαγές παρακάτω. Αντικαταστήστε το <code>{host}</code> αν τα αρχεία φιλοξενούνται σε άλλη διεύθυνση.</p>

  <h2>1. Iframe (με αυτόματο ύψος)</h2>
  <p>Επικολλήστε το στο HTML widget της καρτέλας «Ανοιχτές θέσεις». Το σκριπτ αλλάζει το ύψος του iframe και αφαιρεί το στυλ του placeholder.</p>
  <pre><code>&lt;style&gt;
#theseis-embed.theseis-embed {{
  min-height: 0 !important;
  padding: 0 !important;
  display: block !important;
  text-align: left !important;
  background: transparent !important;
  border-radius: 0 !important;
}}
&lt;/style&gt;
&lt;iframe
  id="sigrow-theseis"
  src="{host}/index.html"
  title="Ανοιχτές θέσεις και εξετάσεις οργανισμών"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  style="width:100%;border:0;display:block;background:transparent;min-height:320px;"
&gt;&lt;/iframe&gt;
&lt;script&gt;
(function () {{
  window.addEventListener("message", function (e) {{
    if (!e.data || e.data.type !== "sigrow-theseis-height") return;
    var f = document.getElementById("sigrow-theseis");
    if (f && typeof e.data.height === "number") {{
      f.style.height = Math.max(320, e.data.height) + "px";
    }}
  }});
}})();
&lt;/script&gt;</code></pre>

  <h2>2. Εγγενής απόδοση (div + script)</h2>
  <p>Φέρνει το <code>theseis.json</code> και ζωγραφίζει τις κάρτες μέσα στο υπάρχον <code>#theseis-embed</code>, με τα typography και χρώματα του νέου design. Εναλλακτική, αν προτιμάτε να ζωγραφίζονται οι κάρτες μέσα στη σελίδα αντί για iframe. Το Elementor στη σελίδα επιτρέπει ήδη custom HTML/JS.</p>
  <pre><code>&lt;link rel="stylesheet" href="{host}/theseis.css"&gt;
&lt;script src="{host}/theseis.js" defer&gt;&lt;/script&gt;
&lt;script&gt;
document.addEventListener("DOMContentLoaded", function () {{
  if (window.SiGrowTheseis) {{
    SiGrowTheseis.mount("#theseis-embed", {{
      api: "{host}/theseis.json"
    }});
  }}
}});
&lt;/script&gt;</code></pre>

  <p>Αν το CSS/JS φορτώνει πριν υπάρξει το <code>defer</code>, μπορείτε εναλλακτικά να βάλετε το script στο τέλος του HTML widget χωρίς <code>defer</code>, αμέσως μετά το <code>theseis.js</code>.</p>
</body>
</html>
"""


def readme(host: str, count: int, run: dt.date) -> str:
    host = host.rstrip("/")
    return f"""# SiGrow theseis feed

Live vacancy and exam listings for [sigrow.net/theseis](https://sigrow.net/theseis/).

- Page: {host}/
- JSON API: {host}/theseis.json

Rebuilt on {fmt_d(run)} (Asia/Nicosia). Currently **{count}** posts in two sections: open (deadline still open) and expired (within 6 months).

## Embed

Paste the iframe snippet from [`shortcode/embed-snippet.html`](shortcode/embed-snippet.html) into the `#theseis-embed` Elementor HTML widget on the /theseis/ page.

## Files

- `theseis.json` — versioned API (`generated_at`, `posts[]`)
- `index.html` — iframe page (transparent background, auto-height via `postMessage`)
- `theseis.css`, `theseis.js`, `fonts/` — assets matched to the live sigrow.net design (self-hosted Roboto with Greek)
"""


def copy_assets(out: Path) -> None:
    for name in ("theseis.css", "theseis.js"):
        src = HERE / name
        dest = out / name
        if src.resolve() != dest.resolve():
            shutil.copyfile(src, dest)
        elif not dest.exists():
            raise SystemExit(f"ERROR: missing {src}")
    src_fonts = HERE / "fonts"
    dest_fonts = out / "fonts"
    if src_fonts.exists():
        dest_fonts.mkdir(parents=True, exist_ok=True)
        for f in src_fonts.iterdir():
            if f.is_file():
                target = dest_fonts / f.name
                if f.resolve() != target.resolve():
                    shutil.copyfile(f, target)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description="Build the SiGrow theseis JSON API and embed.")
    ap.add_argument("--state", default=str(DEFAULT_STATE))
    ap.add_argument("--out", default=str(HERE))
    ap.add_argument("--date", help="Run date YYYY-MM-DD (defaults to today in Asia/Nicosia)")
    ap.add_argument("--host", default=DEFAULT_HOST, help="Public base URL written into the snippet")
    args = ap.parse_args(argv)

    now = dt.datetime.now(TZ)
    run = dt.date.fromisoformat(args.date) if args.date else now.date()
    state_path = Path(args.state)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "shortcode").mkdir(parents=True, exist_ok=True)

    state = json.loads(state_path.read_text(encoding="utf-8"))
    posts = classify(state, run)
    data = payload(posts, run, state, now)

    write_json(out / "theseis.json", data)
    copy_assets(out)
    (out / "index.html").write_text(index_html(data), encoding="utf-8")
    (out / "shortcode" / "embed-snippet.html").write_text(snippet_html(args.host), encoding="utf-8")
    (out / "README.md").write_text(readme(args.host, len(posts), run), encoding="utf-8")

    tags = {}
    for p in posts:
        tags[p["tag"]] = tags.get(p["tag"], 0) + 1
    n_open = sum(1 for p in posts if p.get("status") == "open")
    n_exp = sum(1 for p in posts if p.get("status") == "expired")
    print(f"Wrote {len(posts)} posts to {out / 'theseis.json'} (open {n_open}, expired {n_exp})")
    print("tags:", ", ".join(f"{k} {v}" for k, v in tags.items()) or "none")
    print("files:", "theseis.json, theseis.css, theseis.js, fonts/, index.html, shortcode/embed-snippet.html, README.md")


if __name__ == "__main__":
    main()
