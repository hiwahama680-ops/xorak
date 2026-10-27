/* Xorak views: the four tabs and the setup wizard. */
"use strict";

const app = document.getElementById("app");
function applyChrome() {
  const r = document.documentElement;
  r.lang = lang();
  r.dir = RTL[lang()] ? "rtl" : "ltr";
  if (S.theme === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", S.theme);
  r.setAttribute("data-size", S.textSize);
  document.title = t("appName");
}
function render() {
  applyChrome();
  if (!S.onboarded) { app.innerHTML = renderOnboarding(); return; }
  let body = "";
  if (view === "today") body = renderToday();
  else if (view === "train") body = renderTrain();
  else if (view === "progress") body = renderProgress();
  else body = renderMe();
  app.innerHTML = body + renderTabs();
  checkBadges();
}
function renderTabs() {
  const tab = (v, icon, label) => '<button class="tab' + (view === v ? " on" : "") + '" data-act="tab" data-v="' + v + '"' + (view === v ? ' aria-current="page"' : "") + ">" + ic(icon) + "<span>" + esc(label) + "</span></button>";
  return '<nav class="tabs" aria-label="' + esc(t("appName")) + '"><div class="in">' + tab("today", "home", t("tabToday")) + tab("train", "train", t("tabTrain")) +
    '<button class="fab" data-act="addMenu" aria-label="' + esc(t("add")) + '">' + ic("plus") + "</button>" +
    tab("progress", "chart", t("tabProgress")) + tab("me", "me", t("tabMe")) + "</div></nav>";
}
function header(title, extra = "", sub = "") {
  return '<header class="top"><div class="wrap"><div style="flex:1;min-width:0">' + (sub ? '<div class="hsub">' + esc(sub) + "</div>" : "") + '<h1 class="display">' + esc(title) + "</h1></div>" + extra + "</div></header>";
}
function ring(pct, color, size = 150, stroke = 14) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return '<svg viewBox="0 0 ' + size + " " + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--card2)" stroke-width="' + stroke + '"/>' +
    (p > 0 ? '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" class="prog" stroke-linecap="round" stroke-dasharray="' + (c * p).toFixed(1) + " " + c.toFixed(1) + '"/>' : "") + "</svg>";
}
function logoSvg(cls = "logo") {
  let rays = "";
  for (let i = 0; i < 21; i++) {
    const a = (i / 21) * Math.PI * 2 - Math.PI / 2;
    rays += '<line x1="' + (36 + Math.cos(a) * 17).toFixed(1) + '" y1="' + (36 + Math.sin(a) * 17).toFixed(1) + '" x2="' + (36 + Math.cos(a) * 24).toFixed(1) + '" y2="' + (36 + Math.sin(a) * 24).toFixed(1) + '" stroke="#1b1300" stroke-width="3" stroke-linecap="round"/>';
  }
  return '<svg class="' + cls + '" viewBox="0 0 72 72" aria-hidden="true"><rect width="72" height="72" rx="20" fill="#e89a00"/><circle cx="36" cy="36" r="12" fill="#1b1300"/>' + rays + "</svg>";
}
const seg = (act, key, opts, curv, extra = "") => '<div class="seg" role="group"' + extra + ">" + opts.map(o => '<button data-act="' + act + '" data-' + key + '="' + o[0] + '" class="' + (String(curv) === String(o[0]) ? "on" : "") + '">' + esc(o[1]) + "</button>").join("") + "</div>";
const mealSeg = () => seg("pickMeal", "m", meals().map(m => [m, mealName(m)]), SH && SH.m);

/* ---------- Setup wizard ---------- */
let onb = 0;
const ONB_STEPS = 6;
function renderOnboarding() {
  const p = S.profile;
  const dots = '<div class="dots">' + Array.from({ length: ONB_STEPS }, (_, i) => '<i class="' + (i <= onb - 1 ? "on" : "") + '"></i>').join("") + "</div>";
  const nav = (nextLabel = t("next")) => '<div class="onb-nav"><button class="btn ghost" data-act="onbBack">' + ic("left", "flip") + esc(t("back")) + '</button><button class="btn sun" data-act="onbNext">' + esc(nextLabel) + "</button></div>";
  if (onb === 0) {
    return '<div class="wrap onb">' + logoSvg() + '<h1 class="display">Xorak · خۆراک</h1>' +
      '<p class="muted" style="margin:0">Count calories, move more, feel better. Made for Kurdish food.<br><span lang="ckb" dir="rtl">کالۆری بژمێرە، زیاتر بجووڵێ، باشتر هەست بکە.</span></p>' +
      '<div class="stack">' + [["ckb", "کوردی (سۆرانی)"], ["kmr", "Kurdî (Kurmancî / Badînî)"], ["ar", "العربية"], ["en", "English"]].map((l, i) => '<button class="btn ' + (i === 0 ? "sun" : "ghost") + ' block big" data-act="pickLang" data-l="' + l[0] + '">' + esc(l[1]) + "</button>").join("") + "</div></div>";
  }
  let h = '<div class="wrap onb">' + dots;
  if (onb === 1) {
    const goals = [["lose", "flame", t("wGoalLose"), t("wGoalLoseSub")], ["keep", "check", t("wGoalKeep"), t("wGoalKeepSub")], ["gain", "dumbbell", t("wGoalGain"), t("wGoalGainSub")], ["healthy", "bulb", t("wGoalHealthy"), t("wGoalHealthySub")]];
    const curG = p.goal.startsWith("lose") ? "lose" : p.goal === "gain" ? "gain" : p.healthy ? "healthy" : "keep";
    h += '<h1 class="display">' + esc(t("wGoalQ")) + '</h1><div class="choices">' + goals.map(g => '<button class="choice' + (curG === g[0] ? " on" : "") + '" data-act="onbGoal" data-g="' + g[0] + '"><span class="thumb">' + ic(g[1]) + '</span><span><b>' + esc(g[2]) + "</b><small>" + esc(g[3]) + "</small></span></button>").join("") + "</div>" + nav();
  } else if (onb === 2) {
    h += '<h1 class="display">' + esc(t("wAboutQ")) + "</h1>" +
      '<label class="field"><span>' + esc(t("nameOptional")) + '</span><input class="input" id="pf-name" autocomplete="given-name" value="' + esc(p.name) + '"></label>' +
      seg("pfSex", "s", [["m", t("male")], ["f", t("female")]], p.sex) +
      '<div class="field"><span>' + esc(t("age")) + '</span><div class="stepper big"><button data-act="onbAge" data-d="-1" aria-label="−">−</button><output class="num" id="age-out">' + fmt(p.age) + '</output><button data-act="onbAge" data-d="1" aria-label="+">+</button></div></div>' + nav();
  } else if (onb === 3) {
    h += '<h1 class="display">' + esc(t("wBodyQ")) + "</h1>" + seg("setUnits", "u", [["metric", t("metric")], ["imperial", t("imperial")]], S.units) + bodyInputs() + nav();
  } else if (onb === 4) {
    if (p.goal === "keep" || p.goal === "gain") { onb = 5; return renderOnboarding(); }
    const paces = [["lose_slow", t("paceSlow"), t("paceSlowSub")], ["lose", t("paceNormal"), t("paceNormalSub")], ["lose_fast", t("paceFast"), t("paceFastSub")]];
    h += '<h1 class="display">' + esc(t("wTargetQ")) + "</h1>" +
      '<label class="field"><span>' + esc(t("goalWeight")) + " (" + esc(wUnit()) + ')</span><input class="input num big-input" id="pf-gw" inputmode="decimal" value="' + fmt(wShow(p.goalWeight), 1) + '"></label>' +
      '<div class="field"><span>' + esc(t("pace")) + '</span><div class="choices">' + paces.map(x => '<button class="choice slim' + (p.goal === x[0] ? " on" : "") + '" data-act="onbPace" data-g="' + x[0] + '"><span><b>' + esc(x[1]) + "</b><small>" + esc(x[2]) + "</small></span></button>").join("") + "</div></div>" + nav();
  } else if (onb === 5) {
    h += '<h1 class="display">' + esc(t("wActQ")) + '</h1><div class="choices">' + [0, 1, 2, 3, 4].map(i => '<button class="choice slim' + (p.activity === i ? " on" : "") + '" data-act="onbAct" data-a="' + i + '"><span><b>' + esc(t("actT" + i)) + "</b><small>" + esc(t("actD" + i)) + "</small></span></button>").join("") + "</div>" + nav();
  } else {
    const tg = targets();
    const gd = goalDate(latestWeight() - p.goalWeight, tg);
    h += '<h1 class="display">' + esc(p.name ? t("planReadyName", { n: p.name }) : t("planReady")) + "</h1>" +
      '<div class="card plan-card"><div class="big num">' + fmt(tg.kcal) + '</div><div class="muted">' + esc(t("kcalPerDay")) + "</div>" +
      '<div class="tiles" style="margin-top:14px"><div class="tile"><b class="num" style="color:var(--protein)">' + fmt(tg.p) + esc(t("g")) + "</b><span>" + esc(t("protein")) + '</span></div><div class="tile"><b class="num" style="color:var(--carbs)">' + fmt(tg.c) + esc(t("g")) + "</b><span>" + esc(t("carbs")) + '</span></div><div class="tile"><b class="num" style="color:var(--fat)">' + fmt(tg.f) + esc(t("g")) + "</b><span>" + esc(t("fat")) + "</span></div></div>" +
      '<ul class="plan-list"><li>' + ic("drop") + esc(t("planWater", { n: fmt(tg.water) })) + "</li><li>" + ic("walk") + esc(t("planSteps", { n: fmt(S.profile.stepGoal) })) + "</li>" + (gd ? "<li>" + ic("trophy") + esc(gd) + "</li>" : "") + "</ul></div>" +
      '<p class="small muted" style="margin:0">' + esc(t("planNote")) + "</p>" + nav(t("letsGo"));
  }
  return h + "</div>";
}
function bodyInputs() {
  const p = S.profile, hFt = Math.floor(p.height / 2.54 / 12), hIn = Math.round(p.height / 2.54 - hFt * 12);
  return '<div class="grid2">' +
    (imp()
      ? '<label class="field"><span>' + esc(t("height")) + " (" + esc(t("ft")) + " / " + esc(t("in")) + ')</span><div class="grid2"><input class="input num" id="pf-hft" inputmode="numeric" value="' + fmt(hFt) + '"><input class="input num" id="pf-hin" inputmode="numeric" value="' + fmt(hIn) + '"></div></label>'
      : '<label class="field"><span>' + esc(t("height")) + " (" + esc(t("cm")) + ')</span><input class="input num" id="pf-h" inputmode="decimal" value="' + fmt(p.height) + '"></label>') +
    '<label class="field"><span>' + esc(t("weight")) + " (" + esc(wUnit()) + ')</span><input class="input num" id="pf-w" inputmode="decimal" value="' + fmt(wShow(latestWeight()), 1) + '"></label></div>';
}
function readBody() {
  const p = S.profile, g = id => document.getElementById(id);
  if (g("pf-name")) p.name = g("pf-name").value.trim().slice(0, 30);
  if (imp() && g("pf-hft")) { const ft = num(g("pf-hft").value), inch = num(g("pf-hin").value) || 0; if (ft > 2 && ft < 9) p.height = Math.round((ft * 12 + inch) * 2.54); }
  else if (g("pf-h")) { const h = num(g("pf-h").value); if (h > 90 && h < 250) p.height = h; }
  if (g("pf-w")) {
    const w = wIn(num(g("pf-w").value));
    if (w > 25 && w < 350 && (Math.abs(w - latestWeight()) > 0.05 || !S.weights.length)) {
      p.weight = w; const today = dk(), ex = S.weights.find(x => x.d === today);
      if (ex) ex.kg = w; else S.weights.push({ d: today, kg: w });
    }
  }
  if (g("pf-gw")) { const gw = wIn(num(g("pf-gw").value)); if (gw > 25 && gw < 350) p.goalWeight = gw; }
  if (g("pf-age")) { const a = num(g("pf-age").value); if (a > 10 && a < 110) p.age = Math.round(a); }
  if (g("pf-act")) p.activity = Number(g("pf-act").value);
  if (g("pf-goal")) p.goal = g("pf-goal").value;
}
function goalDate(toGo, tg) {
  if (Math.abs(toGo) < 0.5) return "";
  const deficit = tg.tdee - tg.kcal;
  if ((toGo > 0 && deficit <= 50) || (toGo < 0 && deficit >= -50)) return "";
  const days = Math.abs((toGo * 7700) / deficit);
  if (!isFinite(days) || days > 3 * 365) return "";
  return t("goalBy", { d: dateLabel(addDays(dk(), Math.round(days)), true) });
}

/* ---------- Today ---------- */
function renderToday() {
  const tg = targets(), tt = totals(), d = day(), isToday = cur === dk();
  const remaining = tg.kcal - tt.kcal + tt.ex, over = remaining < 0;
  const nav = '<div class="datenav"><button class="iconbtn" data-act="day" data-n="-1" aria-label="' + esc(t("prevDay")) + '">' + ic("left", "flip") + "</button>" +
    (!isToday ? '<button class="chip" data-act="goToday">' + esc(t("today")) + "</button>" : "") +
    '<button class="iconbtn" data-act="day" data-n="1" aria-label="' + esc(t("nextDay")) + '">' + ic("right", "flip") + "</button></div>";
  const sub = isToday ? greeting() + (S.profile.name ? ", " + S.profile.name : "") : "";
  let h = header(isToday ? t("today") : dateLabel(cur), nav, sub) + '<main><div class="wrap">';

  const standalone = window.navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  if (!standalone && !S.installHidden && /iPhone|iPad|iPod|Android/.test(navigator.userAgent) && !/claude/i.test(location.hostname)) {
    h += '<div class="notice row-notice"><span class="grow">' + esc(t(/Android/.test(navigator.userAgent) ? "installHintAndroid" : "installHint")) + '</span><button class="iconbtn sm" data-act="hideInstall" aria-label="' + esc(t("close")) + '">' + ic("x") + "</button></div>";
  }

  // Calorie hero
  const macro = (k, label, color) => {
    const v = tt[k], g = tg[k];
    return '<div class="macro"><div class="n">' + esc(label) + '</div><div class="bar"><i style="width:' + Math.min(100, (v / g) * 100).toFixed(0) + "%;background:" + color + '"></i></div><div class="v num">' + fmt(v) + " / " + fmt(g) + " " + esc(t("g")) + "</div></div>";
  };
  h += '<section class="card hero"><div class="summary"><div class="ring">' + ring(tt.kcal / Math.max(1, tg.kcal + tt.ex), over ? "var(--pom)" : "var(--sun)") +
    '<div class="center"><div class="big num" style="color:' + (over ? "var(--pom)" : "inherit") + '">' + fmt(Math.abs(remaining)) + '</div><div class="cap">' + esc(over ? t("kcalOver") : t("kcalLeft")) + "</div></div></div>" +
    '<div class="eq"><div class="eq-row"><span class="muted">' + esc(t("goalKcal")) + '</span><b class="num">' + fmt(tg.kcal) + "</b></div>" +
    '<div class="eq-row"><span class="muted"><i class="dot" style="background:var(--sun)"></i>' + esc(t("food")) + '</span><b class="num">−' + fmt(tt.kcal) + "</b></div>" +
    '<div class="eq-row"><span class="muted"><i class="dot" style="background:var(--leaf)"></i>' + esc(t("exercise")) + '</span><b class="num">+' + fmt(tt.ex) + "</b></div></div></div>" +
    '<div class="macros">' + macro("p", t("protein"), "var(--protein)") + macro("c", t("carbs"), "var(--carbs)") + macro("f", t("fat"), "var(--fat)") + "</div>" +
    '<button class="link hero-link" data-act="nutrients">' + esc(t("allNutrients")) + ic("right", "flip") + "</button></section>";

  if (S.ramadan && isToday) h += ramadanCard();

  // Quick actions
  const qa = (act, icon, label, bg, fg) => '<button class="qa" data-act="' + act + '"><i style="background:' + bg + ";color:" + fg + '">' + ic(icon) + "</i>" + esc(label) + "</button>";
  h += '<div class="quick">' + qa("aiPhoto", "camera", t("scanMeal"), "linear-gradient(135deg,#ffb22e,#ff7a3d)", "#fff") + qa("aiVoice", "mic", t("voiceLog"), "linear-gradient(135deg,#7b6cff,#4f8dff)", "#fff") +
    qa("foodSearch", "search", t("logFood"), "linear-gradient(135deg,#2fc27a,#1d8a51)", "#fff") + qa("barcode", "barcode", t("barcode"), "linear-gradient(135deg,#556270,#2b333b)", "#fff") + "</div>";

  if (S.fast.start) h += fastMini();

  // Meals
  meals().forEach(m => {
    const items = d.food.filter(e => e.m === m);
    const kc = items.reduce((a, e) => a + e.kcal * e.q, 0);
    h += '<section class="card meal"><div class="meal-head"><span class="meal-ic">' + mealEmoji(m) + '</span><h2>' + esc(mealName(m)) + '</h2><span class="meal-kcal num">' + (items.length ? fmt(kc) + " " + esc(t("kcal")) : "") + '</span><button class="addbtn" data-act="foodSearch" data-m="' + m + '" aria-label="' + esc(t("addTo", { meal: mealName(m) })) + '">' + ic("plus") + "</button></div>";
    if (items.length) {
      h += '<div class="list">' + items.map(e => '<button class="row" data-act="entry" data-u="' + e.u + '"><span class="fthumb">' + foodEmoji(e) + '</span><div class="grow"><div class="t">' + esc(nm(e)) + '</div><div class="s num">' + esc(servingLabel(e, e.q)) + '</div></div><div class="k num">' + fmt(e.kcal * e.q) + "</div></button>").join("") + "</div>" +
        '<div class="meal-foot"><span class="small muted num">' + esc(t("p")) + " " + fmt(items.reduce((a, e) => a + e.p * e.q, 0)) + esc(t("g")) + " · " + esc(t("c")) + " " + fmt(items.reduce((a, e) => a + e.c * e.q, 0)) + esc(t("g")) + " · " + esc(t("f")) + " " + fmt(items.reduce((a, e) => a + e.f * e.q, 0)) + esc(t("g")) + '</span><button class="link" data-act="saveMeal" data-m="' + m + '">' + esc(t("saveAsMeal")) + "</button></div>";
    } else {
      const y = day(addDays(cur, -1)).food.filter(e => e.m === m);
      h += '<button class="empty-add" data-act="foodSearch" data-m="' + m + '">' + ic("plus") + esc(t("tapToAdd")) + "</button>" + (y.length ? '<button class="link" data-act="copyMeal" data-m="' + m + '">' + ic("copy") + esc(t("copyYesterday")) + "</button>" : "");
    }
    h += "</section>";
  });

  if (isToday) h += planCard();

  // Suggestions
  if (isToday && d.food.length && remaining > 0) h += suggestCard(remaining, tg.p - tt.p);

  // Water
  const cups = d.water || 0, goal = tg.water, ml = S.profile.glassMl;
  h += '<section class="card"><div class="card-head"><h2>' + esc(t("water")) + '</h2><span class="sub num">' + fmt((cups * ml) / 1000, 2) + " / " + fmt((goal * ml) / 1000, 1) + " " + esc(t("liters")) + "</span></div>" +
    '<div class="water-row"><button class="round-btn" data-act="waterAdd" data-n="-1" aria-label="' + esc(t("removeGlass")) + '">' + ic("minus") + '</button><div class="cups">';
  for (let i = 0; i < Math.max(goal, cups); i++) h += '<i class="cup' + (i < cups ? " on" : "") + '"></i>';
  h += '</div><button class="round-btn blue" data-act="waterAdd" data-n="1" aria-label="' + esc(t("addGlass")) + '">' + ic("plus") + "</button></div>" +
    '<div class="small muted num" style="margin-top:6px">' + esc(t("glassesOf", { n: fmt(cups), g: fmt(goal), ml: fmt(ml) })) + "</div></section>";

  // Activity
  h += '<section class="card"><div class="meal-head"><h2>' + esc(t("activity")) + '</h2><span class="meal-kcal num">' + (tt.ex ? "+" + fmt(tt.ex) + " " + esc(t("kcal")) : "") + '</span><button class="addbtn green" data-act="exSheet" aria-label="' + esc(t("logExercise")) + '">' + ic("plus") + '</button></div><div class="list">';
  d.ex.forEach(e => { h += '<button class="row" data-act="exEntry" data-u="' + e.u + '"><span class="fthumb green">' + exEmoji(e) + '</span><div class="grow"><div class="t">' + esc(nm(e)) + '</div><div class="s num">' + fmt(e.min) + " " + esc(t("min")) + '</div></div><div class="k num" style="color:var(--leaf)">+' + fmt(e.kcal) + "</div></button>"; });
  const stepPct = Math.min(1, (d.steps || 0) / S.profile.stepGoal);
  h += '<button class="row" data-act="stepsSheet"><span class="thumb leaf">' + ic("walk") + '</span><div class="grow"><div class="t">' + esc(t("steps")) + '</div><div class="bar thin"><i style="width:' + (stepPct * 100).toFixed(0) + '%;background:var(--leaf)"></i></div><div class="s num">' + (d.steps ? fmt(d.steps) + " / " + fmt(S.profile.stepGoal) : esc(t("tapToAddSteps"))) + "</div></div></button></div></section>";

  // Sleep & mood
  h += '<section class="card"><div class="card-head"><h2>' + esc(t("sleepMood")) + '</h2><span class="sub">' + (d.sleep ? fmt(d.sleep, 1) + " " + esc(t("hours")) : "") + "</span></div>" +
    '<div class="field"><span>' + esc(t("sleepQ")) + '</span><div class="chips wrap">' + [5, 6, 7, 8, 9].map(v => '<button class="chip' + (d.sleep === v ? " on" : "") + '" data-act="sleep" data-v="' + v + '">' + fmt(v) + (v === 9 ? "+" : "") + " " + esc(t("hShort")) + "</button>").join("") + "</div></div>" +
    '<div class="field" style="margin-top:12px"><span>' + esc(t("moodQ")) + '</span><div class="moods">' + ["😫", "😕", "😐", "🙂", "😄"].map((e, i) => '<button class="mood' + (d.mood === i + 1 ? " on" : "") + '" data-act="mood" data-v="' + (i + 1) + '" aria-label="' + esc(t("mood" + (i + 1))) + '">' + e + "</button>").join("") + "</div></div></section>";

  // Daily score + tip + share
  if (isToday) {
    const sc = dayScore();
    const mini = (v, color, label) => '<div class="mini"><div class="mring">' + ring(v, color, 56, 7) + "</div><span>" + esc(label) + "</span></div>";
    h += '<section class="card"><div class="card-head"><h2>' + esc(t("dayScore")) + '</h2><b class="score num">' + fmt(sc.total) + '<small>/' + fmt(100) + "</small></b></div>" +
      '<div class="minis">' + mini(sc.cal, "var(--sun)", t("calories")) + mini(sc.pro, "var(--protein)", t("protein")) + mini(sc.wat, "var(--water)", t("water")) + mini(sc.mov, "var(--leaf)", t("move")) + "</div>" +
      '<p class="small muted" style="margin:10px 0 0">' + esc(t(sc.total >= 100 ? "score100" : sc.total >= 70 ? "scoreGood" : sc.total >= 30 ? "scoreMid" : "scoreLow")) + "</p></section>";
    const tips = window.I18N[lang()].tips || window.I18N.en.tips;
    const idx = Math.floor(parseKey(dk()).getTime() / 86400000) % tips.length;
    h += '<section class="card tip"><span class="thumb sun">' + ic("bulb") + '</span><div><div class="label">' + esc(t("tipOfDay")) + "</div><p>" + esc(tips[idx]) + "</p></div></section>";
    if (d.food.length) h += '<button class="btn ghost block" data-act="shareDay">' + ic("share") + esc(t("shareDay")) + "</button>";
  }
  h += "</div></main>";
  return h;
}
function suggestCard(remaining, proteinLeft) {
  const list = suggestions(remaining, proteinLeft);
  if (!list.length) return "";
  return '<section class="card"><div class="card-head"><h2>' + esc(t("ideasTitle", { n: fmt(remaining) })) + '</h2></div><div class="list">' +
    list.map(f => '<div class="row"><span class="fthumb">' + foodEmoji(f) + '</span><div class="grow"><div class="t">' + esc(nm(f)) + '</div><div class="s num">' + esc(servingLabel(f)) + " · " + fmt(f.p) + esc(t("g")) + " " + esc(t("protein")) + '</div></div><div class="k num">' + fmt(f.kcal) + '</div><button class="addbtn" data-act="quickLog" data-id="' + f.id + '" aria-label="' + esc(t("add")) + '">' + ic("plus") + "</button></div>").join("") + "</div></section>";
}
function suggestions(remaining, proteinLeft) {
  const m = defaultMeal();
  const want = { b: ["dairy", "bread", "fruit"], l: ["kurdish", "meat", "veg"], d: ["kurdish", "meat", "veg"], s: ["fruit", "nuts", "dairy"] }[m];
  const seed = parseKey(dk()).getDate();
  return Object.values(FOOD)
    .filter(f => f.kcal >= 40 && f.kcal <= remaining * 0.85 && !["basic", "drink", "snack", "sweet"].includes(f.cat))
    .map(f => {
      const pd = (f.p * 4) / f.kcal;
      let s = pd * (proteinLeft > 20 ? 3 : 1) + (want.includes(f.cat) ? 0.6 : 0) + (f.cat === "kurdish" ? 0.15 : 0);
      s += ((f.id.charCodeAt(0) * 7 + f.id.length * 13 + seed * 31) % 100) / 400;
      return { f, s };
    })
    .sort((a, b) => b.s - a.s).slice(0, 4).map(x => x.f);
}
function ramadanCard() {
  const rc = ramadanCountdown(), pt = rc.next || rc.pt;
  return '<section class="card ramadan"><div class="card-head"><h2>' + ic("moon") + esc(t("ramadan")) + '</h2><button class="chip" data-act="citySheet">' + esc(cityInfo().name) + "</button></div>" +
    '<div class="rc"><div><div class="label">' + esc(t(rc.kind)) + '</div><div class="big num" data-rc="left">' + dur(rc.left) + "</div></div>" +
    '<div class="rc-times"><div><span class="muted small">' + esc(t("suhoor")) + '</span><b class="num">' + hm(pt.fajr) + '</b></div><div><span class="muted small">' + esc(t("iftar")) + '</span><b class="num">' + hm(rc.pt.maghrib) + "</b></div></div></div>" +
    '<p class="small muted" style="margin:8px 0 0">' + esc(t("ramadanNote")) + "</p></section>";
}

/* ---------- Train ---------- */
function routineMinutes(r) { return (r.rounds * r.moves.length * (r.work + r.rest) - r.rest) / 60; }
function renderTrain() {
  let h = header(t("tabTrain")) + '<main><div class="wrap">';
  // Week summary
  let mins = 0, kc = 0, n = 0;
  lastDays(7).forEach(k => day(k).ex.forEach(e => { mins += e.min || 0; kc += e.kcal; n++; }));
  h += '<section class="card"><div class="card-head"><h2>' + esc(t("thisWeek")) + '</h2></div><div class="tiles"><div class="tile"><b class="num">' + fmt(n) + "</b><span>" + esc(t("workouts")) + '</span></div><div class="tile"><b class="num">' + fmt(mins) + "</b><span>" + esc(t("minutes")) + '</span></div><div class="tile"><b class="num">' + fmt(kc) + "</b><span>" + esc(t("kcalBurned")) + "</span></div></div>" +
    '<div class="weekdots">' + lastDays(7).map(k => '<div class="wd' + (day(k).ex.length ? " on" : "") + '"><i></i><span>' + esc(weekdayShort(k)) + "</span></div>").join("") + "</div></section>";

  // Gym log
  const g = S.gym, act = g.active;
  h += '<section class="card"><div class="card-head"><h2>' + esc(t("gymLog")) + '</h2><span class="sub">' + esc(t("gymSub")) + "</span></div>";
  if (act) {
    const sets = act.items.reduce((a, it) => a + it.sets.filter(s => s.done).length, 0);
    h += '<button class="row" data-act="gymOpen"><span class="thumb leaf">' + ic("dumbbell") + '</span><div class="grow"><div class="t">' + esc(t("gymInProgress")) + '</div><div class="s num">' + fmt((Date.now() - act.start) / 60000) + " " + esc(t("min")) + " · " + fmt(sets) + " " + esc(t("sets")) + "</div></div>" + ic("right", "flip") + "</button>";
  } else {
    h += '<button class="btn leaf block" data-act="gymStart">' + ic("play") + esc(t("gymStart")) + "</button>";
    if (g.sessions.length) h += '<div class="list" style="margin-top:8px">' + g.sessions.slice(-3).reverse().map(s => '<div class="row"><div class="grow"><div class="t">' + esc(dateLabel(s.d)) + '</div><div class="s">' + esc(s.items.map(it => gymName(it.ex)).join(" · ")) + '</div></div><div class="k num">' + fmt(s.items.reduce((a, it) => a + it.sets.length, 0)) + " " + esc(t("sets")) + "</div></div>").join("") + "</div>";
  }
  h += "</section>";

  h += fastCard();

  h += '<h2 class="section-title display">' + esc(t("homeWorkouts")) + "</h2>";
  window.ROUTINES.forEach(r => {
    const min = routineMinutes(r);
    h += '<button class="card rowcard routine-card lv' + r.level + '" data-act="routine" data-id="' + r.id + '"><span class="rthumb">' + (window.EMOJI["r_" + r.id] || "💪") + '</span><span class="grow"><b>' + esc(r.n[li()]) + '</b><span class="s num">' + fmt(min) + " " + esc(t("min")) + " · ~" + fmt(exKcal(r.met, min)) + " " + esc(t("kcal")) + " · " + esc(t("level" + r.level)) + "</span></span>" + ic("right", "flip") + "</button>";
  });
  h += "</div></main>";
  return h;
}
const gymName = k => (window.GYM[k] ? window.GYM[k][li()] : k);
const FAST_PLANS = [12, 14, 16, 18, 20, 23];
function fastState() {
  const f = S.fast;
  if (!f.start) return null;
  const el = Date.now() - f.start, goal = f.plan * 3600000;
  return { el, goal, pct: el / goal, end: f.start + goal, done: el >= goal };
}
function fastMini() {
  const st = fastState();
  return '<button class="card rowcard" data-act="fastSheet"><span class="thumb water">' + ic("clock") + '</span><span class="grow"><b>' + esc(t("fastingNow")) + '</b><span class="s num"><span data-fast="el">' + dur(st.el) + '</span> · <span data-fast="pct">' + fmt(st.pct * 100) + "%</span></span></span>" + ic("right", "flip") + "</button>";
}
function fastStage(ms) {
  const hr = ms / 3600000;
  return t(hr < 4 ? "stage0" : hr < 12 ? "stage1" : hr < 16 ? "stage2" : hr < 18 ? "stage3" : "stage4");
}
function fastCard() {
  const f = S.fast, st = fastState();
  let h = '<section class="card"><div class="card-head"><h2>' + esc(t("fasting")) + '</h2><span class="sub">' + esc(t("fastSub")) + "</span></div>";
  if (!st) {
    h += '<div class="chips" style="margin-bottom:10px">' + FAST_PLANS.map(p => '<button class="chip' + (f.plan === p ? " on" : "") + '" data-act="fastPlan" data-p="' + p + '">' + loc(p + ":" + (24 - p)) + "</button>").join("") + "</div>" +
      '<p class="muted small" style="margin:0 0 12px">' + esc(t("fastPlanDesc", { h: fmt(f.plan), e: fmt(24 - f.plan) })) + "</p>" +
      '<button class="btn block blue" data-act="fastStart">' + esc(t("startFast")) + "</button>";
  } else {
    h += '<div class="summary"><div class="ring">' + ring(st.pct, st.done ? "var(--leaf)" : "var(--water)") + '<div class="center"><div class="big num" style="font-size:24px" data-fast="el">' + dur(st.el) + '</div><div class="cap num" data-fast="pct">' + fmt(st.pct * 100) + "%</div></div></div>" +
      '<div class="eq"><div class="eq-row"><span class="muted">' + esc(t("plan")) + '</span><b class="num">' + loc(f.plan + ":" + (24 - f.plan)) + '</b></div><div class="eq-row"><span class="muted">' + esc(t("started")) + '</span><b class="num">' + timeStr(f.start) + '</b></div><div class="eq-row"><span class="muted">' + esc(t("ends")) + '</span><b class="num">' + timeStr(st.end) + "</b></div>" +
      '<div class="eq-row"><span class="muted">' + esc(t("stage")) + '</span><b class="small">' + esc(fastStage(st.el)) + "</b></div></div></div>" +
      '<button class="btn block ' + (st.done ? "leaf" : "ghost") + '" style="margin-top:14px" data-act="fastEnd">' + esc(t("endFast")) + "</button>";
  }
  if (f.history.length) {
    h += '<div class="list" style="margin-top:10px">' + f.history.slice(-3).reverse().map(x => {
      const ok = x.end - x.start >= x.plan * 3600000;
      return '<div class="row"><div class="grow"><div class="t num">' + esc(shortDate(dk(new Date(x.start)))) + " · " + dur(x.end - x.start).slice(0, -3) + '</div></div><div class="k" style="color:' + (ok ? "var(--leaf)" : "var(--muted)") + '">' + esc(ok ? t("goalMet") : loc(x.plan + ":" + (24 - x.plan))) + "</div></div>";
    }).join("") + "</div>";
  }
  return h + "</section>";
}

/* ---------- Progress ---------- */
let calRange = 7;
function renderProgress() {
  const tg = targets(), p = S.profile;
  let h = header(t("tabProgress")) + '<main><div class="wrap">';
  // Level & streak
  const x = xp(), lvl = levelOf(x), lo = xpFor(lvl), hi = xpFor(lvl + 1);
  h += '<section class="card level"><div class="lv-badge num">' + fmt(lvl) + '</div><div class="grow"><b>' + esc(t("levelN", { n: fmt(lvl) })) + '</b><div class="bar"><i style="width:' + (((x - lo) / (hi - lo)) * 100).toFixed(0) + '%;background:var(--sun)"></i></div><div class="s num">' + fmt(x) + " XP · " + esc(t("xpToNext", { n: fmt(hi - x) })) + '</div></div><div class="streak">' + ic("flame") + '<b class="num">' + fmt(streak()) + "</b><span>" + esc(t("dayStreak")) + "</span></div></section>";

  h += weeklyReport();
  h += '<button class="card rowcard" data-act="report"><span class="rthumb small">📊</span><span class="grow"><b>' + esc(t("monthlyReport")) + '</b><span class="s">' + esc(t("monthlyReportSub")) + "</span></span>" + ic("right", "flip") + "</button>";

  // Weight
  const ws = sortedWeights();
  const curW = latestWeight(), startW = ws.length ? ws[0].kg : curW;
  const bmi = curW / Math.pow(p.height / 100, 2);
  const bmiCat = bmi < 18.5 ? "bmiUnder" : bmi < 25 ? "bmiNormal" : bmi < 30 ? "bmiOver" : "bmiObese";
  const toGo = curW - p.goalWeight;
  const gd = goalDate(toGo, tg);
  h += '<section class="card"><div class="card-head"><h2>' + esc(t("weight")) + '</h2><button class="chip" data-act="weightSheet">' + ic("plus") + esc(t("log")) + "</button></div>" +
    '<div class="tiles"><div class="tile"><b class="num">' + fmt(wShow(curW), 1) + "</b><span>" + esc(t("current")) + " (" + esc(wUnit()) + ')</span></div><div class="tile"><b class="num">' + (curW - startW > 0 ? "+" : "") + fmt(wShow(curW) - wShow(startW), 1) + "</b><span>" + esc(t("change")) + '</span></div><div class="tile"><b class="num">' + fmt(wShow(Math.abs(toGo)), 1) + "</b><span>" + esc(Math.abs(toGo) < 0.1 ? t("atGoal") : t("toGoal")) + "</span></div></div>" +
    weightChart(ws) +
    '<p class="small muted" style="margin:10px 0 0">' + esc(t("bmi")) + ' <b class="num" style="color:var(--fg)">' + fmt(bmi, 1) + "</b> · " + esc(t(bmiCat)) + (gd ? " · " + esc(gd) : "") + "</p></section>";

  // Body
  const lm = S.meas.length ? S.meas[S.meas.length - 1] : null, bf = bodyFat(lm);
  h += '<section class="card"><div class="card-head"><h2>' + esc(t("body")) + '</h2><button class="chip" data-act="measSheet">' + ic("ruler") + esc(t("measure")) + "</button></div>" +
    (lm ? '<div class="tiles">' + (bf ? '<div class="tile"><b class="num">' + fmt(bf, 1) + "%</b><span>" + esc(t("bodyFat")) + "</span></div>" : "") + ["waist", "hip", "chest", "arm"].filter(k => lm[k]).slice(0, bf ? 2 : 3).map(k => '<div class="tile"><b class="num">' + fmt(lShow(lm[k]), 1) + "</b><span>" + esc(t("m_" + k)) + " (" + esc(lUnit()) + ")</span></div>").join("") + "</div>" : '<p class="empty">' + esc(t("measEmpty")) + "</p>") +
    '<div id="photo-strip" class="photo-strip"></div><button class="btn ghost block" style="margin-top:10px" data-act="photoSheet">' + ic("image") + esc(t("progressPhotos")) + "</button></section>";

  // Calories
  const keys = lastDays(calRange);
  const logged = keys.filter(k => day(k).food.length);
  const avg = f => (logged.length ? logged.reduce((a, k) => a + totals(k)[f], 0) / logged.length : 0);
  h += '<section class="card"><div class="card-head"><h2>' + esc(t("calories")) + "</h2>" + seg("calRange", "r", [[7, t("week")], [30, t("month")]], calRange, ' style="width:150px"') + "</div>" +
    calChart(keys, tg.kcal) +
    '<div class="tiles" style="margin-top:12px"><div class="tile"><b class="num">' + fmt(avg("kcal")) + "</b><span>" + esc(t("avgKcal")) + '</span></div><div class="tile"><b class="num">' + fmt(avg("p")) + esc(t("g")) + "</b><span>" + esc(t("avgProtein")) + '</span></div><div class="tile"><b class="num">' + fmt(logged.length) + "</b><span>" + esc(t("daysLogged")) + "</span></div></div></section>";

  // Macro split
  const ap = avg("p") * 4, ac = avg("c") * 4, af = avg("f") * 9, tot = ap + ac + af || 1;
  h += '<section class="card"><div class="card-head"><h2>' + esc(t("macroSplit")) + "</h2></div>" +
    '<div class="stackbar"><i style="width:' + (ap / tot) * 100 + '%;background:var(--protein)"></i><i style="width:' + (ac / tot) * 100 + '%;background:var(--carbs)"></i><i style="width:' + (af / tot) * 100 + '%;background:var(--fat)"></i></div>' +
    '<div class="macros" style="margin-top:10px">' + [["protein", ap, "var(--protein)"], ["carbs", ac, "var(--carbs)"], ["fat", af, "var(--fat)"]].map(x => '<div class="small"><i class="dot" style="background:' + x[2] + '"></i>' + esc(t(x[0])) + ' <b class="num">' + fmt((x[1] / tot) * 100) + "%</b></div>").join("") + "</div></section>";

  // Sleep
  const sk = lastDays(7), sl = sk.map(k => day(k).sleep).filter(Boolean);
  h += '<section class="card"><div class="card-head"><h2>' + esc(t("sleep")) + '</h2><span class="sub num">' + (sl.length ? esc(t("avgHours", { n: fmt(sl.reduce((a, b) => a + b, 0) / sl.length, 1) })) : "") + "</span></div>" + sleepChart(sk) + "</section>";

  // Achievements
  const earned = BADGES.filter(b => S.badges[b.id]);
  h += '<section class="card"><div class="card-head"><h2>' + esc(t("achievements")) + '</h2><span class="sub num">' + fmt(earned.length) + " / " + fmt(BADGES.length) + '</span></div><div class="badges">' +
    BADGES.map(b => '<button class="badge' + (S.badges[b.id] ? " on" : "") + '" data-act="badgeInfo" data-id="' + b.id + '"><i>' + ic(b.icon) + "</i><span>" + esc(t("b_" + b.id)) + "</span></button>").join("") + "</div></section>";

  // Coach
  h += '<button class="card rowcard" data-act="coach"><span class="thumb sun">' + ic("chat") + '</span><span class="grow"><b>' + esc(t("coach")) + '</b><span class="s">' + esc(t("coachSub")) + "</span></span>" + ic("right", "flip") + "</button>";
  h += "</div></main>";
  setTimeout(loadPhotoStrip, 0);
  return h;
}
function weeklyReport() {
  const wk = lastDays(7), prev = lastDays(7, addDays(dk(), -7));
  const stats = keys => {
    const lg = keys.filter(k => day(k).food.length);
    let ex = 0; keys.forEach(k => { ex += day(k).ex.length; });
    const kc = lg.length ? lg.reduce((a, k) => a + totals(k).kcal, 0) / lg.length : 0;
    const pr = lg.length ? lg.reduce((a, k) => a + totals(k).p, 0) / lg.length : 0;
    return { lg: lg.length, ex, kc, pr };
  };
  const a = stats(wk), b = stats(prev), tg = targets();
  if (!a.lg && !a.ex) return "";
  const arrow = (x, y, goodUp) => (y ? (x > y ? (goodUp ? "▲" : "▲") : x < y ? "▼" : "") : "");
  let verdict = "reportStart";
  if (a.lg >= 5 && Math.abs(a.kc - tg.kcal) < tg.kcal * 0.12) verdict = "reportGreat";
  else if (a.lg >= 4) verdict = a.kc > tg.kcal * 1.12 ? "reportOver" : a.pr < tg.p * 0.8 ? "reportProtein" : "reportGood";
  return '<section class="card"><div class="card-head"><h2>' + esc(t("weeklyReport")) + '</h2><span class="sub">' + esc(t("last7")) + "</span></div>" +
    '<div class="tiles four"><div class="tile"><b class="num">' + fmt(a.lg) + '<small>/' + fmt(7) + "</small></b><span>" + esc(t("daysLogged")) + '</span></div><div class="tile"><b class="num">' + fmt(a.kc) + " <small>" + arrow(a.kc, b.kc) + "</small></b><span>" + esc(t("avgKcal")) + '</span></div><div class="tile"><b class="num">' + fmt(a.pr) + esc(t("g")) + "</b><span>" + esc(t("avgProtein")) + '</span></div><div class="tile"><b class="num">' + fmt(a.ex) + " <small>" + arrow(a.ex, b.ex) + "</small></b><span>" + esc(t("workouts")) + "</span></div></div>" +
    '<p class="small" style="margin:10px 0 0">' + esc(t(verdict)) + "</p></section>";
}
function bodyFat(m) {
  if (!m || !m.waist || !m.neck) return null;
  const h = S.profile.height, log = Math.log10;
  let v;
  if (S.profile.sex === "f") { if (!m.hip) return null; v = 495 / (1.29579 - 0.35004 * log(m.waist + m.hip - m.neck) + 0.221 * log(h)) - 450; }
  else v = 495 / (1.0324 - 0.19077 * log(m.waist - m.neck) + 0.15456 * log(h)) - 450;
  return v > 2 && v < 60 ? v : null;
}
function weightChart(ws) {
  const pts = ws.slice(-60);
  if (pts.length < 2) return '<p class="empty" style="margin-top:12px">' + esc(t("weightEmpty")) + "</p>";
  const W = 340, H = 150, L = 34, R = 8, Tp = 10, B = 22;
  const vals = pts.map(x => wShow(x.kg)).concat([wShow(S.profile.goalWeight)]);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  if (mx - mn < 2) { mn -= 1; mx += 1; }
  const pd = (mx - mn) * 0.12; mn -= pd; mx += pd;
  const t0 = parseKey(pts[0].d).getTime(), t1 = parseKey(pts[pts.length - 1].d).getTime();
  const X = d => L + ((parseKey(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const Y = v => Tp + (1 - (v - mn) / (mx - mn)) * (H - Tp - B);
  const line = pts.map((p, i) => (i ? "L" : "M") + X(p.d).toFixed(1) + " " + Y(wShow(p.kg)).toFixed(1)).join(" ");
  const area = line + " L" + X(pts[pts.length - 1].d).toFixed(1) + " " + (H - B) + " L" + L + " " + (H - B) + " Z";
  const gy = Y(wShow(S.profile.goalWeight));
  let g = "";
  for (let i = 0; i <= 3; i++) { const v = mn + ((mx - mn) * i) / 3, yy = Y(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end">' + fmt(v) + "</text>"; }
  const last = pts[pts.length - 1];
  return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" style="margin-top:12px" role="img" aria-label="' + esc(t("weight")) + '">' + g +
    '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" stroke="var(--leaf)" stroke-dasharray="4 4"/>' +
    '<path d="' + area + '" fill="var(--sun)" fill-opacity=".12"/><path d="' + line + '" fill="none" stroke="var(--sun)" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<circle cx="' + X(last.d).toFixed(1) + '" cy="' + Y(wShow(last.kg)).toFixed(1) + '" r="4.5" fill="var(--sun)" stroke="var(--card)" stroke-width="2"/>' +
    '<text x="' + L + '" y="' + (H - 6) + '">' + esc(shortDate(pts[0].d)) + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(shortDate(last.d)) + "</text></svg>";
}
function calChart(keys, goal) {
  const W = 340, H = 160, L = 34, R = 6, Tp = 10, B = 22;
  const vals = keys.map(k => totals(k).kcal);
  const mx = Math.max(goal * 1.25, ...vals);
  const bw = (W - L - R) / keys.length;
  const Y = v => Tp + (1 - v / mx) * (H - Tp - B);
  let g = "";
  [0, goal / 2, goal].forEach(v => { g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="' + (v === goal ? "var(--leaf)" : "var(--line)") + '"' + (v === goal ? ' stroke-dasharray="4 4"' : "") + '/><text x="' + (L - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + fmt(v) + "</text>"; });
  keys.forEach((k, i) => {
    const v = vals[i], bx = L + i * bw + bw * 0.18, w = bw * 0.64;
    if (v > 0) g += '<rect x="' + bx.toFixed(1) + '" y="' + Y(v).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (H - B - Y(v)).toFixed(1) + '" rx="' + Math.min(4, w / 2).toFixed(1) + '" fill="' + (v > goal * 1.05 ? "var(--pom)" : "var(--sun)") + '"/>';
    if (keys.length <= 7 || (i % 5 === 0 && keys.length - 1 - i >= 3) || i === keys.length - 1) g += '<text x="' + (bx + w / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(keys.length <= 7 ? weekdayShort(k) : shortDate(k)) + "</text>";
  });
  return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("calories")) + '">' + g + "</svg>";
}
function sleepChart(keys) {
  const W = 340, H = 120, L = 26, R = 6, Tp = 8, B = 22, mx = 10;
  const bw = (W - L - R) / keys.length, Y = v => Tp + (1 - v / mx) * (H - Tp - B);
  const goal = S.profile.sleepGoal;
  let g = '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(goal).toFixed(1) + '" y2="' + Y(goal).toFixed(1) + '" stroke="var(--leaf)" stroke-dasharray="4 4"/><text x="' + (L - 4) + '" y="' + (Y(goal) + 4).toFixed(1) + '" text-anchor="end">' + fmt(goal) + "</text>";
  keys.forEach((k, i) => {
    const v = day(k).sleep, bx = L + i * bw + bw * 0.22, w = bw * 0.56;
    if (v) g += '<rect x="' + bx.toFixed(1) + '" y="' + Y(v).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (H - B - Y(v)).toFixed(1) + '" rx="4" fill="var(--fat)"/>';
    g += '<text x="' + (bx + w / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(weekdayShort(k)) + "</text>";
  });
  return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("sleep")) + '">' + g + "</svg>";
}

/* ---------- Me ---------- */
function renderMe() {
  const tg = targets(), p = S.profile;
  let h = header(t("tabMe")) + '<main><div class="wrap">';
  h += '<section class="card"><div class="card-head"><h2>' + esc(p.name || t("yourTargets")) + '</h2><button class="chip" data-act="editProfile">' + ic("pen") + esc(t("edit")) + "</button></div>" +
    '<div class="tiles"><div class="tile"><b class="num">' + fmt(tg.kcal) + "</b><span>" + esc(t("kcalDay")) + '</span></div><div class="tile"><b class="num">' + fmt(tg.tdee) + "</b><span>" + esc(t("tdee")) + '</span></div><div class="tile"><b class="num">' + fmt(tg.p) + esc(t("g")) + "</b><span>" + esc(t("protein")) + "</span></div></div>" +
    '<p class="small muted" style="margin:12px 0 0">' + esc(t(p.sex === "m" ? "male" : "female")) + " · " + fmt(p.age) + " " + esc(t("years")) + " · " + fmt(lShow(p.height)) + " " + esc(lUnit()) + " · " + esc(t("goal_" + p.goal)) + "</p></section>";

  h += '<section class="card stack"><h2>' + esc(t("preferences")) + "</h2>" +
    '<div class="field"><span>' + esc(t("language")) + "</span>" + seg("setLang", "l", [["ckb", "سۆرانی"], ["kmr", "Kurmancî"], ["ar", "عربي"], ["en", "English"]], lang()) + "</div>" +
    '<div class="field"><span>' + esc(t("textSize")) + "</span>" + seg("setSize", "z", [["normal", t("sizeNormal")], ["large", t("sizeLarge")]], S.textSize) + "</div>" +
    '<div class="field"><span>' + esc(t("theme")) + "</span>" + seg("setTheme", "th", [["system", t("system")], ["light", t("light")], ["dark", t("dark")]], S.theme) + "</div>" +
    '<div class="field"><span>' + esc(t("units")) + "</span>" + seg("setUnits", "u", [["metric", t("metric")], ["imperial", t("imperial")]], S.units) + "</div></section>";

  h += '<section class="card stack"><h2>' + esc(t("plan")) + "</h2>" +
    '<div class="field"><span>' + esc(t("macroStyle")) + "</span>" + seg("setMacro", "m", [["bal", t("mBal")], ["pro", t("mPro")], ["low", t("mLow")], ["keto", t("mKeto")]], p.macro) + "</div>" +
    '<div class="grid2"><label class="field"><span>' + esc(t("customKcal")) + '</span><input class="input num" id="set-kcal" inputmode="numeric" placeholder="' + esc(t("auto")) + '" value="' + (p.kcalOverride ? fmt(p.kcalOverride) : "") + '"></label>' +
    '<label class="field"><span>' + esc(t("stepGoal")) + '</span><input class="input num" id="set-steps" inputmode="numeric" value="' + fmt(p.stepGoal) + '"></label>' +
    '<label class="field"><span>' + esc(t("waterGoal")) + '</span><input class="input num" id="set-water" inputmode="numeric" value="' + fmt(p.water) + '"></label>' +
    '<label class="field"><span>' + esc(t("glassSize")) + '</span><select class="input" id="set-glass">' + [200, 250, 330, 500].map(v => '<option value="' + v + '"' + (p.glassMl === v ? " selected" : "") + ">" + fmt(v) + " " + esc(t("ml")) + "</option>").join("") + "</select></label></div>" +
    '<label class="row toggle"><div class="grow"><div class="t">' + esc(t("ramadanMode")) + '</div><div class="s wrap-s">' + esc(t("ramadanSub")) + '</div></div><input type="checkbox" id="set-ramadan"' + (S.ramadan ? " checked" : "") + "></label>" +
    (S.ramadan ? '<button class="row" data-act="citySheet"><div class="grow"><div class="t">' + esc(t("city")) + '</div><div class="s">' + esc(cityInfo().name) + "</div></div>" + ic("right", "flip") + "</button>" : "") + "</section>";

  h += '<section class="card stack"><div class="card-head" style="margin:0"><h2>' + esc(t("aiTitle")) + '</h2><span class="pill ' + (aiReady() ? "ok" : "") + '">' + esc(aiReady() ? t("aiOn") : t("aiOff")) + "</span></div>" +
    (AI_SERVER ? '<div class="notice ok small">' + esc(t("aiShared")) + '</div><details' + (S.ai.key ? " open" : "") + '><summary class="small muted">' + esc(t("ownKey")) + '</summary><div class="stack" style="margin-top:10px">' : "") +
    '<p class="small muted" style="margin:0">' + esc(t("aiDesc")) + "</p>" +
    seg("setProvider", "pv", [["gemini", "Google Gemini"], ["claude", "Anthropic Claude"]], S.ai.provider) +
    (S.ai.key ? "" : '<ol class="steps"><li>' + esc(t(S.ai.provider === "gemini" ? "aiStep1g" : "aiStep1c")) + ' <a href="' + (S.ai.provider === "gemini" ? "https://aistudio.google.com/apikey" : "https://console.anthropic.com/settings/keys") + '" target="_blank" rel="noopener">' + (S.ai.provider === "gemini" ? "aistudio.google.com/apikey" : "console.anthropic.com") + "</a></li><li>" + esc(t(S.ai.provider === "gemini" ? "aiStep2g" : "aiStep2c")) + "</li><li>" + esc(t("aiStep3")) + "</li></ol>") +
    '<label class="field"><span>' + esc(t("apiKey")) + '</span><input class="input" id="ai-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + esc(S.ai.provider === "gemini" ? "AIza…" : "sk-ant-…") + '" value="' + esc(S.ai.key) + '"></label>' +
    '<details><summary class="small muted">' + esc(t("advanced")) + '</summary><label class="field" style="margin-top:8px"><span>' + esc(t("model")) + '</span><input class="input" id="ai-model" autocapitalize="off" spellcheck="false" placeholder="' + esc(defaultModel()) + '" value="' + esc(S.ai.model) + '"></label></details>' +
    '<div class="btns"><button class="btn sun" data-act="saveAi">' + esc(t("save")) + '</button><button class="btn ghost" data-act="testAi">' + esc(t("test")) + '</button></div><div id="ai-status"></div>' + (AI_SERVER ? "</div></details>" : "") + "</section>";

  h += '<section class="card stack"><h2>' + esc(t("myStuff")) + "</h2>" +
    '<button class="row" data-act="recipeNew"><span class="thumb sun">' + ic("bowl") + '</span><div class="grow"><div class="t">' + esc(t("newRecipe")) + '</div><div class="s">' + esc(t("newRecipeSub")) + "</div></div>" + ic("right", "flip") + "</button>" +
    '<button class="row" data-act="myFoods"><span class="thumb">' + ic("book") + '</span><div class="grow"><div class="t">' + esc(t("myFoodsMeals")) + '</div><div class="s num">' + fmt(S.custom.length) + " · " + fmt(S.meals.length) + "</div></div>" + ic("right", "flip") + "</button>" +
    '<button class="row" data-act="help"><span class="thumb">' + ic("help") + '</span><div class="grow"><div class="t">' + esc(t("howTo")) + "</div></div>" + ic("right", "flip") + "</button></section>";

  h += '<section class="card stack"><h2>' + esc(t("backup")) + '</h2><p class="small muted" style="margin:0">' + esc(t("backupDesc")) + "</p>" +
    '<div class="btns"><button class="btn ghost" data-act="exportData">' + ic("share") + esc(t("exportData")) + '</button><button class="btn ghost" data-act="importSheet">' + esc(t("importData")) + "</button></div>" +
    '<button class="btn danger block" data-act="reset">' + esc(t("resetAll")) + "</button></section>";

  h += '<p class="small muted center">' + esc(t("disclaimer")) + "<br>Xorak · خۆراک · v2.0</p></div></main>";
  return h;
}
const defaultModel = () => (S.ai.provider === "gemini" ? "gemini-2.5-flash" : "claude-haiku-5-5");
function saveSettingsInputs() {
  const g = id => document.getElementById(id);
  if (g("set-kcal")) { const v = num(g("set-kcal").value); S.profile.kcalOverride = v >= 800 && v <= 6000 ? Math.round(v) : 0; }
  if (g("set-water")) { const v = num(g("set-water").value); if (v >= 1 && v <= 30) S.profile.water = Math.round(v); }
  if (g("set-steps")) { const v = num(g("set-steps").value); if (v >= 1000 && v <= 50000) S.profile.stepGoal = Math.round(v); }
  if (g("set-glass")) S.profile.glassMl = Number(g("set-glass").value);
  if (g("set-ramadan")) S.ramadan = g("set-ramadan").checked;
}

const mealEmoji = m => (S.ramadan ? { b: "🌙", l: "☀️", d: "🌇", s: "🍎" } : { b: "🌅", l: "☀️", d: "🌙", s: "🍎" })[m];

/* ---------- Meal plan ---------- */
const MEAL_SHARE = { b: 0.25, l: 0.35, d: 0.3, s: 0.1 };
function planMeal(m, kcalTarget, avoid) {
  const combos = window.PLAN[m];
  let idx = Math.floor(Math.random() * combos.length);
  if (combos.length > 1 && idx === avoid) idx = (idx + 1) % combos.length;
  const base = combos[idx].reduce((a, it) => a + FOOD[it[0]].kcal * it[1], 0);
  const scale = Math.max(0.5, Math.min(2, Math.round((kcalTarget / base) * 4) / 4));
  return { i: idx, items: combos[idx].map(it => [it[0], Math.max(0.25, Math.round(it[1] * scale * 4) / 4)]) };
}
function makePlan() {
  const tg = targets(), days = [];
  for (let d = 0; d < 7; d++) {
    const day = {};
    ["b", "l", "d", "s"].forEach(m => { const prev = days[d - 1] && days[d - 1][m]; day[m] = planMeal(m, tg.kcal * MEAL_SHARE[m], prev ? prev.i : -1); });
    days.push(day);
  }
  S.plan = { start: dk(), days };
  save();
}
function planDayIndex(k = dk()) {
  if (!S.plan) return -1;
  const diff = Math.round((parseKey(k) - parseKey(S.plan.start)) / 86400000);
  return diff >= 0 && diff < 7 ? diff : -1;
}
const planKcal = items => items.reduce((a, it) => a + (FOOD[it[0]] ? FOOD[it[0]].kcal * it[1] : 0), 0);
function planCard() {
  const i = planDayIndex();
  if (i < 0) {
    return '<button class="card rowcard plan-cta" data-act="planner"><span class="rthumb small">🗓️</span><span class="grow"><b>' + esc(t("mealPlan")) + '</b><span class="s">' + esc(t("mealPlanSub")) + "</span></span>" + ic("right", "flip") + "</button>";
  }
  const pd = S.plan.days[i], logged = day(dk()).planned || {};
  return '<section class="card"><div class="card-head"><h2>🗓️ ' + esc(t("todaysPlan")) + '</h2><button class="chip" data-act="planner">' + esc(t("seeWeek")) + '</button></div><div class="list">' +
    meals().filter(m => pd[m]).map(m => '<div class="row"><span class="fthumb">' + mealEmoji(m) + '</span><div class="grow"><div class="t">' + esc(mealName(m)) + '</div><div class="s">' + esc(pd[m].items.map(it => nm(FOOD[it[0]])).join(" · ")) + '</div></div><div class="k num">' + fmt(planKcal(pd[m].items)) + "</div>" +
      (logged[m] ? '<span class="done-badge">' + ic("check") + "</span>" : '<button class="addbtn" data-act="logPlan" data-day="' + i + '" data-m="' + m + '" aria-label="' + esc(t("logThis")) + '">' + ic("plus") + "</button>") + "</div>").join("") + "</div></section>";
}
