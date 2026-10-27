/* Xorak core: storage, language, math, icons. Shared by views.js and sheets.js. */
"use strict";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Storage ---------- */
const KEY = "xorak.v1";
const LANGS = ["en", "ckb", "kmr", "ar"];
const LI = { en: 0, ckb: 1, kmr: 2, ar: 3 };
const RTL = { ckb: true, ar: true };

function defaults() {
  return {
    v: 2, lang: null, onboarded: false, theme: "system", units: "metric", textSize: "normal",
    ramadan: false, city: 0, cityCustom: null, installHidden: false,
    profile: { name: "", sex: "m", age: 28, height: 175, weight: 78, goalWeight: 72, activity: 1, goal: "lose", macro: "bal", kcalOverride: 0, water: 8, glassMl: 250, stepGoal: 8000, sleepGoal: 8 },
    days: {}, weights: [], meas: [], custom: [], meals: [], recent: [], fav: [],
    fast: { plan: 16, start: null, history: [] },
    gym: { sessions: [], active: null },
    ai: { provider: "gemini", key: "", model: "" },
    chat: [], badges: {}, scans: 0, shares: 0, plan: null, deviceId: uid()
  };
}
function migrate(j) {
  const d = defaults();
  const s = Object.assign(d, j, {
    profile: Object.assign(d.profile, j.profile),
    fast: Object.assign(d.fast, j.fast),
    gym: Object.assign(d.gym, j.gym),
    ai: Object.assign(d.ai, j.ai)
  });
  if (j.v === 1 && j.lang) s.onboarded = true;
  // v1 entries kept en/ckb names and a serving string
  const fixName = e => { if (!e.n) e.n = [e.en || e.ckb || "", e.ckb || e.en || "", e.en || "", e.en || ""]; };
  Object.values(s.days).forEach(day => {
    (day.food || []).forEach(e => { fixName(e); if (!e.unit && e.sen) e.s = e.sen; });
    (day.ex || []).forEach(fixName);
  });
  s.custom.forEach(c => { fixName(c); if (!c.unit) { c.unit = "portion"; c.cnt = 1; c.g = c.g || 0; } });
  if (!s.deviceId) s.deviceId = uid();
  s.v = 2;
  return s;
}
function load() {
  try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && j.v) return migrate(j); } catch (e) { /* storage unavailable */ }
  return defaults();
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toastLater = "storageFull"; } }
let toastLater = null;

/* ---------- Data ---------- */
const FOOD = {};
window.FOODS.forEach(r => { FOOD[r[0]] = { id: r[0], n: [r[1], r[2], r[3], r[4]], unit: r[5], cnt: r[6], g: r[7], kcal: r[8], p: r[9], c: r[10], f: r[11], cat: r[12], mi: window.MICRO[r[0]] || null, em: window.EMOJI[r[0]] }; });
const ACT = window.ACTIVITIES.map(r => ({ id: r[0], n: [r[1], r[2], r[3], r[4]], met: r[5] }));
const getFood = id => FOOD[id] || S.custom.find(c => c.id === id);
const foodEmoji = o => (o && (o.em || window.EMOJI[o.id] || window.CAT_EMOJI[o.cat])) || "🍽️";
const exEmoji = e => window.EMOJI["a_" + e.id] || window.EMOJI[e.id && e.id.startsWith("r_") ? e.id : ""] || (e.id === "gym" ? "🏋️" : "⭐");
// The shared AI server (Lovable Cloud). Empty string = each person uses their own key.
const AI_SERVER = "https://xorak-ai.lovable.app/api/public/xorak-ai";
const aiReady = () => !!(S.ai.key || AI_SERVER);
// Other serving sizes for a food: [unit, factor relative to the food's own serving]
function altServings(f) {
  const out = [[f.unit, 1]];
  if (f.unit === "cup") out.push(["bowl", 1.5], ["plate", 2]);
  else if (f.unit === "plate") out.push(["smallplate", 0.6], ["bigplate", 1.5]);
  else if (f.unit === "bowl") out.push(["smallbowl", 0.6], ["bigbowl", 1.5]);
  else if (f.unit === "piece" && f.cnt === 1 && f.g && f.g <= 80 && ["kurdish", "sweet"].includes(f.cat)) out.push(["smallplate", 4], ["bigplate", 8]);
  else if ((f.unit === "piece" || f.unit === "sheet" || f.unit === "slice") && f.cat === "bread") out.push(["half", 0.5]);
  return out;
}

/* ---------- Dates ---------- */
const pad = n => String(n).padStart(2, "0");
const dk = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dk(d); };
const lastDays = (n, end = dk()) => { const a = []; for (let i = n - 1; i >= 0; i--) a.push(addDays(end, -i)); return a; };
let cur = dk();
let view = "today";
const EMPTY_DAY = () => ({ food: [], ex: [], water: 0, steps: 0, sleep: null, mood: null });
function day(k = cur, create) {
  if (!S.days[k]) { if (!create) return EMPTY_DAY(); S.days[k] = EMPTY_DAY(); }
  return S.days[k];
}

/* ---------- Language ---------- */
const lang = () => (LANGS.includes(S.lang) ? S.lang : "en");
const li = () => LI[lang()];
function t(k, vars) {
  const T = window.I18N;
  let s = T[lang()][k];
  if (s == null) s = T.en[k];
  if (s == null) s = k;
  if (vars) for (const v in vars) s = s.split("{" + v + "}").join(vars[v]);
  return s;
}
const EA = "٠١٢٣٤٥٦٧٨٩";
const useEA = () => lang() === "ckb" || lang() === "ar";
const loc = s => (useEA() ? String(s).replace(/[0-9]/g, d => EA[d]).replace(/\./g, "٫").replace(/,/g, "٬") : String(s));
function fmt(n, dec = 0) {
  if (n == null || isNaN(n)) return "–";
  const v = dec ? (Math.round(n * 10 ** dec) / 10 ** dec).toString() : Math.round(n).toLocaleString("en-US");
  return loc(v);
}
function num(v) {
  if (v == null) return NaN;
  const s = String(v).trim()
    .replace(/[٠-٩]/g, d => EA.indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٫,]/g, ".");
  return s === "" ? NaN : Number(s);
}
const nm = o => {
  if (!o) return "";
  if (o.n) return o.n[li()] || o.n[0] || "";
  return o.en || "";
};
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function servingLabel(o, q = 1) {
  if (!o.unit) return o.s || "";
  if (o.unit === "g") return fmt((o.cnt || 100) * q) + " " + t("g");
  const cnt = (o.cnt || 1) * q;
  const base = fmt(cnt, 2) + " " + t("u_" + o.unit);
  return o.g ? base + " · " + fmt(o.g * q) + " " + t("g") : base;
}

const MONTHS = {
  ckb: ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"],
  kmr: ["Çile", "Sibat", "Adar", "Nîsan", "Gulan", "Hezîran", "Tîrmeh", "Tebax", "Îlon", "Cotmeh", "Mijdar", "Kanûn"],
  ar: ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"]
};
const WEEKDAYS = {
  ckb: ["یەکشەممە", "دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی", "شەممە"],
  kmr: ["Yekşem", "Duşem", "Sêşem", "Çarşem", "Pêncşem", "În", "Şemî"],
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
};
const WD_SHORT = {
  ckb: ["یەک", "دوو", "سێ", "چوار", "پێنج", "هەینی", "شەممە"],
  kmr: ["Yş", "Dş", "Sş", "Çş", "Pş", "În", "Şm"],
  ar: ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
};
function dateLabel(k, plain) {
  const today = dk();
  if (!plain) {
    if (k === today) return t("today");
    if (k === addDays(today, -1)) return t("yesterday");
    if (k === addDays(today, 1)) return t("tomorrow");
  }
  const d = parseKey(k);
  if (lang() === "en") return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return WEEKDAYS[lang()][d.getDay()] + " " + loc(d.getDate()) + " " + MONTHS[lang()][d.getMonth()];
}
function shortDate(k) {
  const d = parseKey(k);
  if (lang() === "en") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return loc(d.getDate()) + " " + MONTHS[lang()][d.getMonth()].split(" ")[0];
}
function weekdayShort(k) {
  const d = parseKey(k);
  if (lang() === "en") return d.toLocaleDateString("en-US", { weekday: "short" });
  return WD_SHORT[lang()][d.getDay()];
}
const timeStr = ts => { const d = new Date(ts); return loc(pad(d.getHours()) + ":" + pad(d.getMinutes())); };
const hm = hours => { const h = ((hours % 24) + 24) % 24; const H = Math.floor(h), M = Math.round((h - H) * 60); return loc(pad(M === 60 ? H + 1 : H) + ":" + pad(M === 60 ? 0 : M)); };
const dur = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return loc(pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60)); };
function greeting() {
  const h = new Date().getHours();
  return t(h < 5 ? "goodNight" : h < 12 ? "goodMorning" : h < 17 ? "goodAfternoon" : "goodEvening");
}

/* ---------- Units ---------- */
const imp = () => S.units === "imperial";
const wShow = kg => (imp() ? kg * 2.20462 : kg);
const wIn = v => (imp() ? v / 2.20462 : v);
const wUnit = () => t(imp() ? "lb" : "kg");
const lShow = cm => (imp() ? cm / 2.54 : cm);
const lIn = v => (imp() ? v * 2.54 : v);
const lUnit = () => t(imp() ? "in" : "cm");

/* ---------- Targets ---------- */
const ACT_MULT = [1.2, 1.375, 1.55, 1.725, 1.9];
const GOAL_DELTA = { lose_fast: -750, lose: -500, lose_slow: -250, keep: 0, gain: 300 };
const MACRO = { bal: [25, 50, 25], pro: [35, 40, 25], low: [30, 25, 45], keto: [25, 5, 70] };
function sortedWeights() { return S.weights.slice().sort((a, b) => (a.d < b.d ? -1 : 1)); }
function latestWeight() { const w = sortedWeights(); return w.length ? w[w.length - 1].kg : S.profile.weight; }
function targets() {
  const p = S.profile, kg = latestWeight();
  const bmr = 10 * kg + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5);
  const tdee = bmr * ACT_MULT[p.activity];
  const floor = p.sex === "f" ? 1200 : 1500;
  let kcal = Math.max(floor, Math.round((tdee + (GOAL_DELTA[p.goal] || 0)) / 10) * 10);
  if (p.kcalOverride > 0) kcal = p.kcalOverride;
  const m = MACRO[p.macro] || MACRO.bal;
  let prot = (kcal * m[0]) / 100 / 4;
  prot = Math.max(prot, kg * (p.goal === "gain" ? 1.6 : 1.2)); // enough protein to keep muscle
  const rest = Math.max(0, kcal - prot * 4);
  const cShare = m[1] / (m[1] + m[2]);
  return { bmr, tdee, kcal, p: prot, c: (rest * cShare) / 4, f: (rest * (1 - cShare)) / 9, water: p.water, kg };
}
const exKcal = (met, min, kg = latestWeight()) => (met * 3.5 * kg / 200) * min;
const stepKcal = steps => Math.max(0, steps - 5000) * 0.04 * (latestWeight() / 70);
function totals(k = cur) {
  const d = day(k);
  const r = { kcal: 0, p: 0, c: 0, f: 0, ex: 0, min: 0, mi: [0, 0, 0, 0, 0, 0, 0], miKnown: 0 };
  d.food.forEach(e => {
    r.kcal += e.kcal * e.q; r.p += e.p * e.q; r.c += e.c * e.q; r.f += e.f * e.q;
    if (e.mi) { e.mi.forEach((v, i) => { r.mi[i] += (v || 0) * e.q; }); r.miKnown++; }
  });
  d.ex.forEach(e => { r.ex += e.kcal; r.min += e.min || 0; });
  r.ex += stepKcal(d.steps || 0);
  return r;
}
function dayScore(k = cur) {
  const tg = targets(), tt = totals(k), d = day(k);
  const cal = !d.food.length ? 0 : Math.max(0, 1 - Math.abs(tt.kcal - (tg.kcal + tt.ex)) / (tg.kcal * 0.35));
  const pro = Math.min(1, tt.p / (tg.p * 0.9));
  const wat = Math.min(1, (d.water || 0) / tg.water);
  const mov = Math.min(1, Math.max(tt.min / 30, (d.steps || 0) / S.profile.stepGoal));
  return { cal, pro, wat, mov, total: Math.round(((cal + pro + wat + mov) / 4) * 100) };
}
function streak() {
  let n = 0, k = dk();
  if (!day(k).food.length) k = addDays(k, -1);
  while (day(k).food.length) { n++; k = addDays(k, -1); }
  return n;
}
function bestStreak() {
  const keys = Object.keys(S.days).filter(k => S.days[k].food.length).sort();
  let best = 0, run = 0, prev = null;
  keys.forEach(k => { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
  return best;
}

/* ---------- Ramadan / prayer times (Muslim World League method) ---------- */
function cityInfo() {
  if (S.cityCustom) return { name: t("myLocation"), lat: S.cityCustom.lat, lng: S.cityCustom.lng };
  const c = window.CITIES[S.city] || window.CITIES[0];
  return { name: c[li()] || c[0], lat: c[4], lng: c[5] };
}
function prayerTimes(date = new Date()) {
  const { lat, lng } = cityInfo();
  const rad = x => (x * Math.PI) / 180, deg = x => (x * 180) / Math.PI;
  const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const jd = 367 * y - Math.floor((7 * (y + Math.floor((m + 9) / 12))) / 4) + Math.floor((275 * m) / 9) + d + 1721013.5 - lng / 360;
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  const eqt = q / 15 - RA;
  const noon = fix(12 - eqt, 24);
  const angleTime = (angle, before) => {
    const v = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
    const T = deg(Math.acos(Math.max(-1, Math.min(1, v)))) / 15;
    return noon + (before ? -T : T);
  };
  const tz = -date.getTimezoneOffset() / 60;
  const adj = h => h + tz - lng / 15;
  return { fajr: adj(angleTime(18, true)), sunrise: adj(angleTime(0.833, true)), maghrib: adj(angleTime(0.833, false)) + 1 / 60 };
}
function ramadanCountdown() {
  const now = new Date(), pt = prayerTimes(now);
  const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  if (h < pt.fajr) return { kind: "suhoorEnds", left: (pt.fajr - h) * 3600000, pt };
  if (h < pt.maghrib) return { kind: "iftarIn", left: (pt.maghrib - h) * 3600000, pt };
  const tomorrow = new Date(now.getTime() + 86400000), pt2 = prayerTimes(tomorrow);
  return { kind: "suhoorEnds", left: (24 - h + pt2.fajr) * 3600000, pt, next: pt2 };
}

/* ---------- Icons ---------- */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  train: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-10-2.5 1.5-4 4-4 6-1-1-2-2-2-4-2 2-4 5-4 8 0 4.3 3 7 7 7z"/>',
  drop: '<path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  barcode: '<path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M7 8v8M10 8v8M13 8v8M17 8v8"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
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
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  bed: '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6v4H9z"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 20"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4M9 2h6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z"/>'
};
const ic = (n, cls = "") => '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>";

/* ---------- Meals ---------- */
function meals(k = cur) {
  const d = day(k);
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

/* ---------- Achievements ---------- */
function countBy(fn) { return Object.keys(S.days).filter(k => fn(S.days[k], k)).length; }
function allWorkouts() { let n = 0; Object.values(S.days).forEach(d => { n += (d.ex || []).length; }); return n; }
const BADGES = [
  { id: "first", icon: "check", test: () => countBy(d => d.food.length) >= 1 },
  { id: "streak3", icon: "flame", test: () => bestStreak() >= 3 },
  { id: "streak7", icon: "flame", test: () => bestStreak() >= 7 },
  { id: "streak30", icon: "flame", test: () => bestStreak() >= 30 },
  { id: "water", icon: "drop", test: () => countBy(d => (d.water || 0) >= S.profile.water) >= 1 },
  { id: "water7", icon: "drop", test: () => countBy(d => (d.water || 0) >= S.profile.water) >= 7 },
  { id: "protein", icon: "bolt", test: () => { const tg = targets(); return countBy((d, k) => totals(k).p >= tg.p) >= 5; } },
  { id: "move1", icon: "walk", test: () => allWorkouts() >= 1 },
  { id: "move10", icon: "train", test: () => allWorkouts() >= 10 },
  { id: "move50", icon: "trophy", test: () => allWorkouts() >= 50 },
  { id: "gym5", icon: "dumbbell", test: () => S.gym.sessions.length >= 5 },
  { id: "fast1", icon: "clock", test: () => S.fast.history.some(f => f.end - f.start >= f.plan * 3600000) },
  { id: "fast10", icon: "moon", test: () => S.fast.history.filter(f => f.end - f.start >= f.plan * 3600000).length >= 10 },
  { id: "weigh5", icon: "scale", test: () => S.weights.length >= 5 },
  { id: "lost2", icon: "trophy", test: () => { const w = sortedWeights(); return w.length > 1 && w[0].kg - Math.min(...w.map(x => x.kg)) >= 2; } },
  { id: "lost5", icon: "trophy", test: () => { const w = sortedWeights(); return w.length > 1 && w[0].kg - Math.min(...w.map(x => x.kg)) >= 5; } },
  { id: "sleep7", icon: "bed", test: () => countBy(d => d.sleep >= 7) >= 7 },
  { id: "scan", icon: "camera", test: () => S.scans >= 1 },
  { id: "chef", icon: "bowl", test: () => S.custom.some(c => c.cat === "recipe") },
  { id: "score100", icon: "star", test: () => Object.keys(S.days).some(k => dayScore(k).total >= 100) }
];
function xp() {
  let x = 0;
  Object.keys(S.days).forEach(k => { const d = S.days[k]; x += d.food.length * 2 + (d.ex || []).length * 10 + ((d.water || 0) >= S.profile.water ? 5 : 0) + (d.food.length ? 5 : 0) + (d.sleep ? 2 : 0); });
  x += S.fast.history.length * 10 + S.weights.length * 3 + S.gym.sessions.length * 15 + Object.keys(S.badges).length * 25;
  return x;
}
const levelOf = x => Math.floor(Math.sqrt(x / 40)) + 1;
const xpFor = l => (l - 1) * (l - 1) * 40;
