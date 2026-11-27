/* The Real Windy City — Cheyenne city meetings, speaker video clips, who's who and public records */
(function () {
  "use strict";
  // Where data/ and provenance/ live. The beta copy in a sub-folder sets window.RWC_BASE = "../".
  const BASE = window.RWC_BASE || "./";
  const assetUrl = (u) => (typeof u === "string" && u.startsWith("./") ? BASE + u.slice(2) : u);

  // "Views" of a single meeting. Keys are internal ids; names and blurbs are what visitors see.
  const LENSES = [
    { key: "foundry", name: "Meeting Documents", icon: "📄", accent: "#38bdf8", group: "Check", blurb: "The agenda and every document attached to it, with a text search of the scanned pages." },
    { key: "gotham", name: "Connections", icon: "🕸️", accent: "#10b981", group: "Follow", blurb: "Who and what is connected to this meeting: officials, companies, ordinances, documents and speakers." },
    { key: "speakers", name: "Speaker Videos", icon: "🎙️", accent: "#f59e0b", group: "Watch", blurb: "Video clips of each person who spoke, cued to the right spot in the meeting video." },
    { key: "provenance", name: "Where the Records Come From", icon: "🎥", accent: "#f43f5e", group: "Check", blurb: "Screen recordings showing the public web pages and clicks used to download each record." },
    { key: "story", name: "Plain-English Story", icon: "📖", accent: "#fbbf24", group: "Watch", blurb: "What happened, why it matters, explained at four levels from headline to kid-friendly." },
    { key: "tabloid", name: "Front Page", icon: "🗞️", accent: "#ef4444", group: "Watch", blurb: "Newspaper-style headlines, each one footnoted back to the official agenda packet." },
    { key: "cast", name: "Who Was There", icon: "🎭", accent: "#a855f7", group: "Watch", blurb: "The presiding officer, council members, staff and members of the public who spoke." },
    { key: "callsheet", name: "Agenda, Item by Item", icon: "🎬", accent: "#38bdf8", group: "Watch", blurb: "The agenda in order. Click an item to see who brought it, what staff recommended and the dollar limit." },
    { key: "votes", name: "Votes", icon: "🗳️", accent: "#22c55e", group: "Follow", blurb: "Every recorded motion in the minutes: unanimous votes, split votes and who voted no." },
    { key: "map", name: "Map", icon: "🗺️", accent: "#14b8a6", group: "Follow", blurb: "Where the rezonings, annexations, subdivisions and road projects on this agenda are." },
    { key: "history", name: "Ordinance History", icon: "🕰️", accent: "#f97316", group: "Follow", blurb: "Each ordinance on this agenda followed through its 1st, 2nd and final readings." },
    { key: "money", name: "Follow the Money", icon: "💵", accent: "#84cc16", group: "Follow", blurb: "Every contract, bid, grant and spending item, largest first, with its source." },
    { key: "jargon", name: "City Terms Explained", icon: "🔤", accent: "#ec4899", group: "Follow", blurb: "What terms like UDC, NTE, consent agenda, BOPU, 6th Penny and substitute mean." },
    { key: "legal", name: "The Legal Question", icon: "⚖️", accent: "#8b5cf6", group: "Check", blurb: "The legal question, the rule that applies, how it applies here and the likely answer, under Wyoming law." },
    { key: "factcheck", name: "Fact Check", icon: "🔍", accent: "#06b6d4", group: "Check", blurb: "Key facts pulled from the agenda documents, with warnings where something looks off." },
    { key: "analytics", name: "By the Numbers", icon: "📊", accent: "#eab308", group: "Check", blurb: "How many items, how many passed together on consent, total dollars and how many no votes." },
    { key: "transcript", name: "Full Text", icon: "📜", accent: "#cbd5e1", group: "Check", blurb: "Searchable minutes, what was said (split by speaker automatically) and excerpts from the documents." },
    { key: "script", name: "Screenplay", icon: "✍️", accent: "#fda4af", group: "Watch", blurb: "The meeting written as a script, with motions and word-for-word quotes." },
    { key: "evidence", name: "Source Files", icon: "🗄️", accent: "#94a3b8", group: "Check", blurb: "Links to the meeting video, saved web-page copies, speaker video downloads and file fingerprints." }
  ];

  // Tone of a clip (data keys stay the same; labels are what visitors see)
  const EMOTIONS = {
    impactful: { label: "Strong moment", icon: "🔥", cls: "tag-amber" },
    angry: { label: "Heated / cut off", icon: "😠", cls: "tag-rose" },
    concerned: { label: "Concerned", icon: "😟", cls: "tag-amber" },
    legal: { label: "Legal argument", icon: "⚖️", cls: "tag-violet" },
    technical: { label: "Budget, staff or technical", icon: "📊", cls: "tag-sky" },
    supportive: { label: "Supportive", icon: "🤝", cls: "tag-emerald" }
  };

  const THEMES = {
    annexation: "Annexation (adding land to the city)",
    datacenters: "Data centers, power & water",
    budget: "Budget & taxes",
    zoning: "Zoning & building rules",
    procedure: "Meeting rules & public comment",
    housing: "Housing & subdivisions",
    safety: "Police, fire & public safety",
    contracts: "Contracts & bids",
    infrastructure: "Roads, parks & stormwater"
  };

  // Who the person was speaking as (values match data/speaker_turns.json speakingCapacity)
  const CAPACITIES = [
    "Elected official",
    "City staff",
    "City board member",
    "Speaking for an organization",
    "Contractor or applicant",
    "Civic watchdog",
    "Resident"
  ];

  const STANCES = [
    ["support_lobby_for", "Supports"],
    ["oppose_challenge", "Opposes"],
    ["sponsor_motion", "Makes a motion"],
    ["procedural_point_of_order", "Raises a point of order"],
    ["technical_staff_report", "Staff report"],
    ["inquiry_discussion", "Questions & discussion"]
  ];

  const DB = (window.DB = {
    episodes: [],
    epBySlug: new Map(),
    seasonCache: new Map(),
    turns: [],
    turnById: new Map(),
    speakers: [],
    speakerBySlug: new Map(),
    osint: [],
    ordinances: [],
    ordBySlug: new Map(),
    docs: null,
    provenance: null,
    people: [],
    featured: null
  });

  const STATE = (window.STATE = {
    view: "home",
    epSlug: null,
    epLens: "foundry",
    epMode: "swipe",
    splitLeft: "foundry",
    splitRight: "speakers",
    epFilterQ: "",
    epFilterBody: "",
    epFilterSeason: "",
    epPage: 1,
    spkAxis: "speaker",
    spkRosterQ: "",
    spkSlug: "",
    spkDate: "",
    spkOrd: "",
    spkTheme: "",
    spkEmotion: "",
    spkCapacity: "",
    spkStance: "",
    spkPoe: false,
    spkQ: "",
    spkSort: "impact",
    spkPage: 1,
    osintCategory: "",
    osintQ: "",
    osintPage: 1,
    ordSlug: null,
    ordStageIdx: 0,
    ordKind: "",
    ordQ: "",
    ordPage: 1,
    docQ: "",
    docRole: "",
    docOcr: false,
    docPage: 1,
    selectedDocId: null,
    castQ: "",
    castKind: "",
    castPage: 1,
    provActiveUrl: null,
    provActiveTitle: "",
    provActiveDesc: "",
    provQ: "",
    provPage: 1,
    floats: []
  });

  // Site-wide counts, computed from the data at start-up so the page never shows stale numbers
  const C = (window.COUNTS = { episodes: 0, withVideo: 0, turns: 0, timed: 0, branded: 0, speakers: 0, osint: 0, docs: 0, ordinances: 0, films: 0 });
  function fmtN(n) {
    return Number(n || 0).toLocaleString("en-US");
  }
  const DOC_ROLES = { attachment: "Attached document", agenda: "Agenda", minutes: "Minutes", substitute: "Revised version", staff_report: "Staff report" };
  function docRoleLabel(r) {
    return DOC_ROLES[r] || String(r || "Document").replace(/_/g, " ");
  }
  function docTitle(t) {
    return String(t || "").replace(/^\[cheyenne-archives[^\]]*\]\s*/, "");
  }
  function bodyLabel(b) {
    if (b === "other") return "Other boards & commissions";
    const e = DB.episodes.find((x) => x.body === b);
    return e ? e.bodyName : b;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // for values placed inside a single-quoted JS string in an onclick="" attribute
  function jsq(s) {
    return esc(String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, " "));
  }

  function safeUrl(u) {
    if (!u) return "";
    u = assetUrl(u);
    if (u.includes("archive-video.granicus.com")) return "";
    if (u.includes("granicus.com") && !u.includes("web.archive.org")) return "https://web.archive.org/web/" + u;
    return u;
  }

  function money(n) {
    if (!n) return "$0";
    return n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : "$" + Math.round(n).toLocaleString("en-US");
  }

  function renderPagination(page, totalItems, pageSize, onPageFnName) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return `
      <div class="pagination-bar">
        <button type="button" class="btn" ${page <= 1 ? "disabled" : ""} onclick="${onPageFnName}(${page - 1})">← Previous Page</button>
        <span style="font-family:var(--mono);color:#cbd5e1">Page <b>${page}</b> of <b>${totalPages}</b> (${totalItems.toLocaleString()} results)</span>
        <button type="button" class="btn btn-amber" ${page >= totalPages ? "disabled" : ""} onclick="${onPageFnName}(${page + 1})">Next Page →</button>
      </div>`;
  }

  // Reusable branded video player (Real Windy City intro + scrolling banner + captions + outro)
  function renderVideoBox(opts) {
    const id = opts.id;
    const headerRight = opts.headerRight || "";
    const title = opts.title || "Cheyenne city meeting";
    const sub = opts.sub || "Public record";
    const ccText = opts.ccText || title;
    const marquee = opts.marquee || `THE REAL WINDY CITY · ${title.toUpperCase()} · ${sub.toUpperCase()} · MEETING VIDEO FROM THE INTERNET ARCHIVE · OFFICIAL CITY MINUTES`;
    const videoSrc = safeUrl(opts.videoSrc);
    const iframeSrc = opts.iframeSrc || "";
    const maxEndSec = opts.endSec || 0;
    const minStartSec = opts.startSec || 0;
    const poster = opts.poster ? `poster="${esc(assetUrl(opts.poster))}"` : "";
    const autoPlayAttr = opts.autoPlay ? "autoplay" : "";

    const mediaHtml = videoSrc
      ? `<video id="${id}_vid" src="${esc(videoSrc)}" ${poster} ${autoPlayAttr} controls preload="metadata"
           onloadedmetadata="if(${minStartSec}>0 && !'${jsq(videoSrc)}'.includes('rwc-turn-')){try{if(this.duration>${minStartSec}+2)this.currentTime=${minStartSec};}catch(e){}}"
           ontimeupdate="if(${maxEndSec}>0 && !'${jsq(videoSrc)}'.includes('rwc-turn-') && this.currentTime>=${maxEndSec}){this.pause();setVideoPhase('${id}','outro');}"
           onended="setVideoPhase('${id}','outro')"
           onplay="if(${maxEndSec}>0 && !'${jsq(videoSrc)}'.includes('rwc-turn-') && (this.currentTime>=${maxEndSec}-0.5 || this.currentTime<${minStartSec}-1)){this.currentTime=${minStartSec};}"
           style="width:100%;max-height:${opts.height || 310}px;display:block;background:#000"></video>`
      : iframeSrc
      ? `<iframe src="${esc(iframeSrc)}" allow="autoplay; encrypted-media" allowfullscreen style="width:100%;height:${opts.height || 260}px;border:0;display:block;background:#000"></iframe>`
      : `<div style="padding:28px;text-align:center;font-size:12px;color:#94a3b8">${opts.noVideoNote ? esc(opts.noVideoNote) : "No video for this clip. Open the meeting page for the full video and minutes."}</div>`;

    return `
      <div class="vbox-box" id="${id}">
        <div class="vbox-top">
          <span style="color:var(--amber)">THE REAL WINDY CITY · CHEYENNE CITY MEETINGS</span>
          <div style="display:flex;gap:5px;align-items:center">
            <span style="color:#fff;font-family:var(--mono)">${esc(headerRight)}</span>
            <button type="button" class="chip" style="padding:1px 6px;font-size:9.5px" onclick="setVideoPhase('${id}','intro')">Intro</button>
            <button type="button" class="chip active" style="padding:1px 6px;font-size:9.5px" onclick="toggleVideoCc('${id}',this)">CC</button>
            <button type="button" class="chip" style="padding:1px 6px;font-size:9.5px" onclick="setVideoPhase('${id}','outro')">Outro</button>
          </div>
        </div>
        <div class="vbox-stage">
          <div id="${id}_intro" style="display:${opts.startWithIntro ? "flex" : "none"};min-height:${opts.height || 220}px;padding:18px;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:linear-gradient(135deg,#071226,#02050d)">
            <span class="tag tag-amber">THE REAL WINDY CITY · CIVIC ARCHIVE</span>
            <div style="font-weight:900;font-size:16px;margin-top:8px;color:#fff">${esc(title)}</div>
            <div style="font-size:11.5px;color:var(--amber);margin-top:4px">${esc(sub)}</div>
            <button type="button" class="btn btn-amber" style="margin-top:12px;padding:6px 14px" onclick="setVideoPhase('${id}','main')">▶ Play</button>
          </div>
          <div id="${id}_main" style="display:${opts.startWithIntro ? "none" : "block"};position:relative">
            ${mediaHtml}
            <div id="${id}_cc" class="vbox-cc">CC · “${esc(ccText.slice(0, 145))}${ccText.length > 145 ? "…" : ""}”</div>
          </div>
          <div id="${id}_outro" style="display:none;min-height:${opts.height || 220}px;padding:18px;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:linear-gradient(135deg,#02050d,#09172e)">
            <div style="font-size:13px;font-weight:900;letter-spacing:0.2em;color:var(--amber)">THE REAL WINDY CITY</div>
            <div style="font-size:11.5px;color:#e2e8f0;margin-top:4px">Cheyenne public meeting record · Internet Archive video &amp; official City Clerk minutes</div>
            <button type="button" class="btn" style="margin-top:12px;padding:5px 12px" onclick="setVideoPhase('${id}','main')">↺ Replay</button>
          </div>
        </div>
        <div class="vbox-chyron">
          <b style="color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</b>
          <span style="color:var(--amber);font-family:var(--mono);font-size:10px;white-space:nowrap">${esc(sub)}</span>
        </div>
        <div class="vbox-marquee">
          <div class="vbox-marquee-track">
            <span style="padding-right:48px">${esc(marquee)}</span>
            <span style="padding-right:48px">${esc(marquee)}</span>
          </div>
        </div>
      </div>`;
  }

  window.setVideoPhase = function (id, phase) {
    const intro = document.getElementById(id + "_intro");
    const main = document.getElementById(id + "_main");
    const outro = document.getElementById(id + "_outro");
    const vid = document.getElementById(id + "_vid");
    if (!intro || !main || !outro) return;
    intro.style.display = phase === "intro" ? "flex" : "none";
    main.style.display = phase === "main" ? "block" : "none";
    outro.style.display = phase === "outro" ? "flex" : "none";
    if (phase === "main" && vid) {
      vid.play().catch(() => {});
    } else if (vid) {
      vid.pause();
    }
  };

  window.toggleVideoCc = function (id, btn) {
    const cc = document.getElementById(id + "_cc");
    if (!cc) return;
    const hidden = cc.style.display === "none";
    cc.style.display = hidden ? "block" : "none";
    btn.classList.toggle("active", hidden);
  };

  // Client-side ZIP builder for a speaker's clips (only their own clips, never whole meetings)
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function buildZipBlob(entries) {
    const enc = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const e of entries) {
      const nb = enc.encode(e.name);
      const data = e.data instanceof Uint8Array ? e.data : enc.encode(String(e.data));
      const crc = crc32(data);
      const sz = data.length;
      const loc = new Uint8Array(30 + nb.length + sz);
      const lv = new DataView(loc.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(12, 0x5978, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, sz, true);
      lv.setUint32(22, sz, true);
      lv.setUint16(26, nb.length, true);
      loc.set(nb, 30);
      loc.set(data, 30 + nb.length);
      locals.push(loc);

      const cen = new Uint8Array(46 + nb.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(14, 0x5978, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, sz, true);
      cv.setUint32(24, sz, true);
      cv.setUint16(28, nb.length, true);
      cv.setUint32(42, offset, true);
      cen.set(nb, 46);
      centrals.push(cen);
      offset += loc.length;
    }
    const cSize = centrals.reduce((s, x) => s + x.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cSize, true);
    ev.setUint32(16, offset, true);
    return new Blob([...locals, ...centrals, eocd], { type: "application/zip" });
  }

  window.downloadSpeakerZip = async function (speakerSlug) {
    const spk = DB.speakerBySlug.get(speakerSlug);
    if (!spk) return;
    const turns = DB.turns.filter((t) => t.speakerSlug === speakerSlug);
    const an = spk.analytics || {};
    const md = [
      `# ${spk.name} — Cheyenne speaker profile and video clips`,
      `- Role: ${spk.role}`,
      `- Clips: ${turns.length} from ${spk.meetingCount} meetings (${spk.firstDate} to ${spk.lastDate})`,
      `- Average time speaking: ${an.avgSpeakingFormatted || "N/A"} · Points of order: ${an.pointOfOrderCount || 0}`,
      an.osint && an.osint.headline ? `- About: ${an.osint.headline}` : "",
      ``,
      `## What is in this download`,
      `Each command below saves only ${spk.name}'s own clip (3 minutes at most), never the whole meeting video.`,
      ``
    ];
    const sh = [
      `#!/usr/bin/env bash`,
      `set -euo pipefail`,
      `mkdir -p "${speakerSlug}_speaker_segments" && cd "${speakerSlug}_speaker_segments"`
    ];
    for (const t of turns) {
      const dur = Math.min(180, Math.max(8, Math.round(t.durationSec || 45)));
      const fn = `${t.date}_${speakerSlug}_turn${t.id}_${dur}s.mp4`;
      md.push(`### Clip #${t.id} — ${t.date} · ${t.bodyName} [${t.hms}, ${dur}s]`);
      md.push(`- Speaking as: ${t.speakingCapacity || spk.role} · Position: ${t.stanceLabel || "Not recorded"}`);
      if (t.brandedMp4Url) {
        md.push(`- Ready-made video clip (MP4): ${t.brandedMp4Url}`);
        sh.push(`curl -fL "${t.brandedMp4Url}" -o "${fn}"`);
      } else if (t.directMp4Url) {
        md.push(`- Video clip (MP4): ${t.directMp4Url}`);
        sh.push(`curl -fL "${t.directMp4Url}" -o "${fn}"`);
      } else if (t.sourceMeetingMp4Url) {
        const endSec = Math.min(t.endSec || t.startSec + dur, t.startSec + 180);
        sh.push(`ffmpeg -y -ss ${t.startSec} -to ${endSec} -i "${t.sourceMeetingMp4Url}" -c:v libx264 -c:a aac -movflags +faststart "${fn}"`);
      } else if (t.youtubeId) {
        const endSec = Math.min(Math.ceil(t.endSec || t.startSec + dur), Math.floor(t.startSec) + 180);
        sh.push(`yt-dlp --download-sections "*${Math.floor(t.startSec)}-${endSec}" -f mp4 "https://www.youtube.com/watch?v=${t.youtubeId}" -o "${fn}"`);
      } else {
        md.push(`- Video: transcript only — ${t.videoTimingNote || "no confirmed recording of this clip"}`);
      }
      if (t.videoTiming === "diarized_window" || t.speakerAttributionVerified === false) md.push(`- Note: ${t.speakerUnverifiedReason || t.videoTimingNote}`);
      md.push(`> "${t.text}"\n`);
    }
    const entries = [
      { name: `${speakerSlug}/SPEAKER_PROFILE_AND_CLIPS.md`, data: md.join("\n") },
      { name: `${speakerSlug}/profile_and_clips.json`, data: JSON.stringify({ profile: spk, turns }, null, 2) },
      { name: `${speakerSlug}/download_clips.sh`, data: sh.join("\n") + "\n" }
    ];
    const blob = buildZipBlob(entries);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${speakerSlug}-video-clips.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  window.playThemeSong = function () {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 440.0, 523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + i * 0.22 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.21);
    });
  };

  window.openFbModal = function (turnId) {
    const t = DB.turnById.get(Number(turnId));
    if (!t) return;
    const emo = EMOTIONS[t.emotion] || EMOTIONS.impactful;
    const an = t.speakerAnalytics;
    const dur = Math.min(180, Math.max(8, Math.round(t.durationSec || 45)));
    const standaloneSegmentUrl = t.brandedMp4Url || t.directMp4Url || "";
    const shareUrl = "https://www.facebook.com/profile.php?id=61576260305204"; // clip shares point to The Real Windy City Facebook page
    const caption = [
      `${emo.icon} ${t.speakerName} (${t.speakingCapacity || t.speakerRole}) at Cheyenne ${t.bodyName} — ${t.date} [${t.hms}] (${dur}-second clip)`,
      an ? `📊 ${an.historicalClipCount} clips on record · usually speaks about ${an.avgSpeakingFormatted}${an.pointOfOrderCount ? ` · ${an.pointOfOrderCount} points of order` : ""}` : "",
      ``,
      `“${t.text.slice(0, 320)}${t.text.length > 320 ? "…" : ""}”`,
      `🎥 Follow The Real Windy City on Facebook: ${shareUrl}`,
      `#CheyenneWY #TheRealWindyCity #PublicRecord ${(t.themes || []).map((x) => "#" + x).join(" ")}`
    ].filter(Boolean).join("\n");

    const endSec = Math.min(t.endSec || t.startSec + dur, t.startSec + 180);
    const ffmpegCmd = t.sourceMeetingMp4Url
      ? `ffmpeg -y -ss ${t.startSec} -to ${endSec} -i "${t.sourceMeetingMp4Url}" -c:v libx264 -c:a aac "${t.speakerSlug}-turn-${t.id}-${dur}s.mp4"`
      : "";

    const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(caption)}`;
    const modal = document.getElementById("modalLayer");
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="if(event.target===this)document.getElementById('modalLayer').innerHTML=''">
        <div class="modal-card">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;border-bottom:1px solid #1e293b;padding-bottom:12px">
            <div>
              <div class="kicker">Share this clip on Facebook (3 minutes or less)</div>
              <h3 style="margin:4px 0 0">${esc(t.speakerName)} · ${esc(t.date)} (${dur}-second clip)</h3>
            </div>
            <button type="button" class="btn" onclick="document.getElementById('modalLayer').innerHTML=''">✕ Close</button>
          </div>
          <div style="margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);font-size:12px;color:#d1fae5">
            <b>Only this clip:</b> downloads contain just <b>${esc(t.speakerName)}&rsquo;s ${dur}-second clip</b> (starting at ${esc(t.hms)}) with The Real Windy City intro, outro, banner and captions — never the whole meeting.
          </div>
          <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px">
            ${standaloneSegmentUrl ? `<a class="btn btn-emerald" href="${esc(standaloneSegmentUrl)}" download target="_blank" rel="noreferrer">⬇ Download this clip (MP4)</a>` : ""}
            <button type="button" class="btn btn-amber" onclick="downloadSpeakerZip('${jsq(t.speakerSlug)}')">📦 Download all of this speaker's clips (ZIP)</button>
            <button type="button" class="btn btn-sky" onclick="openSpeaker('${jsq(t.speakerSlug)}');document.getElementById('modalLayer').innerHTML=''">📼 View All ${an ? an.historicalClipCount : ""} Clips of ${esc(t.speakerName)} →</button>
          </div>
          ${!standaloneSegmentUrl && ffmpegCmd ? `
            <div style="margin-top:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;margin-bottom:4px">
                <span>Command to save just this ${dur}-second clip from the Internet Archive video (for ffmpeg users):</span>
                <button type="button" class="btn" style="padding:3px 9px;font-size:10.5px" onclick="navigator.clipboard.writeText(document.getElementById('ffmpegSegBox').value);this.textContent='✓ Copied!'">Copy Command</button>
              </div>
              <input id="ffmpegSegBox" readonly class="input" style="width:100%;font-family:var(--mono);font-size:11px" value="${esc(ffmpegCmd)}" />
            </div>` : ""}
          <div style="margin-top:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;color:#94a3b8">
              <span>Post text (edit before sharing if you like):</span>
              <button type="button" class="btn btn-sky" onclick="navigator.clipboard.writeText(document.getElementById('fbCapBox').value);this.textContent='✓ Copied!'">📋 Copy Post Text</button>
            </div>
            <textarea id="fbCapBox" rows="7" class="input" style="width:100%;font-family:var(--mono)">${esc(caption)}</textarea>
          </div>
          <div style="margin-top:14px;display:flex;justify-content:flex-end">
            <a class="btn btn-fb" href="${esc(fbHref)}" target="_blank" rel="noreferrer" onclick="navigator.clipboard.writeText(document.getElementById('fbCapBox').value).catch(()=>{})">📘 Share on Facebook ↗</a>
          </div>
        </div>
      </div>`;
  };

  async function ensureSeasonLoaded(season) {
    if (DB.seasonCache.has(season)) return DB.seasonCache.get(season);
    const r = await fetch(`${BASE}data/seasons/${season}.json`);
    const j = await r.json();
    DB.seasonCache.set(season, j);
    return j;
  }

  async function ensureDocsLoaded() {
    if (DB.docs) return DB.docs;
    const r = await fetch(`${BASE}data/documents_compact.json`);
    DB.docs = await r.json();
    return DB.docs;
  }

  function renderTurnCard(t) {
    const emo = EMOTIONS[t.emotion] || EMOTIONS.technical;
    const vidId = "turnVid_" + t.id;
    const an = t.speakerAnalytics || {};
    const histCount = an.historicalClipCount || 1;
    const avgFmt = an.avgSpeakingFormatted || `${Math.round(t.durationSec)}s`;
    const poeCount = an.pointOfOrderCount || 0;
    const isPoe = Boolean(t.pointOfOrder);
    const dur = Math.min(180, Math.max(8, Math.round(t.durationSec || 45)));
    const standaloneUrl = t.brandedMp4Url || t.directMp4Url || "";
    const hasVid = Boolean(t.brandedMp4Url || t.directMp4Url || t.sourceMeetingMp4Url || t.youtubeId);
    const osintLinks = (an.osint && an.osint.profiles) || [];

    return `
      <div class="panel" style="display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:start">
            <div>
              <a href="#speakers:${esc(t.speakerSlug)}" onclick="openSpeaker('${jsq(t.speakerSlug)}');return false;" style="font-weight:900;font-size:14.5px;color:#fff">🎙️ ${esc(t.speakerName)}</a>
              <div style="font-size:10.5px;color:#cbd5e1;margin-top:2px">
                ${esc(t.speakerRole)} · <b style="color:var(--amber)">${esc(t.speakingCapacity || "Role not recorded")}</b>
              </div>
            </div>
            <span class="tag ${emo.cls}">${emo.icon} ${esc(t.stanceLabel || emo.label)}</span>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;font-family:var(--mono);font-size:10px">
            <a href="#speakers:${esc(t.speakerSlug)}" onclick="openSpeaker('${jsq(t.speakerSlug)}');return false;" class="tag tag-amber" style="cursor:pointer">
              📼 ${histCount} clip${histCount === 1 ? "" : "s"} of this speaker →
            </a>
            <span class="tag tag-sky" title="Average time this person speaks">⏱️ Usually ${esc(avgFmt)}</span>
            <span class="tag ${isPoe || poeCount > 0 ? "tag-rose" : ""}" style="${!(isPoe || poeCount > 0) ? "background:#1e293b;color:#94a3b8" : ""}">
              ⚖️ ${isPoe ? `Point of order (${poeCount} total)` : `Points of order: ${poeCount}`}
            </span>
          </div>

          <div style="font-size:11px;color:#94a3b8;margin-top:6px;font-family:var(--mono)">
            <a href="#ep:${esc(t.meetingSlug)}" onclick="openEpisode('${jsq(t.meetingSlug)}');return false;" style="color:var(--sky);font-weight:700">${esc(t.date)} · ${esc(t.bodyName)}</a> · <span style="color:var(--amber)">at ${esc(t.hms)} (${dur}-second clip)</span>${t.videoTiming === "removed" ? ` <span class="tag" title="${esc(t.videoTimingNote || "")}" style="background:#1e293b;color:#cbd5e1">📄 Transcript only</span>` : (t.videoTiming === "diarized_window" || t.speakerAttributionVerified === false) ? ` <span class="tag tag-amber" title="${esc(t.speakerUnverifiedReason || t.videoTimingNote || "")}">⚠ Speaker not confirmed</span>` : ""}
          </div>

          <div id="${vidId}" style="margin-top:9px">
            <button type="button" onclick="mountTurnVideo(${t.id}, '${vidId}')" class="vbox-box" style="width:100%;padding:0;cursor:pointer;text-align:left;color:#fff">
              <div class="vbox-top">
                <span style="color:var(--amber)">THE REAL WINDY CITY</span>
                <span style="font-family:var(--mono)">${esc(t.date)} · ${dur}s</span>
              </div>
              <div style="height:132px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:radial-gradient(circle,#112240,#030712)">
                <span style="width:40px;height:40px;border-radius:999px;background:var(--amber);color:#000;display:grid;place-items:center;font-weight:900;font-size:15px">▶</span>
                <span style="font-size:11.5px;font-weight:800">${hasVid ? `Watch the ${dur}-second clip (with captions)` : "Read what was said (no video)"}</span>
                <span style="font-size:9.5px;font-family:var(--mono);color:var(--emerald)">${t.brandedMp4Url ? "✓ Ready-made HD video clip" : t.directMp4Url ? "✓ Video clip" : t.sourceMeetingMp4Url ? (t.videoTiming === "diarized_window" ? "✓ From the meeting video · speaker not confirmed" : "✓ From the meeting video · timing checked against the transcript") : t.youtubeId ? "✓ City of Cheyenne YouTube video · same spot" : "📄 " + esc(t.videoTimingNote || "No recording found")}</span>
              </div>
              <div class="vbox-marquee">
                <div class="vbox-marquee-track">
                  <span style="padding-right:36px">THE REAL WINDY CITY · ${esc(t.speakerName.toUpperCase())} · ${esc((t.speakingCapacity || t.speakerRole).toUpperCase())} · ${histCount} CLIPS</span>
                  <span style="padding-right:36px">THE REAL WINDY CITY · ${esc(t.speakerName.toUpperCase())} · ${esc((t.speakingCapacity || t.speakerRole).toUpperCase())} · ${histCount} CLIPS</span>
                </div>
              </div>
            </button>
          </div>

          <p style="font-size:12px;line-height:1.48;color:#e2e8f0;margin:9px 0">“${esc(t.text.slice(0, 240))}${t.text.length > 240 ? "…" : ""}”</p>

          <details style="margin-bottom:8px;background:#050b16;border:1px solid #1e293b;border-radius:8px;padding:6px 9px;font-size:11px">
            <summary style="cursor:pointer;font-weight:800;color:var(--sky)">📊 Topics, roles, positions &amp; links</summary>
            <div style="margin-top:7px;display:grid;gap:5px;color:#cbd5e1">
              ${an.capacitiesSummary ? `<div><b style="color:var(--amber)">Speaks as:</b> ${esc([].concat(an.capacitiesSummary).join(" · "))}</div>` : ""}
              ${an.topTopics && an.topTopics.length ? `<div><b style="color:var(--sky)">Topics:</b> ${an.topTopics.map((tp) => (typeof tp === "string" ? esc(tp) : `${esc(tp.label || tp.topic || "")}${tp.count != null ? ` (${tp.count})` : ""}`)).join(" · ")}</div>` : ""}
              ${an.lobbiesFor && an.lobbiesFor.length ? `<div><b style="color:var(--emerald)">Has spoken in favor of:</b> ${esc(an.lobbiesFor.slice(0, 2).join(" | "))}</div>` : ""}
              ${an.opposes && an.opposes.length ? `<div><b style="color:var(--rose)">Has spoken against:</b> ${esc(an.opposes.slice(0, 2).join(" | "))}</div>` : ""}
              ${osintLinks.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px">
                ${osintLinks.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noreferrer" class="tag tag-emerald">🔗 ${esc(p.platform)} ↗</a>`).join("")}
                <a href="#osint" onclick="STATE.osintQ='${jsq(t.speakerName)}';navTo('osint');return false;" class="tag tag-sky">🕸️ Who's Who →</a>
              </div>` : ""}
            </div>
          </details>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;border-top:1px solid #1e293b;padding-top:9px;font-size:11px">
          <div>${(t.themes || []).slice(0, 3).map((th) => `<span class="tag" style="background:#1e293b;margin-right:3px">${esc(THEMES[th] || th)}</span>`).join("")}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            ${standaloneUrl ? `<a class="btn btn-emerald" style="padding:4px 9px;font-size:10.5px" href="${esc(standaloneUrl)}" download target="_blank" rel="noreferrer">⬇ ${dur}s MP4</a>` : ""}
            <button type="button" class="btn" style="padding:4px 9px;font-size:10.5px" onclick="downloadSpeakerZip('${jsq(t.speakerSlug)}')">📦 All clips (ZIP)</button>
            <button type="button" class="btn btn-fb" style="padding:4px 9px;font-size:10.5px" onclick="openFbModal(${t.id})">📘 Share</button>
          </div>
        </div>
      </div>`;
  }

  window.mountTurnVideo = function (turnId, containerId) {
    const t = DB.turnById.get(Number(turnId));
    const el = document.getElementById(containerId);
    if (!t || !el) return;
    const dur = Math.min(180, Math.max(8, Math.round(t.durationSec || 45)));
    const endSec = Math.min(t.endSec || t.startSec + dur, t.startSec + 180);
    const an = t.speakerAnalytics || {};
    const videoSrc = t.brandedMp4Url || t.directMp4Url || (t.sourceMeetingMp4Url ? `${t.sourceMeetingMp4Url}#t=${t.startSec},${endSec}` : "");
    const iframeSrc = !videoSrc && t.youtubeId
      ? `https://www.youtube-nocookie.com/embed/${t.youtubeId}?start=${Math.floor(t.startSec)}&end=${Math.ceil(endSec)}&autoplay=1&cc_load_policy=1`
      : "";

    el.innerHTML = renderVideoBox({
      id: "vbox_turn_" + t.id,
      headerRight: `${t.date} · ${t.hms} (${dur}s)`,
      title: `${t.speakerName} (${t.speakingCapacity || t.speakerRole})`,
      sub: `${t.stanceLabel || "Speaking"} · ${t.bodyName} · ${t.date}`,
      ccText: t.text,
      marquee: `THE REAL WINDY CITY · ${t.speakerName.toUpperCase()} · ${(t.speakingCapacity || t.speakerRole).toUpperCase()} · ${t.bodyName.toUpperCase()} (${t.date}) · ${an.historicalClipCount || 1} CLIPS ON RECORD`,
      videoSrc,
      iframeSrc,
      startSec: t.brandedMp4Url || t.directMp4Url ? 0 : t.startSec,
      endSec: t.brandedMp4Url || t.directMp4Url ? 0 : endSec,
      startWithIntro: !t.brandedMp4Url && Boolean(videoSrc || iframeSrc),
      autoPlay: Boolean(t.brandedMp4Url),
      noVideoNote: t.videoTimingNote ? `Transcript only — no video. ${t.videoTimingNote}` : "",
      height: 205
    });
  };

  function epCardHtml(m) {
    return `
      <div class="ep-card" onclick="openEpisode('${jsq(m.slug)}')">
        <div>
          <div style="display:flex;justify-content:space-between;gap:6px;font-size:10px;font-family:var(--mono);color:var(--amber)">
            <span>${esc(m.bodyName)}</span>
            <span>${esc(m.date)}</span>
          </div>
          <div style="font-weight:900;font-size:14.5px;margin-top:7px;line-height:1.25">${esc(m.title)}</div>
          <p style="font-size:11.5px;color:#94a3b8;margin:7px 0;line-height:1.4">${esc((m.logline || "").length > 120 ? m.logline.slice(0, 120) + "…" : m.logline || "")}</p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:10px;font-family:var(--mono);color:#cbd5e1;border-top:1px solid #1e293b;padding-top:8px">
          <span>📋 ${m.itemCount} agenda items</span>
          <span>📄 ${m.docCount} documents</span>
          ${m.turnCount ? `<span style="color:var(--amber)">🎙️ ${m.turnCount} clips</span>` : ""}
          ${m.mp4Url ? `<span style="color:var(--emerald)">🎞️ Video</span>` : ""}
        </div>
      </div>`;
  }

  function renderHome() {
    const feat = DB.episodes.find((e) => e.featured) || DB.episodes[0];
    const council26 = DB.episodes.filter((e) => e.body === "council" && e.season === 2026).slice(0, 12);
    const psc26 = DB.episodes.filter((e) => e.body === "psc" && e.season === 2026).slice(0, 10);
    const topTurns = [...DB.turns].sort((a, b) => (b.brandedMp4Url ? 1 : 0) - (a.brandedMp4Url ? 1 : 0) || b.impactScore - a.impactScore).slice(0, 6);
    const topOrds = DB.ordinances.slice(0, 8);

    document.getElementById("appRoot").innerHTML = `
      <section class="hero-box">
        <div>
          <div class="kicker">● FEATURED MEETING</div>
          <h1 class="hero-h1">${esc(feat.title)}</h1>
          <div style="font-size:14px;color:#e2e8f0">${esc(feat.bodyName)} · ${esc(feat.date)}</div>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.55;max-width:660px">${esc(feat.logline)}</p>
          <div class="btn-row">
            <button type="button" class="btn btn-amber" onclick="openEpisode('${jsq(feat.slug)}')">▶ Watch this meeting</button>
            <button type="button" class="btn btn-fb" onclick="navTo('speakers')">🎙️ Speakers (${fmtN(C.turns)} clips)</button>
            <button type="button" class="btn btn-emerald" onclick="navTo('osint')">🕸️ Who's Who: people &amp; companies (${fmtN(C.osint)})</button>
            <button type="button" class="btn btn-sky" onclick="navTo('foundry')">📄 Meeting documents (${fmtN(C.docs)})</button>
            <button type="button" class="btn btn-rose" onclick="navTo('provenance')">🎥 Where the records come from</button>
            <button type="button" class="btn" onclick="playThemeSong()">🎵 Theme Song</button>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-big">${fmtN(C.episodes)}</div><div class="stat-lbl">City meetings (${fmtN(C.withVideo)} with full video)</div></div>
          <div class="stat-card"><div class="stat-big">${fmtN(C.turns)}</div><div class="stat-lbl">Speaker clips (${fmtN(C.timed)} with video)</div></div>
          <div class="stat-card"><div class="stat-big">${fmtN(C.osint)}</div><div class="stat-lbl">People, companies &amp; agencies in Who's Who</div></div>
          <div class="stat-card"><div class="stat-big">${fmtN(C.docs)}</div><div class="stat-lbl">Minutes, agendas &amp; attached documents</div></div>
          <div class="stat-card"><div class="stat-big">${fmtN(C.ordinances)}</div><div class="stat-lbl">Ordinances followed from 1st to final reading</div></div>
          <div class="stat-card"><div class="stat-big">${fmtN(C.films)}</div><div class="stat-lbl">Screen recordings showing where the records come from</div></div>
        </div>
      </section>

      <div class="section-head">
        <h2>🎙️ Speaker Video Clips (3 minutes or less)</h2>
        <span class="sub">Who spoke, what role they spoke in, whether they were for or against, and how often they speak</span>
        <button type="button" class="more" onclick="navTo('speakers')">See all speakers →</button>
      </div>
      <div class="grid-3">${topTurns.map(renderTurnCard).join("")}</div>

      <div class="section-head">
        <h2>🕸️ Who's Who in City Business</h2>
        <span class="sub">Business groups, contractors, public agencies and the people who speak at meetings</span>
        <button type="button" class="more" onclick="navTo('osint')">See all ${fmtN(C.osint)} profiles →</button>
      </div>
      <div class="h-scroll">
        ${DB.osint.slice(0, 10).map((e) => `
          <div class="ep-card" onclick="STATE.osintQ='${jsq(e.name)}';navTo('osint')">
            <div>
              <span class="tag tag-emerald">${esc(e.category)}</span>
              <div style="font-weight:900;font-size:14px;margin:8px 0 4px">${esc(e.name)}</div>
              <div style="font-size:11px;color:#94a3b8">${esc((e.role || "").slice(0, 95))}</div>
            </div>
            <div style="font-family:var(--mono);font-size:10.5px;color:var(--amber);margin-top:8px">
              🏛️ ${e.meetingCount || 0} meetings ${e.totalContractUsd ? "· 💰 " + money(e.totalContractUsd) + " in agenda items" : ""}
            </div>
          </div>`).join("")}
      </div>

      <div class="section-head">
        <h2>📜 Ordinances: 1st Reading to Final Vote</h2>
        <span class="sub">Follow each ordinance through every reading, with what speakers said and the documents</span>
        <button type="button" class="more" onclick="navTo('ordinances')">See all ${fmtN(C.ordinances)} ordinances →</button>
      </div>
      <div class="h-scroll">
        ${topOrds.map((o) => `
          <div class="ep-card" onclick="openOrdinance('${jsq(o.slug)}')">
            <span class="tag tag-violet">${esc(o.kind)} · ${o.readings.length} readings</span>
            <div style="font-weight:800;font-size:13.5px;margin:10px 0;line-height:1.35">${esc(o.title.slice(0, 120))}</div>
            <div style="font-size:11px;color:var(--amber);font-family:var(--mono)">▶ ${esc(o.firstDate)} → ${esc(o.lastDate)}</div>
          </div>`).join("")}
      </div>

      <div class="section-head">
        <h2>City Council · 2026</h2>
        <span class="sub">Most recent meetings</span>
        <button type="button" class="more" onclick="navTo('episodes')">See all ${fmtN(C.episodes)} meetings →</button>
      </div>
      <div class="h-scroll">${council26.map(epCardHtml).join("")}</div>

      <div class="section-head">
        <h2>Public Services Committee · 2026</h2>
        <span class="sub">Where ordinances and zoning are discussed between council readings</span>
      </div>
      <div class="h-scroll">${psc26.map(epCardHtml).join("")}</div>
    `;
  }

  // ------------------------------------------------------------------ MEETINGS LIST
  window.setEpisodesPage = function (p) {
    STATE.epPage = Math.max(1, p);
    updateEpisodesResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.updateEpisodesResults = function () {
    const box = document.getElementById("epResultsBox");
    if (!box) return;
    const pageSize = 36;
    const filtered = DB.episodes.filter((e) => {
      if (STATE.epFilterBody && e.body !== STATE.epFilterBody) return false;
      if (STATE.epFilterSeason && String(e.season) !== String(STATE.epFilterSeason)) return false;
      if (STATE.epFilterQ && !`${e.title} ${e.logline} ${e.date} ${e.bodyName}`.toLowerCase().includes(STATE.epFilterQ.toLowerCase())) return false;
      return true;
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (STATE.epPage > totalPages) STATE.epPage = 1;
    const slice = filtered.slice((STATE.epPage - 1) * pageSize, STATE.epPage * pageSize);
    const countEl = document.getElementById("epMatchCount");
    if (countEl) countEl.textContent = `Page ${STATE.epPage} of ${totalPages} · ${filtered.length.toLocaleString()} matching meetings`;
    box.innerHTML = `
      <div class="grid-3">${slice.map(epCardHtml).join("")}</div>
      ${renderPagination(STATE.epPage, filtered.length, pageSize, "setEpisodesPage")}
    `;
  };

  function renderEpisodesList() {
    const seasons = [...new Set(DB.episodes.map((e) => e.season))].sort((a, b) => b - a);
    const bodies = [...new Set(DB.episodes.map((e) => e.body))];
    document.getElementById("appRoot").innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div class="kicker">EVERY MEETING · 2008–2026 · ${fmtN(C.withVideo)} WITH FULL VIDEO</div>
        <h1 style="margin:6px 0 12px;font-size:26px">All ${fmtN(DB.episodes.length)} Cheyenne City Meetings</h1>
        <div class="toolbar">
          <form class="search-form" onsubmit="STATE.epFilterQ=document.getElementById('epSearchInput').value;STATE.epPage=1;updateEpisodesResults();return false;">
            <input id="epSearchInput" class="input" style="width:270px" placeholder="Search by topic, title or date…" value="${esc(STATE.epFilterQ)}" oninput="STATE.epFilterQ=this.value;STATE.epPage=1;updateEpisodesResults()" />
            <button type="submit" class="btn-enter">Enter ↵</button>
          </form>
          <select class="input" onchange="STATE.epFilterSeason=this.value;STATE.epPage=1;updateEpisodesResults()">
            <option value="">All years (${seasons[seasons.length - 1]}–${seasons[0]})</option>
            ${seasons.map((s) => `<option value="${s}" ${String(STATE.epFilterSeason) === String(s) ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          <select class="input" onchange="STATE.epFilterBody=this.value;STATE.epPage=1;updateEpisodesResults()">
            <option value="">All boards &amp; committees</option>
            ${bodies.map((b) => `<option value="${esc(b)}" ${STATE.epFilterBody === b ? "selected" : ""}>${esc(bodyLabel(b))}</option>`).join("")}
          </select>
          <button type="button" class="btn" style="padding:6px 12px" onclick="STATE.epFilterQ='';STATE.epFilterSeason='';STATE.epFilterBody='';STATE.epPage=1;renderEpisodesList()">Reset</button>
          <span id="epMatchCount" style="font-family:var(--mono);font-size:12px;color:var(--amber)"></span>
        </div>
      </div>
      <div id="epResultsBox"></div>
    `;
    updateEpisodesResults();
  }

  // ------------------------------------------------------------------ MEETING PAGE & ITS VIEWS
  function renderLensHtml(lensKey, ep, detail) {
    const items = detail.items || [];
    const docs = detail.docs || [];
    const votes = detail.votes || [];
    const briefs = detail.briefs || [];
    const turns = detail.turns || [];

    if (lensKey === "foundry") {
      const sel = docs.find((d) => d.id === STATE.selectedDocId) || docs[0];
      const selSafeUrl = sel ? safeUrl(sel.url) : "";
      return `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;padding:10px 12px;background:#091428;border:1px solid rgba(56,189,248,0.35);border-radius:10px;font-family:var(--mono);font-size:11px">
            <span><b style="color:var(--sky)">DOCUMENTS FOR THIS MEETING</b> · ${docs.length} files · ${docs.filter((d) => d.ocr).length} with searchable text</span>
            <button type="button" class="btn btn-sky" style="padding:5px 10px;font-size:11px" onclick="navTo('foundry')">All ${fmtN(C.docs)} documents ↗</button>
          </div>
          <div class="foundry-shell">
            <div style="max-height:520px;overflow-y:auto;border:1px solid #1e293b;border-radius:10px;background:#050a14">
              ${docs.map((d) => `
                <div onclick="STATE.selectedDocId=${d.id};rerenderEpisode()" style="padding:10px;border-bottom:1px solid #1e293b;cursor:pointer;background:${sel && sel.id === d.id ? "rgba(56,189,248,0.16)" : "transparent"}">
                  <div style="font-family:var(--mono);font-size:10px;color:var(--sky)">${esc(docRoleLabel(d.role).toUpperCase())} ${d.ocr ? "· 🔬 searchable text" : ""}</div>
                  <div style="font-size:12px;font-weight:700;margin-top:3px">${esc(docTitle(d.title))}</div>
                  
                </div>`).join("")}
            </div>
            <div style="border:1px solid #1e293b;border-radius:10px;background:#050a14;padding:12px">
              ${sel ? `
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
                  <div>
                    <div style="font-weight:800;font-size:13px">${esc(docTitle(sel.title))}</div>
                    <div style="font-family:var(--mono);font-size:10px;color:#94a3b8" title="A file fingerprint (SHA-1) proves the copy here is identical to the archived original">${sel.sha1 ? `File fingerprint: ${esc(sel.sha1.slice(0, 12))}…` : "Saved web-page copy"}</div>
                  </div>
                  <div style="display:flex;gap:6px">
                    ${sel.ocr && sel.sha1 ? `<button type="button" class="btn btn-emerald" style="padding:5px 10px;font-size:11px" onclick="loadLiveOcr('${jsq(sel.sha1)}')">🔬 Show the document text</button>` : ""}
                    ${selSafeUrl ? `<a class="btn btn-amber" style="padding:5px 10px;font-size:11px" href="${esc(selSafeUrl)}" target="_blank" rel="noreferrer">Open the original ↗</a>` : ""}
                  </div>
                </div>
                <div id="foundryDocPane">
                  ${selSafeUrl && selSafeUrl.toLowerCase().includes(".pdf") && !selSafeUrl.includes("web.archive.org")
                    ? `<iframe src="https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(selSafeUrl)}" style="width:100%;height:430px;border:0;border-radius:8px;background:#fff"></iframe>`
                    : `<pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;max-height:430px;overflow:auto;background:#02050b;padding:12px;border-radius:8px">${esc(sel.bodySnippet || "Use \"Open the original\" above to see the document itself.")}</pre>`}
                </div>
              ` : ""}
            </div>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${renderVideoBox({
                id: "vbox_foundry_cue",
                headerRight: "HOW WE GOT THESE",
                title: "Downloading the agenda documents",
                sub: "Screen recording",
                ccText: "Screen recording of downloading the agenda and its attached documents from the city website",
                videoSrc: "./provenance/clips/clip-03-supporting-documents.mp4",
                height: 155
              })}
              <div style="border:1px solid #1e293b;border-radius:10px;padding:10px;background:#050a14;font-family:var(--mono);font-size:10.5px">
                <div style="color:var(--emerald);font-weight:800;margin-bottom:6px">WHERE THESE FILES CAME FROM</div>
                <div>1. City website, Internet Archive &amp; saved web pages</div>
                <div>2. Stored in the public cheyenne-archives collections, each with a file fingerprint</div>
                <div>3. Minutes text cleaned up for reading</div>
                <div>4. Published on this site</div>
              </div>
            </div>
          </div>
        </div>`;
    }

    if (lensKey === "gotham") {
      const nodes = [
        ...items.filter((i) => i.kind !== "procedural").slice(0, 6).map((i, idx) => ({ lbl: `Item ${i.itemNo}: ${i.title.slice(0, 26)}…`, c: "#38bdf8", ang: idx * 0.55 })),
        ...docs.slice(0, 5).map((d, idx) => ({ lbl: `Doc: ${d.title.slice(0, 22)}…`, c: "#10b981", ang: 3.2 + idx * 0.5 })),
        ...turns.slice(0, 4).map((t, idx) => ({ lbl: `🎙️ ${t.speakerName}`, c: "#f43f5e", ang: 5.2 + idx * 0.4 }))
      ];
      return `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span style="font-family:var(--mono);font-size:11px;color:var(--emerald)"><b>WHAT'S CONNECTED TO THIS MEETING</b> · agenda items (blue), documents (green) and speakers (red)</span>
            <button type="button" class="btn btn-emerald" style="padding:4px 10px;font-size:11px" onclick="navTo('osint')">Open Who's Who →</button>
          </div>
          <svg viewBox="0 0 820 440" style="width:100%;height:430px;background:#040812;border:1px solid #1e293b;border-radius:12px">
            ${nodes.map((n, idx) => {
              const x = Math.round(410 + Math.cos(n.ang) * (idx % 2 ? 155 : 215));
              const y = Math.round(220 + Math.sin(n.ang) * 165);
              return `<line x1="410" y1="220" x2="${x}" y2="${y}" stroke="#1e293b" stroke-width="1.5" />
                      <circle cx="${x}" cy="${y}" r="11" fill="#091224" stroke="${n.c}" stroke-width="2.5" />
                      <text x="${x}" y="${y + 23}" text-anchor="middle" fill="#e2e8f0" font-size="10" font-family="monospace">${esc(n.lbl)}</text>`;
            }).join("")}
            <circle cx="410" cy="220" r="24" fill="#091224" stroke="#fbbf24" stroke-width="3.5" />
            <text x="410" y="258" text-anchor="middle" fill="#fbbf24" font-size="11" font-weight="bold" font-family="monospace">${esc(ep.date)}</text>
          </svg>
        </div>`;
    }

    if (lensKey === "speakers") {
      return turns.length
        ? `<div class="grid-2">${turns.map(renderTurnCard).join("")}</div>`
        : `<div class="panel">There are no speaker clips for this meeting yet. <a href="#speakers" onclick="navTo('speakers');return false;" style="color:var(--amber);text-decoration:underline">Browse all ${fmtN(C.turns)} speaker clips →</a></div>`;
    }

    if (lensKey === "provenance") return renderProvenanceInner();

    if (lensKey === "votes") {
      return `<div style="display:grid;gap:10px">${votes.length ? votes.map((v) => `
        <div class="panel">
          <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px">
            <span style="color:${v.result === "failed" ? "var(--rose)" : "var(--emerald)"};font-weight:800">${esc(v.result.toUpperCase())} ${v.unanimous ? "(EVERYONE VOTED YES)" : ""}</span>
            ${v.noNames && v.noNames.length ? `<span style="color:#fda4af">Voted no: ${esc(v.noNames.join(", "))}</span>` : ""}
          </div>
          <p style="font-size:12.5px;margin:6px 0 0">${esc(v.excerpt)}</p>
        </div>`).join("") : `<div class="panel">No recorded votes for this meeting (committees and work sessions usually don't take roll-call votes). See the Meeting Documents view for the agenda.</div>`}</div>`;
    }

    if (lensKey === "money") {
      const mItems = items.filter((i) => i.amountUsd).sort((a, b) => b.amountUsd - a.amountUsd);
      return `<div style="display:grid;gap:8px">${mItems.length ? mItems.map((i) => `
        <div class="panel" style="display:flex;justify-content:space-between;gap:12px;align-items:center">
          <div><div style="font-size:11px;color:var(--muted)">Item ${esc(i.itemNo)} · ${esc(i.sponsor || "")}</div><div style="font-weight:700;font-size:13px">${esc(i.title)}</div></div>
          <div style="font-family:var(--mono);font-size:18px;font-weight:900;color:var(--emerald)">${money(i.amountUsd)}</div>
        </div>`).join("") : `<div class="panel">No dollar amounts are listed in this agenda's item titles.</div>`}</div>`;
    }

    if (lensKey === "transcript") {
      const minDoc = docs.find((d) => d.role === "minutes") || docs[0];
      return `<pre style="white-space:pre-wrap;font-family:var(--mono);font-size:12px;line-height:1.55;background:#040811;padding:16px;border-radius:12px">${esc((minDoc && minDoc.bodySnippet) || ep.logline)}</pre>`;
    }

    return `
      <div style="display:grid;gap:12px">
        <div class="panel">
          <div class="kicker">${esc(((LENSES.find((l) => l.key === lensKey) || {}).name || lensKey).toUpperCase())} · ${esc(ep.date)} · ${esc(ep.bodyName)}</div>
          <h3 style="margin:6px 0">${esc(ep.title)}</h3>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.55">${esc(ep.logline)}</p>
        </div>
        <div style="display:grid;gap:8px">
          ${items.slice(0, 25).map((it) => `
            <div class="panel" style="padding:11px 14px">
              <div style="display:flex;justify-content:space-between;gap:8px;font-family:var(--mono);font-size:10.5px;color:var(--sky)">
                <span>ITEM ${esc(it.itemNo)} · ${esc((it.kind || "").toUpperCase())} ${it.reading ? "(" + esc(it.reading === "third" ? "final" : it.reading) + " reading)" : ""}</span>
                ${it.amountUsd ? `<span style="color:var(--emerald)">${money(it.amountUsd)}</span>` : ""}
              </div>
              <div style="font-size:12.5px;font-weight:700;margin-top:4px">${esc(it.title)}</div>
              ${it.action ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px">Action: ${esc(it.action)} ${it.sponsor ? "· " + esc(it.sponsor) : ""}</div>` : ""}
            </div>`).join("")}
        </div>
        ${briefs.length ? `<div class="panel"><div class="kicker">DOCUMENT SUMMARIES (${briefs.length})</div>${briefs.slice(0, 6).map((b) => `<div style="margin-top:8px;font-size:12px"><b>Item ${esc(b.itemNo)}:</b> ${esc(b.title)}</div>`).join("")}</div>` : ""}
      </div>`;
  }

  window.loadLiveOcr = async function (sha1) {
    const pane = document.getElementById("foundryDocPane");
    if (!pane) return;
    pane.innerHTML = `<div class="loading-shell">Loading the document text…</div>`;
    try {
      const r = await fetch(`https://raw.githubusercontent.com/therealwindycity/TheReelWindyCity/main/ai-record-ocr/${sha1}.json`);
      const j = await r.json();
      const pages = Object.entries(j).sort((a, b) => Number(a[0]) - Number(b[0]));
      pane.innerHTML = `<div style="max-height:430px;overflow:auto;display:grid;gap:10px">${pages.map(([pg, txt]) => `
        <div style="background:#02050b;border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:10px">
          <div style="font-family:var(--mono);font-size:10px;color:var(--emerald);font-weight:800">PAGE ${esc(pg)} · TEXT READ FROM THE SCAN</div>
          <pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;margin:6px 0 0">${esc(txt)}</pre>
        </div>`).join("")}</div>`;
    } catch (e) {
      pane.innerHTML = `<div class="panel">The document text could not be loaded right now. Try "Open the original" instead.</div>`;
    }
  };

  window.openEpisode = async function (slug) {
    STATE.view = "episode";
    STATE.epSlug = slug;
    window.location.hash = "ep:" + slug;
    updateNavButtons();
    const ep = DB.epBySlug.get(slug);
    if (!ep) return renderHome();
    document.getElementById("appRoot").innerHTML = `<div class="loading-shell">Loading ${esc(ep.title)}…</div>`;
    await ensureSeasonLoaded(ep.season);
    rerenderEpisode();
  };

  window.rerenderEpisode = function () {
    const ep = DB.epBySlug.get(STATE.epSlug);
    if (!ep) return;
    const seasonData = DB.seasonCache.get(ep.season) || {};
    const detail = seasonData[ep.slug] || { items: [], docs: [], votes: [], briefs: [], turns: [] };

    const cleanMp4 = safeUrl(ep.mp4Url);
    const cleanIframe = !cleanMp4 && ep.videoUrl && ep.videoUrl.includes("archive.org/details/")
      ? ep.videoUrl.replace("/details/", "/embed/")
      : "";
    const hasVideo = Boolean(cleanMp4 || cleanIframe);
    const VLB = {
      transcript: ["#10b981", "✓ Right video — what speakers said matches this recording"],
      title_date: ["#10b981", "✓ Right video — the Internet Archive recording is labeled with this meeting's date"],
      ia_item_itself: ["#38bdf8", "From the Internet Archive — this entry is the recording itself"]
    };
    const vlb = hasVideo ? (VLB[ep.videoLinkBasis] || ["#f59e0b", "⚠ We could not double-check this video — its title has no date to compare with the meeting"]) : null;
    const partLinks = (ep.extraLinks || []).filter((l) => l && l.kind === "archive_video_part" && safeUrl(l.url));
    const videoNote = (vlb ? `<div class="video-basis" style="margin-top:6px;font-size:11px;color:${vlb[0]}">${esc(vlb[1])}</div>` : "")
      + (partLinks.length ? `<div style="margin-top:4px;font-size:11px">Other parts of this meeting: ${partLinks.map((l) => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label.replace(/^Archive\.org Ch192 — /, ""))} ↗</a>`).join(" · ")}</div>` : "");
    const videoEmbed = hasVideo
      ? renderVideoBox({
          id: "vbox_ep_" + ep.slug,
          headerRight: ep.date,
          title: ep.title,
          sub: `${ep.bodyName} · ${ep.date}`,
          ccText: ep.logline || ep.title,
          marquee: `THE REAL WINDY CITY · ${ep.bodyName.toUpperCase()} · ${ep.date} · ${ep.itemCount} AGENDA ITEMS · ${ep.docCount} DOCUMENTS · ${ep.turnCount} SPEAKER CLIPS · VIDEO FROM THE INTERNET ARCHIVE`,
          videoSrc: cleanMp4,
          iframeSrc: cleanIframe,
          height: 290
        })
      : "";

    document.getElementById("appRoot").innerHTML = `
      <div style="margin-bottom:12px"><button type="button" class="btn" onclick="navTo('episodes')">← All ${fmtN(DB.episodes.length)} meetings</button></div>
      <div class="panel" style="margin-bottom:16px">
        <div style="display:grid;gap:18px;grid-template-columns:${videoEmbed ? "minmax(0,1.15fr) minmax(0,1fr)" : "minmax(0,1fr)"}">
          <div>
            <div class="kicker">${esc(ep.bodyName)} · ${esc(ep.date)}</div>
            <h1 style="margin:8px 0;font-size:28px;line-height:1.1">${esc(ep.title)}</h1>
            <p style="font-size:13px;color:#cbd5e1;line-height:1.55">${esc(ep.logline)}</p>
            <div class="btn-row">
              <button type="button" class="btn" onclick="playThemeSong()">🎵 Theme song</button>
              ${ep.agendaUrl ? `<a class="btn btn-sky" href="${esc(safeUrl(ep.agendaUrl))}" target="_blank" rel="noreferrer">📄 Agenda ↗</a>` : ""}
              ${ep.minutesUrl ? `<a class="btn" href="${esc(safeUrl(ep.minutesUrl))}" target="_blank" rel="noreferrer">📜 Minutes ↗</a>` : ""}
              ${cleanMp4 ? `<a class="btn btn-amber" href="${esc(cleanMp4)}" target="_blank" rel="noreferrer">🎞️ Full video (Internet Archive) ↗</a>` : ""}
            </div>
          </div>
          ${videoEmbed ? `<div>${videoEmbed}${videoNote}</div>` : ""}
        </div>
      </div>

      <div class="toolbar" style="justify-content:space-between">
        <div style="font-weight:900;font-size:18px">${LENSES.length} ways to look at this meeting</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="chip ${STATE.epMode === "swipe" ? "active" : ""}" onclick="STATE.epMode='swipe';rerenderEpisode()">↔ One at a time</button>
          <button type="button" class="chip ${STATE.epMode === "split" ? "active" : ""}" onclick="STATE.epMode='split';rerenderEpisode()">◫ Two side by side</button>
          <button type="button" class="chip ${STATE.epMode === "mosaic" ? "active" : ""}" onclick="STATE.epMode='mosaic';rerenderEpisode()">▦ Show all ${LENSES.length}</button>
          <button type="button" class="chip" onclick="spawnFloat('${jsq(STATE.epLens)}')">⧉ Pop out</button>
        </div>
      </div>

      ${STATE.epMode === "swipe" ? `
        <div class="h-scroll" style="margin-bottom:12px">
          ${LENSES.map((l) => `
            <button type="button" class="chip ${STATE.epLens === l.key ? "active" : ""}" title="${esc(l.blurb)}" onclick="STATE.epLens='${l.key}';rerenderEpisode()">
              ${l.icon} ${esc(l.name)}
            </button>`).join("")}
        </div>
        <div class="lens-stage">${renderLensHtml(STATE.epLens, ep, detail)}</div>
      ` : STATE.epMode === "split" ? `
        <div class="split-stage">
          <div class="lens-stage">
            <div style="margin-bottom:10px">
              <select class="input" onchange="STATE.splitLeft=this.value;rerenderEpisode()">
                ${LENSES.map((l) => `<option value="${l.key}" ${STATE.splitLeft === l.key ? "selected" : ""}>${l.icon} ${esc(l.name)}</option>`).join("")}
              </select>
            </div>
            ${renderLensHtml(STATE.splitLeft, ep, detail)}
          </div>
          <div class="lens-stage">
            <div style="margin-bottom:10px">
              <select class="input" onchange="STATE.splitRight=this.value;rerenderEpisode()">
                ${LENSES.map((l) => `<option value="${l.key}" ${STATE.splitRight === l.key ? "selected" : ""}>${l.icon} ${esc(l.name)}</option>`).join("")}
              </select>
            </div>
            ${renderLensHtml(STATE.splitRight, ep, detail)}
          </div>
        </div>
      ` : `
        <div class="grid-3">
          ${LENSES.map((l) => `
            <div class="panel" style="border-top:3px solid ${l.accent}">
              <div style="font-weight:900;font-size:15px">${l.icon} ${esc(l.name)}</div>
              <p style="font-size:12px;color:#cbd5e1;margin:8px 0 14px">${esc(l.blurb)}</p>
              <div style="display:flex;gap:6px">
                <button type="button" class="btn btn-amber" style="padding:6px 12px" onclick="STATE.epMode='swipe';STATE.epLens='${l.key}';rerenderEpisode()">Open</button>
                <button type="button" class="btn" style="padding:6px 12px" onclick="spawnFloat('${l.key}')">⧉ Pop out</button>
              </div>
            </div>`).join("")}
        </div>
      `}
    `;
  };

  window.spawnFloat = function (lensKey) {
    const ep = DB.epBySlug.get(STATE.epSlug);
    if (!ep) return;
    const detail = (DB.seasonCache.get(ep.season) || {})[ep.slug] || {};
    const l = LENSES.find((x) => x.key === lensKey) || LENSES[0];
    const win = document.createElement("div");
    win.className = "float-win";
    win.style.left = 60 + (STATE.floats.length * 32) + "px";
    win.style.top = 90 + (STATE.floats.length * 28) + "px";
    win.innerHTML = `
      <div class="float-bar" style="background:${l.accent}33;border-bottom:2px solid ${l.accent}">
        <span>${l.icon} ${esc(l.name)} · ${esc(ep.date)}</span>
        <button type="button" class="btn" style="margin-left:auto;padding:2px 8px" onclick="this.closest('.float-win').remove()">✕</button>
      </div>
      <div class="float-body">${renderLensHtml(lensKey, ep, detail)}</div>
    `;
    const bar = win.querySelector(".float-bar");
    let dx = 0, dy = 0, dragging = false;
    bar.addEventListener("pointerdown", (e) => {
      dragging = true;
      dx = e.clientX - win.offsetLeft;
      dy = e.clientY - win.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      win.style.left = Math.max(0, e.clientX - dx) + "px";
      win.style.top = Math.max(48, e.clientY - dy) + "px";
    });
    bar.addEventListener("pointerup", () => { dragging = false; });
    document.getElementById("floatLayer").appendChild(win);
    STATE.floats.push(win);
  };

  // ------------------------------------------------------------------ SPEAKERS
  window.openSpeaker = function (slug) {
    STATE.view = "speakers";
    STATE.spkAxis = "speaker";
    STATE.spkSlug = slug;
    STATE.spkPage = 1;
    window.location.hash = "speakers:" + slug;
    updateNavButtons();
    renderSpeakersVault();
  };

  window.setSpeakersPage = function (p) {
    STATE.spkPage = Math.max(1, p);
    updateSpeakersResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.updateSpeakerRosterBox = function () {
    const el = document.getElementById("spkRosterList");
    if (!el) return;
    const list = DB.speakers.filter((s) => !STATE.spkRosterQ || `${s.name} ${s.role}`.toLowerCase().includes(STATE.spkRosterQ.toLowerCase()));
    el.innerHTML = list.map((s) => `
      <button type="button" class="chip ${STATE.spkSlug === s.slug ? "active" : ""}" style="margin:3px" onclick="STATE.spkSlug=(STATE.spkSlug==='${jsq(s.slug)}'?'':'${jsq(s.slug)}');STATE.spkPage=1;renderSpeakersVault()">
        ${esc(s.name)} (${s.turnCount} clips)
      </button>`).join("");
  };

  window.updateSpeakersResults = function () {
    const box = document.getElementById("spkResultsBox");
    if (!box) return;
    const pageSize = 30;
    let filtered = DB.turns.filter((t) => {
      if (STATE.spkSlug && t.speakerSlug !== STATE.spkSlug) return false;
      if (STATE.spkDate && t.date !== STATE.spkDate) return false;
      if (STATE.spkTheme && !(t.themes || []).includes(STATE.spkTheme)) return false;
      if (STATE.spkEmotion && t.emotion !== STATE.spkEmotion) return false;
      if (STATE.spkCapacity && t.speakingCapacity !== STATE.spkCapacity) return false;
      if (STATE.spkStance && t.stance !== STATE.spkStance) return false;
      if (STATE.spkPoe && !t.pointOfOrder) return false;
      if (STATE.spkOrd && !(t.ordinances || []).some((o) => o.slug === STATE.spkOrd)) return false;
      if (STATE.spkQ && !`${t.speakerName} ${t.text} ${t.date} ${t.speakingCapacity || ""}`.toLowerCase().includes(STATE.spkQ.toLowerCase())) return false;
      return true;
    });

    if (STATE.spkSort === "newest") filtered.sort((a, b) => b.date.localeCompare(a.date) || a.startSec - b.startSec);
    else if (STATE.spkSort === "oldest") filtered.sort((a, b) => a.date.localeCompare(b.date) || a.startSec - b.startSec);
    else filtered.sort((a, b) => b.impactScore - a.impactScore);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (STATE.spkPage > totalPages) STATE.spkPage = 1;
    const slice = filtered.slice((STATE.spkPage - 1) * pageSize, STATE.spkPage * pageSize);

    const countEl = document.getElementById("spkMatchLabel");
    if (countEl) countEl.textContent = `Page ${STATE.spkPage} of ${totalPages} · Showing ${slice.length} of ${filtered.length.toLocaleString()} matching clips`;

    box.innerHTML = `
      <div class="grid-3">${slice.map(renderTurnCard).join("")}</div>
      ${renderPagination(STATE.spkPage, filtered.length, pageSize, "setSpeakersPage")}
    `;
  };

  window.renderSpeakersVault = function () {
    const activeSpk = STATE.spkSlug ? DB.speakerBySlug.get(STATE.spkSlug) : null;
    const an = activeSpk && activeSpk.analytics ? activeSpk.analytics : null;
    const datesMap = new Map();
    for (const t of DB.turns) {
      if (!datesMap.has(t.date)) datesMap.set(t.date, { date: t.date, bodyName: t.bodyName, count: 0 });
      datesMap.get(t.date).count++;
    }
    const datesList = [...datesMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 75);

    document.getElementById("appRoot").innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px">
          <div>
            <div class="kicker">🎙️ EVERYONE WHO SPOKE AT A CITY MEETING</div>
            <h1 style="margin:6px 0 6px;font-size:26px">${fmtN(C.speakers)} Speakers · ${fmtN(C.turns)} Clips (${fmtN(C.timed)} with video)</h1>
          </div>
          <form class="search-form" onsubmit="STATE.spkQ=document.getElementById('spkSearchInput').value;STATE.spkPage=1;updateSpeakersResults();return false;">
            <input id="spkSearchInput" class="input" style="width:260px" placeholder="Search what was said, a name or a date…" value="${esc(STATE.spkQ)}" oninput="STATE.spkQ=this.value;STATE.spkPage=1;updateSpeakersResults()" />
            <button type="submit" class="btn-enter">Enter ↵</button>
          </form>
        </div>

        <div class="toolbar" style="margin-top:10px">
          ${[
            ["speaker", "👤 By speaker"],
            ["date", "📅 By meeting date"],
            ["ordinance", "📜 By ordinance"],
            ["theme", "🏷️ By topic"],
            ["emotion", "🔥 By tone"]
          ].map(([k, lbl]) => `<button type="button" class="chip ${STATE.spkAxis === k ? "active" : ""}" onclick="STATE.spkAxis='${k}';renderSpeakersVault()">${lbl}</button>`).join("")}
          <button type="button" class="chip" style="color:var(--emerald);border-color:rgba(16,185,129,0.4)" onclick="navTo('osint')">🕸️ Who's Who →</button>
          <button type="button" class="btn btn-rose" style="margin-left:auto;padding:5px 11px" onclick="STATE.spkSlug='';STATE.spkDate='';STATE.spkOrd='';STATE.spkTheme='';STATE.spkEmotion='';STATE.spkCapacity='';STATE.spkStance='';STATE.spkPoe=false;STATE.spkQ='';STATE.spkRosterQ='';STATE.spkPage=1;renderSpeakersVault()">✕ Clear filters</button>
        </div>

        <div class="toolbar">
          <select class="input" onchange="STATE.spkCapacity=this.value;STATE.spkPage=1;updateSpeakersResults()">
            <option value="">Speaking as: anyone</option>
            ${CAPACITIES.map((c) => `<option value="${esc(c)}" ${STATE.spkCapacity === c ? "selected" : ""}>Speaking as: ${esc(c)}</option>`).join("")}
          </select>
          <select class="input" onchange="STATE.spkStance=this.value;STATE.spkPage=1;updateSpeakersResults()">
            <option value="">Position: any</option>
            ${STANCES.map(([k, lbl]) => `<option value="${esc(k)}" ${STATE.spkStance === k ? "selected" : ""}>Position: ${esc(lbl)}</option>`).join("")}
          </select>
          <label class="chip ${STATE.spkPoe ? "active" : ""}" style="display:inline-flex;align-items:center;gap:6px">
            <input type="checkbox" ${STATE.spkPoe ? "checked" : ""} onchange="STATE.spkPoe=this.checked;STATE.spkPage=1;updateSpeakersResults();this.parentElement.classList.toggle('active',this.checked)" />
            ⚖️ Only points of order
          </label>
        </div>

        <div style="background:#040811;border:1px solid #1e293b;border-radius:10px;padding:12px;max-height:195px;overflow-y:auto">
          ${STATE.spkAxis === "speaker" ? `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
              <span style="font-size:11.5px;font-weight:700;color:var(--sky)">Pick a speaker (${DB.speakers.length}):</span>
              <form class="search-form" onsubmit="const m=DB.speakers.find(s=>s.name.toLowerCase().includes(STATE.spkRosterQ.toLowerCase()));if(m){openSpeaker(m.slug);}return false;">
                <input class="input" style="padding:5px 9px;width:210px" placeholder="Type a name (e.g. Mark Moody)…" value="${esc(STATE.spkRosterQ)}" oninput="STATE.spkRosterQ=this.value;updateSpeakerRosterBox()" />
                <button type="submit" class="btn-enter" style="padding:5px 10px">Enter ↵</button>
              </form>
            </div>
            <div id="spkRosterList"></div>
          ` : STATE.spkAxis === "date" ? datesList.map((d) => `
            <button type="button" class="chip ${STATE.spkDate === d.date ? "active" : ""}" style="margin:3px;font-family:var(--mono)" onclick="STATE.spkDate=(STATE.spkDate==='${d.date}'?'':'${d.date}');STATE.spkSort='oldest';STATE.spkPage=1;renderSpeakersVault()">
              ${d.date} · ${esc(d.bodyName)} (${d.count})
            </button>`).join("")
          : STATE.spkAxis === "ordinance" ? DB.ordinances.slice(0, 75).map((o) => `
            <button type="button" class="chip ${STATE.spkOrd === o.slug ? "active" : ""}" style="margin:3px" onclick="STATE.spkOrd=(STATE.spkOrd==='${jsq(o.slug)}'?'':'${jsq(o.slug)}');STATE.spkSort='oldest';STATE.spkPage=1;renderSpeakersVault()">
              📜 ${esc(o.title.slice(0, 52))}…
            </button>`).join("")
          : STATE.spkAxis === "theme" ? Object.entries(THEMES).map(([k, lbl]) => `
            <button type="button" class="chip ${STATE.spkTheme === k ? "active" : ""}" style="margin:4px" onclick="STATE.spkTheme=(STATE.spkTheme==='${k}'?'':'${k}');STATE.spkPage=1;renderSpeakersVault()">
              ${esc(lbl)}
            </button>`).join("")
          : Object.entries(EMOTIONS).map(([k, m]) => `
            <button type="button" class="chip ${STATE.spkEmotion === k ? "active" : ""}" style="margin:4px" onclick="STATE.spkEmotion=(STATE.spkEmotion==='${k}'?'':'${k}');STATE.spkPage=1;renderSpeakersVault()">
              ${m.icon} ${esc(m.label)}
            </button>`).join("")}
        </div>
      </div>

      ${activeSpk ? `
        <div class="panel" style="margin-bottom:16px;border:2px solid var(--amber)">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:start">
            <div style="max-width:780px">
              <div class="kicker">SPEAKER PROFILE · ${esc(activeSpk.role)}</div>
              <h2 style="margin:4px 0">${esc(activeSpk.name)}</h2>
              ${an && an.osint && an.osint.headline ? `<div style="font-size:12px;color:var(--sky);font-weight:700">${esc(an.osint.headline)}</div>` : ""}
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;font-family:var(--mono);font-size:11px">
                <span class="tag tag-amber">📼 ${activeSpk.turnCount} clips from ${activeSpk.meetingCount} meetings</span>
                <span class="tag tag-sky">⏱️ Usually speaks for ${esc(an ? an.avgSpeakingFormatted : "n/a")}</span>
                <span class="tag tag-violet">⏳ Total time speaking: ${esc(an ? an.totalSpeakingFormatted : "")}</span>
                <span class="tag tag-rose">⚖️ Points of order: ${an ? an.pointOfOrderCount : 0}</span>
              </div>
              ${an && an.osint && an.osint.profiles && an.osint.profiles.length ? `
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;font-size:11px;align-items:center">
                  <b style="color:var(--emerald)">Find them online:</b>
                  ${an.osint.profiles.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noreferrer" class="tag tag-emerald">🔗 ${esc(p.platform)}: ${esc(p.label)} ↗</a>`).join("")}
                  <button type="button" class="chip" style="padding:3px 9px;font-size:10.5px" onclick="STATE.osintQ='${jsq(activeSpk.name)}';navTo('osint')">🕸️ Who's Who →</button>
                </div>` : ""}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn btn-amber" onclick="downloadSpeakerZip('${jsq(activeSpk.slug)}')">📦 Download all clips + profile (ZIP)</button>
            </div>
          </div>

          ${an ? `
            <div class="grid-3" style="margin-top:14px;padding-top:12px;border-top:1px solid #1e293b">
              <div style="background:#040811;padding:11px;border-radius:10px;border:1px solid #1e293b;font-size:11.5px">
                <div class="kicker" style="color:var(--violet);margin-bottom:6px">🏛️ Spoke as</div>
                ${(an.capacitiesBreakdown || []).map((cb) => `
                  <div style="margin-bottom:6px">
                    <div style="display:flex;justify-content:space-between;font-weight:700"><span>${esc(cb.capacity)}</span><span style="color:var(--amber);font-family:var(--mono)">${cb.count} (${cb.pct}%)</span></div>
                    ${cb.orgs && cb.orgs.length ? `<div style="font-size:10px;color:#94a3b8">${esc(cb.orgs.join(" · "))}</div>` : ""}
                  </div>`).join("")}
              </div>
              <div style="background:#040811;padding:11px;border-radius:10px;border:1px solid #1e293b;font-size:11.5px">
                <div class="kicker" style="color:var(--sky);margin-bottom:6px">📊 Topics (times for / against)</div>
                ${(an.topicAnalytics || []).map((ta) => `
                  <div style="display:flex;justify-content:space-between;padding:2px 0">
                    <span>${esc(ta.label)}</span>
                    <span style="font-family:var(--mono);font-size:10.5px"><b style="color:var(--amber)">${ta.count}</b> (<span style="color:var(--emerald)">+${ta.supportCount}</span>/<span style="color:var(--rose)">-${ta.opposeCount}</span>)</span>
                  </div>`).join("")}
              </div>
              <div style="background:#040811;padding:11px;border-radius:10px;border:1px solid #1e293b;font-size:11.5px">
                <div class="kicker" style="color:var(--emerald);margin-bottom:6px">✅ For &amp; 🛑 Against</div>
                ${an.lobbiesFor && an.lobbiesFor.length ? `<div style="margin-bottom:6px"><b style="color:var(--emerald)">Spoke for or moved:</b><ul style="margin:3px 0 0;padding-left:16px">${an.lobbiesFor.slice(0, 3).map((x) => `<li>${esc(x.slice(0, 80))}</li>`).join("")}</ul></div>` : ""}
                ${an.opposes && an.opposes.length ? `<div><b style="color:var(--rose)">Spoke against or voted no:</b><ul style="margin:3px 0 0;padding-left:16px">${an.opposes.slice(0, 3).map((x) => `<li>${esc(x.slice(0, 80))}</li>`).join("")}</ul></div>` : ""}
              </div>
            </div>` : ""}
        </div>` : ""}

      <div class="toolbar" style="justify-content:space-between">
        <span id="spkMatchLabel" style="font-weight:800;font-size:13px"></span>
        <select class="input" onchange="STATE.spkSort=this.value;STATE.spkPage=1;updateSpeakersResults()">
          <option value="impact" ${STATE.spkSort === "impact" ? "selected" : ""}>Sort: Most notable first</option>
          <option value="newest" ${STATE.spkSort === "newest" ? "selected" : ""}>Sort: Newest first</option>
          <option value="oldest" ${STATE.spkSort === "oldest" ? "selected" : ""}>Sort: Oldest first</option>
        </select>
      </div>
      <div id="spkResultsBox"></div>
    `;
    if (STATE.spkAxis === "speaker") updateSpeakerRosterBox();
    updateSpeakersResults();
  };

  // ------------------------------------------------------------------ WHO'S WHO (people, companies, agencies)
  window.setOsintPage = function (p) {
    STATE.osintPage = Math.max(1, p);
    updateOsintResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.updateOsintResults = function () {
    const box = document.getElementById("osintResultsBox");
    if (!box) return;
    const pageSize = 18;
    const filtered = DB.osint.filter((e) => {
      if (STATE.osintCategory && e.category !== STATE.osintCategory) return false;
      if (STATE.osintQ && !`${e.name} ${e.role} ${e.summary} ${e.category}`.toLowerCase().includes(STATE.osintQ.toLowerCase())) return false;
      return true;
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (STATE.osintPage > totalPages) STATE.osintPage = 1;
    const slice = filtered.slice((STATE.osintPage - 1) * pageSize, STATE.osintPage * pageSize);

    const lbl = document.getElementById("osintMatchLabel");
    if (lbl) lbl.textContent = `Page ${STATE.osintPage} of ${totalPages} · ${filtered.length} matching profiles`;

    box.innerHTML = `
      <div class="grid-2">
        ${slice.map((e) => `
          <div class="panel" style="display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;flex-wrap:wrap">
                <div>
                  <span class="tag tag-emerald">${esc(e.category)}</span>
                  <h3 style="margin:6px 0 2px;font-size:17px">${esc(e.name)}</h3>
                  <div style="font-size:11.5px;color:var(--sky);font-weight:700">${esc(e.role)}</div>
                </div>
                <div style="text-align:right;font-family:var(--mono);font-size:11px">
                  <div style="color:var(--amber);font-weight:800">🏛️ ${e.meetingCount || 0} meetings</div>
                  ${e.totalContractUsd ? `<div style="color:var(--emerald);font-weight:900" title="Total of the dollar amounts in city agenda items that name them">💰 ${money(e.totalContractUsd)} in agenda items</div>` : ""}
                </div>
              </div>
              <p style="font-size:12px;color:#cbd5e1;line-height:1.5;margin:10px 0">${esc(e.summary)}</p>
              ${e.verifiedProfiles && e.verifiedProfiles.length ? `
                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
                  ${e.verifiedProfiles.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noreferrer" class="tag tag-sky">🔗 ${esc(p.platform)}: ${esc(p.label)} ↗</a>`).join("")}
                </div>` : ""}
              ${e.keyPrincipals && e.keyPrincipals.length ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px"><b style="color:#fff">Key people:</b> ${esc(e.keyPrincipals.join(" · "))}</div>` : ""}
              ${e.sampleContractsAndItems && e.sampleContractsAndItems.length ? `
                <div style="background:#040811;border:1px solid #1e293b;border-radius:8px;padding:8px;font-size:11px;margin-bottom:8px">
                  <div style="font-family:var(--mono);font-size:10px;color:var(--amber);font-weight:800;margin-bottom:4px">CITY AGENDA ITEMS THAT NAME THEM (CONTRACTS, BIDS &amp; MORE)</div>
                  ${e.sampleContractsAndItems.slice(0, 3).map((it) => `
                    <div style="margin-bottom:3px">
                      <a href="#ep:${esc(it.meeting)}" onclick="openEpisode('${jsq(it.meeting)}');return false;" style="color:var(--sky);font-family:var(--mono)">${esc(it.date)} [${esc(it.itemNo)}]</a>:
                      ${esc((it.title || "").slice(0, 88))} ${it.amountUsd ? `<b style="color:var(--emerald)">(${money(it.amountUsd)})</b>` : ""}
                    </div>`).join("")}
                </div>` : ""}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;border-top:1px solid #1e293b;padding-top:9px;font-size:11px">
              ${(e.linkedSpeakers || []).slice(0, 3).map((sp) => `
                <button type="button" class="btn btn-amber" style="padding:4px 9px;font-size:10.5px" onclick="openSpeaker('${jsq(sp.slug)}')">🎙️ ${esc(sp.name)} (${sp.clips})</button>`).join("")}
              ${(e.linkedOrdinances || []).slice(0, 2).map((o) => `
                <button type="button" class="btn" style="padding:4px 9px;font-size:10.5px" onclick="openOrdinance('${jsq(o.slug)}')">📜 ${esc((o.title || o.slug).slice(0, 34))}…</button>`).join("")}
            </div>
          </div>`).join("")}
      </div>
      ${renderPagination(STATE.osintPage, filtered.length, pageSize, "setOsintPage")}
    `;
  };

  function renderOsintView() {
    const cats = [...new Set(DB.osint.map((e) => e.category))];
    document.getElementById("appRoot").innerHTML = `
      <div class="panel" style="margin-bottom:16px;border-color:rgba(16,185,129,0.4)">
        <div class="kicker" style="color:var(--emerald)">🕸️ WHO'S WHO IN CHEYENNE CITY BUSINESS</div>
        <h1 style="margin:6px 0 8px;font-size:26px">${DB.osint.length} People, Companies &amp; Agencies</h1>
        <p style="font-size:12.5px;color:#cbd5e1;margin:0 0 12px">Elected officials, city staff, contractors, business groups such as the Chamber of Commerce and Cheyenne LEADS, public agencies, and residents who speak at meetings. Each profile links to their public pages online, the agenda items that name them, the ordinances they spoke on and their video clips.</p>
        <div class="toolbar">
          <form class="search-form" onsubmit="STATE.osintQ=document.getElementById('osintSearchInput').value;STATE.osintPage=1;updateOsintResults();return false;">
            <input id="osintSearchInput" class="input" style="width:290px" placeholder="Search a name: Mark Moody, LEADS, Simon, Chamber…" value="${esc(STATE.osintQ)}" oninput="STATE.osintQ=this.value;STATE.osintPage=1;updateOsintResults()" />
            <button type="submit" class="btn-enter">Enter ↵</button>
          </form>
          <select class="input" onchange="STATE.osintCategory=this.value;STATE.osintPage=1;updateOsintResults()">
            <option value="">All groups (${DB.osint.length})</option>
            ${cats.map((c) => `<option value="${esc(c)}" ${STATE.osintCategory === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
          </select>
          <button type="button" class="btn" style="padding:6px 12px" onclick="STATE.osintQ='';STATE.osintCategory='';STATE.osintPage=1;renderOsintView()">Reset</button>
          <span id="osintMatchLabel" style="font-family:var(--mono);font-size:12px;color:var(--emerald)"></span>
        </div>
      </div>
      <div id="osintResultsBox"></div>
    `;
    updateOsintResults();
  }

  // ------------------------------------------------------------------ ORDINANCES
  window.openOrdinance = async function (slug) {
    STATE.view = "ordinance_detail";
    STATE.ordSlug = slug;
    STATE.ordStageIdx = 0;
    window.location.hash = "ord:" + slug;
    updateNavButtons();
    const ord = DB.ordBySlug.get(slug);
    if (!ord) return renderOrdinancesList();
    for (const r of ord.readings) {
      const ep = r.meeting ? DB.epBySlug.get(r.meeting) : null;
      if (ep) await ensureSeasonLoaded(ep.season);
    }
    renderOrdinanceDetail();
  };

  window.renderOrdinanceDetail = function () {
    const ord = DB.ordBySlug.get(STATE.ordSlug);
    if (!ord) return;
    const r = ord.readings[STATE.ordStageIdx] || ord.readings[0];
    const ep = r && r.meeting ? DB.epBySlug.get(r.meeting) : null;
    const detail = ep ? (DB.seasonCache.get(ep.season) || {})[ep.slug] || {} : {};
    const stageTurns = DB.turns.filter((t) => (r && r.meeting && t.meetingSlug === r.meeting) || (t.ordinances || []).some((o) => o.slug === ord.slug));
    const cleanMp4 = ep ? safeUrl(ep.mp4Url) : "";

    document.getElementById("appRoot").innerHTML = `
      <div style="margin-bottom:12px"><button type="button" class="btn" onclick="navTo('ordinances')">← All ${fmtN(C.ordinances)} ordinances</button></div>
      <div class="panel" style="margin-bottom:16px">
        <div class="kicker">📜 ORDINANCE, READING BY READING · ${esc(ord.kind)} (${esc(ord.firstDate)} to ${esc(ord.lastDate)})</div>
        <h1 style="margin:8px 0 14px;font-size:24px">${esc(ord.title)}</h1>
        <div class="grid-3">
          ${ord.readings.map((st, idx) => `
            <div onclick="STATE.ordStageIdx=${idx};renderOrdinanceDetail()" class="panel" style="cursor:pointer;border-color:${idx === STATE.ordStageIdx ? "var(--amber)" : "#1e293b"};background:${idx === STATE.ordStageIdx ? "rgba(251,191,36,0.12)" : "#050a14"}">
              <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px">
                <span class="tag tag-amber">STEP ${idx + 1} · ${esc(st.stage)}</span>
                <span>${esc(st.date)}</span>
              </div>
              <div style="font-weight:800;margin-top:8px">${esc(st.body)}</div>
              ${st.context ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">${esc(st.context.slice(0, 100))}</div>` : ""}
            </div>`).join("")}
        </div>
      </div>

      ${ep ? `
        <div class="panel" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <h2 style="margin:0">Step ${STATE.ordStageIdx + 1}: ${esc(ep.date)} · ${esc(ep.bodyName)}</h2>
            <button type="button" class="btn btn-sky" onclick="openEpisode('${jsq(ep.slug)}')">Open the full meeting →</button>
          </div>
          ${cleanMp4 ? renderVideoBox({
            id: "vbox_ord_" + ep.slug,
            headerRight: `STEP ${STATE.ordStageIdx + 1} · ${ep.date}`,
            title: ord.title,
            sub: `${ep.bodyName} · ${r.stage || "Reading"}`,
            ccText: r.context || ord.title,
            videoSrc: cleanMp4,
            height: 290
          }) : ""}
          <div style="margin-top:12px">
            <div class="kicker" style="margin-bottom:8px">DOCUMENTS FOR THIS MEETING (${(detail.docs || []).length})</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${(detail.docs || []).slice(0, 12).map((d) => d.url ? `<a class="btn" style="font-size:11px;padding:5px 10px" href="${esc(safeUrl(d.url))}" target="_blank" rel="noreferrer">📄 ${esc(docTitle(d.title).slice(0, 48))} ↗</a>` : "").join("")}
            </div>
          </div>
        </div>` : ""}

      <h3 style="margin:18px 0 10px">🎙️ What speakers said about it (${stageTurns.length} clips)</h3>
      <div class="grid-3">${stageTurns.slice(0, 24).map(renderTurnCard).join("")}</div>
    `;
  };

  window.setOrdinancesPage = function (p) {
    STATE.ordPage = Math.max(1, p);
    updateOrdinancesResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.updateOrdinancesResults = function () {
    const box = document.getElementById("ordResultsBox");
    if (!box) return;
    const pageSize = 30;
    const filtered = DB.ordinances.filter((o) => {
      if (STATE.ordKind && o.kind !== STATE.ordKind) return false;
      if (STATE.ordQ && !o.title.toLowerCase().includes(STATE.ordQ.toLowerCase())) return false;
      return true;
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (STATE.ordPage > totalPages) STATE.ordPage = 1;
    const slice = filtered.slice((STATE.ordPage - 1) * pageSize, STATE.ordPage * pageSize);
    const lbl = document.getElementById("ordMatchLabel");
    if (lbl) lbl.textContent = `Page ${STATE.ordPage} of ${totalPages} · ${filtered.length} matching ordinances`;
    box.innerHTML = `
      <div class="grid-3">
        ${slice.map((o) => `
          <div class="ep-card" onclick="openOrdinance('${jsq(o.slug)}')">
            <div>
              <span class="tag tag-violet">${esc(o.kind)} · ${o.readings.length} readings</span>
              <div style="font-weight:800;font-size:14px;margin:10px 0;line-height:1.35">${esc(o.title)}</div>
            </div>
            <div style="font-family:var(--mono);font-size:11px;color:var(--amber)">▶ 1st reading ${esc(o.firstDate)} → last ${esc(o.lastDate)}</div>
          </div>`).join("")}
      </div>
      ${renderPagination(STATE.ordPage, filtered.length, pageSize, "setOrdinancesPage")}
    `;
  };

  function renderOrdinancesList() {
    const kinds = [...new Set(DB.ordinances.map((o) => o.kind))];
    document.getElementById("appRoot").innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div class="kicker">📜 ORDINANCES (CITY LAWS) FROM 1ST READING TO FINAL VOTE</div>
        <h1 style="margin:6px 0 12px;font-size:26px">${DB.ordinances.length} Cheyenne Ordinances, Start to Finish</h1>
        <div class="toolbar">
          <form class="search-form" onsubmit="STATE.ordQ=document.getElementById('ordSearchInput').value;STATE.ordPage=1;updateOrdinancesResults();return false;">
            <input id="ordSearchInput" class="input" style="width:310px" placeholder="Search ordinances (annexation, zoning, budget, data center…)" value="${esc(STATE.ordQ)}" oninput="STATE.ordQ=this.value;STATE.ordPage=1;updateOrdinancesResults()" />
            <button type="submit" class="btn-enter">Enter ↵</button>
          </form>
          <select class="input" onchange="STATE.ordKind=this.value;STATE.ordPage=1;updateOrdinancesResults()">
            <option value="">All types</option>
            ${kinds.map((k) => `<option value="${esc(k)}" ${STATE.ordKind === k ? "selected" : ""}>${esc(k)}</option>`).join("")}
          </select>
          <span id="ordMatchLabel" style="font-family:var(--mono);font-size:12px;color:var(--amber)"></span>
        </div>
      </div>
      <div id="ordResultsBox"></div>`;
    updateOrdinancesResults();
  }

  // ------------------------------------------------------------------ ALL MEETING DOCUMENTS
  window.setDocsPage = function (p) {
    STATE.docPage = Math.max(1, p);
    updateFoundryResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.updateFoundryResults = function () {
    const box = document.getElementById("docResultsBox");
    if (!box || !DB.docs) return;
    const pageSize = 50;
    const filtered = DB.docs.filter((d) => {
      if (STATE.docRole && d.role !== STATE.docRole) return false;
      if (STATE.docOcr && !d.ocr) return false;
      if (STATE.docQ && !`${d.title} ${d.date} ${d.sha1 || ""} ${d.bodyName}`.toLowerCase().includes(STATE.docQ.toLowerCase())) return false;
      return true;
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (STATE.docPage > totalPages) STATE.docPage = 1;
    const slice = filtered.slice((STATE.docPage - 1) * pageSize, STATE.docPage * pageSize);
    const lbl = document.getElementById("docMatchLabel");
    if (lbl) lbl.textContent = `Page ${STATE.docPage} of ${totalPages} · ${filtered.length.toLocaleString()} documents`;
    box.innerHTML = `
      <div class="panel" style="padding:0;overflow:hidden">
        <table class="foundry-tbl">
          <thead><tr><th>Meeting</th><th>Type</th><th>Document</th><th>Text search</th><th>Open</th></tr></thead>
          <tbody>
            ${slice.map((d) => `
              <tr>
                <td style="font-family:var(--mono);white-space:nowrap"><a href="#ep:${esc(d.meetingSlug)}" onclick="openEpisode('${jsq(d.meetingSlug)}');return false;" style="color:var(--sky);font-weight:800">${esc(d.date)}</a><div style="font-size:10px;color:#94a3b8">${esc(d.bodyName)}</div></td>
                <td><span class="tag tag-sky">${esc(docRoleLabel(d.role))}</span></td>
                <td><b>${esc(docTitle(d.title))}</b><div style="font-size:11px;color:#94a3b8">${esc(d.episodeTitle || "")}</div></td>
                <td style="font-size:10.5px">${d.ocr ? `<span class="tag tag-emerald">🔬 Text available</span>` : `<span style="color:#64748b">—</span>`}</td>
                <td style="white-space:nowrap">
                  <button type="button" class="btn btn-sky" style="padding:4px 9px;font-size:11px" onclick="STATE.selectedDocId=${d.id};STATE.epLens='foundry';openEpisode('${jsq(d.meetingSlug)}')">View here</button>
                  ${d.url ? `<a class="btn btn-amber" style="padding:4px 9px;font-size:11px" href="${esc(safeUrl(d.url))}" target="_blank" rel="noreferrer">Original ↗</a>` : ""}
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      ${renderPagination(STATE.docPage, filtered.length, pageSize, "setDocsPage")}
    `;
  };

  async function renderGlobalFoundry() {
    document.getElementById("appRoot").innerHTML = `<div class="loading-shell">Loading meeting documents…</div>`;
    await ensureDocsLoaded();
    document.getElementById("appRoot").innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div class="kicker" style="color:var(--sky)">AGENDAS, MINUTES &amp; ATTACHED DOCUMENTS</div>
        <h1 style="margin:6px 0 12px;font-size:26px">${fmtN(DB.docs.length)} Meeting Documents (2008–2026)</h1>
        <p style="font-size:12.5px;color:#cbd5e1;margin:0 0 12px">${fmtN(DB.docs.filter((d) => d.ocr).length)} of them have searchable text. Each file has a fingerprint (SHA-1) that proves it matches the archived original — you can search by it too.</p>
        <div class="toolbar">
          <form class="search-form" onsubmit="STATE.docQ=document.getElementById('docSearchInput').value;STATE.docPage=1;updateFoundryResults();return false;">
            <input id="docSearchInput" class="input" style="width:290px;font-family:var(--mono)" placeholder="Search document title, date or fingerprint…" value="${esc(STATE.docQ)}" oninput="STATE.docQ=this.value;STATE.docPage=1;updateFoundryResults()" />
            <button type="submit" class="btn-enter">Enter ↵</button>
          </form>
          <select class="input" onchange="STATE.docRole=this.value;STATE.docPage=1;updateFoundryResults()">
            <option value="">All types (${fmtN(DB.docs.length)})</option>
            ${Object.entries(DOC_ROLES).map(([k, v]) => `<option value="${k}" ${STATE.docRole === k ? "selected" : ""}>${v}s (${fmtN(DB.docs.filter((d) => d.role === k).length)})</option>`).join("")}
          </select>
          <label class="chip ${STATE.docOcr ? "active" : ""}" style="display:inline-flex;align-items:center;gap:6px">
            <input type="checkbox" ${STATE.docOcr ? "checked" : ""} onchange="STATE.docOcr=this.checked;STATE.docPage=1;updateFoundryResults();this.parentElement.classList.toggle('active',this.checked)" />
            🔬 Only documents with searchable text
          </label>
          <span id="docMatchLabel" style="font-family:var(--mono);font-size:12px;color:var(--sky)"></span>
        </div>
      </div>
      <div id="docResultsBox"></div>`;
    updateFoundryResults();
  }

  // ------------------------------------------------------------------ PEOPLE
  window.setCastPage = function (p) {
    STATE.castPage = Math.max(1, p);
    updateCastResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.updateCastResults = function () {
    const box = document.getElementById("castResultsBox");
    if (!box) return;
    const pageSize = 36;
    const filtered = DB.speakers.filter((s) => {
      if (STATE.castKind && !s.role.toLowerCase().includes(STATE.castKind.toLowerCase())) return false;
      if (STATE.castQ && !`${s.name} ${s.role}`.toLowerCase().includes(STATE.castQ.toLowerCase())) return false;
      return true;
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (STATE.castPage > totalPages) STATE.castPage = 1;
    const slice = filtered.slice((STATE.castPage - 1) * pageSize, STATE.castPage * pageSize);
    const lbl = document.getElementById("castMatchLabel");
    if (lbl) lbl.textContent = `Page ${STATE.castPage} of ${totalPages} · ${filtered.length} people`;
    box.innerHTML = `
      <div class="grid-3">
        ${slice.map((s) => {
          const an = s.analytics || {};
          return `
            <div class="panel" style="display:flex;flex-direction:column;justify-content:space-between">
              <div>
                <div style="font-weight:900;font-size:16px">${esc(s.name)}</div>
                <div style="font-size:11px;color:var(--amber);font-weight:700;margin-top:2px">${esc(s.role)}</div>
                ${an.osint && an.osint.headline ? `<p style="font-size:11.5px;color:#cbd5e1;margin:8px 0">${esc(an.osint.headline)}</p>` : ""}
                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;font-family:var(--mono);font-size:10px">
                  <span class="tag tag-amber">📼 ${s.turnCount} clips · ${s.meetingCount} meetings</span>
                  <span class="tag tag-sky">⏱️ Usually ${esc(an.avgSpeakingFormatted || "n/a")}</span>
                  <span class="tag tag-rose">⚖️ Points of order: ${an.pointOfOrderCount || 0}</span>
                </div>
              </div>
              <div style="display:flex;gap:6px;margin-top:12px;border-top:1px solid #1e293b;padding-top:9px">
                <button type="button" class="btn btn-amber" style="padding:5px 10px;font-size:11px" onclick="openSpeaker('${jsq(s.slug)}')">🎙️ Watch ${s.turnCount === 1 ? "the clip" : `all ${s.turnCount} clips`} →</button>
                <button type="button" class="btn btn-emerald" style="padding:5px 10px;font-size:11px" onclick="STATE.osintQ='${jsq(s.name)}';navTo('osint')">🕸️ Who's Who →</button>
              </div>
            </div>`;
        }).join("")}
      </div>
      ${renderPagination(STATE.castPage, filtered.length, pageSize, "setCastPage")}
    `;
  };

  function renderCastView() {
    document.getElementById("appRoot").innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div class="kicker" style="color:var(--violet)">🎭 ELECTED OFFICIALS, CITY STAFF &amp; MEMBERS OF THE PUBLIC</div>
        <h1 style="margin:6px 0 10px;font-size:26px">All ${DB.speakers.length} People Who Spoke at City Meetings</h1>
        <p style="font-size:12.5px;color:#cbd5e1;margin:0 0 12px">Names are checked against the official minutes.</p>
        <div class="toolbar">
          <form class="search-form" onsubmit="STATE.castQ=document.getElementById('castSearchInput').value;STATE.castPage=1;updateCastResults();return false;">
            <input id="castSearchInput" class="input" style="width:270px" placeholder="Search a name: Mark Moody, Patrick Collins…" value="${esc(STATE.castQ)}" oninput="STATE.castQ=this.value;STATE.castPage=1;updateCastResults()" />
            <button type="submit" class="btn-enter">Enter ↵</button>
          </form>
          <select class="input" onchange="STATE.castKind=this.value;STATE.castPage=1;updateCastResults()">
            <option value="">Everyone (${DB.speakers.length})</option>
            <option value="Mayor" ${STATE.castKind === "Mayor" ? "selected" : ""}>Mayor</option>
            <option value="Council" ${STATE.castKind === "Council" ? "selected" : ""}>City Council Members</option>
            <option value="Director" ${STATE.castKind === "Director" ? "selected" : ""}>Department Directors &amp; Staff</option>
            <option value="Public" ${STATE.castKind === "Public" ? "selected" : ""}>Public Commenters &amp; Advocates</option>
          </select>
          <span id="castMatchLabel" style="font-family:var(--mono);font-size:12px;color:var(--amber)"></span>
        </div>
      </div>
      <div id="castResultsBox"></div>`;
    updateCastResults();
  }

  // ------------------------------------------------------------------ WHERE THE RECORDS COME FROM
  window.setProvPage = function (p) {
    STATE.provPage = Math.max(1, p);
    updateProvLedger();
  };

  window.updateProvLedger = function () {
    const box = document.getElementById("provLedgerBox");
    const p = DB.provenance;
    if (!box || !p) return;
    const pageSize = 25;
    const rows = p.chapters.flatMap((c) => (c.ledgerRows || []).map((r) => ({ ...r, clipUrl: assetUrl(c.pagesUrl), chTitle: c.title })))
      .filter((r) => !STATE.provQ || `${r.key} ${r.item || ""} ${r.how || ""}`.toLowerCase().includes(STATE.provQ.toLowerCase()));
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (STATE.provPage > totalPages) STATE.provPage = 1;
    const slice = rows.slice((STATE.provPage - 1) * pageSize, STATE.provPage * pageSize);

    box.innerHTML = `
      <div style="max-height:360px;overflow-y:auto">
        <table class="foundry-tbl">
          <thead><tr><th>Record</th><th>How many</th><th>Where to click to get it</th><th>Video</th></tr></thead>
          <tbody>
            ${slice.map((r) => `
              <tr>
                <td style="color:var(--sky)">${esc(String(r.ledger || r.key || "").replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase()))}<div style="font-size:10px;color:#94a3b8">${esc(r.item || "")}</div></td>
                <td style="font-family:var(--mono);color:var(--amber);font-weight:800">${esc(r.value)}</td>
                <td>${esc(r.how || "")}</td>
                <td><button type="button" class="btn btn-rose" style="padding:3px 8px;font-size:10.5px" onclick="setProvVideo('${jsq(r.clipUrl)}','${jsq(r.chTitle)}','${jsq(r.how || "")}')">▶ Watch</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      ${renderPagination(STATE.provPage, rows.length, pageSize, "setProvPage")}
    `;
  };

  function renderProvenanceInner() {
    const p = DB.provenance;
    if (!p) return `<div class="panel">Loading…</div>`;
    const curUrl = STATE.provActiveUrl || p.masterFilms[0].pagesUrl;
    const curTitle = STATE.provActiveTitle || p.masterFilms[0].title;
    const curDesc = STATE.provActiveDesc || p.masterFilms[0].description;

    setTimeout(updateProvLedger, 0);

    return `
      <div>
        <div class="panel" style="margin-bottom:16px;border-color:rgba(244,63,94,0.4)">
          <div class="kicker" style="color:#fda4af">🎥 WHERE THE RECORDS COME FROM</div>
          <h1 style="margin:6px 0">How Every Record Was Downloaded, on Video</h1>
          <p style="font-size:12.5px;color:#cbd5e1">Screen recordings of the real public websites, showing the clicks a person makes to get each meeting calendar, agenda packet, attached document, set of minutes and meeting video. Doing all of this by hand for the ${p.summaryStats.totalFilesAudited.toLocaleString()} files checked would take about ${esc(p.summaryStats.manualEquivalentEstimate)}.</p>
        </div>
        <div class="grid-2" style="margin-bottom:16px">
          <div class="panel" style="background:#050912">
            ${renderVideoBox({
              id: "vbox_prov_main",
              headerRight: "SCREEN RECORDING",
              title: curTitle,
              sub: "Screen recording",
              ccText: curDesc,
              videoSrc: curUrl,
              poster: "./provenance/provenance-timelapse-poster.jpg",
              height: 270
            })}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
              <span style="font-size:12px;color:#cbd5e1">${esc(curDesc)}</span>
              <a class="btn btn-rose" href="${esc(curUrl)}" download>⬇ Download video</a>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">
              ${p.masterFilms.map((mf) => `
                <button type="button" class="panel" style="padding:9px;text-align:left;cursor:pointer;border-color:${curUrl === mf.pagesUrl ? "var(--rose)" : "#1e293b"}" onclick="setProvVideo('${jsq(mf.pagesUrl)}','${jsq(mf.title)}','${jsq(mf.description)}')">
                  <div style="font-family:var(--mono);font-size:10px;color:#fda4af">${mf.durationSec >= 60 ? Math.floor(mf.durationSec / 60) + " min " + (mf.durationSec % 60) + " s" : mf.durationSec + " s"} · ${mf.sizeMb} MB</div>
                  <div style="font-size:11.5px;font-weight:800;margin-top:3px">${esc(mf.title)}</div>
                </button>`).join("")}
            </div>
          </div>
          <div class="panel" style="max-height:540px;overflow-y:auto">
            <div class="kicker" style="color:var(--sky);margin-bottom:8px">${p.chapters.length} SHORT CLIPS, ONE FOR EACH KIND OF RECORD</div>
            ${p.chapters.map((ch) => `
              <div onclick="setProvVideo('${jsq(ch.pagesUrl)}','${jsq(ch.title)}','${jsq(ch.description)}')" style="padding:9px;border-bottom:1px solid #1e293b;cursor:pointer">
                <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px;color:var(--amber)"><span>▶ ${esc(ch.title)}</span><span>${ch.durationSec}s</span></div>
                <div style="font-size:11.5px;color:#cbd5e1;margin-top:3px">${esc(ch.description)}</div>
              </div>`).join("")}
          </div>
        </div>
        <div class="panel">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div class="kicker" style="color:var(--emerald)">EVERY KIND OF RECORD, HOW MANY THERE ARE AND WHERE TO CLICK (${p.chapters.reduce((n, c) => n + (c.ledgerRows || []).length, 0)} ROWS)</div>
            <form class="search-form" onsubmit="STATE.provQ=document.getElementById('provSearchInput').value;STATE.provPage=1;updateProvLedger();return false;">
              <input id="provSearchInput" class="input" style="width:240px" placeholder="Search records or websites…" value="${esc(STATE.provQ)}" oninput="STATE.provQ=this.value;STATE.provPage=1;updateProvLedger()" />
              <button type="submit" class="btn-enter">Enter ↵</button>
            </form>
          </div>
          <div id="provLedgerBox"></div>
        </div>
      </div>`;
  }

  window.setProvVideo = function (url, title, desc) {
    STATE.provActiveUrl = url;
    STATE.provActiveTitle = title;
    STATE.provActiveDesc = desc;
    if (STATE.view === "episode") rerenderEpisode();
    else document.getElementById("appRoot").innerHTML = renderProvenanceInner();
  };

  function updateNavButtons() {
    document.querySelectorAll("#mainNav button").forEach((b) => {
      const target = b.getAttribute("data-nav");
      b.classList.toggle("active", target === STATE.view || (STATE.view === "episode" && target === "episodes") || (STATE.view === "ordinance_detail" && target === "ordinances"));
    });
  }

  window.navTo = function (view) {
    STATE.view = view;
    window.location.hash = view;
    updateNavButtons();
    if (view === "home") renderHome();
    else if (view === "episodes") renderEpisodesList();
    else if (view === "speakers") renderSpeakersVault();
    else if (view === "osint") renderOsintView();
    else if (view === "ordinances") renderOrdinancesList();
    else if (view === "foundry") renderGlobalFoundry();
    else if (view === "cast") renderCastView();
    else if (view === "provenance") document.getElementById("appRoot").innerHTML = renderProvenanceInner();
  };

  window.renderHome = renderHome;
  window.renderEpisodesList = renderEpisodesList;
  window.renderOsintView = renderOsintView;
  window.renderOrdinancesList = renderOrdinancesList;
  window.renderGlobalFoundry = renderGlobalFoundry;
  window.renderCastView = renderCastView;
  window.renderProvenanceInner = renderProvenanceInner;

  async function boot() {
    const [eps, turns, spks, osint, ords, prov, people] = await Promise.all([
      fetch(BASE + "data/episodes_index.json").then((r) => r.json()),
      fetch(BASE + "data/speaker_turns.json").then((r) => r.json()),
      fetch(BASE + "data/speakers_directory.json").then((r) => r.json()),
      fetch(BASE + "data/osint_entities.json").then((r) => r.json()),
      fetch(BASE + "data/ordinances.json").then((r) => r.json()),
      fetch(BASE + "data/provenance_videos.json").then((r) => r.json()),
      fetch(BASE + "data/people.json").then((r) => r.json())
    ]);
    DB.episodes = eps;
    eps.forEach((e) => DB.epBySlug.set(e.slug, e));
    DB.turns = turns;
    turns.forEach((t) => DB.turnById.set(t.id, t));
    DB.speakers = spks;
    spks.forEach((s) => DB.speakerBySlug.set(s.slug, s));
    DB.osint = osint.map((e) => ({
      ...e,
      role: e.role || e.subtype || "",
      summary: e.summary || e.nexusSummary || "",
      keyPrincipals: e.keyPrincipals || e.keyPeople || [],
      totalContractUsd: e.totalContractUsd != null ? e.totalContractUsd : e.trackedContractValueUsd || 0,
      sampleContractsAndItems: (e.sampleContractsAndItems || e.contractsAndBids || []).map((it) => ({
        ...it,
        date: it.date || String(it.meeting || "").slice(0, 10)
      })),
      linkedOrdinances: e.linkedOrdinances || e.ordinancesAndResolutions || [],
      linkedSpeakers: (e.linkedSpeakers || []).map((sp) => ({ ...sp, clips: sp.clips != null ? sp.clips : sp.clipCount || 0 }))
    }));
    DB.ordinances = ords;
    ords.forEach((o) => DB.ordBySlug.set(o.slug, o));
    DB.provenance = prov;
    DB.people = people;

    C.episodes = eps.length;
    C.withVideo = eps.filter((e) => e.mp4Url || e.videoUrl).length;
    C.turns = turns.length;
    C.timed = turns.filter((t) => t.videoTiming !== "removed" && (t.brandedMp4Url || t.directMp4Url || t.sourceMeetingMp4Url || t.youtubeId)).length;
    C.branded = turns.filter((t) => t.brandedMp4Url).length;
    C.speakers = spks.length;
    C.osint = osint.length;
    C.docs = eps.reduce((n, e) => n + (e.docCount || 0), 0);
    C.ordinances = ords.length;
    C.films = ((prov && prov.masterFilms) || []).length + ((prov && prov.chapters) || []).length;
    C.people = (people || []).length;
    const navCounts = { episodes: C.episodes, speakers: C.turns, osint: C.osint, ordinances: C.ordinances, foundry: C.docs, cast: C.speakers };
    document.querySelectorAll("[data-count]").forEach((el) => {
      const n = navCounts[el.getAttribute("data-count")];
      if (n) el.textContent = `(${fmtN(n)})`;
    });

    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        navTo(el.getAttribute("data-nav"));
      });
    });

    const h = window.location.hash.replace(/^#/, "");
    if (h.startsWith("ep:")) return openEpisode(decodeURIComponent(h.slice(3)));
    if (h.startsWith("speakers:")) return openSpeaker(decodeURIComponent(h.slice(9)));
    if (h.startsWith("ord:")) return openOrdinance(decodeURIComponent(h.slice(4)));
    if (["episodes", "speakers", "osint", "ordinances", "foundry", "provenance", "cast"].includes(h)) return navTo(h);
    renderHome();
  }

  boot().catch((err) => {
    document.getElementById("appRoot").innerHTML = `<div class="panel">Sorry, the site could not load its data. Please refresh the page. (${esc(err)})</div>`;
  });
})();
