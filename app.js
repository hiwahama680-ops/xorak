(() => {
  "use strict";

  /* ---------- Storage ---------- */
  const KEY = "xorak.v1";
  const defaults = () => ({
    v: 1,
    lang: null, // null = first run (onboarding)
    theme: "system",
    units: "metric",
    ramadan: false,
    installHidden: false,
    profile: { sex: "m", age: 28, height: 175, weight: 78, goalWeight: 72, activity: 1, goal: "lose", macro: "bal", kcalOverride: 0, water: 8 },
    days: {},
    weights: [],
    custom: [],
    recent: [],
    fav: [],
    fast: { plan: 16, start: null, history: [] },
    ai: { provider: "gemini", key: "", model: "" },
    chat: []
  });
  function load() {
    const d = defaults();
    try {
      const j = JSON.parse(localStorage.getItem(KEY));
      if (j && j.v) {
        return Object.assign(d, j, {
          profile: Object.assign(d.profile, j.profile),
          fast: Object.assign(d.fast, j.fast),
          ai: Object.assign(d.ai, j.ai)
        });
      }
    } catch (e) { /* storage unavailable */ }
    return d;
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  /* ---------- Data helpers ---------- */
  const FOOD = {};
  window.FOODS.forEach(r => { FOOD[r[0]] = { id: r[0], en: r[1], ckb: r[2], sen: r[3], sckb: r[4], kcal: r[5], p: r[6], c: r[7], f: r[8], cat: r[9] }; });
  const ACT = window.ACTIVITIES.map(r => ({ id: r[0], en: r[1], ckb: r[2], met: r[3] }));
  const getFood = id => FOOD[id] || S.custom.find(c => c.id === id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const pad = n => String(n).padStart(2, "0");
  const dk = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dk(d); };
  let cur = dk();
  let view = "today";

  function day(k = cur, create) {
    if (!S.days[k]) { if (!create) return { food: [], ex: [], water: 0, steps: 0 }; S.days[k] = { food: [], ex: [], water: 0, steps: 0 }; }
    return S.days[k];
  }

  /* ---------- Language ---------- */
  const T = window.I18N;
  const lang = () => (S.lang === "ckb" ? "ckb" : "en");
  function t(k, vars) {
    let s = (T[lang()] && T[lang()][k]) || T.en[k] || k;
    if (vars) for (const v in vars) s = s.split("{" + v + "}").join(vars[v]);
    return s;
  }
  const KU_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  const kuNum = s => (lang() === "ckb" ? String(s).replace(/[0-9]/g, d => KU_DIGITS[d]).replace(/\./g, "٫").replace(/,/g, "٬") : String(s));
  const fmt = (n, dec = 0) => {
    if (n == null || isNaN(n)) return "–";
    const v = dec ? (Math.round(n * 10 ** dec) / 10 ** dec).toString() : Math.round(n).toLocaleString("en-US");
    return kuNum(v);
  };
  function num(v) {
    if (v == null) return NaN;
    const s = String(v).trim()
      .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
      .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
      .replace(/[٫,]/g, ".");
    return s === "" ? NaN : Number(s);
  }
  const nm = o => (lang() === "ckb" && o.ckb ? o.ckb : o.en || o.ckb || "");
  const sv = o => (lang() === "ckb" && o.sckb ? o.sckb : o.sen || o.sckb || "");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const MONTHS_KU = ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"];
  const DAYS_KU = ["یەکشەممە", "دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی", "شەممە"];
  function dateLabel(k) {
    const today = dk();
    if (k === today) return t("today");
    if (k === addDays(today, -1)) return t("yesterday");
    if (k === addDays(today, 1)) return t("tomorrow");
    const d = parseKey(k);
    if (lang() === "ckb") return DAYS_KU[d.getDay()] + " " + kuNum(d.getDate()) + " " + MONTHS_KU[d.getMonth()];
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  function shortDate(k) {
    const d = parseKey(k);
    if (lang() === "ckb") return kuNum(d.getDate()) + "/" + kuNum(d.getMonth() + 1);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function timeStr(ts) {
    const d = new Date(ts);
    return kuNum(pad(d.getHours()) + ":" + pad(d.getMinutes()));
  }

  /* ---------- Units ---------- */
  const imp = () => S.units === "imperial";
  const wShow = kg => (imp() ? kg * 2.20462 : kg);
  const wIn = v => (imp() ? v / 2.20462 : v);
  const wUnit = () => t(imp() ? "lb" : "kg");

  /* ---------- Targets ---------- */
  const ACT_MULT = [1.2, 1.375, 1.55, 1.725, 1.9];
  const GOAL_DELTA = { lose_fast: -750, lose: -500, lose_slow: -250, keep: 0, gain: 300 };
  const MACRO = { bal: [25, 50, 25], pro: [35, 40, 25], low: [30, 25, 45], keto: [25, 5, 70] };
  function latestWeight() {
    const w = S.weights.slice().sort((a, b) => (a.d < b.d ? -1 : 1));
    return w.length ? w[w.length - 1].kg : S.profile.weight;
  }
  function targets() {
    const p = S.profile, kg = latestWeight();
    const bmr = 10 * kg + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5);
    const tdee = bmr * ACT_MULT[p.activity];
    const floor = p.sex === "f" ? 1200 : 1500;
    let kcal = Math.max(floor, Math.round((tdee + (GOAL_DELTA[p.goal] || 0)) / 10) * 10);
    if (p.kcalOverride > 0) kcal = p.kcalOverride;
    const m = MACRO[p.macro] || MACRO.bal;
    return { bmr, tdee, kcal, p: (kcal * m[0]) / 100 / 4, c: (kcal * m[1]) / 100 / 4, f: (kcal * m[2]) / 100 / 9, water: p.water, kg };
  }
  const exKcal = (met, min, kg = latestWeight()) => (met * 3.5 * kg / 200) * min;
  const stepKcal = steps => Math.max(0, steps - 5000) * 0.04 * (latestWeight() / 70);
  function totals(k = cur) {
    const d = day(k);
    const r = { kcal: 0, p: 0, c: 0, f: 0, ex: 0 };
    d.food.forEach(e => { r.kcal += e.kcal * e.q; r.p += e.p * e.q; r.c += e.c * e.q; r.f += e.f * e.q; });
    d.ex.forEach(e => { r.ex += e.kcal; });
    r.ex += stepKcal(d.steps || 0);
    return r;
  }

  /* ---------- Icons ---------- */
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    train: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-10-2.5 1.5-4 4-4 6-1-1-2-2-2-4-2 2-4 5-4 8 0 4.3 3 7 7 7z"/>',
    drop: '<path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    barcode: '<path d="M4 6v12M7 6v12M11 6v12M14 6v12M18 6v12M20 6v12"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    scale: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9a5 5 0 0 1 8 0l-3 3"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    pause: '<path d="M7 4v16M17 4v16"/>',
    skip: '<path d="M5 4v16l10-8zM19 4v16"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    walk: '<circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v3M7 12l3-4 4 1 2 4M11 15l-1-4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'
  };
  const ic = (n, cls = "") => '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[n] + "</svg>";

  /* ---------- Theme / lang ---------- */
  function applyChrome() {
    const r = document.documentElement;
    r.lang = lang();
    r.dir = lang() === "ckb" ? "rtl" : "ltr";
    if (S.theme === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", S.theme);
    document.title = t("appName");
  }

  /* ---------- Meals ---------- */
  function meals() {
    const d = day();
    if (S.ramadan) {
      const list = ["b", "d", "s"];
      if (d.food.some(e => e.m === "l")) list.splice(1, 0, "l");
      return list;
    }
    return ["b", "l", "d", "s"];
  }
  const mealName = m => t(S.ramadan ? { b: "suhoor", l: "lunch", d: "iftar", s: "snacks" }[m] : { b: "breakfast", l: "lunch", d: "dinner", s: "snacks" }[m]);
  function defaultMeal() {
    const h = new Date().getHours();
    if (S.ramadan) return h < 6 ? "b" : h >= 17 ? "d" : "s";
    return h < 11 ? "b" : h < 16 ? "l" : h < 21 ? "d" : "s";
  }

  /* ---------- Render: shell ---------- */
  const app = document.getElementById("app");
  function render() {
    applyChrome();
    if (!S.lang || !S.onboarded) { app.innerHTML = renderOnboarding(); return; }
    let body = "";
    if (view === "today") body = renderToday();
    else if (view === "train") body = renderTrain();
    else if (view === "progress") body = renderProgress();
    else body = renderMe();
    app.innerHTML = body + renderTabs();
  }
  function renderTabs() {
    const tab = (v, icon, label) => '<button class="tab' + (view === v ? " on" : "") + '" data-act="tab" data-v="' + v + '" aria-label="' + esc(label) + '">' + ic(icon) + "<span>" + esc(label) + "</span></button>";
    return '<nav class="tabs"><div class="in">' + tab("today", "home", t("tabToday")) + tab("train", "train", t("tabTrain")) +
      '<button class="fab" data-act="addMenu" aria-label="' + esc(t("add")) + '">' + ic("plus") + "</button>" +
      tab("progress", "chart", t("tabProgress")) + tab("me", "me", t("tabMe")) + "</div></nav>";
  }
  function header(title, extra = "") {
    return '<header class="top"><div class="wrap"><h1 class="display">' + esc(title) + "</h1>" + extra + "</div></header>";
  }

  /* ---------- Onboarding ---------- */
  let onbStep = 0;
  function renderOnboarding() {
    if (!S.lang || onbStep === 0) {
      return '<div class="wrap onb">' + logoImg() +
        '<h1 class="display">Xorak · خۆراک</h1>' +
        '<p class="muted" style="margin:0">Calories, workouts and fasting, made for Kurdish food.<br>کالۆری، ڕاهێنان و ڕۆژوو، بۆ خواردنی کوردی.</p>' +
        '<div class="stack"><button class="btn sun block" data-act="pickLang" data-l="ckb">کوردی (سۆرانی)</button>' +
        '<button class="btn ghost block" data-act="pickLang" data-l="en">English</button></div></div>';
    }
    return '<div class="wrap onb"><h1 class="display">' + esc(t("onbTitle")) + '</h1><p class="muted" style="margin:0">' + esc(t("onbSub")) + "</p>" +
      profileForm() +
      '<button class="btn sun block" data-act="finishOnb">' + esc(t("onbDone")) + "</button></div>";
  }
  function logoImg() {
    return '<svg class="logo" viewBox="0 0 72 72" aria-hidden="true"><rect width="72" height="72" rx="20" fill="var(--sun)"/><circle cx="36" cy="36" r="13" fill="#1b1300"/>' +
      Array.from({ length: 21 }, (_, i) => { const a = (i / 21) * Math.PI * 2; const x1 = 36 + Math.cos(a) * 17, y1 = 36 + Math.sin(a) * 17, x2 = 36 + Math.cos(a) * 25, y2 = 36 + Math.sin(a) * 25; return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#1b1300" stroke-width="3" stroke-linecap="round"/>'; }).join("") +
      "</svg>";
  }
  function profileForm() {
    const p = S.profile;
    const opt = (val, cur, label) => '<option value="' + val + '"' + (String(val) === String(cur) ? " selected" : "") + ">" + esc(label) + "</option>";
    const hFt = Math.floor(p.height / 2.54 / 12), hIn = Math.round(p.height / 2.54 - hFt * 12);
    return '<div class="stack">' +
      '<div class="seg" role="group">' + ["m", "f"].map(s => '<button data-act="pfSex" data-s="' + s + '" class="' + (p.sex === s ? "on" : "") + '">' + esc(t(s === "m" ? "male" : "female")) + "</button>").join("") + "</div>" +
      '<div class="seg" role="group">' + ["metric", "imperial"].map(u => '<button data-act="setUnits" data-u="' + u + '" class="' + (S.units === u ? "on" : "") + '">' + esc(t(u)) + "</button>").join("") + "</div>" +
      '<div class="grid2">' +
      '<label class="field"><span>' + esc(t("age")) + '</span><input class="input num" id="pf-age" inputmode="numeric" value="' + fmt(p.age) + '"></label>' +
      (imp()
        ? '<label class="field"><span>' + esc(t("height")) + " (ft / in)</span><div class=\"grid2\"><input class=\"input num\" id=\"pf-hft\" inputmode=\"numeric\" value=\"" + hFt + '"><input class="input num" id="pf-hin" inputmode="numeric" value="' + hIn + '"></div></label>'
        : '<label class="field"><span>' + esc(t("height")) + " (" + esc(t("cm")) + ')</span><input class="input num" id="pf-h" inputmode="decimal" value="' + fmt(p.height) + '"></label>') +
      '<label class="field"><span>' + esc(t("weight")) + " (" + esc(wUnit()) + ')</span><input class="input num" id="pf-w" inputmode="decimal" value="' + fmt(wShow(latestWeight()), 1) + '"></label>' +
      '<label class="field"><span>' + esc(t("goalWeight")) + " (" + esc(wUnit()) + ')</span><input class="input num" id="pf-gw" inputmode="decimal" value="' + fmt(wShow(p.goalWeight), 1) + '"></label>' +
      "</div>" +
      '<label class="field"><span>' + esc(t("activity")) + '</span><select class="input" id="pf-act">' + [0, 1, 2, 3, 4].map(i => opt(i, p.activity, t("act" + i))).join("") + "</select></label>" +
      '<label class="field"><span>' + esc(t("goal")) + '</span><select class="input" id="pf-goal">' + ["lose_fast", "lose", "lose_slow", "keep", "gain"].map(g => opt(g, p.goal, t("goal_" + g))).join("") + "</select></label>" +
      "</div>";
  }
  function readProfileForm() {
    const p = S.profile, g = id => document.getElementById(id);
    const age = num(g("pf-age") && g("pf-age").value);
    if (age > 10 && age < 110) p.age = Math.round(age);
    if (imp()) {
      const ft = num(g("pf-hft").value), inch = num(g("pf-hin").value) || 0;
      if (ft > 2) p.height = Math.round((ft * 12 + inch) * 2.54);
    } else {
      const h = num(g("pf-h").value);
      if (h > 100 && h < 250) p.height = h;
    }
    const w = wIn(num(g("pf-w").value));
    if (w > 25 && w < 350) {
      p.weight = w;
      const today = dk(), ex = S.weights.find(x => x.d === today);
      if (Math.abs(w - latestWeight()) > 0.05 || !S.weights.length) { if (ex) ex.kg = w; else S.weights.push({ d: today, kg: w }); }
    }
    const gw = wIn(num(g("pf-gw").value));
    if (gw > 25 && gw < 350) p.goalWeight = gw;
    p.activity = Number(g("pf-act").value);
    p.goal = g("pf-goal").value;
  }

  /* ---------- Today ---------- */
  function ring(pct, color, size = 150, stroke = 14) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
    return '<svg viewBox="0 0 ' + size + " " + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--card2)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + (c * p).toFixed(1) + " " + c.toFixed(1) + '"/></svg>';
  }
  function renderToday() {
    const tg = targets(), tt = totals(), d = day();
    const remaining = tg.kcal - tt.kcal + tt.ex;
    const over = remaining < 0;
    const nav = '<div class="datenav"><button class="iconbtn" data-act="day" data-n="-1" aria-label="' + esc(t("prevDay")) + '">' + ic("left", "flip") + "</button>" +
      (cur !== dk() ? '<button class="datelabel" data-act="goToday">' + esc(t("today")) + "</button>" : "") +
      '<button class="iconbtn" data-act="day" data-n="1" aria-label="' + esc(t("nextDay")) + '">' + ic("right", "flip") + "</button></div>";
    let h = header(dateLabel(cur), nav) + '<main><div class="wrap">';

    // install hint on iPhone Safari
    const standalone = window.navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
    if (!standalone && !S.installHidden && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      h += '<div class="notice" style="display:flex;gap:10px;align-items:flex-start"><div style="flex:1">' + esc(t("installHint")) + '</div><button class="iconbtn" style="width:30px;height:30px" data-act="hideInstall" aria-label="' + esc(t("close")) + '">' + ic("x") + "</button></div>";
    }

    // summary
    const macro = (k, label, color) => {
      const v = tt[k], g = tg[k];
      return '<div class="macro"><div class="n">' + esc(label) + '</div><div class="bar"><i style="width:' + Math.min(100, (v / g) * 100).toFixed(0) + "%;background:" + color + '"></i></div><div class="v num">' + fmt(v) + " / " + fmt(g) + " " + esc(t("g")) + "</div></div>";
    };
    h += '<section class="card"><div class="summary"><div class="ring">' + ring(tt.kcal / Math.max(1, tg.kcal + tt.ex), over ? "var(--pom)" : "var(--sun)") +
      '<div class="center"><div class="big num" style="color:' + (over ? "var(--pom)" : "inherit") + '">' + fmt(Math.abs(remaining)) + '</div><div class="cap">' + esc(over ? t("kcalOver") : t("kcalLeft")) + "</div></div></div>" +
      '<div class="eq">' +
      '<div class="eq-row"><span class="muted">' + esc(t("goalKcal")) + '</span><b class="num">' + fmt(tg.kcal) + "</b></div>" +
      '<div class="eq-row"><span class="muted"><i class="dot" style="background:var(--sun)"></i>' + esc(t("food")) + '</span><b class="num">' + fmt(tt.kcal) + "</b></div>" +
      '<div class="eq-row"><span class="muted"><i class="dot" style="background:var(--leaf)"></i>' + esc(t("exercise")) + '</span><b class="num">+' + fmt(tt.ex) + "</b></div>" +
      "</div></div>" +
      '<div class="macros">' + macro("p", t("protein"), "var(--protein)") + macro("c", t("carbs"), "var(--carbs)") + macro("f", t("fat"), "var(--fat)") + "</div></section>";

    // quick actions
    const qa = (act, icon, label, bg, fg) => '<button class="qa" data-act="' + act + '"><i style="background:' + bg + ";color:" + fg + '">' + ic(icon) + "</i>" + esc(label) + "</button>";
    h += '<div class="quick">' + qa("aiPhoto", "camera", t("scanMeal"), "var(--sun-soft)", "var(--sun)") + qa("foodSearch", "search", t("logFood"), "var(--card2)", "var(--fg)") +
      qa("exSheet", "flame", t("logExercise"), "var(--leaf-soft)", "var(--leaf)") + qa("fastSheet", "clock", t("fasting"), "var(--water-soft)", "var(--water)") + "</div>";

    // active fast
    if (S.fast.start) h += fastMini();

    // meals
    meals().forEach(m => {
      const items = d.food.filter(e => e.m === m);
      const kc = items.reduce((a, e) => a + e.kcal * e.q, 0);
      h += '<section class="card"><div class="meal-head"><h2>' + esc(mealName(m)) + '</h2><span class="meal-kcal num">' + (items.length ? fmt(kc) + " " + esc(t("kcal")) : "") + '</span><button class="addbtn" data-act="foodSearch" data-m="' + m + '" aria-label="' + esc(t("addTo", { meal: mealName(m) })) + '">+</button></div>';
      if (items.length) {
        h += '<div class="list">' + items.map(e => '<button class="row" data-act="entry" data-u="' + e.u + '"><div class="grow"><div class="t">' + esc(nm(e)) + '</div><div class="s num">' + esc(qtyLabel(e)) + " · " + esc(t("p")) + fmt(e.p * e.q) + " " + esc(t("c")) + fmt(e.c * e.q) + " " + esc(t("f")) + fmt(e.f * e.q) + '</div></div><div class="k num">' + fmt(e.kcal * e.q) + "</div></button>").join("") + "</div>";
      } else {
        const y = day(addDays(cur, -1)).food.filter(e => e.m === m);
        h += '<div class="empty">' + esc(t("emptyMeal")) + (y.length ? ' · <button class="chip" style="padding:4px 10px" data-act="copyMeal" data-m="' + m + '">' + esc(t("copyYesterday")) + "</button>" : "") + "</div>";
      }
      h += "</section>";
    });

    // exercise
    h += '<section class="card"><div class="meal-head"><h2>' + esc(t("exercise")) + '</h2><span class="meal-kcal num">' + (tt.ex ? fmt(tt.ex) + " " + esc(t("kcal")) : "") + '</span><button class="addbtn" style="background:var(--leaf-soft);color:var(--leaf)" data-act="exSheet" aria-label="' + esc(t("logExercise")) + '">+</button></div><div class="list">';
    d.ex.forEach(e => { h += '<button class="row" data-act="exEntry" data-u="' + e.u + '"><div class="grow"><div class="t">' + esc(nm(e)) + '</div><div class="s num">' + fmt(e.min) + " " + esc(t("min")) + '</div></div><div class="k num" style="color:var(--leaf)">+' + fmt(e.kcal) + "</div></button>"; });
    h += '<button class="row" data-act="stepsSheet"><span class="thumb" style="background:var(--leaf-soft);color:var(--leaf)">' + ic("walk") + '</span><div class="grow"><div class="t">' + esc(t("steps")) + '</div><div class="s num">' + (d.steps ? fmt(d.steps) + " · +" + fmt(stepKcal(d.steps)) + " " + esc(t("kcal")) : esc(t("tapToAddSteps"))) + "</div></div></button>";
    h += "</div></section>";

    // water
    const cups = d.water || 0, goal = tg.water;
    h += '<section class="card"><div class="card-head"><h2>' + esc(t("water")) + '</h2><span class="sub num">' + fmt(cups) + " / " + fmt(goal) + " " + esc(t("glasses")) + " · " + fmt(cups * 0.25, 2) + " " + esc(t("liters")) + '</span></div><div class="cups">';
    for (let i = 0; i < Math.max(goal, cups); i++) h += '<button class="cup' + (i < cups ? " on" : "") + '" data-act="water" data-n="' + (i < cups ? i : i + 1) + '" aria-label="' + esc(t("glass")) + " " + (i + 1) + '"></button>';
    h += '<button class="cup plus" data-act="water" data-n="' + (cups + 1) + '" aria-label="' + esc(t("addGlass")) + '">+</button></div></section>';

    h += "</div></main>";
    return h;
  }
  function qtyLabel(e) {
    const base = sv(e);
    return e.q === 1 ? base : fmt(e.q, 2) + " × " + base;
  }

  /* ---------- Train ---------- */
  function routineMinutes(r) { return (r.rounds * r.moves.length * (r.work + r.rest) - r.rest) / 60; }
  function renderTrain() {
    let h = header(t("tabTrain")) + '<main><div class="wrap">';
    h += fastCard();
    h += '<h2 style="margin:6px 4px 0;font-size:20px" class="display">' + esc(t("homeWorkouts")) + "</h2>";
    window.ROUTINES.forEach(r => {
      const min = routineMinutes(r);
      h += '<button class="card" style="border:0;text-align:start;display:flex;gap:14px;align-items:center;width:100%" data-act="routine" data-id="' + r.id + '">' +
        '<span class="thumb" style="width:52px;height:52px;background:var(--leaf-soft);color:var(--leaf)">' + ic(r.met >= 7 ? "bolt" : "train") + '</span><span class="grow" style="flex:1;min-width:0"><span class="t" style="display:block;font-weight:700;font-size:16px">' + esc(lang() === "ckb" ? r.ckb : r.en) + '</span><span class="s num muted small">' + fmt(min) + " " + esc(t("min")) + " · ~" + fmt(exKcal(r.met, min)) + " " + esc(t("kcal")) + " · " + fmt(r.moves.length) + " " + esc(t("moves")) + "</span></span>" + ic("right", "flip") + "</button>";
    });
    // recent exercise this week
    const week = []; for (let i = 6; i >= 0; i--) week.push(addDays(dk(), -i));
    let mins = 0, kc = 0, n = 0;
    week.forEach(k => day(k).ex.forEach(e => { mins += e.min || 0; kc += e.kcal; n++; }));
    h += '<section class="card"><div class="card-head"><h2>' + esc(t("thisWeek")) + '</h2></div><div class="tiles"><div class="tile"><b class="num">' + fmt(n) + "</b><span>" + esc(t("workouts")) + '</span></div><div class="tile"><b class="num">' + fmt(mins) + "</b><span>" + esc(t("minutes")) + '</span></div><div class="tile"><b class="num">' + fmt(kc) + "</b><span>" + esc(t("kcalBurned")) + "</span></div></div></section>";
    h += "</div></main>";
    return h;
  }

  /* ---------- Fasting ---------- */
  const FAST_PLANS = [12, 14, 16, 18, 20, 23];
  function fastState() {
    const f = S.fast;
    if (!f.start) return null;
    const el = Date.now() - f.start, goal = f.plan * 3600000;
    return { el, goal, pct: el / goal, end: f.start + goal, done: el >= goal };
  }
  const dur = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return kuNum(pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60)); };
  function fastMini() {
    const st = fastState();
    return '<button class="card" style="border:0;text-align:start;display:flex;gap:14px;align-items:center;width:100%" data-act="fastSheet"><span class="thumb" style="background:var(--water-soft);color:var(--water)">' + ic("clock") + '</span><span style="flex:1;min-width:0"><b>' + esc(t("fastingNow")) + ' </b><span class="muted small num" data-fast="pct">' + fmt(st.pct * 100) + '%</span><br><span class="num" data-fast="el">' + dur(st.el) + "</span></span></button>";
  }
  function fastCard() {
    const f = S.fast, st = fastState();
    let h = '<section class="card"><div class="card-head"><h2>' + esc(t("fasting")) + '</h2><span class="sub">' + esc(t("fastSub")) + "</span></div>";
    if (!st) {
      h += '<div class="chips" style="margin-bottom:12px">' + FAST_PLANS.map(p => '<button class="chip' + (f.plan === p ? " on" : "") + '" data-act="fastPlan" data-p="' + p + '">' + kuNum(p + ":" + (24 - p)) + "</button>").join("") + "</div>" +
        '<p class="muted small" style="margin:0 0 12px">' + esc(t("fastPlanDesc", { h: fmt(f.plan), e: fmt(24 - f.plan) })) + "</p>" +
        '<button class="btn block" style="background:var(--water);color:#fff" data-act="fastStart">' + esc(t("startFast")) + "</button>";
    } else {
      h += '<div class="summary"><div class="ring">' + ring(st.pct, st.done ? "var(--leaf)" : "var(--water)") + '<div class="center"><div class="big num" style="font-size:24px" data-fast="el">' + dur(st.el) + '</div><div class="cap num" data-fast="pct">' + fmt(st.pct * 100) + "%</div></div></div>" +
        '<div class="eq"><div class="eq-row"><span class="muted">' + esc(t("plan")) + '</span><b class="num">' + kuNum(f.plan + ":" + (24 - f.plan)) + '</b></div><div class="eq-row"><span class="muted">' + esc(t("started")) + '</span><b class="num">' + timeStr(f.start) + '</b></div><div class="eq-row"><span class="muted">' + esc(t("ends")) + '</span><b class="num">' + timeStr(st.end) + "</b></div>" +
        '<div class="eq-row"><span class="muted">' + esc(t("stage")) + '</span><b class="small" data-fast="stage">' + esc(fastStage(st.el)) + "</b></div></div></div>" +
        '<button class="btn block ' + (st.done ? "leaf" : "ghost") + '" style="margin-top:14px" data-act="fastEnd">' + esc(t("endFast")) + "</button>";
    }
    if (f.history.length) {
      h += '<div class="list" style="margin-top:10px">' + f.history.slice(-4).reverse().map(x => '<div class="row"><div class="grow"><div class="t num">' + esc(shortDate(dk(new Date(x.start)))) + " · " + dur(x.end - x.start).slice(0, -3) + '</div></div><div class="k" style="color:' + (x.end - x.start >= x.plan * 3600000 ? "var(--leaf)" : "var(--muted)") + '">' + esc(x.end - x.start >= x.plan * 3600000 ? t("goalMet") : kuNum(x.plan + ":" + (24 - x.plan))) + "</div></div>").join("") + "</div>";
    }
    return h + "</section>";
  }
  function fastStage(ms) {
    const hr = ms / 3600000;
    if (hr < 4) return t("stage0");
    if (hr < 12) return t("stage1");
    if (hr < 16) return t("stage2");
    if (hr < 18) return t("stage3");
    return t("stage4");
  }

  /* ---------- Progress ---------- */
  let calRange = 7;
  function renderProgress() {
    const tg = targets(), p = S.profile;
    let h = header(t("tabProgress")) + '<main><div class="wrap">';
    // weight
    const ws = S.weights.slice().sort((a, b) => (a.d < b.d ? -1 : 1));
    const curW = latestWeight(), startW = ws.length ? ws[0].kg : curW;
    const bmi = curW / Math.pow(p.height / 100, 2);
    const bmiCat = bmi < 18.5 ? "bmiUnder" : bmi < 25 ? "bmiNormal" : bmi < 30 ? "bmiOver" : "bmiObese";
    const toGo = curW - p.goalWeight;
    h += '<section class="card"><div class="card-head"><h2>' + esc(t("weight")) + '</h2><button class="chip" data-act="weightSheet">+ ' + esc(t("logWeight")) + "</button></div>" +
      '<div class="tiles"><div class="tile"><b class="num">' + fmt(wShow(curW), 1) + "</b><span>" + esc(t("current")) + " (" + esc(wUnit()) + ')</span></div><div class="tile"><b class="num">' + (curW - startW > 0 ? "+" : "") + fmt(wShow(curW) - wShow(startW), 1) + "</b><span>" + esc(t("change")) + '</span></div><div class="tile"><b class="num">' + fmt(wShow(Math.abs(toGo)), 1) + "</b><span>" + esc(Math.abs(toGo) < 0.1 ? t("atGoal") : t("toGoal")) + "</span></div></div>" +
      weightChart(ws) +
      '<p class="small muted" style="margin:10px 0 0">' + esc(t("bmi")) + ' <b class="num" style="color:var(--fg)">' + fmt(bmi, 1) + "</b> · " + esc(t(bmiCat)) + (goalDate(toGo, tg) ? " · " + esc(goalDate(toGo, tg)) : "") + "</p></section>";

    // calories
    const keys = []; for (let i = calRange - 1; i >= 0; i--) keys.push(addDays(dk(), -i));
    const logged = keys.filter(k => day(k).food.length);
    const avg = f => (logged.length ? logged.reduce((a, k) => a + totals(k)[f], 0) / logged.length : 0);
    h += '<section class="card"><div class="card-head"><h2>' + esc(t("calories")) + '</h2><div class="seg" style="width:140px">' + [7, 30].map(r => '<button class="' + (calRange === r ? "on" : "") + '" data-act="calRange" data-r="' + r + '">' + esc(t(r === 7 ? "week" : "month")) + "</button>").join("") + "</div></div>" +
      calChart(keys, tg.kcal) +
      '<div class="tiles" style="margin-top:12px"><div class="tile"><b class="num">' + fmt(avg("kcal")) + "</b><span>" + esc(t("avgKcal")) + '</span></div><div class="tile"><b class="num">' + fmt(avg("p")) + esc(t("g")) + "</b><span>" + esc(t("avgProtein")) + '</span></div><div class="tile"><b class="num">' + fmt(streak()) + "</b><span>" + esc(t("dayStreak")) + "</span></div></div></section>";

    // macro split
    const ap = avg("p") * 4, ac = avg("c") * 4, af = avg("f") * 9, tot = ap + ac + af || 1;
    h += '<section class="card"><div class="card-head"><h2>' + esc(t("macroSplit")) + '</h2><span class="sub">' + esc(t("avgOf", { n: fmt(logged.length) })) + "</span></div>" +
      '<div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--card2)"><i style="width:' + (ap / tot) * 100 + '%;background:var(--protein)"></i><i style="width:' + (ac / tot) * 100 + '%;background:var(--carbs)"></i><i style="width:' + (af / tot) * 100 + '%;background:var(--fat)"></i></div>' +
      '<div class="macros" style="margin-top:10px">' + [["protein", ap, "var(--protein)"], ["carbs", ac, "var(--carbs)"], ["fat", af, "var(--fat)"]].map(x => '<div class="small"><i class="dot" style="background:' + x[2] + '"></i>' + esc(t(x[0])) + ' <b class="num">' + fmt((x[1] / tot) * 100) + "%</b></div>").join("") + "</div></section>";

    // coach
    h += '<button class="card" style="border:0;text-align:start;display:flex;gap:14px;align-items:center;width:100%" data-act="coach"><span class="thumb" style="background:var(--sun-soft);color:var(--sun)">' + ic("chat") + '</span><span style="flex:1;min-width:0"><b>' + esc(t("coach")) + '</b><br><span class="muted small">' + esc(t("coachSub")) + "</span></span>" + ic("right", "flip") + "</button>";
    h += "</div></main>";
    return h;
  }
  function goalDate(toGo, tg) {
    if (Math.abs(toGo) < 0.5) return "";
    const deficit = tg.tdee - tg.kcal; // kcal/day
    if ((toGo > 0 && deficit <= 0) || (toGo < 0 && deficit >= 0)) return "";
    const days = Math.abs(toGo * 7700 / deficit);
    if (!isFinite(days) || days > 3 * 365) return "";
    return t("goalBy", { d: dateLabel(addDays(dk(), Math.round(days))) });
  }
  function streak() {
    let n = 0, k = dk();
    if (!day(k).food.length) k = addDays(k, -1);
    while (day(k).food.length) { n++; k = addDays(k, -1); }
    return n;
  }
  function weightChart(ws) {
    const pts = ws.slice(-60);
    if (pts.length < 2) return '<p class="empty" style="margin-top:12px">' + esc(t("weightEmpty")) + "</p>";
    const W = 340, H = 150, L = 34, R = 8, Tp = 10, B = 22;
    const vals = pts.map(x => wShow(x.kg)).concat([wShow(S.profile.goalWeight)]);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (mx - mn < 2) { mn -= 1; mx += 1; }
    const pad2 = (mx - mn) * 0.12; mn -= pad2; mx += pad2;
    const t0 = parseKey(pts[0].d).getTime(), t1 = parseKey(pts[pts.length - 1].d).getTime() || t0 + 1;
    const x = d => L + ((parseKey(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    const y = v => Tp + (1 - (v - mn) / (mx - mn)) * (H - Tp - B);
    const line = pts.map((p, i) => (i ? "L" : "M") + x(p.d).toFixed(1) + " " + y(wShow(p.kg)).toFixed(1)).join(" ");
    const area = line + " L" + x(pts[pts.length - 1].d).toFixed(1) + " " + (H - B) + " L" + L + " " + (H - B) + " Z";
    const gy = y(wShow(S.profile.goalWeight));
    let g = "";
    for (let i = 0; i <= 3; i++) { const v = mn + ((mx - mn) * i) / 3, yy = y(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end">' + fmt(v) + "</text>"; }
    const last = pts[pts.length - 1];
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" style="margin-top:12px" role="img" aria-label="' + esc(t("weight")) + '">' + g +
      '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" stroke="var(--leaf)" stroke-dasharray="4 4"/>' +
      '<path d="' + area + '" fill="var(--sun)" fill-opacity=".12"/><path d="' + line + '" fill="none" stroke="var(--sun)" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="' + x(last.d).toFixed(1) + '" cy="' + y(wShow(last.kg)).toFixed(1) + '" r="4.5" fill="var(--sun)" stroke="var(--card)" stroke-width="2"/>' +
      '<text x="' + L + '" y="' + (H - 6) + '">' + esc(shortDate(pts[0].d)) + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(shortDate(last.d)) + "</text></svg>";
  }
  function calChart(keys, goal) {
    const W = 340, H = 160, L = 34, R = 6, Tp = 10, B = 22;
    const vals = keys.map(k => totals(k).kcal);
    const mx = Math.max(goal * 1.25, ...vals);
    const bw = (W - L - R) / keys.length;
    const y = v => Tp + (1 - v / mx) * (H - Tp - B);
    let g = "";
    [0, goal / 2, goal].forEach(v => { g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="' + (v === goal ? "var(--leaf)" : "var(--line)") + '"' + (v === goal ? ' stroke-dasharray="4 4"' : "") + '/><text x="' + (L - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + fmt(v) + "</text>"; });
    keys.forEach((k, i) => {
      const v = vals[i], bx = L + i * bw + bw * 0.18, w = bw * 0.64;
      if (v > 0) g += '<rect x="' + bx.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (H - B - y(v)).toFixed(1) + '" rx="' + Math.min(4, w / 2).toFixed(1) + '" fill="' + (v > goal * 1.05 ? "var(--pom)" : "var(--sun)") + '"/>';
      const showLabel = keys.length <= 7 || i % 5 === 0 || i === keys.length - 1;
      if (showLabel) g += '<text x="' + (bx + w / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(keys.length <= 7 ? weekdayShort(k) : shortDate(k)) + "</text>";
    });
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("calories")) + '">' + g + "</svg>";
  }
  function weekdayShort(k) {
    const d = parseKey(k);
    if (lang() === "ckb") return ["یەک", "دوو", "سێ", "چوار", "پێنج", "هەینی", "شەممە"][d.getDay()];
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }

  /* ---------- Me / settings ---------- */
  function renderMe() {
    const tg = targets(), p = S.profile;
    const seg = (act, key, opts, curv) => '<div class="seg">' + opts.map(o => '<button data-act="' + act + '" data-' + key + '="' + o[0] + '" class="' + (curv === o[0] ? "on" : "") + '">' + esc(o[1]) + "</button>").join("") + "</div>";
    let h = header(t("tabMe")) + '<main><div class="wrap">';
    h += '<section class="card"><div class="card-head"><h2>' + esc(t("yourTargets")) + '</h2><button class="chip" data-act="editProfile">' + esc(t("edit")) + "</button></div>" +
      '<div class="tiles"><div class="tile"><b class="num">' + fmt(tg.kcal) + "</b><span>" + esc(t("kcalDay")) + '</span></div><div class="tile"><b class="num">' + fmt(tg.tdee) + "</b><span>" + esc(t("tdee")) + '</span></div><div class="tile"><b class="num">' + fmt(tg.bmr) + "</b><span>" + esc(t("bmr")) + "</span></div></div>" +
      '<div class="macros"><div class="small"><i class="dot" style="background:var(--protein)"></i>' + esc(t("protein")) + ' <b class="num">' + fmt(tg.p) + esc(t("g")) + '</b></div><div class="small"><i class="dot" style="background:var(--carbs)"></i>' + esc(t("carbs")) + ' <b class="num">' + fmt(tg.c) + esc(t("g")) + '</b></div><div class="small"><i class="dot" style="background:var(--fat)"></i>' + esc(t("fat")) + ' <b class="num">' + fmt(tg.f) + esc(t("g")) + "</b></div></div>" +
      '<p class="small muted" style="margin:12px 0 0">' + esc(t(p.sex === "m" ? "male" : "female")) + " · " + fmt(p.age) + " " + esc(t("years")) + " · " + esc(t("goal_" + p.goal)) + "</p></section>";

    h += '<section class="card stack"><h2>' + esc(t("plan")) + "</h2>" +
      '<div class="field"><span>' + esc(t("macroStyle")) + "</span>" + seg("setMacro", "m", [["bal", t("mBal")], ["pro", t("mPro")], ["low", t("mLow")], ["keto", t("mKeto")]], p.macro) + "</div>" +
      '<div class="grid2"><label class="field"><span>' + esc(t("customKcal")) + '</span><input class="input num" id="set-kcal" inputmode="numeric" placeholder="' + esc(t("auto")) + '" value="' + (p.kcalOverride ? fmt(p.kcalOverride) : "") + '"></label>' +
      '<label class="field"><span>' + esc(t("waterGoal")) + '</span><input class="input num" id="set-water" inputmode="numeric" value="' + fmt(p.water) + '"></label></div>' +
      '<label class="row" style="border:0;padding:4px 0"><div class="grow"><div class="t">' + esc(t("ramadan")) + '</div><div class="s" style="white-space:normal">' + esc(t("ramadanSub")) + '</div></div><input type="checkbox" id="set-ramadan" style="width:24px;height:24px;accent-color:var(--sun)"' + (S.ramadan ? " checked" : "") + "></label></section>";

    h += '<section class="card stack"><h2>' + esc(t("preferences")) + "</h2>" +
      '<div class="field"><span>' + esc(t("language")) + "</span>" + seg("setLang", "l", [["ckb", "کوردی"], ["en", "English"]], lang()) + "</div>" +
      '<div class="field"><span>' + esc(t("units")) + "</span>" + seg("setUnits", "u", [["metric", t("metric")], ["imperial", t("imperial")]], S.units) + "</div>" +
      '<div class="field"><span>' + esc(t("theme")) + "</span>" + seg("setTheme", "th", [["system", t("system")], ["light", t("light")], ["dark", t("dark")]], S.theme) + "</div></section>";

    h += '<section class="card stack"><div class="card-head" style="margin:0"><h2>' + esc(t("aiTitle")) + '</h2><span class="sub">' + esc(S.ai.key ? t("aiOn") : t("aiOff")) + "</span></div>" +
      '<p class="small muted" style="margin:0">' + esc(t("aiDesc")) + "</p>" +
      seg("setProvider", "pv", [["gemini", "Google Gemini"], ["claude", "Anthropic Claude"]], S.ai.provider) +
      '<label class="field"><span>' + esc(t("apiKey")) + '</span><input class="input" id="ai-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + esc(S.ai.provider === "gemini" ? "AIza…" : "sk-ant-…") + '" value="' + esc(S.ai.key) + '"></label>' +
      '<label class="field"><span>' + esc(t("model")) + '</span><input class="input" id="ai-model" autocapitalize="off" spellcheck="false" placeholder="' + esc(defaultModel()) + '" value="' + esc(S.ai.model) + '"></label>' +
      '<p class="small muted" style="margin:0">' + esc(S.ai.provider === "gemini" ? t("keyHelpGemini") : t("keyHelpClaude")) + ' <span class="num" style="user-select:all;color:var(--fg)">' + (S.ai.provider === "gemini" ? "aistudio.google.com/apikey" : "console.anthropic.com") + "</span></p>" +
      '<div class="btns"><button class="btn sun" data-act="saveAi">' + esc(t("save")) + '</button><button class="btn ghost" data-act="testAi">' + esc(t("test")) + '</button></div><div id="ai-status"></div></section>';

    h += '<section class="card stack"><h2>' + esc(t("backup")) + '</h2><p class="small muted" style="margin:0">' + esc(t("backupDesc")) + "</p>" +
      '<div class="btns"><button class="btn ghost" data-act="exportData">' + ic("copy") + esc(t("exportData")) + '</button><button class="btn ghost" data-act="importSheet">' + esc(t("importData")) + "</button></div>" +
      '<button class="btn danger block" data-act="reset">' + esc(t("resetAll")) + "</button></section>";

    h += '<p class="small muted" style="text-align:center;margin:4px 16px 0">' + esc(t("disclaimer")) + "<br>Xorak · خۆراک · v1.0</p>";
    h += "</div></main>";
    return h;
  }
  function saveSettingsInputs() {
    const k = document.getElementById("set-kcal"), w = document.getElementById("set-water"), r = document.getElementById("set-ramadan");
    if (k) { const v = num(k.value); S.profile.kcalOverride = v >= 800 && v <= 6000 ? Math.round(v) : 0; }
    if (w) { const v = num(w.value); if (v >= 1 && v <= 30) S.profile.water = Math.round(v); }
    if (r) S.ramadan = r.checked;
  }
  const defaultModel = () => (S.ai.provider === "gemini" ? "gemini-2.5-flash" : "claude-haiku-5-5");

  /* ---------- Sheets ---------- */
  let SH = null; // current sheet state
  const sheetEl = document.getElementById("sheet");
  function openSheet(state) { SH = state; renderSheet(); sheetEl.hidden = false; document.body.style.overflow = "hidden"; }
  function closeSheet() {
    if (SH && SH.type === "player") stopPlayer();
    SH = null; sheetEl.hidden = true; sheetEl.innerHTML = ""; document.body.style.overflow = ""; render();
  }
  function sheetTop(title) {
    return '<div class="grab"></div><div class="sheet-top"><h2 class="display">' + esc(title) + '</h2><button class="iconbtn" data-act="close" aria-label="' + esc(t("close")) + '">' + ic("x") + "</button></div>";
  }
  function renderSheet() {
    if (!SH) return;
    const fn = SHEETS[SH.type];
    const html = fn();
    sheetEl.innerHTML = '<div class="sheet-bg" data-act="close"></div><div class="sheet-panel' + (SH.full ? " full" : "") + '" role="dialog" aria-modal="true">' + html + "</div>";
    if (SH.focus) { const f = document.getElementById(SH.focus); if (f) { f.focus(); } SH.focus = null; }
  }

  const SHEETS = {};

  SHEETS.addMenu = () => {
    const item = (act, icon, label, sub, bg, fg) => '<button class="row" data-act="' + act + '"><span class="thumb" style="background:' + bg + ";color:" + fg + '">' + ic(icon) + '</span><div class="grow"><div class="t">' + esc(label) + '</div><div class="s">' + esc(sub) + "</div></div></button>";
    return sheetTop(t("add")) + '<div class="card"><div class="list">' +
      item("aiPhoto", "camera", t("scanMeal"), t("scanMealSub"), "var(--sun-soft)", "var(--sun)") +
      item("aiText", "spark", t("describeMeal"), t("describeMealSub"), "var(--sun-soft)", "var(--sun)") +
      item("foodSearch", "search", t("logFood"), t("logFoodSub"), "var(--card2)", "var(--fg)") +
      item("barcode", "barcode", t("barcode"), t("barcodeSub"), "var(--card2)", "var(--fg)") +
      item("quickAdd", "bolt", t("quickAdd"), t("quickAddSub"), "var(--card2)", "var(--fg)") +
      item("exSheet", "flame", t("logExercise"), t("logExerciseSub"), "var(--leaf-soft)", "var(--leaf)") +
      item("weightSheet", "scale", t("logWeight"), t("logWeightSub"), "var(--water-soft)", "var(--water)") +
      "</div></div>";
  };

  // Food search
  const CATS = ["all", "recent", "fav", "mine", "kurdish", "bread", "meat", "dairy", "fruit", "veg", "snack", "drink", "sweet", "basic"];
  const norm = s => String(s).toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/ة/g, "ە").replace(/[ً-ْ]/g, "");
  function foodResults() {
    const q = norm(SH.q || "").trim(), cat = SH.cat;
    let list;
    const all = Object.values(FOOD).concat(S.custom);
    if (cat === "recent") list = S.recent.map(getFood).filter(Boolean);
    else if (cat === "fav") list = S.fav.map(getFood).filter(Boolean);
    else if (cat === "mine") list = S.custom.slice().reverse();
    else if (cat === "all") list = q ? all : S.recent.map(getFood).filter(Boolean).concat(all.filter(f => !S.recent.includes(f.id)));
    else list = all.filter(f => f.cat === cat);
    if (q) list = list.filter(f => norm(f.en).includes(q) || norm(f.ckb || "").includes(q));
    return list.slice(0, 80);
  }
  function foodRows() {
    const list = foodResults();
    if (!list.length) {
      return '<div class="empty" style="padding:14px 0">' + esc(SH.cat === "fav" ? t("noFav") : SH.cat === "mine" ? t("noMine") : SH.cat === "recent" ? t("noRecent") : t("noResults")) + "</div>" +
        (SH.q ? '<button class="btn ghost block" data-act="customFood">' + esc(t("createNamed", { n: SH.q })) + "</button>" : "");
    }
    return list.map(f => '<button class="row" data-act="foodPick" data-id="' + esc(f.id) + '"><div class="grow"><div class="t">' + esc(nm(f)) + (S.fav.includes(f.id) ? ' <span style="color:var(--sun)">★</span>' : "") + '</div><div class="s">' + esc(sv(f)) + '</div></div><div class="k num">' + fmt(f.kcal) + " <small>" + esc(t("kcal")) + "</small></div></button>").join("");
  }
  SHEETS.food = () => {
    const mealSeg = '<div class="seg" style="margin-bottom:12px">' + meals().map(m => '<button data-act="pickMeal" data-m="' + m + '" class="' + (SH.m === m ? "on" : "") + '">' + esc(mealName(m)) + "</button>").join("") + "</div>";
    return sheetTop(t("logFood")) + mealSeg +
      '<div class="search">' + ic("search") + '<input class="input" id="food-q" type="search" autocomplete="off" placeholder="' + esc(t("searchFoods")) + '" value="' + esc(SH.q || "") + '"></div>' +
      '<div class="chips" style="margin:12px 0">' + CATS.map(c => '<button class="chip' + (SH.cat === c ? " on" : "") + '" data-act="foodCat" data-c="' + c + '">' + esc(t("cat_" + c)) + "</button>").join("") + "</div>" +
      '<div class="btns" style="margin-bottom:12px"><button class="btn ghost" data-act="aiPhoto">' + ic("camera") + esc(t("scan")) + '</button><button class="btn ghost" data-act="customFood">' + ic("pen") + esc(t("create")) + "</button></div>" +
      '<div class="card" style="padding-block:4px"><div class="list" id="food-list">' + foodRows() + "</div></div>";
  };
  SHEETS.foodDetail = () => {
    const f = getFood(SH.id), q = SH.qty;
    const isFav = S.fav.includes(f.id);
    return sheetTop(nm(f)) + '<div class="stack">' +
      '<p class="muted" style="margin:0">' + esc(sv(f)) + (lang() === "ckb" ? "" : f.ckb ? " · " + esc(f.ckb) : "") + "</p>" +
      '<div class="field"><span>' + esc(t("servings")) + '</span><div class="stepper"><button data-act="qty" data-d="-0.5" aria-label="−">−</button><input class="input num" id="qty" inputmode="decimal" value="' + fmt(q, 2) + '"><button data-act="qty" data-d="0.5" aria-label="+">+</button></div></div>' +
      '<div class="chips">' + [0.25, 0.5, 1, 1.5, 2, 3].map(v => '<button class="chip' + (q === v ? " on" : "") + '" data-act="qtySet" data-v="' + v + '">' + fmt(v, 2) + "×</button>").join("") + "</div>" +
      '<div class="card"><div class="tiles" style="grid-template-columns:repeat(4,1fr)"><div class="tile"><b class="num">' + fmt(f.kcal * q) + "</b><span>" + esc(t("kcal")) + '</span></div><div class="tile"><b class="num" style="color:var(--protein)">' + fmt(f.p * q, 1) + "</b><span>" + esc(t("protein")) + '</span></div><div class="tile"><b class="num" style="color:var(--carbs)">' + fmt(f.c * q, 1) + "</b><span>" + esc(t("carbs")) + '</span></div><div class="tile"><b class="num" style="color:var(--fat)">' + fmt(f.f * q, 1) + "</b><span>" + esc(t("fat")) + "</span></div></div></div>" +
      '<div class="seg">' + meals().map(m => '<button data-act="pickMeal" data-m="' + m + '" class="' + (SH.m === m ? "on" : "") + '">' + esc(mealName(m)) + "</button>").join("") + "</div>" +
      '<div class="btns"><button class="btn ghost" style="flex:0 0 56px" data-act="toggleFav" aria-label="' + esc(t("favorite")) + '">' + (isFav ? '<span style="color:var(--sun);font-size:22px">★</span>' : ic("star")) + '</button><button class="btn sun" data-act="addFood">' + esc(t("addTo", { meal: mealName(SH.m) })) + "</button></div>" +
      (f.id[0] === "c" && S.custom.includes(f) ? '<button class="btn danger block" data-act="delCustom">' + esc(t("deleteFood")) + "</button>" : "") +
      "</div>";
  };
  SHEETS.custom = () => sheetTop(SH.quick ? t("quickAdd") : t("createFood")) + '<div class="stack">' +
    '<label class="field"><span>' + esc(t("name")) + '</span><input class="input" id="cf-name" value="' + esc(SH.name || "") + '" placeholder="' + esc(SH.quick ? t("quickAdd") : t("namePh")) + '"></label>' +
    (SH.quick ? "" : '<label class="field"><span>' + esc(t("serving")) + '</span><input class="input" id="cf-sv" placeholder="' + esc(t("servingPh")) + '"></label>') +
    '<label class="field"><span>' + esc(t("kcal")) + '</span><input class="input num" id="cf-kcal" inputmode="decimal"></label>' +
    '<div class="grid2" style="grid-template-columns:repeat(3,1fr)"><label class="field"><span>' + esc(t("protein")) + " (" + esc(t("g")) + ')</span><input class="input num" id="cf-p" inputmode="decimal"></label><label class="field"><span>' + esc(t("carbs")) + " (" + esc(t("g")) + ')</span><input class="input num" id="cf-c" inputmode="decimal"></label><label class="field"><span>' + esc(t("fat")) + " (" + esc(t("g")) + ')</span><input class="input num" id="cf-f" inputmode="decimal"></label></div>' +
    '<div class="seg">' + meals().map(m => '<button data-act="pickMeal" data-m="' + m + '" class="' + (SH.m === m ? "on" : "") + '">' + esc(mealName(m)) + "</button>").join("") + "</div>" +
    (SH.quick ? "" : '<label class="row" style="border:0"><div class="grow"><div class="t">' + esc(t("saveToMine")) + '</div></div><input type="checkbox" id="cf-save" checked style="width:24px;height:24px;accent-color:var(--sun)"></label>') +
    '<div id="cf-err"></div><button class="btn sun block" data-act="saveCustom">' + esc(t("addTo", { meal: mealName(SH.m) })) + "</button></div>";

  SHEETS.entry = () => {
    const e = day().food.find(x => x.u === SH.u);
    if (!e) return sheetTop("") + "";
    const q = SH.qty;
    return sheetTop(nm(e)) + '<div class="stack"><p class="muted" style="margin:0">' + esc(sv(e)) + "</p>" +
      '<div class="field"><span>' + esc(t("servings")) + '</span><div class="stepper"><button data-act="qty" data-d="-0.5">−</button><input class="input num" id="qty" inputmode="decimal" value="' + fmt(q, 2) + '"><button data-act="qty" data-d="0.5">+</button></div></div>' +
      '<div class="card"><div class="tiles" style="grid-template-columns:repeat(4,1fr)"><div class="tile"><b class="num">' + fmt(e.kcal * q) + "</b><span>" + esc(t("kcal")) + '</span></div><div class="tile"><b class="num">' + fmt(e.p * q, 1) + "</b><span>" + esc(t("protein")) + '</span></div><div class="tile"><b class="num">' + fmt(e.c * q, 1) + "</b><span>" + esc(t("carbs")) + '</span></div><div class="tile"><b class="num">' + fmt(e.f * q, 1) + "</b><span>" + esc(t("fat")) + "</span></div></div></div>" +
      '<div class="seg">' + meals().map(m => '<button data-act="pickMeal" data-m="' + m + '" class="' + (SH.m === m ? "on" : "") + '">' + esc(mealName(m)) + "</button>").join("") + "</div>" +
      '<div class="btns"><button class="btn danger" data-act="delEntry">' + ic("trash") + esc(t("remove")) + '</button><button class="btn sun" data-act="saveEntry">' + esc(t("save")) + "</button></div></div>";
  };

  // Exercise
  SHEETS.ex = () => {
    const q = norm(SH.q || "");
    const list = ACT.filter(a => !q || norm(a.en).includes(q) || norm(a.ckb).includes(q));
    if (SH.pick) {
      const a = ACT.find(x => x.id === SH.pick);
      return sheetTop(nm(a)) + '<div class="stack"><div class="field"><span>' + esc(t("minutes")) + '</span><div class="stepper"><button data-act="exMin" data-d="-5">−</button><input class="input num" id="ex-min" inputmode="numeric" value="' + fmt(SH.min) + '"><button data-act="exMin" data-d="5">+</button></div></div>' +
        '<div class="chips">' + [10, 20, 30, 45, 60, 90].map(v => '<button class="chip' + (SH.min === v ? " on" : "") + '" data-act="exMinSet" data-v="' + v + '">' + fmt(v) + " " + esc(t("min")) + "</button>").join("") + "</div>" +
        '<div class="card" style="text-align:center"><div class="big num" style="font-size:40px;font-weight:700;color:var(--leaf)">' + fmt(exKcal(a.met, SH.min)) + '</div><div class="muted small">' + esc(t("kcalBurnedEst")) + "</div></div>" +
        '<div class="btns"><button class="btn ghost" data-act="exBack">' + esc(t("back")) + '</button><button class="btn leaf" data-act="exAdd">' + esc(t("add")) + "</button></div></div>";
    }
    return sheetTop(t("logExercise")) + '<div class="search" style="margin-bottom:12px">' + ic("search") + '<input class="input" id="ex-q" type="search" autocomplete="off" placeholder="' + esc(t("searchActivities")) + '" value="' + esc(SH.q || "") + '"></div>' +
      '<div class="card" style="padding-block:4px"><div class="list">' + list.map(a => '<button class="row" data-act="exPick" data-id="' + a.id + '"><div class="grow"><div class="t">' + esc(nm(a)) + '</div><div class="s num">~' + fmt(exKcal(a.met, 30)) + " " + esc(t("kcal")) + " / " + fmt(30) + " " + esc(t("min")) + "</div></div>" + ic("right", "flip") + "</button>").join("") + "</div></div>" +
      '<h2 style="font-size:17px;margin:16px 4px 8px">' + esc(t("customExercise")) + '</h2><div class="card stack"><div class="grid2"><label class="field"><span>' + esc(t("name")) + '</span><input class="input" id="cx-name"></label><label class="field"><span>' + esc(t("kcal")) + '</span><input class="input num" id="cx-kcal" inputmode="numeric"></label></div><label class="field"><span>' + esc(t("minutes")) + '</span><input class="input num" id="cx-min" inputmode="numeric"></label><button class="btn leaf block" data-act="cxAdd">' + esc(t("add")) + "</button></div>";
  };
  SHEETS.exEntry = () => {
    const e = day().ex.find(x => x.u === SH.u);
    return sheetTop(e ? nm(e) : "") + (e ? '<div class="stack"><div class="card" style="text-align:center"><div class="big num" style="font-size:40px;font-weight:700;color:var(--leaf)">+' + fmt(e.kcal) + '</div><div class="muted small num">' + fmt(e.min) + " " + esc(t("min")) + '</div></div><button class="btn danger block" data-act="delEx">' + ic("trash") + esc(t("remove")) + "</button></div>" : "");
  };
  SHEETS.steps = () => sheetTop(t("steps")) + '<div class="stack"><p class="muted small" style="margin:0">' + esc(t("stepsDesc")) + '</p><label class="field"><span>' + esc(t("stepsToday")) + '</span><input class="input num" id="steps-in" inputmode="numeric" value="' + (day().steps ? fmt(day().steps) : "") + '"></label><button class="btn leaf block" data-act="saveSteps">' + esc(t("save")) + "</button></div>";

  SHEETS.weight = () => {
    const ex = S.weights.find(w => w.d === cur);
    const list = S.weights.slice().sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 8);
    return sheetTop(t("logWeight")) + '<div class="stack"><label class="field"><span>' + esc(dateLabel(cur)) + " (" + esc(wUnit()) + ')</span><input class="input num" id="w-in" inputmode="decimal" value="' + fmt(wShow(ex ? ex.kg : latestWeight()), 1) + '" style="font-size:28px;text-align:center;font-weight:700"></label><button class="btn block" style="background:var(--water);color:#fff" data-act="saveWeight">' + esc(t("save")) + "</button>" +
      (list.length ? '<div class="card" style="padding-block:4px"><div class="list">' + list.map(w => '<div class="row"><div class="grow"><div class="t">' + esc(dateLabel(w.d)) + '</div></div><div class="k num">' + fmt(wShow(w.kg), 1) + " " + esc(wUnit()) + '</div><button class="iconbtn" style="width:32px;height:32px;box-shadow:none" data-act="delWeight" data-d="' + w.d + '" aria-label="' + esc(t("remove")) + '">' + ic("trash") + "</button></div>").join("") + "</div></div>" : "") + "</div>";
  };
  SHEETS.water = () => "";

  SHEETS.fast = () => sheetTop(t("fasting")) + fastCard();

  SHEETS.profile = () => sheetTop(t("editProfile")) + profileForm() + '<button class="btn sun block" style="margin-top:16px" data-act="saveProfile">' + esc(t("save")) + "</button>";

  SHEETS.importData = () => sheetTop(t("importData")) + '<div class="stack"><p class="small muted" style="margin:0">' + esc(t("importDesc")) + '</p><textarea class="input" id="imp-text" spellcheck="false" placeholder="{ … }"></textarea><label class="field"><span>' + esc(t("orFile")) + '</span><input type="file" id="imp-file" accept="application/json,.json,.txt"></label><div id="imp-err"></div><button class="btn sun block" data-act="doImport">' + esc(SH.confirm ? t("tapAgainReplace") : t("restore")) + "</button></div>";
  SHEETS.exportData = () => sheetTop(t("exportData")) + '<div class="stack"><p class="small muted" style="margin:0">' + esc(t("exportDesc")) + '</p><textarea class="input num" id="exp-text" readonly style="min-height:160px;font-size:12px">' + esc(JSON.stringify(S)) + '</textarea><div class="btns"><button class="btn sun" data-act="copyExport">' + ic("copy") + esc(t("copy")) + '</button><button class="btn ghost" data-act="downloadExport">' + esc(t("saveFile")) + "</button></div></div>";

  // Routines & player
  SHEETS.routine = () => {
    const r = window.ROUTINES.find(x => x.id === SH.id), min = routineMinutes(r);
    return sheetTop(lang() === "ckb" ? r.ckb : r.en) + '<div class="stack"><div class="tiles"><div class="tile"><b class="num">' + fmt(min) + "</b><span>" + esc(t("minutes")) + '</span></div><div class="tile"><b class="num">' + fmt(r.rounds) + "</b><span>" + esc(t("rounds")) + '</span></div><div class="tile"><b class="num">~' + fmt(exKcal(r.met, min)) + "</b><span>" + esc(t("kcal")) + "</span></div></div>" +
      '<div class="card" style="padding-block:4px"><div class="list">' + r.moves.map((m, i) => '<div class="row"><span class="thumb num" style="background:var(--card2)">' + fmt(i + 1) + '</span><div class="grow"><div class="t">' + esc(moveName(m)) + '</div><div class="s num">' + fmt(r.work) + " " + esc(t("sec")) + "</div></div></div>").join("") + "</div></div>" +
      '<p class="small muted" style="margin:0">' + esc(t("routineNote", { w: fmt(r.work), r: fmt(r.rest) })) + '</p><button class="btn leaf block" data-act="startRoutine">' + ic("play") + esc(t("start")) + "</button></div>";
  };
  const moveName = k => (window.MOVES[k] ? window.MOVES[k][lang() === "ckb" ? 1 : 0] : k);
  let PL = null;
  SHEETS.player = () => {
    if (!PL) return "";
    const r = PL.r;
    if (PL.done) {
      const min = PL.workSec / 60;
      return sheetTop(t("greatJob")) + '<div class="player"><div class="time num" style="color:var(--leaf)">' + fmt(exKcal(r.met, min)) + '</div><div class="muted">' + esc(t("kcalBurnedEst")) + " · " + fmt(min, 1) + " " + esc(t("min")) + '</div><button class="btn leaf block" data-act="saveRoutine">' + esc(t("saveToDiary")) + '</button><button class="btn ghost block" data-act="close">' + esc(t("close")) + "</button></div>";
    }
    const st = PL.steps[PL.i], next = PL.steps.slice(PL.i + 1).find(s => !s.rest);
    const phase = st.k === "ready" ? t("getReady") : st.rest ? t("rest") : t("go");
    const color = st.rest ? "var(--water)" : "var(--leaf)";
    return sheetTop(lang() === "ckb" ? r.ckb : r.en) + '<div class="player">' +
      '<div class="progressbar"><i style="width:' + ((PL.i / PL.steps.length) * 100).toFixed(1) + '%"></i></div>' +
      '<span class="phase" style="background:color-mix(in srgb, ' + color + ' 18%, transparent);color:' + color + '">' + esc(phase) + (st.round ? " · " + esc(t("roundN", { n: fmt(st.round), t: fmt(r.rounds) })) : "") + "</span>" +
      '<div class="ex">' + esc(st.rest ? (next ? t("nextUp") + ": " + moveName(next.k) : t("almostDone")) : moveName(st.k)) + "</div>" +
      '<div class="time num" id="pl-time" style="color:' + color + '">' + fmt(PL.left) + "</div>" +
      '<div class="btns" style="width:100%"><button class="btn ghost" data-act="plPause">' + ic(PL.paused ? "play" : "pause") + esc(PL.paused ? t("resume") : t("pause")) + '</button><button class="btn ghost" data-act="plSkip">' + ic("skip", "flip") + esc(t("skip")) + "</button></div>" +
      '<button class="btn danger block" data-act="plFinish">' + esc(t("finishNow")) + "</button></div>";
  };
  let audioCtx = null;
  function beep(f = 880, d = 0.12) {
    try {
      if (!audioCtx) return;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.15, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
      o.start(); o.stop(audioCtx.currentTime + d);
    } catch (e) { /* no audio */ }
  }
  let wakeLock = null;
  function startPlayer(r) {
    const steps = [{ k: "ready", sec: 5, rest: true }];
    for (let i = 1; i <= r.rounds; i++) r.moves.forEach((m, j) => {
      steps.push({ k: m, sec: r.work, round: i });
      if (!(i === r.rounds && j === r.moves.length - 1)) steps.push({ k: "rest", sec: r.rest, rest: true, round: i });
    });
    PL = { r, steps, i: 0, left: steps[0].sec, paused: false, workSec: 0, done: false };
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { audioCtx = null; }
    try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(l => { wakeLock = l; }).catch(() => {}); } catch (e) { /* ignore */ }
    openSheet({ type: "player", full: true });
  }
  function stopPlayer() { PL = null; try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }
  function playerTick() {
    if (!PL || PL.paused || PL.done) return;
    const st = PL.steps[PL.i];
    PL.left--;
    if (!st.rest) PL.workSec++;
    if (PL.left <= 3 && PL.left > 0) beep(660, 0.08);
    if (PL.left <= 0) {
      PL.i++;
      if (PL.i >= PL.steps.length) { PL.done = true; beep(990, 0.4); renderSheet(); return; }
      PL.left = PL.steps[PL.i].sec; beep(PL.steps[PL.i].rest ? 520 : 990, 0.2);
      renderSheet(); return;
    }
    const el = document.getElementById("pl-time"); if (el) el.textContent = fmt(PL.left);
  }

  // AI
  SHEETS.aiPhoto = () => {
    if (!S.ai.key) return sheetTop(t("scanMeal")) + aiNeedKey();
    let h = sheetTop(SH.mode === "text" ? t("describeMeal") : t("scanMeal")) + '<div class="stack">';
    if (!SH.items) {
      if (SH.mode === "text") {
        h += '<p class="muted small" style="margin:0">' + esc(t("describeHelp")) + '</p><textarea class="input" id="ai-desc" placeholder="' + esc(t("describePh")) + '">' + esc(SH.desc || "") + "</textarea>";
      } else {
        h += (SH.img ? '<img class="photo-prev" src="' + SH.img + '" alt="">' : '<p class="muted small" style="margin:0">' + esc(t("scanHelp")) + "</p>") +
          '<div class="btns"><label class="btn ghost">' + ic("camera") + esc(t("takePhoto")) + '<input type="file" accept="image/*" capture="environment" id="ai-cam" hidden></label><label class="btn ghost">' + esc(t("fromLibrary")) + '<input type="file" accept="image/*" id="ai-lib" hidden></label></div>' +
          '<input class="input" id="ai-hint" placeholder="' + esc(t("hintPh")) + '" value="' + esc(SH.hint || "") + '">';
      }
      h += (SH.err ? '<div class="notice err">' + esc(SH.err) + "</div>" : "") +
        '<button class="btn sun block" data-act="aiRun"' + (SH.busy || (SH.mode !== "text" && !SH.img) ? " disabled" : "") + ">" + (SH.busy ? '<span class="spinner"></span>' + esc(t("analyzing")) : ic("spark") + esc(t("analyze"))) + "</button>";
    } else {
      if (SH.img) h += '<img class="photo-prev" src="' + SH.img + '" alt="" style="max-height:160px">';
      h += '<div class="card" style="padding-block:4px"><div class="list">' + SH.items.map((it, i) =>
        '<div class="row"><input type="checkbox" data-ai-i="' + i + '"' + (it.on ? " checked" : "") + ' style="width:22px;height:22px;accent-color:var(--sun)" aria-label="' + esc(t("include")) + '"><div class="grow"><div class="t" style="white-space:normal">' + esc(nm(it)) + '</div><div class="s num">' + esc(it.sen) + " · " + esc(t("p")) + fmt(it.p * it.q) + " " + esc(t("c")) + fmt(it.c * it.q) + " " + esc(t("f")) + fmt(it.f * it.q) + '</div></div><div class="stepper" style="gap:4px"><button style="width:30px;height:30px;font-size:16px" data-act="aiQty" data-i="' + i + '" data-d="-0.25">−</button><b class="num" style="min-width:56px;text-align:center">' + fmt(it.kcal * it.q) + '</b><button style="width:30px;height:30px;font-size:16px" data-act="aiQty" data-i="' + i + '" data-d="0.25">+</button></div></div>').join("") + "</div></div>";
      if (SH.note) h += '<div class="notice ok small">' + esc(SH.note) + "</div>";
      const tot = SH.items.filter(i => i.on).reduce((a, i) => a + i.kcal * i.q, 0);
      h += '<div class="seg">' + meals().map(m => '<button data-act="pickMeal" data-m="' + m + '" class="' + (SH.m === m ? "on" : "") + '">' + esc(mealName(m)) + "</button>").join("") + "</div>" +
        '<p class="small muted" style="margin:0">' + esc(t("aiCheck")) + "</p>" +
        '<div class="btns"><button class="btn ghost" data-act="aiRetry">' + esc(t("retry")) + '</button><button class="btn sun" data-act="aiAdd">' + esc(t("addKcal", { n: fmt(tot) })) + "</button></div>";
    }
    return h + "</div>";
  };
  function aiNeedKey() {
    return '<div class="stack"><div class="notice">' + esc(t("aiNeedKey")) + '</div><button class="btn sun block" data-act="goAiSettings">' + esc(t("setUpAi")) + "</button></div>";
  }
  SHEETS.coach = () => {
    if (!S.ai.key) return sheetTop(t("coach")) + aiNeedKey();
    const msgs = S.chat.slice(-30);
    return sheetTop(t("coach")) + '<div class="chat" id="chat">' +
      (msgs.length ? "" : '<div class="msg ai">' + esc(t("coachHello")) + "</div>" +
        '<div class="chips" style="flex-wrap:wrap">' + ["q1", "q2", "q3", "q4"].map(q => '<button class="chip" data-act="coachAsk" data-q="' + esc(t(q)) + '">' + esc(t(q)) + "</button>").join("") + "</div>") +
      msgs.map(m => '<div class="msg ' + (m.r === "me" ? "me" : "ai") + '">' + esc(m.t) + "</div>").join("") +
      (SH.busy ? '<div class="msg ai"><span class="spinner" style="display:inline-block;width:16px;height:16px;border-width:2px"></span></div>' : "") +
      (SH.err ? '<div class="notice err small">' + esc(SH.err) + "</div>" : "") +
      '</div><div style="display:flex;gap:8px;margin-top:14px;position:sticky;bottom:0;background:var(--bg);padding-top:8px"><input class="input" id="coach-in" placeholder="' + esc(t("askAnything")) + '" autocomplete="off"><button class="btn sun" data-act="coachSend" style="flex:none"' + (SH.busy ? " disabled" : "") + ">" + esc(t("send")) + "</button></div>" +
      (msgs.length ? '<button class="btn ghost block" style="margin-top:10px" data-act="coachClear">' + esc(t("clearChat")) + "</button>" : "");
  };

  SHEETS.barcode = () => {
    let h = sheetTop(t("barcode")) + '<div class="stack"><p class="small muted" style="margin:0">' + esc(t("barcodeHelp")) + '</p><input class="input num" id="bc-in" inputmode="numeric" placeholder="6281006…" value="' + esc(SH.code || "") + '">' +
      '<button class="btn sun block" data-act="bcLookup"' + (SH.busy ? " disabled" : "") + ">" + (SH.busy ? '<span class="spinner"></span>' : "") + esc(t("lookUp")) + "</button>";
    if (SH.err) h += '<div class="notice err">' + esc(SH.err) + "</div>";
    if (SH.prod) {
      const p = SH.prod, g = SH.grams;
      h += '<div class="card stack"><div><b>' + esc(p.name) + '</b><div class="small muted">' + esc(t("per100", { k: fmt(p.kcal) })) + '</div></div><label class="field"><span>' + esc(t("grams")) + '</span><input class="input num" id="bc-g" inputmode="decimal" value="' + fmt(g) + '"></label>' +
        '<div class="tiles" style="grid-template-columns:repeat(4,1fr)"><div class="tile"><b class="num">' + fmt(p.kcal * g / 100) + "</b><span>" + esc(t("kcal")) + '</span></div><div class="tile"><b class="num">' + fmt(p.p * g / 100, 1) + "</b><span>" + esc(t("protein")) + '</span></div><div class="tile"><b class="num">' + fmt(p.c * g / 100, 1) + "</b><span>" + esc(t("carbs")) + '</span></div><div class="tile"><b class="num">' + fmt(p.f * g / 100, 1) + "</b><span>" + esc(t("fat")) + "</span></div></div>" +
        '<div class="seg">' + meals().map(m => '<button data-act="pickMeal" data-m="' + m + '" class="' + (SH.m === m ? "on" : "") + '">' + esc(mealName(m)) + "</button>").join("") + "</div>" +
        '<button class="btn sun block" data-act="bcAdd">' + esc(t("addTo", { meal: mealName(SH.m) })) + "</button></div>";
    }
    return h + "</div>";
  };

  /* ---------- AI calls ---------- */
  async function callAI({ system, messages, json }) {
    const key = S.ai.key.trim(), model = (S.ai.model || defaultModel()).trim();
    if (S.ai.provider === "gemini") {
      const contents = messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: m.parts.map(p => (p.image ? { inline_data: { mime_type: "image/jpeg", data: p.image } } : { text: p.text })) }));
      const body = { contents, generationConfig: { temperature: 0.4 } };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      if (json) body.generationConfig.responseMimeType = "application/json";
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j.error && j.error.message) || "HTTP " + res.status);
      const parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
      if (!parts) throw new Error(t("aiEmpty"));
      return parts.map(p => p.text || "").join("");
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({
        model, max_tokens: 1500, system: system || undefined,
        messages: messages.map(m => ({ role: m.role, content: m.parts.map(p => (p.image ? { type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.image } } : { type: "text", text: p.text })) }))
      })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((j.error && j.error.message) || "HTTP " + res.status);
    return (j.content || []).map(c => c.text || "").join("");
  }
  function parseJSON(s) {
    const m = s.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : s);
  }
  const FOOD_PROMPT = "You are a nutrition expert with deep knowledge of Kurdish, Iraqi and Middle Eastern home cooking (dolma, yaprax, qima, tashreeb, biryani, kubba, shifta, kebab, tikka, savar/bulgur, shla, fasolia, bamya, tapsi, kalana, kade, tanuri and samoon bread, dew, mast, kleicha, baklava) as well as international food. " +
    "Identify every food and drink in the user's photo or description, estimate the portion size realistically (home portions are often generous and cooked with oil), and estimate the nutrition for the portion shown. If the image is a nutrition label, read it and return one serving. " +
    'Reply with JSON only, in this shape: {"items":[{"en":"English name","ckb":"name in Sorani Kurdish (Arabic script)","portion":"portion in English, e.g. 1 plate, 300 g","grams":300,"kcal":420,"protein":9,"carbs":54,"fat":19}],"note":"one short helpful sentence"}. ' +
    "Numbers are for the whole portion. If you cannot see any food, return an empty items list and explain in note.";
  async function imageToBase64(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      const max = 1024, s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.82);
    } finally { URL.revokeObjectURL(url); }
  }
  async function runFoodAI() {
    SH.busy = true; SH.err = ""; renderSheet();
    try {
      const parts = [];
      if (SH.mode === "text") parts.push({ text: "Meal description: " + SH.desc });
      else { parts.push({ image: SH.img.split(",")[1] }); parts.push({ text: SH.hint ? "Extra info from the user: " + SH.hint : "Analyze this meal." }); }
      parts.push({ text: "Write the note in " + (lang() === "ckb" ? "Sorani Kurdish" : "English") + "." });
      const out = parseJSON(await callAI({ system: FOOD_PROMPT, messages: [{ role: "user", parts }], json: true }));
      const items = (out.items || []).map(i => ({ id: "ai", en: String(i.en || i.name || "Food"), ckb: String(i.ckb || ""), sen: String(i.portion || (i.grams ? i.grams + " g" : "")), sckb: "", kcal: +i.kcal || 0, p: +i.protein || 0, c: +i.carbs || 0, f: +i.fat || 0, q: 1, on: true }));
      if (!items.length) { SH.err = out.note || t("aiNoFood"); } else { SH.items = items; SH.note = out.note || ""; }
    } catch (e) { SH.err = t("aiError") + " " + e.message; }
    SH.busy = false;
    if (SH) renderSheet();
  }
  function coachContext() {
    const tg = targets(), tt = totals(dk()), p = S.profile;
    const foods = day(dk()).food.map(e => nm(e) + " (" + Math.round(e.kcal * e.q) + " kcal)").join(", ") || "nothing yet";
    return "You are Xorak's friendly fitness and nutrition coach. You know Kurdish and Iraqi food and culture well (and Ramadan fasting). Be practical, encouraging and brief (under 150 words unless asked for a plan). Never give medical diagnoses; suggest seeing a doctor for medical issues. " +
      "Always reply in " + (lang() === "ckb" ? "Sorani Kurdish (Arabic script)" : "English") + ". " +
      "User: " + (p.sex === "f" ? "female" : "male") + ", " + p.age + " years, " + p.height + " cm, " + latestWeight().toFixed(1) + " kg, goal weight " + p.goalWeight.toFixed(1) + " kg, goal: " + p.goal + ". " +
      "Daily target " + tg.kcal + " kcal, protein " + Math.round(tg.p) + " g, carbs " + Math.round(tg.c) + " g, fat " + Math.round(tg.f) + " g. " +
      "Today so far: " + Math.round(tt.kcal) + " kcal eaten (" + foods + "), protein " + Math.round(tt.p) + " g, exercise " + Math.round(tt.ex) + " kcal, water " + (day(dk()).water || 0) + " glasses." +
      (S.ramadan ? " The user is fasting for Ramadan." : "");
  }
  async function coachSend(text) {
    if (!text.trim() || SH.busy) return;
    S.chat.push({ r: "me", t: text.trim() }); save();
    SH.busy = true; SH.err = ""; renderSheet(); scrollChat();
    try {
      const hist = S.chat.slice(-12).map(m => ({ role: m.r === "me" ? "user" : "assistant", parts: [{ text: m.t }] }));
      const out = await callAI({ system: coachContext(), messages: hist });
      S.chat.push({ r: "ai", t: out.trim() }); save();
    } catch (e) { SH.err = t("aiError") + " " + e.message; }
    if (SH) { SH.busy = false; renderSheet(); scrollChat(); }
  }
  function scrollChat() { const p = sheetEl.querySelector(".sheet-panel"); if (p) p.scrollTop = p.scrollHeight; }

  /* ---------- Actions ---------- */
  function toast(msg) {
    const old = document.querySelector(".toast"); if (old) old.remove();
    const d = document.createElement("div"); d.className = "toast"; d.textContent = msg; document.body.appendChild(d);
    setTimeout(() => d.remove(), 2200);
  }
  function pushRecent(id) { S.recent = [id].concat(S.recent.filter(x => x !== id)).slice(0, 30); }
  function addEntry(f, q, m) {
    day(cur, true).food.push({ u: uid(), id: f.id, en: f.en, ckb: f.ckb || "", sen: f.sen || "", sckb: f.sckb || "", kcal: +f.kcal || 0, p: +f.p || 0, c: +f.c || 0, f: +f.f || 0, q, m });
    if (f.id && f.id !== "ai" && f.id !== "quick") pushRecent(f.id);
    save();
  }
  const A = {
    tab: el => { view = el.dataset.v; window.scrollTo(0, 0); render(); },
    day: el => { cur = addDays(cur, Number(el.dataset.n)); render(); },
    goToday: () => { cur = dk(); render(); },
    hideInstall: () => { S.installHidden = true; save(); render(); },
    close: () => closeSheet(),
    pickLang: el => { S.lang = el.dataset.l; onbStep = 1; save(); render(); },
    finishOnb: () => { readProfileForm(); S.onboarded = true; save(); render(); toast(t("welcome")); },
    pfSex: el => { if (document.getElementById("pf-age")) readProfileForm(); S.profile.sex = el.dataset.s; save(); SH ? renderSheet() : render(); },
    setUnits: el => { if (document.getElementById("pf-age")) readProfileForm(); S.units = el.dataset.u; save(); SH ? renderSheet() : render(); },
    setLang: el => { saveSettingsInputs(); S.lang = el.dataset.l; save(); render(); },
    setTheme: el => { saveSettingsInputs(); S.theme = el.dataset.th; save(); render(); },
    setMacro: el => { saveSettingsInputs(); S.profile.macro = el.dataset.m; save(); render(); },
    setProvider: el => { saveSettingsInputs(); S.ai.provider = el.dataset.pv; S.ai.model = ""; save(); render(); },
    editProfile: () => openSheet({ type: "profile" }),
    saveProfile: () => { readProfileForm(); save(); closeSheet(); toast(t("saved")); },
    saveAi: () => { S.ai.key = document.getElementById("ai-key").value.trim(); S.ai.model = document.getElementById("ai-model").value.trim(); saveSettingsInputs(); save(); render(); toast(t("saved")); },
    testAi: async () => {
      S.ai.key = document.getElementById("ai-key").value.trim(); S.ai.model = document.getElementById("ai-model").value.trim(); save();
      const st = document.getElementById("ai-status");
      if (!S.ai.key) { st.innerHTML = '<div class="notice err">' + esc(t("aiNeedKey")) + "</div>"; return; }
      st.innerHTML = '<div class="notice"><span class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;vertical-align:middle"></span> ' + esc(t("testing")) + "</div>";
      try { await callAI({ messages: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }] }); st.innerHTML = '<div class="notice ok">' + esc(t("aiWorks")) + "</div>"; }
      catch (e) { st.innerHTML = '<div class="notice err">' + esc(t("aiError") + " " + e.message) + "</div>"; }
    },
    goAiSettings: () => { closeSheet(); view = "me"; render(); setTimeout(() => { const k = document.getElementById("ai-key"); if (k) { k.scrollIntoView({ block: "center" }); k.focus(); } }, 50); },

    addMenu: () => openSheet({ type: "addMenu" }),
    foodSearch: el => openSheet({ type: "food", m: (el && el.dataset.m) || defaultMeal(), cat: "all", q: "" }),
    foodCat: el => { SH.cat = el.dataset.c; renderSheet(); },
    pickMeal: el => { SH.m = el.dataset.m; if (SH.type === "entry") readQty(); if (SH.type === "custom") return keepCustom(() => renderSheet()); renderSheet(); },
    foodPick: el => { SH.prev = Object.assign({}, SH); openSheet({ type: "foodDetail", id: el.dataset.id, qty: 1, m: SH.m, back: SH.prev }); },
    qty: el => { readQty(); SH.qty = Math.max(0.25, Math.round((SH.qty + Number(el.dataset.d)) * 4) / 4); renderSheet(); },
    qtySet: el => { SH.qty = Number(el.dataset.v); renderSheet(); },
    toggleFav: () => { const id = SH.id; S.fav = S.fav.includes(id) ? S.fav.filter(x => x !== id) : [id].concat(S.fav); save(); renderSheet(); },
    addFood: () => { readQty(); const f = getFood(SH.id); addEntry(f, SH.qty, SH.m); const m = SH.m; closeSheet(); toast(t("addedTo", { meal: mealName(m) })); },
    delCustom: () => { const id = SH.id; S.custom = S.custom.filter(c => c.id !== id); S.fav = S.fav.filter(x => x !== id); S.recent = S.recent.filter(x => x !== id); save(); closeSheet(); },
    customFood: () => openSheet({ type: "custom", m: (SH && SH.m) || defaultMeal(), name: (SH && SH.q) || "" }),
    quickAdd: () => openSheet({ type: "custom", quick: true, m: (SH && SH.m) || defaultMeal() }),
    saveCustom: () => {
      const g = id => document.getElementById(id);
      const name = g("cf-name").value.trim() || t("quickAdd"), kcal = num(g("cf-kcal").value);
      if (!(kcal >= 0)) { g("cf-err").innerHTML = '<div class="notice err">' + esc(t("needKcal")) + "</div>"; return; }
      const f = { id: SH.quick ? "quick" : "c" + uid(), en: name, ckb: name, sen: SH.quick ? "" : g("cf-sv").value.trim() || t("oneServing"), sckb: "", kcal, p: num(g("cf-p").value) || 0, c: num(g("cf-c").value) || 0, f: num(g("cf-f").value) || 0, cat: "mine" };
      f.sckb = f.sen;
      if (!SH.quick && g("cf-save").checked) S.custom.push(f); else if (!SH.quick) f.id = "x" + uid();
      addEntry(f, 1, SH.m); const m = SH.m; closeSheet(); toast(t("addedTo", { meal: mealName(m) }));
    },
    entry: el => { const e = day().food.find(x => x.u === el.dataset.u); openSheet({ type: "entry", u: e.u, qty: e.q, m: e.m }); },
    saveEntry: () => { readQty(); const e = day().food.find(x => x.u === SH.u); if (e) { e.q = SH.qty; e.m = SH.m; save(); } closeSheet(); },
    delEntry: () => { const d = day(cur, true); d.food = d.food.filter(x => x.u !== SH.u); save(); closeSheet(); toast(t("removed")); },
    copyMeal: el => {
      const m = el.dataset.m, y = day(addDays(cur, -1)).food.filter(e => e.m === m);
      const d = day(cur, true); y.forEach(e => d.food.push(Object.assign({}, e, { u: uid() }))); save(); render(); toast(t("copied"));
    },

    exSheet: () => openSheet({ type: "ex", q: "" }),
    exPick: el => { SH.pick = el.dataset.id; SH.min = 30; renderSheet(); },
    exBack: () => { SH.pick = null; renderSheet(); },
    exMin: el => { readExMin(); SH.min = Math.max(5, SH.min + Number(el.dataset.d)); renderSheet(); },
    exMinSet: el => { SH.min = Number(el.dataset.v); renderSheet(); },
    exAdd: () => { readExMin(); const a = ACT.find(x => x.id === SH.pick); day(cur, true).ex.push({ u: uid(), id: a.id, en: a.en, ckb: a.ckb, min: SH.min, kcal: Math.round(exKcal(a.met, SH.min)) }); save(); closeSheet(); toast(t("exAdded")); },
    cxAdd: () => {
      const n = document.getElementById("cx-name").value.trim(), k = num(document.getElementById("cx-kcal").value), mn = num(document.getElementById("cx-min").value) || 0;
      if (!n || !(k > 0)) { toast(t("needNameKcal")); return; }
      day(cur, true).ex.push({ u: uid(), id: "custom", en: n, ckb: n, min: mn, kcal: Math.round(k) }); save(); closeSheet(); toast(t("exAdded"));
    },
    exEntry: el => openSheet({ type: "exEntry", u: el.dataset.u }),
    delEx: () => { const d = day(cur, true); d.ex = d.ex.filter(x => x.u !== SH.u); save(); closeSheet(); toast(t("removed")); },
    stepsSheet: () => openSheet({ type: "steps", focus: "steps-in" }),
    saveSteps: () => { const v = num(document.getElementById("steps-in").value); day(cur, true).steps = v > 0 ? Math.round(v) : 0; save(); closeSheet(); },

    water: el => { const d = day(cur, true); const n = Number(el.dataset.n); d.water = d.water === n ? n - 1 : n; save(); render(); },

    weightSheet: () => openSheet({ type: "weight" }),
    saveWeight: () => {
      const v = wIn(num(document.getElementById("w-in").value));
      if (!(v > 25 && v < 350)) { toast(t("badWeight")); return; }
      const ex = S.weights.find(w => w.d === cur); if (ex) ex.kg = v; else S.weights.push({ d: cur, kg: v });
      S.profile.weight = latestWeight(); save(); closeSheet(); toast(t("saved"));
    },
    delWeight: el => { S.weights = S.weights.filter(w => w.d !== el.dataset.d); save(); renderSheet(); },
    calRange: el => { calRange = Number(el.dataset.r); render(); },

    fastSheet: () => openSheet({ type: "fast" }),
    fastPlan: el => { S.fast.plan = Number(el.dataset.p); save(); SH ? renderSheet() : render(); },
    fastStart: () => { S.fast.start = Date.now(); save(); SH ? renderSheet() : render(); toast(t("fastStarted")); },
    fastEnd: () => { S.fast.history.push({ start: S.fast.start, end: Date.now(), plan: S.fast.plan }); S.fast.history = S.fast.history.slice(-60); S.fast.start = null; save(); SH ? renderSheet() : render(); },

    routine: el => openSheet({ type: "routine", id: el.dataset.id }),
    startRoutine: () => startPlayer(window.ROUTINES.find(x => x.id === SH.id)),
    plPause: () => { PL.paused = !PL.paused; renderSheet(); },
    plSkip: () => { PL.left = 1; PL.paused = false; playerTick(); },
    plFinish: () => { PL.done = true; renderSheet(); },
    saveRoutine: () => {
      const r = PL.r, min = PL.workSec / 60;
      if (min > 0.2) day(dk(), true).ex.push({ u: uid(), id: "r_" + r.id, en: r.en, ckb: r.ckb, min: Math.round(min), kcal: Math.round(exKcal(r.met, min)) });
      save(); closeSheet(); toast(t("exAdded"));
    },

    aiPhoto: () => openSheet({ type: "aiPhoto", mode: "photo", m: (SH && SH.m) || defaultMeal() }),
    aiText: () => openSheet({ type: "aiPhoto", mode: "text", m: (SH && SH.m) || defaultMeal(), focus: "ai-desc" }),
    aiRun: () => {
      if (SH.mode === "text") { SH.desc = document.getElementById("ai-desc").value.trim(); if (!SH.desc) return; }
      else { const h = document.getElementById("ai-hint"); SH.hint = h ? h.value.trim() : ""; }
      runFoodAI();
    },
    aiQty: el => { const it = SH.items[Number(el.dataset.i)]; it.q = Math.max(0.25, Math.round((it.q + Number(el.dataset.d)) * 4) / 4); renderSheet(); },
    aiRetry: () => { SH.items = null; SH.err = ""; renderSheet(); },
    aiAdd: () => {
      const items = SH.items.filter(i => i.on); if (!items.length) return;
      items.forEach(i => addEntry(i, i.q, SH.m)); const m = SH.m; closeSheet(); toast(t("addedTo", { meal: mealName(m) }));
    },
    coach: () => openSheet({ type: "coach", full: true }),
    coachSend: () => { const i = document.getElementById("coach-in"); coachSend(i.value); },
    coachAsk: el => coachSend(el.dataset.q),
    coachClear: () => { S.chat = []; save(); renderSheet(); },

    barcode: () => openSheet({ type: "barcode", m: (SH && SH.m) || defaultMeal(), focus: "bc-in" }),
    bcLookup: async () => {
      const code = String(num(document.getElementById("bc-in").value) || "").replace(/\D/g, "") || document.getElementById("bc-in").value.replace(/\D/g, "");
      SH.code = code; if (!code) return;
      SH.busy = true; SH.err = ""; SH.prod = null; renderSheet();
      try {
        const r = await fetch("https://world.openfoodfacts.org/api/v2/product/" + code + ".json?fields=product_name,product_name_en,brands,nutriments,serving_quantity");
        const j = await r.json();
        if (!j.product || !j.product.nutriments) throw new Error(t("notFound"));
        const n = j.product.nutriments;
        const kcal = n["energy-kcal_100g"] != null ? n["energy-kcal_100g"] : n.energy_100g ? n.energy_100g / 4.184 : null;
        if (kcal == null) throw new Error(t("notFound"));
        SH.prod = { name: [j.product.product_name_en || j.product.product_name, j.product.brands].filter(Boolean).join(" · ") || code, kcal: +kcal, p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0, f: +n.fat_100g || 0 };
        SH.grams = +j.product.serving_quantity || 100;
      } catch (e) { SH.err = e.message === t("notFound") ? t("notFound") : t("netError"); }
      if (SH) { SH.busy = false; renderSheet(); }
    },
    bcAdd: () => {
      const g = num(document.getElementById("bc-g").value) || SH.grams, p = SH.prod;
      addEntry({ id: "bc", en: p.name, ckb: p.name, sen: kuNumEn(g) + " g", sckb: fmt(g) + " گم", kcal: p.kcal * g / 100, p: p.p * g / 100, c: p.c * g / 100, f: p.f * g / 100 }, 1, SH.m);
      const m = SH.m; closeSheet(); toast(t("addedTo", { meal: mealName(m) }));
    },

    exportData: () => openSheet({ type: "exportData" }),
    copyExport: () => {
      const ta = document.getElementById("exp-text");
      const done = () => toast(t("copied"));
      try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); toast(t("selectCopy")); }); } catch (e) { ta.select(); toast(t("selectCopy")); }
    },
    downloadExport: () => {
      try {
        const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "xorak-backup-" + dk() + ".json";
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      } catch (e) { toast(t("selectCopy")); }
    },
    importSheet: () => openSheet({ type: "importData" }),
    doImport: async () => {
      const ta = document.getElementById("imp-text"), fi = document.getElementById("imp-file"), err = document.getElementById("imp-err");
      let text = ta.value.trim();
      if (!text && fi.files && fi.files[0]) text = await fi.files[0].text();
      let data;
      try { data = JSON.parse(text); if (!data || !data.v || !data.days) throw new Error("bad"); }
      catch (e) { err.innerHTML = '<div class="notice err">' + esc(t("badBackup")) + "</div>"; return; }
      if (!SH.confirm) { SH.confirm = true; SH.pending = data; const keep = ta.value; renderSheet(); document.getElementById("imp-text").value = keep; return; }
      localStorage.setItem(KEY, JSON.stringify(data)); S = load(); S.onboarded = true; save(); closeSheet(); toast(t("restored"));
    },
    reset: el => {
      if (el.dataset.armed) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } S = defaults(); onbStep = 0; view = "today"; cur = dk(); render(); return; }
      el.dataset.armed = "1"; el.textContent = t("tapAgainErase"); setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = t("resetAll"); } }, 4000);
    }
  };
  const kuNumEn = g => String(Math.round(g));
  function readQty() { const i = document.getElementById("qty"); if (i) { const v = num(i.value); if (v > 0) SH.qty = v; } }
  function readExMin() { const i = document.getElementById("ex-min"); if (i) { const v = num(i.value); if (v > 0) SH.min = Math.round(v); } }
  function keepCustom(fn) {
    const ids = ["cf-name", "cf-sv", "cf-kcal", "cf-p", "cf-c", "cf-f"], vals = {};
    ids.forEach(id => { const e = document.getElementById(id); if (e) vals[id] = e.value; });
    fn();
    ids.forEach(id => { const e = document.getElementById(id); if (e && vals[id] != null) e.value = vals[id]; });
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el); }
  });
  document.addEventListener("input", e => {
    const id = e.target.id;
    if (id === "food-q") { SH.q = e.target.value; const l = document.getElementById("food-list"); if (l) l.innerHTML = foodRows(); }
    if (id === "ex-q") { SH.q = e.target.value; const pos = e.target.selectionStart; renderSheet(); const n = document.getElementById("ex-q"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) { /* ignore */ } } }
    if (id === "bc-g" && SH && SH.prod) { const v = num(e.target.value); if (v > 0) { SH.grams = v; } }
  });
  document.addEventListener("change", async e => {
    const el = e.target;
    if (el.dataset && el.dataset.aiI != null && SH && SH.items) { SH.items[Number(el.dataset.aiI)].on = el.checked; renderSheet(); return; }
    if ((el.id === "ai-cam" || el.id === "ai-lib") && el.files && el.files[0]) {
      const h = document.getElementById("ai-hint"); SH.hint = h ? h.value : "";
      try { SH.img = await imageToBase64(el.files[0]); SH.err = ""; } catch (er) { SH.err = t("photoError"); }
      renderSheet(); return;
    }
    if (el.id === "set-ramadan") { S.ramadan = el.checked; save(); }
    if (el.id === "set-kcal" || el.id === "set-water") { saveSettingsInputs(); save(); render(); }
    if (el.id === "bc-g" && SH && SH.prod) { renderSheet(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && SH) closeSheet();
    if (e.key === "Enter" && e.target.id === "coach-in") { e.preventDefault(); coachSend(e.target.value); }
    if (e.key === "Enter" && e.target.id === "bc-in") { e.preventDefault(); A.bcLookup(); }
  });

  // timers
  setInterval(() => {
    playerTick();
    const st = fastState();
    if (st) {
      document.querySelectorAll('[data-fast="el"]').forEach(n => { n.textContent = dur(st.el); });
      document.querySelectorAll('[data-fast="pct"]').forEach(n => { n.textContent = fmt(st.pct * 100) + "%"; });
    }
  }, 1000);
  // roll over to a new day if the app stays open past midnight
  let lastToday = dk();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && dk() !== lastToday) { if (cur === lastToday) cur = dk(); lastToday = dk(); if (!SH) render(); }
  });

  render();

  if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|anthropic/.test(location.hostname)) {
    try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (e) { /* ignore */ }
  }
})();
