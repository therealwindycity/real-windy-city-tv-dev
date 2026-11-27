#!/usr/bin/env python3
"""Collect click-to-comment notes from ntfy.sh into feedback/comments.json + feedback/COMMENTS.md.

Runs in GitHub Actions every few minutes (see .github/workflows/collect-feedback.yml).
ntfy keeps messages for 12 hours, so anything posted is filed long before it expires.

Statuses in comments.json:
  open       — not fixed yet
  fixed      — the developer changed something (fixNote says what); waiting for the owner's OK
  confirmed  — the owner clicked "Looks good"
  wontfix    — the developer explains why it was left as is (fixNote)
To mark a comment fixed, edit comments.json: set "status": "fixed", "fixNote": "...", "fixedAt": ISO time.
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COMMENTS = ROOT / "comments.json"
MD = ROOT / "COMMENTS.md"
STATE = ROOT / ".collector_state.json"
TOPICS = {"dev": "rwc-fb-dev-7f3c91a2d84e5b06", "beta": "rwc-fb-beta-2b9e64c0f1a7d358"}
if os.environ.get("RWC_TEST_TOPICS"):  # "devtopic,betatopic" for local testing
    TOPICS = dict(zip(("dev", "beta"), os.environ["RWC_TEST_TOPICS"].split(",")))
NTFY = "https://ntfy.sh"
REPO = os.environ.get("GITHUB_REPOSITORY", "therealwindycity/real-windy-city-tv-dev")
GH_TOKEN = os.environ.get("GITHUB_TOKEN", "")

TEXT_LIMITS = {"comment": 2500, "page": 200, "element": 200, "elementText": 200, "selector": 600, "url": 300,
               "author": 60, "type": 20, "hash": 200, "navLabel": 60, "tag": 20, "screen": 20, "note": 1500}
TYPE_L = {"change": "Change I want", "question": "Question", "broken": "Something's broken", "other": "Other"}
STATUS_L = {"open": "Not fixed yet", "fixed": "Fixed — waiting for owner's OK", "confirmed": "Fixed ✓ (owner confirmed)", "wontfix": "Won't change"}


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def clean(c):
    out = {}
    for k, lim in TEXT_LIMITS.items():
        v = c.get(k)
        if isinstance(v, str):
            out[k] = v[:lim]
    for k in ("id", "target", "action", "kind", "site", "createdAt"):
        v = c.get(k)
        if isinstance(v, str):
            out[k] = v[:80]
    if not re.fullmatch(r"[a-z0-9]+-[a-z0-9]+", out.get("id", "")):
        return None
    if out.get("site") not in ("dev", "beta"):
        return None
    return out


def poll(topic, since):
    url = f"{NTFY}/{topic}/json?poll=1&since={since}"
    req = urllib.request.Request(url, headers={"User-Agent": "rwc-feedback-collector"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8", "replace")
    msgs = []
    for line in body.splitlines():
        try:
            m = json.loads(line)
        except Exception:
            continue
        if m.get("event") != "message" or not m.get("message"):
            continue
        try:
            c = json.loads(m["message"])
        except Exception:
            continue
        if isinstance(c, dict):
            msgs.append((m.get("id"), m.get("time", 0), c))
    return msgs


def gh(method, path, data=None):
    if not GH_TOKEN:
        return None
    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}{path}", method=method,
                                 data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Authorization": f"Bearer {GH_TOKEN}", "Accept": "application/vnd.github+json",
                                          "User-Agent": "rwc-feedback-collector"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"null")
    except Exception as e:  # never fail the whole run over an issue
        print("github api:", method, path, e, file=sys.stderr)
        return None


def write_md(comments):
    open_ = [c for c in comments if c.get("status") == "open"]
    fixed = [c for c in comments if c.get("status") == "fixed"]
    done = [c for c in comments if c.get("status") in ("confirmed", "wontfix")]
    L = ["# Feedback from the click-to-comment sites", "",
         "Developer copy: https://therealwindycity.github.io/real-windy-city-tv-dev/  ·  "
         "Beta copy: https://therealwindycity.github.io/real-windy-city-tv-dev/beta/", "",
         f"**{len(open_)} not fixed yet · {len(fixed)} fixed, waiting for the owner's OK · {len(done)} closed** "
         f"(total {len(comments)}; updated {now()})", "",
         "Machine-readable list: `feedback/comments.json`. To close one, set its `status` to `fixed` and add a `fixNote`.", ""]

    def block(title, items):
        L.append(f"## {title} ({len(items)})")
        L.append("")
        if not items:
            L.append("_None._")
            L.append("")
        for c in items:
            who = f"beta tester **{c.get('author') or 'anonymous'}**" if c.get("site") == "beta" else "site owner"
            L.append(f"### #{c.get('num')} · {TYPE_L.get(c.get('type'), 'Note')} · {c.get('createdAt', '')[:16].replace('T', ' ')} UTC · from {who}")
            L.append(f"- **Status:** {STATUS_L.get(c.get('status'), c.get('status'))}")
            L.append(f"- **Page:** {c.get('page', '')}  (`#{c.get('hash', '')}`)")
            L.append(f"- **Clicked:** {c.get('element', '')}")
            L.append(f"- **Selector:** `{c.get('selector', '')}`")
            L.append("")
            for line in (c.get("comment") or "").splitlines() or [""]:
                L.append(f"> {line}")
            for t in c.get("thread", []):
                L.append(f">\n> ↳ {t.get('createdAt', '')[:16]} {t.get('author', '')}: {t.get('action')} — {t.get('note', '')}")
            if c.get("fixNote"):
                L.append("")
                L.append(f"**What was done:** {c['fixNote']}")
            L.append("")

    block("Not fixed yet", open_)
    block("Fixed — waiting for the owner's OK", fixed)
    block("Closed", done)
    MD.write_text("\n".join(L) + "\n")


def main():
    comments = json.loads(COMMENTS.read_text()) if COMMENTS.exists() else []
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    by_id = {c["id"]: c for c in comments}
    seen_actions = set(state.get("actions", []))
    deleted = set(state.get("deleted", []))  # ids removed on purpose (tests, spam): never re-file them
    next_num = max([c.get("num", 0) for c in comments] + [0]) + 1
    new_count = 0
    for site, topic in TOPICS.items():
        try:
            msgs = poll(topic, "all")
        except Exception as e:
            print("poll failed", topic, e, file=sys.stderr)
            continue
        for _mid, _t, raw in sorted(msgs, key=lambda x: x[1]):
            c = clean(raw)
            if not c or c.get("site") != site:
                continue
            if c.get("kind") == "action":
                if c["id"] in seen_actions:
                    continue
                seen_actions.add(c["id"])
                tgt = by_id.get(c.get("target", ""))
                if not tgt:
                    continue
                act = c.get("action")
                if act == "confirm":
                    tgt["status"] = "confirmed"
                elif act == "reopen":
                    tgt["status"] = "open"
                tgt.setdefault("thread", []).append({"action": "Looks good" if act == "confirm" else "Still not right",
                                                      "note": c.get("note", ""), "author": c.get("author", ""), "createdAt": c.get("createdAt", now())})
                tgt["updatedAt"] = now()
                continue
            if c["id"] in by_id or c["id"] in deleted or not c.get("comment"):
                continue
            c.pop("kind", None)
            c.update({"num": next_num, "status": "open", "receivedAt": now()})
            next_num += 1
            comments.append(c)
            by_id[c["id"]] = c
            new_count += 1
            if site == "beta":  # an issue = an email notification to the repo owner
                body = (f"**From beta tester:** {c.get('author') or 'anonymous'}\n\n**Page:** {c.get('page')}\n\n**Clicked:** {c.get('element')}\n\n"
                        f"**Kind:** {TYPE_L.get(c.get('type'), 'Note')}\n\n> " + (c.get("comment") or "").replace("\n", "\n> ") +
                        f"\n\n_Comment #{c['num']} — status lives in feedback/comments.json; this issue closes when it is fixed._")
                iss = gh("POST", "/issues", {"title": f"Beta feedback #{c['num']} from {c.get('author') or 'anonymous'}: {(c.get('comment') or '')[:60]}",
                                             "body": body, "labels": ["beta feedback"]})
                if iss and iss.get("number"):
                    c["issue"] = iss["number"]
                    c["_issueState"] = "open"
    # close / reopen notification issues to match status
    for c in comments:
        if c.get("issue"):
            want = "open" if c.get("status") == "open" else "closed"
            if c.get("_issueState") != want:
                if gh("PATCH", f"/issues/{c['issue']}", {"state": want}) is not None:
                    c["_issueState"] = want
    comments.sort(key=lambda c: c.get("num", 0))
    COMMENTS.write_text(json.dumps(comments, ensure_ascii=False, indent=1) + "\n")
    state["actions"] = sorted(seen_actions)[-2000:]
    state["deleted"] = sorted(deleted)
    STATE.write_text(json.dumps(state) + "\n")
    write_md(comments)
    print(f"new comments: {new_count}; total {len(comments)}")


if __name__ == "__main__":
    main()
