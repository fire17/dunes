/* Dunes - globe of the world's best sandboarding dunes. Plain JS, no build step. */
(() => {
  "use strict";

  const TEX = "https://cdn.jsdelivr.net/npm/three-globe@2.45.0/example/img/";
  const SAFETY = {
    green:  { color: "#7fcf8f", he: "בטוח יחסית" },
    orange: { color: "#f2a33a", he: "בזהירות, עדיף עם מדריך" },
    red:    { color: "#ee5a4f", he: "אזהרת מסע: לא להגיע" },
  };
  const REGIONS = {
    "americas": "אמריקה",
    "africa": "אפריקה",
    "asia-me": "אסיה והמזרח התיכון",
    "europe-oceania": "אירופה ואוקיאניה",
    "sinai": "סיני",
    "europe": "אירופה",
    "oceania": "אוקיאניה",
    "asia": "אסיה",
    "middle-east": "המזרח התיכון",
    "me": "המזרח התיכון",
    "north-america": "צפון אמריקה",
    "south-america": "דרום אמריקה",
  };
  const COUNTRY_HE = {
    "Peru": "פרו", "Chile": "צ'ילה", "Bolivia": "בוליביה", "Brazil": "ברזיל", "Argentina": "ארגנטינה",
    "Colombia": "קולומביה", "Ecuador": "אקוודור", "Mexico": "מקסיקו", "United States": "ארצות הברית",
    "USA": "ארצות הברית", "Canada": "קנדה", "Namibia": "נמיביה", "Morocco": "מרוקו", "Egypt": "מצרים",
    "Libya": "לוב", "Algeria": "אלג'יריה", "Tunisia": "תוניסיה", "Mauritania": "מאוריטניה", "Niger": "ניז'ר",
    "Chad": "צ'אד", "Sudan": "סודן", "Mali": "מאלי", "South Africa": "דרום אפריקה", "Angola": "אנגולה",
    "Botswana": "בוטסוואנה", "Madagascar": "מדגסקר", "Senegal": "סנגל",
    "United Arab Emirates": "איחוד האמירויות", "UAE": "איחוד האמירויות", "Oman": "עומאן",
    "Saudi Arabia": "ערב הסעודית", "Qatar": "קטאר", "Jordan": "ירדן", "Israel": "ישראל", "Iran": "איראן",
    "Kuwait": "כווית", "Bahrain": "בחריין", "Yemen": "תימן", "China": "סין", "Mongolia": "מונגוליה",
    "India": "הודו", "Kazakhstan": "קזחסטן", "Uzbekistan": "אוזבקיסטן", "Turkmenistan": "טורקמניסטן",
    "Vietnam": "וייטנאם", "Russia": "רוסיה", "Armenia": "ארמניה", "Turkey": "טורקיה", "Azerbaijan": "אזרבייג'ן",
    "France": "צרפת", "Spain": "ספרד", "Poland": "פולין", "Lithuania": "ליטא", "Portugal": "פורטוגל",
    "Denmark": "דנמרק", "Germany": "גרמניה", "Italy": "איטליה", "Netherlands": "הולנד", "Ukraine": "אוקראינה",
    "United Kingdom": "בריטניה", "Ireland": "אירלנד", "Australia": "אוסטרליה", "New Zealand": "ניו זילנד",
    "Kenya": "קניה", "Western Sahara": "סהרה המערבית", "Venezuela": "ונצואלה", "Japan": "יפן",
    "Philippines": "הפיליפינים",
  };

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const countryHe = (c) => COUNTRY_HE[c] || c;
  const regionHe = (r) => REGIONS[r] || r;
  const isDesktop = () => matchMedia("(min-width: 900px)").matches;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    all: [],
    q: "",
    safety: new Set(["green", "orange", "red"]),
    minScore: 1,
    region: "all",
    view: "globe",
    selected: null,
  };
  let world = null;

  /* ---------- Data ---------- */
  async function load() {
    const res = await fetch("dunes.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("dunes.json " + res.status);
    const data = await res.json();
    return data.filter((d) => d && d.id && Number.isFinite(d.lat) && Number.isFinite(d.lon))
      .sort((a, b) => b.sandboard - a.sandboard || (b.height_m || 0) - (a.height_m || 0));
  }

  const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-֑ͯ-ׇ]/g, "");

  function filtered() {
    const q = norm(state.q.trim());
    return state.all.filter((d) => {
      if (!state.safety.has(d.safety)) return false;
      if (d.sandboard < state.minScore) return false;
      if (state.region !== "all" && d.region !== state.region) return false;
      if (!q) return true;
      const hay = norm([d.name, d.name_he, d.country, countryHe(d.country), regionHe(d.region)].join(" "));
      return hay.includes(q);
    });
  }

  /* ---------- Small renderers ---------- */
  const STAR = '<svg viewBox="0 0 24 24"%c><path d="M12 2.8l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8 6.2 20.1l1.5-6.4L2.8 9.4l6.5-.6z"/></svg>';
  function stars(n, lg) {
    let h = `<span class="stars${lg ? " lg" : ""}" role="img" aria-label="ציון ${n} מתוך 5">`;
    for (let i = 1; i <= 5; i++) h += STAR.replace("%c", i <= n ? ' class="on"' : "");
    return h + "</span>";
  }
  const badge = (s) => `<span class="badge ${s}">${esc(SAFETY[s]?.he || s)}</span>`;

  /* ---------- Filters UI ---------- */
  function chip(label, pressed, attrs, sw) {
    return `<button type="button" class="chip" aria-pressed="${pressed}" ${attrs}>${sw ? `<span class="sw" style="background:${sw}"></span>` : ""}${label}</button>`;
  }
  function renderFilters() {
    $("#safetyChips").innerHTML = Object.entries(SAFETY)
      .map(([k, v]) => chip(esc(v.he), state.safety.has(k), `data-safety="${k}"`, v.color)).join("");
    $("#scoreChips").innerHTML = [1, 2, 3, 4, 5]
      .map((n) => chip(n === 1 ? "הכול" : `${n}+ ★`, state.minScore === n, `data-score="${n}"`)).join("");
    const regions = [...new Set(state.all.map((d) => d.region))]
      .sort((a, b) => Object.keys(REGIONS).indexOf(a) - Object.keys(REGIONS).indexOf(b));
    $("#regionChips").innerHTML = chip("כל העולם", state.region === "all", 'data-region="all"') +
      regions.map((r) => chip(esc(regionHe(r)), state.region === r, `data-region="${esc(r)}"`)).join("");
    const active = state.safety.size < 3 || state.minScore > 1 || state.region !== "all";
    $("#filterDot").hidden = !active;
  }

  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    if (b.dataset.safety) {
      const k = b.dataset.safety;
      if (state.safety.has(k)) { if (state.safety.size > 1) state.safety.delete(k); }
      else state.safety.add(k);
    } else if (b.dataset.score) state.minScore = +b.dataset.score;
    else if (b.dataset.region) state.region = b.dataset.region;
    update();
  });
  $("#resetBtn").addEventListener("click", () => {
    state.safety = new Set(["green", "orange", "red"]);
    state.minScore = 1; state.region = "all"; state.q = ""; $("#q").value = "";
    update();
  });
  $("#filterBtn").addEventListener("click", () => {
    const f = $("#filters"), open = f.hidden;
    f.hidden = !open;
    $("#filterBtn").setAttribute("aria-expanded", String(open));
    syncTopHeight();
  });
  $("#q").addEventListener("input", (e) => { state.q = e.target.value; update(); });
  $("#q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = filtered()[0];
      if (first) { e.target.blur(); select(first); }
    }
  });

  /* ---------- List ---------- */
  function renderList(rows) {
    $("#listItems").innerHTML = rows.map((d) => `
      <li><button type="button" class="row" data-id="${esc(d.id)}">
        <span><span class="row-name">${esc(d.name_he)}</span>
          <span class="row-meta">${esc(countryHe(d.country))}${d.height_m ? ` · ${Math.round(d.height_m)} מ'` : ""}</span></span>
        <span class="row-side">${stars(d.sandboard)}${badge(d.safety)}</span>
      </button></li>`).join("");
    $("#listEmpty").hidden = rows.length > 0;
  }
  $("#listItems").addEventListener("click", (e) => {
    const b = e.target.closest(".row");
    if (!b) return;
    const d = state.all.find((x) => x.id === b.dataset.id);
    if (d) { setView("globe"); select(d); }
  });

  function setView(v) {
    state.view = v;
    $("#list").hidden = v !== "list";
    document.querySelectorAll(".viewtoggle button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
    if (v === "list") { closePanel(); stopRotate(); }
  }
  document.querySelector(".viewtoggle").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) setView(b.dataset.view);
  });

  /* ---------- Panel ---------- */
  // Prefer the Hebrew translation (<key>_he); fall back to the English original.
  function txt(d, k) {
    const he = d[k + "_he"];
    if (he) return { v: he, en: false };
    return d[k] ? { v: d[k], en: true } : null;
  }
  const langAttr = (t) => (t && t.en ? ' lang="en" dir="auto"' : ' dir="rtl"');
  // Hebrew text with embedded Latin names / numbers: isolate each Latin run
  // (<bdi>) so punctuation stays on the right side, and keep number ranges
  // ("4.5–5", "Oct–May" dates) from breaking across lines.
  const LTR_TOK = "(?=[\\w.'’&/:+-]*[A-Za-z])[A-Za-z0-9][\\w.'’&/:+-]*";
  const LTR_RUN = new RegExp(`(${LTR_TOK}(?:[ \u00a0]+${LTR_TOK})*)|(\\d[\\d.,]*[ \u00a0]?[–-][ \u00a0]?\\d[\\d.,]*)`, "g");
  function rich(t) {
    if (!t || !t.v) return "";
    if (t.en) return esc(t.v);
    let out = "", last = 0;
    for (const m of t.v.matchAll(LTR_RUN)) {
      let run = m[0];
      if (m[1]) run = run.replace(/[.:/'’-]+$/, ""); // trailing punctuation stays RTL
      out += esc(t.v.slice(last, m.index));
      out += m[1] ? `<bdi dir="ltr">${esc(run)}</bdi>` : `<span class="nw">${esc(run)}</span>`;
      last = m.index + run.length;
    }
    return out + esc(t.v.slice(last));
  }
  function fact(label, t) {
    if (!t || !t.v) return "";
    return `<div><dt>${label}</dt><dd${langAttr(t)}>${rich(t)}</dd></div>`;
  }
  function renderPanel(d) {
    const maps = `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lon}`;
    const hn = txt(d, "height_note"), hi = txt(d, "highlights"), sn = txt(d, "safety_note");
    const note = hn ? `<span class="note"${langAttr(hn)}>${rich(hn)}</span>` : "";
    const h = Number.isFinite(d.height_m)
      ? `<div class="p-height"><span class="num">${Math.round(d.height_m)}<small>מ'</small></span>${note}</div>`
      : `<div class="p-height unknown"><span class="num">גובה לא ידוע</span>${note}</div>`;
    $("#panelBody").innerHTML = `
      <div class="p-head">
        <h2 class="p-name" id="pName">${esc(d.name_he)}</h2>
        <p class="p-en"><bdi lang="en">${esc(d.name)}</bdi> · ${esc(countryHe(d.country))}${countryHe(d.country) !== d.country ? ` <bdi lang="en" dir="ltr" class="p-cty">(${esc(d.country)})</bdi>` : ""}</p>
      </div>
      <div class="p-score">${stars(d.sandboard, true)}<span class="lbl">ציון סנדבורד ${d.sandboard}/5</span></div>
      ${hi ? `<p class="p-high"${langAttr(hi)}>${rich(hi)}</p>` : ""}
      ${h}
      <div class="p-safety ${d.safety}">${badge(d.safety)}${sn ? `<p${langAttr(sn)}>${rich(sn)}</p>` : ""}</div>
      <dl class="p-facts">
        ${fact("עונה מומלצת", txt(d, "best_season"))}
        ${fact("איך מגיעים", txt(d, "access"))}
        ${fact("מפעילים והשכרת קרשים", txt(d, "operators") || { v: "לא ידועים מפעילים קבועים", en: false })}
        ${fact("אזור", { v: regionHe(d.region), en: false })}
      </dl>
      <div class="p-actions">
        <a class="btn primary" href="${maps}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>
          פתיחה ב-Google Maps</a>
      </div>
      ${d.sources?.length ? `<div class="p-sources">מקורות<ul>${d.sources.map((s) => `<li><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s.replace(/^https?:\/\/(www\.)?/, ""))}</a></li>`).join("")}</ul></div>` : ""}`;
  }

  function select(d) {
    state.selected = d;
    renderPanel(d);
    const p = $("#panel");
    p.classList.add("open");
    p.setAttribute("aria-hidden", "false");
    document.body.classList.add("sheet-open");
    $("#panelBody").scrollTop = 0;
    history.replaceState(null, "", "#" + encodeURIComponent(d.id));
    if (world) {
      stopRotate();
      // Offset the camera so the dune sits clear of the sheet/panel.
      // Phone: the globe layer slides up above the sheet (CSS), so centre on the dune.
      const pov = isDesktop()
        ? { lat: d.lat, lng: d.lon - 22, altitude: 1.5 }
        : { lat: d.lat, lng: d.lon, altitude: 1.45 };
      world.pointOfView(pov, reducedMotion ? 0 : 1400);
      world.ringsData([d]);
      world.labelsData([d]);
    }
    if (isDesktop()) setTimeout(() => $("#closeBtn").focus({ preventScroll: true }), 50);
  }
  function closePanel() {
    const p = $("#panel");
    if (!p.classList.contains("open")) return;
    p.classList.remove("open");
    p.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sheet-open");
    state.selected = null;
    history.replaceState(null, "", location.pathname);
    if (world) { world.ringsData([]); world.labelsData([]); }
  }
  $("#closeBtn").addEventListener("click", closePanel);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

  // Swipe the bottom sheet down to dismiss.
  (() => {
    const p = $("#panel"); let y0 = null, dy = 0;
    const start = (e) => { if (isDesktop()) return; y0 = e.touches[0].clientY; dy = 0; p.style.transition = "none"; };
    const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); p.style.transform = `translateY(${dy}px)`; };
    const end = () => { if (y0 == null) return; p.style.transition = ""; p.style.transform = ""; if (dy > 90) closePanel(); y0 = null; };
    $("#grip").addEventListener("touchstart", start, { passive: true });
    p.addEventListener("touchstart", (e) => { if (e.target.closest(".grip, .p-head")) start(e); }, { passive: true });
    p.addEventListener("touchmove", move, { passive: true });
    p.addEventListener("touchend", end);
  })();

  /* ---------- Globe ---------- */
  function stopRotate() { if (world) world.controls().autoRotate = false; }

  function labelHtml(d) {
    return `<div class="g-label"><b>${esc(d.name_he)}</b><span>${esc(d.name)} · ${esc(countryHe(d.country))} · ${"★".repeat(d.sandboard)}</span></div>`;
  }

  function initGlobe() {
    if (typeof Globe === "undefined") throw new Error("globe.gl failed to load");
    const el = $("#globe");
    world = new Globe(el, { animateIn: !reducedMotion })
      .backgroundColor("rgba(0,0,0,0)")
      .globeImageUrl(TEX + "earth-blue-marble.jpg")
      .bumpImageUrl(TEX + "earth-topology.png")
      .showAtmosphere(true)
      .atmosphereColor("#f3b06a")
      .atmosphereAltitude(0.22)
      .pointLat("lat").pointLng("lon")
      .pointColor((d) => SAFETY[d.safety]?.color || "#fff")
      .pointAltitude((d) => 0.015 + d.sandboard * 0.028)
      .pointRadius((d) => 0.32 + d.sandboard * 0.1)
      .pointResolution(14)
      .pointsMerge(false)
      .pointsTransitionDuration(600)
      .pointLabel(labelHtml)
      .onPointClick((d) => select(d))
      .onPointHover((d) => { el.style.cursor = d ? "pointer" : ""; })
      .ringLat("lat").ringLng("lon")
      .ringColor((d) => (t) => {
        const c = SAFETY[d.safety]?.color || "#fff";
        const a = Math.round((1 - t) * 255).toString(16).padStart(2, "0");
        return c + a;
      })
      .ringMaxRadius(4.5).ringPropagationSpeed(2.2).ringRepeatPeriod(1100)
      .labelLat("lat").labelLng("lon")
      .labelText("name")
      .labelSize(0.9).labelDotRadius(0.35).labelAltitude((d) => 0.02 + d.sandboard * 0.028)
      .labelColor(() => "#f6eedd").labelResolution(3)
      .onGlobeClick(() => { if (!isDesktop()) closePanel(); });

    const ctr = world.controls();
    ctr.autoRotate = !reducedMotion;
    ctr.autoRotateSpeed = 0.45;
    ctr.enableDamping = true;
    ctr.minDistance = 160;
    ctr.maxDistance = 900;
    ctr.addEventListener("start", stopRotate);
    el.addEventListener("pointerdown", stopRotate, { passive: true });
    el.addEventListener("wheel", stopRotate, { passive: true });

    // Dusk lighting: warm key light.
    try {
      const lights = world.lights?.();
      if (lights && lights[0]) lights[0].intensity = Math.PI * 0.9;
    } catch (_) { /* older API */ }

    const size = () => world.width(innerWidth).height(innerHeight);
    addEventListener("resize", size);
    size();
    // Start over the Middle East / Africa - home turf for the audience.
    world.pointOfView({ lat: 24, lng: 28, altitude: isDesktop() ? 2.3 : 3.3 }, 0);
  }

  /* ---------- Update ---------- */
  function update() {
    const rows = filtered();
    renderFilters();
    renderList(rows);
    if (world) world.pointsData(rows);
    const n = rows.length, total = state.all.length;
    $("#count").textContent = n === total ? `${total} דיונות על המפה` : `${n} מתוך ${total} דיונות`;
  }

  function syncTopHeight() {
    const h = $(".top").getBoundingClientRect().height;
    document.documentElement.style.setProperty("--toph", h + "px");
    $("#list").style.paddingTop = h + 8 + "px";
  }
  addEventListener("resize", syncTopHeight);

  function showStatus(msg) { const s = $("#status"); s.textContent = msg; s.hidden = false; }

  async function main() {
    syncTopHeight();
    try {
      initGlobe();
    } catch (err) {
      console.error(err);
      showStatus("הגלובוס לא נטען בדפדפן הזה. אפשר לעבור לתצוגת רשימה.");
      setView("list");
    }
    try {
      state.all = await load();
    } catch (err) {
      console.error(err);
      showStatus("לא הצלחנו לטעון את dunes.json. הריצו python3 build.py והגישו את התיקייה דרך שרת מקומי.");
      return;
    }
    update();
    syncTopHeight();
    const id = decodeURIComponent(location.hash.slice(1));
    const d = id && state.all.find((x) => x.id === id);
    if (d) setTimeout(() => select(d), 600);
    addEventListener("hashchange", () => {
      const x = state.all.find((y) => y.id === decodeURIComponent(location.hash.slice(1)));
      if (x && x !== state.selected) { setView("globe"); select(x); }
    });
  }
  main();

  // Debug hook for automated checks.
  window.__dunes = { state, select: (id) => { const d = state.all.find((x) => x.id === id); if (d) select(d); return !!d; }, world: () => world };
})();
