/* The Real Windy City — click-to-comment feedback layer.
 * Loaded only on the developer copy and the beta copy (never on the public site).
 * Config comes from window.RWC_FEEDBACK = { mode: "dev" | "beta", ... } set before this script.
 *
 * How it works
 *  - Turn on "Comment mode", click anything, type a note, Save.
 *  - The note is posted to a private-ish ntfy.sh topic (no account needed, works from any browser).
 *  - A GitHub Action in therealwindycity/real-windy-city-tv-dev collects new notes every few minutes and
 *    writes them to feedback/comments.json + feedback/COMMENTS.md in that repo (the developer reads those).
 *  - The developer marks each note fixed (with a short explanation) in comments.json.
 *  - The developer copy shows a pin on every commented spot (red = open, green = fixed) and a running tally.
 */
(function () {
  "use strict";
  const CFG = Object.assign(
    {
      mode: "dev",
      repo: "therealwindycity/real-windy-city-tv-dev",
      topics: { dev: "rwc-fb-dev-7f3c91a2d84e5b06", beta: "rwc-fb-beta-2b9e64c0f1a7d358" },
      ntfy: "https://ntfy.sh",
      commentsPath: "feedback/comments.json",
    },
    window.RWC_FEEDBACK || {}
  );
  const MODE = CFG.mode === "beta" ? "beta" : "dev";
  const TOPIC = CFG.topics[MODE];
  const LS_MINE = "rwcfb_mine_" + MODE;
  const LS_QUEUE = "rwcfb_queue_" + MODE;
  const LS_NAME = "rwcfb_name";
  const LS_ON = "rwcfb_on_" + MODE;
  const MAX_COMMENT = 2500;

  // ---------- small helpers ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const uid = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const when = (iso) => { try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return iso; } };
  const inUi = (el) => !!(el && el.closest && el.closest("#rwcfb-root,.rwcfb-pin"));

  // ---------- where am I on the site ----------
  function currentPage() {
    const active = document.querySelector("#mainNav button.active, #mainNav button[aria-current], #mainNav .active");
    const nav = active ? clip(active.innerText.replace(/\(\d[\d,]*\)/, ""), 40) : "";
    const h1 = document.querySelector("main h1, h1");
    const hash = location.hash.replace(/^#/, "");
    let label = nav || "Home";
    if (hash.startsWith("ep:")) label = "Meeting page: " + clip(h1 ? h1.innerText : hash.slice(3), 70);
    else if (hash.startsWith("ord:")) label = "Ordinance page: " + clip(h1 ? h1.innerText : hash.slice(4), 70);
    else if (hash.startsWith("speakers:")) label = "Speaker: " + hash.slice(9);
    return { hash, label };
  }

  // ---------- describe / locate an element ----------
  const KIND = { BUTTON: "Button", A: "Link", IMG: "Picture", VIDEO: "Video", IFRAME: "Video", INPUT: "Box you type in", SELECT: "Drop-down menu", TEXTAREA: "Box you type in",
    H1: "Page title", H2: "Heading", H3: "Heading", H4: "Heading", P: "Text", TD: "Table cell", TH: "Table heading", LI: "List item", LABEL: "Label", NAV: "Menu", TABLE: "Table", HEADER: "Top banner", FOOTER: "Bottom of the page", SPAN: "Text", STRONG: "Text", SVG: "Picture", CANVAS: "Picture" };
  function elText(el) {
    if (!el) return "";
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.value || "";
    if (el.tagName === "SELECT") return (el.options[el.selectedIndex] || {}).text || "";
    if (el.tagName === "IMG") return el.getAttribute("alt") || "";
    return el.getAttribute("aria-label") || el.innerText || el.textContent || el.getAttribute("title") || "";
  }
  function describe(el) {
    const kind = KIND[el.tagName] || (el.getAttribute("onclick") ? "Clickable item" : "Section");
    const t = clip(elText(el), 90);
    let where = "";
    if (el.closest("#mainNav")) where = " in the top menu";
    else if (el.closest("header")) where = " in the top banner";
    else if (el.closest("footer")) where = " at the bottom of the page";
    return t ? `${kind} “${t}”${where}` : `${kind}${where}`;
  }
  function cssPath(el) {
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && n !== document.body && parts.length < 12) {
      if (n.id && !/^\d/.test(n.id) && document.querySelectorAll("#" + CSS.escape(n.id)).length === 1) { parts.unshift("#" + CSS.escape(n.id)); break; }
      let sel = n.tagName.toLowerCase();
      const p = n.parentElement;
      if (p) {
        const same = Array.from(p.children).filter((c) => c.tagName === n.tagName);
        if (same.length > 1) sel += `:nth-of-type(${same.indexOf(n) + 1})`;
      }
      parts.unshift(sel);
      n = n.parentElement;
    }
    if (parts.length && !parts[0].startsWith("#")) parts.unshift("body");
    return parts.join(" > ");
  }
  function smartTarget(el) {
    const good = el.closest("button,a,select,input,textarea,video,iframe,img,[onclick],h1,h2,h3,h4,td,th,li,label");
    if (good && !inUi(good)) {
      // don't jump to a huge container just because it has an onclick
      const r = good.getBoundingClientRect();
      if (r.width * r.height < window.innerWidth * window.innerHeight * 0.5) return good;
    }
    return el;
  }
  function locate(c) {
    if (!c || !c.selector) return null;
    let el = null;
    try { el = document.querySelector(c.selector); } catch (e) {}
    // compare text loosely: counts like "(1,583)" change as data is added
    const norm = (t) => clip(String(t || "").toLowerCase().replace(/[\d,.()]+/g, " "), 60).replace(/\s+/g, " ").trim();
    const want = norm(c.elementText);
    const okText = (e) => !want || norm(elText(e)) === want;
    if (el && okText(el) && el.getClientRects().length) return el;
    if (want && c.tag) {
      const cands = Array.from(document.getElementsByTagName(c.tag)).filter((e) => okText(e) && e.getClientRects().length && !inUi(e));
      if (cands.length) return cands[0];
    }
    return null;
  }

  // ---------- styles ----------
  const css = `
  #rwcfb-root{position:fixed;z-index:2147483000;right:14px;bottom:14px;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a}
  #rwcfb-root *{box-sizing:border-box}
  .rwcfb-bar{display:flex;gap:6px;align-items:center;background:#0b1220;border:2px solid #fbbf24;border-radius:999px;padding:6px;box-shadow:0 8px 30px rgba(0,0,0,.5)}
  .rwcfb-btn{border:0;border-radius:999px;padding:8px 13px;font-weight:700;cursor:pointer;background:#1f2937;color:#f8fafc;font-size:13px;white-space:nowrap}
  .rwcfb-btn:hover{filter:brightness(1.15)}
  .rwcfb-on{background:#fbbf24;color:#111}
  .rwcfb-tag{font-size:11px;font-weight:800;letter-spacing:.06em;color:#fbbf24;padding:0 6px;text-transform:uppercase}
  .rwcfb-hl{outline:3px solid #fbbf24 !important;outline-offset:2px !important;cursor:crosshair !important;background-color:rgba(251,191,36,.08) !important}
  .rwcfb-flash{outline:4px solid #f43f5e !important;outline-offset:3px !important;transition:outline-color .3s}
  .rwcfb-modal-bg{position:fixed;inset:0;background:rgba(2,6,23,.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:2147483001}
  .rwcfb-modal{background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  .rwcfb-modal h3{margin:0 0 6px;font-size:17px}
  .rwcfb-what{background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:10px;margin:8px 0 12px;font-size:13px}
  .rwcfb-what b{display:block;font-size:14px;margin-bottom:2px}
  .rwcfb-modal label{display:block;font-weight:700;font-size:13px;margin:10px 0 4px}
  .rwcfb-modal textarea,.rwcfb-modal input,.rwcfb-modal select{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:9px;font:inherit;color:#0f172a;background:#fff}
  .rwcfb-modal textarea{min-height:120px;resize:vertical}
  .rwcfb-row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
  .rwcfb-primary{background:#16a34a;color:#fff}
  .rwcfb-ghost{background:#e2e8f0;color:#0f172a}
  .rwcfb-small{font-size:12px;color:#475569}
  .rwcfb-types{display:flex;gap:6px;flex-wrap:wrap}
  .rwcfb-types button{border:1px solid #cbd5e1;background:#f8fafc;border-radius:999px;padding:6px 11px;cursor:pointer;font-weight:600;font-size:13px;color:#0f172a}
  .rwcfb-types button.sel{background:#0f172a;color:#fff;border-color:#0f172a}
  .rwcfb-panel{position:fixed;right:14px;bottom:76px;width:min(480px,calc(100vw - 28px));max-height:min(75vh,760px);background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden}
  .rwcfb-panel header{background:#0b1220;color:#fff;padding:12px 14px}
  .rwcfb-panel header h3{margin:0;font-size:16px}
  .rwcfb-tally{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
  .rwcfb-tally button{border:0;border-radius:8px;padding:6px 10px;font-weight:800;cursor:pointer;font-size:12px}
  .rwcfb-list{overflow:auto;padding:8px 12px 12px}
  .rwcfb-item{border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin:8px 0}
  .rwcfb-item .top{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#475569}
  .rwcfb-item .where{font-size:12px;color:#334155;margin:4px 0}
  .rwcfb-item .txt{white-space:pre-wrap;font-size:14px}
  .rwcfb-item .fix{margin-top:6px;background:#ecfdf5;border-left:3px solid #16a34a;padding:6px 8px;font-size:13px;white-space:pre-wrap}
  .rwcfb-item .acts{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
  .rwcfb-item .acts button{border:1px solid #cbd5e1;background:#f8fafc;border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer;font-weight:600}
  .rwcfb-st{border-radius:999px;padding:2px 8px;font-weight:800;font-size:11px;white-space:nowrap}
  .st-open{background:#fee2e2;color:#991b1b}.st-fixed{background:#dcfce7;color:#166534}.st-confirmed{background:#dbeafe;color:#1e40af}.st-pending{background:#fef3c7;color:#92400e}.st-wontfix{background:#e5e7eb;color:#374151}
  .rwcfb-pin{position:absolute;z-index:2147482999;min-width:22px;height:22px;border-radius:999px;border:2px solid #fff;color:#fff;font:800 11px/18px system-ui;text-align:center;padding:0 5px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5)}
  .rwcfb-pin.open{background:#e11d48}.rwcfb-pin.fixed{background:#16a34a}.rwcfb-pin.mixed{background:#d97706}
  .rwcfb-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#0f172a;color:#fff;border-radius:10px;padding:10px 16px;font-weight:700;z-index:2147483002;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:90vw;text-align:center}
  .rwcfb-hint{background:#fbbf24;color:#111;border-radius:10px;padding:8px 12px;font-weight:700;font-size:13px;margin-bottom:8px;box-shadow:0 8px 30px rgba(0,0,0,.4)}
  @media (max-width:640px){.rwcfb-btn{padding:8px 10px;font-size:12px}.rwcfb-tag{display:none}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- data: my comments, the shared list, live (not yet filed) notes ----------
  let mine = load(LS_MINE, []);          // everything this browser sent
  let filed = [];                        // feedback/comments.json from the repo
  let live = [];                         // still sitting in ntfy (last 12 hours), not filed yet
  let commentOn = load(LS_ON, false);
  let panelOpen = false;
  let filter = "open";

  function statusOf(c) { return c.status || "pending"; }
  function allComments() {
    const byId = new Map();
    const add = (c, src) => { if (!c || !c.id || c.kind === "action") return; const prev = byId.get(c.id); byId.set(c.id, Object.assign({}, prev || {}, c, prev && prev.status && !c.status ? { status: prev.status } : {}, { _src: src })); };
    mine.forEach((c) => add(c, "mine"));
    live.forEach((c) => add(Object.assign({}, c, { status: c.status || "open" }), "live"));
    filed.forEach((c) => add(c, "filed"));
    let list = Array.from(byId.values());
    if (MODE === "beta") { const ids = new Set(mine.map((m) => m.id)); list = list.filter((c) => ids.has(c.id)); }
    list.forEach((c) => { if (!c.status) c.status = c._src === "mine" ? "pending" : "open"; });
    return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function fetchFiled() {
    const urls = [
      `https://api.github.com/repos/${CFG.repo}/contents/${CFG.commentsPath}?ref=main&t=${Date.now()}`,
      `https://raw.githubusercontent.com/${CFG.repo}/main/${CFG.commentsPath}?t=${Date.now()}`,
    ];
    for (const u of urls) {
      try {
        const r = await fetch(u, { headers: u.includes("api.github.com") ? { Accept: "application/vnd.github.raw+json" } : {}, cache: "no-store" });
        if (!r.ok) continue;
        const j = await r.json();
        filed = Array.isArray(j) ? j : j.comments || [];
        return;
      } catch (e) {}
    }
  }
  async function fetchLive() {
    const topics = MODE === "dev" ? [CFG.topics.dev, CFG.topics.beta] : [TOPIC];
    const out = [];
    for (const t of topics) {
      try {
        const r = await fetch(`${CFG.ntfy}/${t}/json?poll=1&since=all`, { cache: "no-store" });
        if (!r.ok) continue;
        const txt = await r.text();
        txt.split("\n").forEach((line) => {
          if (!line.trim()) return;
          try { const m = JSON.parse(line); if (m.event === "message" && m.message) { const c = JSON.parse(m.message); if (c && c.id) out.push(c); } } catch (e) {}
        });
      } catch (e) {}
    }
    // actions (confirm / reopen) adjust the status shown before the collector files them
    const actions = out.filter((c) => c.kind === "action");
    live = out.filter((c) => c.kind !== "action");
    live.forEach((c) => { c.status = "open"; });
    window.__rwcfbActions = actions;
  }
  function applyLiveActions(list) {
    (window.__rwcfbActions || []).forEach((a) => {
      const c = list.find((x) => x.id === a.target);
      if (!c) return;
      const filedC = filed.find((x) => x.id === a.target);
      if (filedC && filedC.updatedAt && filedC.updatedAt >= a.createdAt) return;
      c.status = a.action === "confirm" ? "confirmed" : "open";
    });
    return list;
  }
  async function refresh() {
    await Promise.all([fetchFiled(), fetchLive()]);
    flushQueue();
    render();
  }

  // ---------- sending ----------
  async function post(payload) {
    const body = JSON.stringify(payload);
    const r = await fetch(`${CFG.ntfy}/${TOPIC}`, {
      method: "POST",
      body,
      headers: { Title: payload.kind === "action" ? `RWC ${MODE}: ${payload.action}` : `RWC ${MODE} comment${payload.author ? " from " + payload.author : ""}`, Tags: MODE === "beta" ? "speech_balloon,busts_in_silhouette" : "speech_balloon" },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
  }
  async function send(payload) {
    try { await post(payload); return true; }
    catch (e) { const q = load(LS_QUEUE, []); q.push(payload); save(LS_QUEUE, q); return false; }
  }
  async function flushQueue() {
    const q = load(LS_QUEUE, []);
    if (!q.length) return;
    const left = [];
    for (const p of q) { try { await post(p); } catch (e) { left.push(p); } }
    save(LS_QUEUE, left);
  }

  // ---------- UI root ----------
  const root = document.createElement("div");
  root.id = "rwcfb-root";
  document.body.appendChild(root);
  const pinLayer = document.createElement("div");
  pinLayer.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:2147482999";
  document.body.appendChild(pinLayer);

  function toast(msg, ms) {
    const t = document.createElement("div");
    t.className = "rwcfb-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 3500);
  }

  function render() {
    const list = applyLiveActions(allComments());
    const n = (s) => list.filter((c) => (s === "open" ? ["open", "pending"].includes(c.status) : c.status === s)).length;
    const counts = { all: list.length, open: n("open"), fixed: n("fixed"), confirmed: n("confirmed") };
    const label = MODE === "dev" ? `📋 ${counts.open} open · ${counts.fixed + counts.confirmed} fixed` : `📋 My notes (${counts.all})`;
    root.innerHTML = `
      ${commentOn ? `<div class="rwcfb-hint">💬 Comment mode is on — click anything on the page to leave a note. Click “Done commenting” to use the site normally.</div>` : ""}
      ${panelOpen ? panelHtml(list, counts) : ""}
      <div class="rwcfb-bar">
        <span class="rwcfb-tag">${MODE === "dev" ? "Developer copy" : "Beta"}</span>
        <button class="rwcfb-btn ${commentOn ? "rwcfb-on" : ""}" data-act="toggle">${commentOn ? "✓ Done commenting" : "💬 Comment on something"}</button>
        <button class="rwcfb-btn" data-act="panel">${label}</button>
      </div>`;
    root.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", onUiClick));
    placePins(list);
  }

  function statusBadge(s) {
    const L = { open: "Not fixed yet", pending: "Sending / waiting to be filed", fixed: "Fixed — please check", confirmed: "Fixed ✓ (you confirmed)", wontfix: "Won't change" };
    return `<span class="rwcfb-st st-${esc(s)}">${esc(L[s] || s)}</span>`;
  }
  const TYPE_L = { change: "Change I want", question: "Question", broken: "Something's broken", other: "Other" };

  function panelHtml(list, counts) {
    const shown = list.filter((c) => filter === "all" ? true : filter === "open" ? ["open", "pending"].includes(c.status) : filter === "fixed" ? ["fixed", "confirmed", "wontfix"].includes(c.status) : filter === "beta" ? c.site === "beta" : true);
    const tb = (k, txt, bg, fg) => `<button data-act="filter" data-f="${k}" style="background:${filter === k ? "#fbbf24" : bg};color:${filter === k ? "#111" : fg}">${txt}</button>`;
    return `<div class="rwcfb-panel">
      <header>
        <h3>${MODE === "dev" ? "All comments on the site" : "Your notes"}</h3>
        <div class="rwcfb-small" style="color:#cbd5e1">${MODE === "dev" ? "Every note you and your beta testers left. Red = not fixed yet, green = fixed. Updates every minute." : "Thank you! Everything you save goes straight to the site owner."}</div>
        <div class="rwcfb-tally">
          ${tb("open", `Not fixed: ${counts.open}`, "#7f1d1d", "#fff")}
          ${tb("fixed", `Fixed: ${counts.fixed + counts.confirmed}`, "#14532d", "#fff")}
          ${MODE === "dev" ? tb("beta", `From beta testers: ${list.filter((c) => c.site === "beta").length}`, "#1e3a8a", "#fff") : ""}
          ${tb("all", `All: ${counts.all}`, "#334155", "#fff")}
        </div>
      </header>
      <div class="rwcfb-list">
        ${shown.length ? shown.map(itemHtml).join("") : `<p class="rwcfb-small" style="padding:12px">Nothing here yet. Turn on “💬 Comment on something” and click any part of the page.</p>`}
      </div>
    </div>`;
  }
  function itemHtml(c) {
    const fix = c.fixNote ? `<div class="fix"><b>${c.status === "wontfix" ? "Developer's note" : "What was done"}${c.fixedAt ? " · " + esc(when(c.fixedAt)) : ""}:</b> ${esc(c.fixNote)}</div>` : "";
    const thread = (c.thread || []).map((t) => `<div class="fix" style="background:#fff7ed;border-color:#f97316"><b>${esc(t.author || "You")} · ${esc(when(t.createdAt))}:</b> ${esc(t.note || t.action)}</div>`).join("");
    const acts = [`<button data-act="goto" data-id="${esc(c.id)}">📍 Show me where</button>`];
    if (MODE === "dev" && c.status === "fixed") acts.push(`<button data-act="confirm" data-id="${esc(c.id)}">👍 Looks good</button>`);
    if (MODE === "dev" && ["fixed", "confirmed", "wontfix"].includes(c.status)) acts.push(`<button data-act="reopen" data-id="${esc(c.id)}">↺ Still not right</button>`);
    return `<div class="rwcfb-item">
      <div class="top"><span>${esc(when(c.createdAt))}${c.site === "beta" ? ` · <b>Beta: ${esc(c.author || "anonymous")}</b>` : ""} · ${esc(TYPE_L[c.type] || "Note")}</span>${statusBadge(c.status)}</div>
      <div class="where">📍 ${esc(c.page || "")} → ${esc(c.element || "")}</div>
      <div class="txt">${esc(c.comment)}</div>
      ${fix}${thread}
      <div class="acts">${acts.join("")}</div>
      <div class="rwcfb-small" style="margin-top:4px">${c.num ? "Comment #" + esc(c.num) : "Received — will get a number within about 5 minutes"}</div>
    </div>`;
  }

  function onUiClick(e) {
    const b = e.currentTarget;
    const act = b.getAttribute("data-act");
    if (act === "toggle") { commentOn = !commentOn; save(LS_ON, commentOn); clearHl(); render(); }
    else if (act === "panel") { panelOpen = !panelOpen; render(); if (panelOpen) refresh(); }
    else if (act === "filter") { filter = b.getAttribute("data-f"); render(); }
    else if (act === "goto") gotoComment(b.getAttribute("data-id"));
    else if (act === "confirm" || act === "reopen") actionOn(b.getAttribute("data-id"), act);
  }

  async function actionOn(id, action) {
    let note = "";
    if (action === "reopen") { note = prompt("What's still not right? (optional)") || ""; }
    const p = { kind: "action", id: uid(), target: id, action, note: clip(note, 1500), site: MODE, author: MODE === "beta" ? load(LS_NAME, "") : "Site owner", createdAt: new Date().toISOString() };
    const ok = await send(p);
    (window.__rwcfbActions = window.__rwcfbActions || []).push(p);
    toast(ok ? (action === "confirm" ? "Marked as good ✓" : "Re-opened — sent to the developer") : "No connection — saved and will send automatically");
    render();
  }

  function gotoComment(id) {
    const c = allComments().find((x) => x.id === id);
    if (!c) return;
    const go = () => {
      const el = locate(c);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("rwcfb-flash"); setTimeout(() => el.classList.remove("rwcfb-flash"), 2500); }
      else toast("That spot isn't on the page right now (the page may have changed).");
    };
    const here = location.hash.replace(/^#/, "");
    if ((c.hash || "") !== here) {
      sessionStorage.setItem("rwcfb_goto", id);
      location.hash = c.hash || "";
      location.reload();
      return;
    }
    if (c.navLabel) {
      const btn = Array.from(document.querySelectorAll("#mainNav button")).find((x) => clip(x.innerText.replace(/\(\d[\d,]*\)/, ""), 40) === c.navLabel);
      if (btn && !btn.classList.contains("active")) { btn.click(); setTimeout(go, 1200); return; }
    }
    go();
  }

  // ---------- pins on commented spots (developer copy only) ----------
  let pinTimer = null;
  function placePins(list) {
    if (MODE !== "dev") return;
    pinLayer.innerHTML = "";
    const here = location.hash.replace(/^#/, "");
    const page = currentPage();
    const groups = new Map();
    list.forEach((c) => {
      if ((c.hash || "") !== here) return;
      if (c.navLabel && page.label !== c.navLabel && !here) return;
      const el = locate(c);
      if (!el) return;
      if (!groups.has(el)) groups.set(el, []);
      groups.get(el).push(c);
    });
    groups.forEach((cs, el) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const open = cs.filter((c) => ["open", "pending"].includes(c.status)).length;
      const pin = document.createElement("div");
      pin.className = "rwcfb-pin " + (open === cs.length ? "open" : open ? "mixed" : "fixed");
      pin.textContent = open ? (cs.length > 1 ? `${open}/${cs.length}` : "!") : "✓";
      pin.title = cs.map((c) => `${statusOf(c) === "open" ? "NOT FIXED" : statusOf(c).toUpperCase()}: ${clip(c.comment, 80)}`).join("\n");
      pin.style.left = Math.max(0, r.left + window.scrollX - 10) + "px";
      pin.style.top = Math.max(0, r.top + window.scrollY - 10) + "px";
      pin.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); panelOpen = true; filter = "all"; render(); });
      pinLayer.appendChild(pin);
    });
  }
  function schedulePins() {
    if (MODE !== "dev") return;
    clearTimeout(pinTimer);
    pinTimer = setTimeout(() => placePins(applyLiveActions(allComments())), 250);
  }
  new MutationObserver((muts) => { if (muts.some((m) => !inUi(m.target) && m.target !== pinLayer && !pinLayer.contains(m.target))) schedulePins(); })
    .observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", schedulePins);
  window.addEventListener("hashchange", schedulePins);

  // ---------- comment mode: hover highlight + click capture ----------
  let hl = null;
  function clearHl() { if (hl) hl.classList.remove("rwcfb-hl"); hl = null; }
  document.addEventListener("mouseover", (e) => {
    if (!commentOn || inUi(e.target)) return;
    const t = smartTarget(e.target);
    if (t === hl) return;
    clearHl(); hl = t; hl.classList.add("rwcfb-hl");
  }, true);
  const swallow = (e) => {
    if (!commentOn || inUi(e.target) || document.querySelector(".rwcfb-modal-bg")) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  };
  ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "dblclick", "submit", "auxclick"].forEach((ev) => document.addEventListener(ev, swallow, true));
  document.addEventListener("click", (e) => {
    if (inUi(e.target) || e.target.closest(".rwcfb-modal-bg")) return;
    if (!commentOn && !e.altKey) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    openComposer(smartTarget(e.target));
  }, true);

  function openComposer(el) {
    clearHl();
    let target = el;
    let type = "change";
    const bg = document.createElement("div");
    bg.className = "rwcfb-modal-bg";
    bg.id = "rwcfb-modal";
    root.appendChild(bg);
    const draw = () => {
      target.classList.add("rwcfb-flash");
      const page = currentPage();
      bg.innerHTML = `<div class="rwcfb-modal" role="dialog" aria-label="Leave a note">
        <h3>💬 Leave a note about this</h3>
        <div class="rwcfb-what"><b>You clicked: ${esc(describe(target))}</b>On: ${esc(page.label)}
          <div style="margin-top:6px"><button class="rwcfb-btn rwcfb-ghost" data-k="bigger" type="button" style="padding:4px 10px">⬆ Select the bigger area around it</button></div></div>
        <label>What kind of note?</label>
        <div class="rwcfb-types">${Object.entries(TYPE_L).map(([k, v]) => `<button type="button" data-type="${k}" class="${k === type ? "sel" : ""}">${v}</button>`).join("")}</div>
        ${MODE === "beta" ? `<label for="rwcfb-name">Your name</label><input id="rwcfb-name" maxlength="60" placeholder="So the owner knows who sent it" value="${esc(load(LS_NAME, ""))}">` : ""}
        <label for="rwcfb-text">Your note — what should change, what's wrong, or what's your question?</label>
        <textarea id="rwcfb-text" maxlength="${MAX_COMMENT}" placeholder="Example: This button should say “Watch the meeting” instead."></textarea>
        <div class="rwcfb-small"><span id="rwcfb-count">0</span>/${MAX_COMMENT}</div>
        <div class="rwcfb-row">
          <button type="button" class="rwcfb-btn rwcfb-ghost" data-k="cancel">Cancel</button>
          <button type="button" class="rwcfb-btn rwcfb-primary" data-k="save">💾 Save note</button>
        </div>
      </div>`;
      const ta = $("#rwcfb-text", bg);
      ta.addEventListener("input", () => { $("#rwcfb-count", bg).textContent = ta.value.length; });
      setTimeout(() => ta.focus(), 30);
      bg.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => { type = b.getAttribute("data-type"); bg.querySelectorAll("[data-type]").forEach((x) => x.classList.toggle("sel", x === b)); }));
      $("[data-k=cancel]", bg).addEventListener("click", close);
      $("[data-k=bigger]", bg).addEventListener("click", () => {
        const keep = ta.value;
        const p = target.parentElement;
        if (p && p !== document.body && p !== document.documentElement) { target.classList.remove("rwcfb-flash"); target = p; draw(); $("#rwcfb-text", bg).value = keep; }
      });
      $("[data-k=save]", bg).addEventListener("click", submit);
    };
    const close = () => { target.classList.remove("rwcfb-flash"); bg.remove(); };
    bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
    async function submit() {
      const text = $("#rwcfb-text", bg).value.trim();
      if (!text) { $("#rwcfb-text", bg).focus(); toast("Please type your note first."); return; }
      let author = "Site owner";
      if (MODE === "beta") {
        author = clip($("#rwcfb-name", bg).value, 60);
        if (!author) { $("#rwcfb-name", bg).focus(); toast("Please add your name."); return; }
        save(LS_NAME, author);
      }
      const page = currentPage();
      const navActive = document.querySelector("#mainNav button.active");
      const payload = {
        kind: "comment", id: uid(), site: MODE, author, type,
        comment: text.slice(0, MAX_COMMENT),
        page: page.label, hash: page.hash,
        navLabel: navActive ? clip(navActive.innerText.replace(/\(\d[\d,]*\)/, ""), 40) : "",
        element: describe(target), elementText: clip(elText(target), 160), tag: target.tagName.toLowerCase(),
        selector: cssPath(target).slice(0, 600),
        url: location.href.slice(0, 300), screen: `${window.innerWidth}x${window.innerHeight}`,
        createdAt: new Date().toISOString(),
      };
      $("[data-k=save]", bg).disabled = true;
      const ok = await send(payload);
      mine.push(Object.assign({}, payload, { status: "pending" }));
      save(LS_MINE, mine);
      close();
      toast(ok ? "Saved ✓ Your note was sent." : "No connection right now — your note is saved on this device and will send automatically.", 4500);
      render();
      setTimeout(refresh, 1500);
    }
    draw();
  }

  // ---------- start ----------
  render();
  refresh();
  setInterval(refresh, 60000);
  const pendingGoto = sessionStorage.getItem("rwcfb_goto");
  if (pendingGoto) { sessionStorage.removeItem("rwcfb_goto"); setTimeout(() => gotoComment(pendingGoto), 3500); }
  window.RWCFeedback = { refresh, open: () => { panelOpen = true; render(); } };
})();
