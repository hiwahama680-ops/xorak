/* Xorak sheets (bottom panels), actions and startup. */
"use strict";

/* ---------- Sheet stack ---------- */
let SH = null;
let STACK = [];
const sheetEl = document.getElementById("sheet");
function openSheet(state) { stopCamera(); STACK = []; SH = state; showSheet(); }
function pushSheet(state) { if (SH) STACK.push(SH); SH = state; showSheet(); }
function backSheet() { stopCamera(); if (STACK.length) { SH = STACK.pop(); showSheet(); } else closeSheet(); }
function showSheet() { renderSheet(); sheetEl.hidden = false; document.body.classList.add("locked"); }
function closeSheet() {
  stopCamera();
  if (SH && SH.type === "player") stopPlayer();
  if (SH && SH.type === "aiPhoto" && SH.rec) { try { mediaRec.onstop = null; mediaRec.stop(); mediaRec.stream.getTracks().forEach(tr => tr.stop()); } catch (e) { /* ignore */ } }
  SH = null; STACK = []; sheetEl.hidden = true; sheetEl.innerHTML = ""; document.body.classList.remove("locked"); render();
}
function sheetTop(title, opts = {}) {
  return '<div class="grab"></div><div class="sheet-top">' + (STACK.length ? '<button class="iconbtn" data-act="sheetBack" aria-label="' + esc(t("back")) + '">' + ic("left", "flip") + "</button>" : "") +
    '<h2 class="display">' + esc(title) + "</h2>" + (opts.extra || "") + '<button class="iconbtn" data-act="close" aria-label="' + esc(t("close")) + '">' + ic("x") + "</button></div>";
}
function renderSheet() {
  if (!SH) return;
  const html = SHEETS[SH.type]();
  const panel = sheetEl.querySelector(".sheet-panel");
  const keep = panel && panel.dataset.type === SH.type ? panel.scrollTop : 0;
  sheetEl.innerHTML = '<div class="sheet-bg" data-act="close"></div><div class="sheet-panel' + (SH.full ? " full" : "") + '" data-type="' + SH.type + '" role="dialog" aria-modal="true">' + html + "</div>";
  const np = sheetEl.querySelector(".sheet-panel"); if (np && keep) np.scrollTop = keep;
  if (SH.focus) { const f = document.getElementById(SH.focus); if (f) f.focus(); SH.focus = null; }
  if (SH.after) { const fn = SH.after; SH.after = null; setTimeout(fn, 0); }
}
const SHEETS = {};

/* ---------- Toasts, confetti ---------- */
let undoBuf = null;
function toast(msg, undo) {
  const old = document.querySelector(".toast"); if (old) old.remove();
  const d = document.createElement("div"); d.className = "toast"; d.setAttribute("role", "status");
  d.innerHTML = "<span>" + esc(msg) + "</span>" + (undo ? '<button data-act="undo">' + esc(t("undo")) + "</button>" : "");
  document.body.appendChild(d);
  setTimeout(() => { if (d.isConnected) d.remove(); }, undo ? 5000 : 2400);
}
function confetti() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
  const W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio, ctx = c.getContext("2d");
  const cols = ["#e89a00", "#1f8f55", "#d4413a", "#2f86d6", "#6a6fd8", "#ffffff"];
  const ps = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 22, vy: -Math.random() * 26 - 8, s: (Math.random() * 6 + 4) * devicePixelRatio, r: Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)] }));
  let f = 0;
  (function step() {
    ctx.clearRect(0, 0, W, H);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.9; p.vx *= 0.99; p.r += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (++f < 110) requestAnimationFrame(step); else c.remove();
  })();
}
let badgeCheckReady = false;
function checkBadges() {
  const fresh = BADGES.filter(b => !S.badges[b.id] && b.test());
  if (!fresh.length) return;
  fresh.forEach(b => { S.badges[b.id] = dk(); });
  save();
  if (!badgeCheckReady) return; // don't celebrate old progress on first load
  setTimeout(() => { confetti(); toast(t("badgeEarned", { b: t("b_" + fresh[0].id) })); }, 300);
}

/* ---------- Add menu ---------- */
SHEETS.addMenu = () => {
  const item = (act, icon, label, sub, cls) => '<button class="row" data-act="' + act + '"><span class="thumb ' + cls + '">' + ic(icon) + '</span><div class="grow"><div class="t">' + esc(label) + '</div><div class="s">' + esc(sub) + "</div></div></button>";
  return sheetTop(t("add")) +
    '<div class="bigacts"><button class="bigact sun" data-act="aiPhoto">' + ic("camera") + "<b>" + esc(t("scanMeal")) + "</b><small>" + esc(t("scanMealSub")) + '</small></button><button class="bigact" data-act="foodSearch">' + ic("search") + "<b>" + esc(t("logFood")) + "</b><small>" + esc(t("logFoodSub")) + "</small></button></div>" +
    '<div class="card"><div class="list">' +
    item("aiText", "spark", t("describeMeal"), t("describeMealSub"), "sun") +
    item("barcode", "barcode", t("barcode"), t("barcodeSub"), "") +
    item("quickAdd", "bolt", t("quickAdd"), t("quickAddSub"), "") +
    item("waterQuick", "drop", t("addGlass"), t("waterSub"), "water") +
    item("exSheet", "flame", t("logExercise"), t("logExerciseSub"), "leaf") +
    item("weightSheet", "scale", t("logWeight"), t("logWeightSub"), "water") +
    item("fastSheet", "clock", t("fasting"), t("fastSub"), "water") +
    "</div></div>";
};

/* ---------- Food search ---------- */
const CATS = ["all", "recent", "fav", "meals", "mine", "kurdish", "bread", "dairy", "meat", "fruit", "nuts", "veg", "snack", "sweet", "drink", "basic"];
const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ًͯ-ْ]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/ة/g, "ە").replace(/[أإآ]/g, "ا").replace(/ى/g, "ی");
function foodMatches(f, q) { return f.n.some(x => norm(x).includes(q)); }
function foodResults() {
  const q = norm(SH.q).trim(), cat = SH.cat;
  const all = Object.values(FOOD).concat(S.custom);
  let list;
  if (cat === "recent") list = S.recent.map(getFood).filter(Boolean);
  else if (cat === "fav") list = S.fav.map(getFood).filter(Boolean);
  else if (cat === "mine") list = S.custom.slice().reverse();
  else if (cat === "all") list = q ? all : S.recent.map(getFood).filter(Boolean).concat(all.filter(f => !S.recent.includes(f.id)));
  else list = all.filter(f => f.cat === cat);
  if (q) {
    list = list.filter(f => foodMatches(f, q));
    list.sort((a, b) => (norm(nm(a)).startsWith(q) ? 0 : 1) - (norm(nm(b)).startsWith(q) ? 0 : 1));
  }
  return list.slice(0, 100);
}
function foodRows() {
  if (SH.cat === "meals") {
    if (!S.meals.length) return '<div class="empty pad">' + esc(t("noMeals")) + "</div>";
    return S.meals.slice().reverse().map(m => '<button class="row" data-act="addSavedMeal" data-id="' + m.id + '"><span class="fthumb">' + (m.items[0] ? foodEmoji(m.items[0]) : "🍽️") + '</span><div class="grow"><div class="t">' + esc(m.name) + '</div><div class="s">' + esc(m.items.map(nm).join(" · ")) + '</div></div><div class="k num">' + fmt(m.items.reduce((a, e) => a + e.kcal * e.q, 0)) + "</div></button>").join("");
  }
  const list = foodResults();
  if (!list.length) {
    return '<div class="empty pad">' + esc(SH.cat === "fav" ? t("noFav") : SH.cat === "mine" ? t("noMine") : SH.cat === "recent" ? t("noRecent") : t("noResults")) + "</div>" +
      (SH.q ? '<div class="stack"><button class="btn ghost block" data-act="aiTextFrom">' + ic("spark") + esc(t("askAiAbout", { n: SH.q })) + '</button><button class="btn ghost block" data-act="customFood">' + ic("pen") + esc(t("createNamed", { n: SH.q })) + "</button></div>" : "");
  }
  return list.map(f => '<button class="row" data-act="foodPick" data-id="' + esc(f.id) + '"><span class="fthumb">' + foodEmoji(f) + '</span><div class="grow"><div class="t">' + esc(nm(f)) + (S.fav.includes(f.id) ? ' <span class="star">★</span>' : "") + '</div><div class="s num">' + esc(servingLabel(f)) + '</div></div><div class="k num">' + fmt(f.kcal) + " <small>" + esc(t("kcal")) + '</small></div><span class="plus-mini" data-act="quickPick" data-id="' + esc(f.id) + '" role="button" aria-label="' + esc(t("add")) + '">' + ic("plus") + "</span></button>").join("");
}
SHEETS.food = () => {
  const recipe = SH.mode === "recipe";
  return sheetTop(recipe ? t("addIngredient") : t("logFood")) + (recipe ? "" : '<div style="margin-bottom:12px">' + mealSeg() + "</div>") +
    '<div class="search">' + ic("search") + '<input class="input" id="food-q" type="search" autocomplete="off" enterkeyhint="search" placeholder="' + esc(t("searchFoods")) + '" value="' + esc(SH.q || "") + '"></div>' +
    '<div class="chips" style="margin:12px 0">' + CATS.filter(c => !(recipe && c === "meals")).map(c => '<button class="chip' + (SH.cat === c ? " on" : "") + '" data-act="foodCat" data-c="' + c + '">' + esc(t("cat_" + c)) + "</button>").join("") + "</div>" +
    (recipe ? "" : '<div class="btns" style="margin-bottom:12px"><button class="btn ghost" data-act="aiPhoto">' + ic("camera") + esc(t("scan")) + '</button><button class="btn ghost" data-act="barcode">' + ic("barcode") + esc(t("barcode")) + '</button><button class="btn ghost" data-act="customFood">' + ic("pen") + esc(t("create")) + "</button></div>") +
    '<div class="card" style="padding-block:4px"><div class="list" id="food-list">' + foodRows() + "</div></div>";
};
function servedFood(f, alt) {
  const opts = altServings(f), a = opts[alt || 0] || opts[0];
  if (!a || a[1] === 1) return f;
  const k = a[1], mul = v => (v || 0) * k;
  return Object.assign({}, f, { unit: a[0], cnt: 1, g: f.g ? Math.round(f.g * k) : 0, kcal: mul(f.kcal), p: mul(f.p), c: mul(f.c), f: mul(f.f), mi: f.mi ? f.mi.map(mul) : null });
}
function microTiles(mi, q = 1, full) {
  if (!mi) return "";
  const keys = full ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2];
  const unit = i => (i < 2 ? t("g") : t("mg"));
  return '<div class="micro-row">' + keys.map(i => '<div><b class="num">' + fmt(mi[i] * q, i === 5 ? 1 : 0) + " " + esc(unit(i)) + "</b><span>" + esc(t("mi_" + window.MICRO_KEYS[i])) + "</span></div>").join("") + "</div>";
}
SHEETS.foodDetail = () => {
  const f0 = getFood(SH.id), recipe = SH.mode === "recipe";
  const f = servedFood(f0, SH.alt);
  const isFav = S.fav.includes(f.id);
  const q = SH.qty, byG = SH.unitMode === "g" && f.g;
  const val = k => f[k] * q;
  let h = sheetTop(nm(f), { extra: recipe ? "" : '<button class="iconbtn" data-act="toggleFav" aria-label="' + esc(t("favorite")) + '" aria-pressed="' + isFav + '">' + (isFav ? '<span class="star big">★</span>' : ic("star")) + "</button>" }) + '<div class="stack">' +
    '<div class="food-hero"><span class="big-emoji">' + foodEmoji(f0) + '</span><div><div class="muted">' + esc(servingLabel(f)) + '</div>' + (lang() !== "en" && f.n[0] !== nm(f) ? '<div class="small muted">' + esc(f.n[0]) + "</div>" : "") + "</div></div>";
  const opts = altServings(f0);
  if (opts.length > 1 && SH.unitMode !== "g") h += '<div class="field"><span>' + esc(t("servingSize")) + '</span><div class="chips">' + opts.map((o, i) => '<button class="chip' + ((SH.alt || 0) === i ? " on" : "") + '" data-act="servAlt" data-i="' + i + '">' + esc(t("u_" + o[0])) + "</button>").join("") + "</div></div>";
  if (f.g && f.unit !== "g") h += seg("unitMode", "um", [["srv", t("servings")], ["g", t("grams")]], SH.unitMode || "srv");
  h += byG
    ? '<div class="field"><span>' + esc(t("grams")) + '</span><div class="stepper"><button data-act="gStep" data-d="-10" aria-label="−">−</button><input class="input num" id="grams" inputmode="decimal" value="' + fmt(q * f.g) + '"><button data-act="gStep" data-d="10" aria-label="+">+</button></div></div>'
    : '<div class="field"><span>' + esc(t("servings")) + '</span><div class="stepper"><button data-act="qty" data-d="-0.5" aria-label="−">−</button><input class="input num" id="qty" inputmode="decimal" value="' + fmt(q, 2) + '"><button data-act="qty" data-d="0.5" aria-label="+">+</button></div></div>' +
      '<div class="chips">' + [0.5, 1, 1.5, 2, 3].map(v => '<button class="chip' + (q === v ? " on" : "") + '" data-act="qtySet" data-v="' + v + '">' + fmt(v, 2) + "×</button>").join("") + "</div>";
  h += nutriTiles(val("kcal"), val("p"), val("c"), val("f")) + microTiles(f.mi, q);
  if (recipe) h += '<button class="btn sun block" data-act="addToRecipe">' + esc(t("addToRecipe")) + "</button>";
  else {
    h += mealSeg() + '<button class="btn sun block big" data-act="addFood">' + esc(t("addTo", { meal: mealName(SH.m) })) + "</button>";
    if (f.cat === "recipe" && f.items) h += '<p class="small muted" style="margin:0">' + esc(t("ingredients")) + ": " + esc(f.items.map(nm).join(", ")) + "</p>";
    if (S.custom.includes(f)) h += '<button class="btn danger block" data-act="delCustom">' + esc(t("deleteFood")) + "</button>";
  }
  return h + "</div>";
};
function nutriTiles(kcal, p, c, f) {
  return '<div class="tiles four"><div class="tile"><b class="num">' + fmt(kcal) + "</b><span>" + esc(t("kcal")) + '</span></div><div class="tile"><b class="num" style="color:var(--protein)">' + fmt(p, 1) + "</b><span>" + esc(t("protein")) + '</span></div><div class="tile"><b class="num" style="color:var(--carbs)">' + fmt(c, 1) + "</b><span>" + esc(t("carbs")) + '</span></div><div class="tile"><b class="num" style="color:var(--fat)">' + fmt(f, 1) + "</b><span>" + esc(t("fat")) + "</span></div></div>";
}
SHEETS.custom = () => sheetTop(SH.quick ? t("quickAdd") : t("createFood")) + '<div class="stack">' +
  '<label class="field"><span>' + esc(t("name")) + '</span><input class="input" id="cf-name" value="' + esc(SH.name || "") + '" placeholder="' + esc(SH.quick ? t("quickAdd") : t("namePh")) + '"></label>' +
  (SH.quick ? "" : '<div class="grid2"><label class="field"><span>' + esc(t("serving")) + '</span><input class="input" id="cf-sv" placeholder="' + esc(t("servingPh")) + '"></label><label class="field"><span>' + esc(t("grams")) + '</span><input class="input num" id="cf-g" inputmode="decimal" placeholder="' + esc(t("optional")) + '"></label></div>') +
  '<label class="field"><span>' + esc(t("kcal")) + '</span><input class="input num big-input" id="cf-kcal" inputmode="decimal"></label>' +
  '<div class="grid3"><label class="field"><span>' + esc(t("protein")) + '</span><input class="input num" id="cf-p" inputmode="decimal" placeholder="' + esc(t("g")) + '"></label><label class="field"><span>' + esc(t("carbs")) + '</span><input class="input num" id="cf-c" inputmode="decimal" placeholder="' + esc(t("g")) + '"></label><label class="field"><span>' + esc(t("fat")) + '</span><input class="input num" id="cf-f" inputmode="decimal" placeholder="' + esc(t("g")) + '"></label></div>' +
  mealSeg() +
  (SH.quick ? "" : '<label class="row toggle"><div class="grow"><div class="t">' + esc(t("saveToMine")) + '</div></div><input type="checkbox" id="cf-save" checked></label>') +
  '<div id="cf-err"></div><button class="btn sun block big" data-act="saveCustom">' + esc(t("addTo", { meal: mealName(SH.m) })) + "</button></div>";

SHEETS.entry = () => {
  const e = day().food.find(x => x.u === SH.u);
  if (!e) return sheetTop("");
  const q = SH.qty;
  return sheetTop(nm(e)) + '<div class="stack"><div class="food-hero"><span class="big-emoji">' + foodEmoji(e) + '</span><div class="muted">' + esc(servingLabel(e)) + "</div></div>" +
    '<div class="field"><span>' + esc(t("servings")) + '</span><div class="stepper"><button data-act="qty" data-d="-0.5" aria-label="−">−</button><input class="input num" id="qty" inputmode="decimal" value="' + fmt(q, 2) + '"><button data-act="qty" data-d="0.5" aria-label="+">+</button></div></div>' +
    nutriTiles(e.kcal * q, e.p * q, e.c * q, e.f * q) + microTiles(e.mi, q) + mealSeg() +
    '<div class="btns"><button class="btn danger" data-act="delEntry">' + ic("trash") + esc(t("remove")) + '</button><button class="btn sun" data-act="saveEntry">' + esc(t("save")) + "</button></div></div>";
};
SHEETS.saveMeal = () => sheetTop(t("saveAsMeal")) + '<div class="stack"><p class="small muted" style="margin:0">' + esc(t("saveMealDesc")) + '</p><label class="field"><span>' + esc(t("name")) + '</span><input class="input" id="sm-name" value="' + esc(SH.name) + '"></label><button class="btn sun block" data-act="doSaveMeal">' + esc(t("save")) + "</button></div>";

/* ---------- Recipes ---------- */
let RECIPE = null;
SHEETS.recipe = () => {
  const r = RECIPE, tot = r.items.reduce((a, i) => ({ kcal: a.kcal + i.kcal * i.q, p: a.p + i.p * i.q, c: a.c + i.c * i.q, f: a.f + i.f * i.q }), { kcal: 0, p: 0, c: 0, f: 0 });
  const sv = Math.max(1, r.servings);
  return sheetTop(t("newRecipe")) + '<div class="stack">' +
    '<label class="field"><span>' + esc(t("recipeName")) + '</span><input class="input" id="rc-name" value="' + esc(r.name) + '" placeholder="' + esc(t("recipePh")) + '"></label>' +
    '<div class="field"><span>' + esc(t("recipeServings")) + '</span><div class="stepper"><button data-act="rcServ" data-d="-1" aria-label="−">−</button><output class="input num">' + fmt(sv) + '</output><button data-act="rcServ" data-d="1" aria-label="+">+</button></div></div>' +
    '<div class="card" style="padding-block:4px"><div class="list">' + (r.items.length ? r.items.map((i, n) => '<div class="row"><div class="grow"><div class="t">' + esc(nm(i)) + '</div><div class="s num">' + esc(servingLabel(i, i.q)) + '</div></div><div class="k num">' + fmt(i.kcal * i.q) + '</div><button class="iconbtn sm flat" data-act="rcDel" data-i="' + n + '" aria-label="' + esc(t("remove")) + '">' + ic("trash") + "</button></div>").join("") : '<div class="empty pad">' + esc(t("recipeEmpty")) + "</div>") + "</div></div>" +
    '<button class="btn ghost block" data-act="rcAdd">' + ic("plus") + esc(t("addIngredient")) + "</button>" +
    (r.items.length ? '<div class="label">' + esc(t("perServing")) + "</div>" + nutriTiles(tot.kcal / sv, tot.p / sv, tot.c / sv, tot.f / sv) : "") +
    '<div id="rc-err"></div><button class="btn sun block big" data-act="rcSave">' + esc(t("saveRecipe")) + "</button></div>";
};

/* ---------- My foods ---------- */
SHEETS.myFoods = () => sheetTop(t("myFoodsMeals")) +
  '<div class="label" style="margin:4px 4px 8px">' + esc(t("cat_mine")) + '</div><div class="card" style="padding-block:4px"><div class="list">' +
  (S.custom.length ? S.custom.slice().reverse().map(c => '<div class="row"><span class="thumb ' + (c.cat === "recipe" ? "sun" : "") + '">' + ic(c.cat === "recipe" ? "bowl" : "book") + '</span><div class="grow"><div class="t">' + esc(nm(c)) + '</div><div class="s num">' + fmt(c.kcal) + " " + esc(t("kcal")) + " · " + esc(servingLabel(c)) + '</div></div><button class="iconbtn sm flat" data-act="delCustomId" data-id="' + c.id + '" aria-label="' + esc(t("remove")) + '">' + ic("trash") + "</button></div>").join("") : '<div class="empty pad">' + esc(t("noMine")) + "</div>") + "</div></div>" +
  '<div class="label" style="margin:16px 4px 8px">' + esc(t("cat_meals")) + '</div><div class="card" style="padding-block:4px"><div class="list">' +
  (S.meals.length ? S.meals.slice().reverse().map(m => '<div class="row"><span class="thumb sun">' + ic("bowl") + '</span><div class="grow"><div class="t">' + esc(m.name) + '</div><div class="s num">' + fmt(m.items.reduce((a, e) => a + e.kcal * e.q, 0)) + " " + esc(t("kcal")) + '</div></div><button class="iconbtn sm flat" data-act="delMeal" data-id="' + m.id + '" aria-label="' + esc(t("remove")) + '">' + ic("trash") + "</button></div>").join("") : '<div class="empty pad">' + esc(t("noMeals")) + "</div>") + "</div></div>";

/* ---------- Exercise ---------- */
SHEETS.ex = () => {
  if (SH.pick) {
    const a = ACT.find(x => x.id === SH.pick);
    return sheetTop(nm(a)) + '<div class="stack"><div class="field"><span>' + esc(t("minutes")) + '</span><div class="stepper"><button data-act="exMin" data-d="-5" aria-label="−">−</button><input class="input num" id="ex-min" inputmode="numeric" value="' + fmt(SH.min) + '"><button data-act="exMin" data-d="5" aria-label="+">+</button></div></div>' +
      '<div class="chips">' + [10, 20, 30, 45, 60, 90].map(v => '<button class="chip' + (SH.min === v ? " on" : "") + '" data-act="exMinSet" data-v="' + v + '">' + fmt(v) + " " + esc(t("min")) + "</button>").join("") + "</div>" +
      '<div class="card center"><div class="hero-num num" style="color:var(--leaf)">' + fmt(exKcal(a.met, SH.min)) + '</div><div class="muted small">' + esc(t("kcalBurnedEst")) + "</div></div>" +
      '<button class="btn leaf block big" data-act="exAdd">' + esc(t("add")) + "</button></div>";
  }
  const q = norm(SH.q);
  const list = ACT.filter(a => !q || a.n.some(x => norm(x).includes(q)));
  return sheetTop(t("logExercise")) + '<div class="search" style="margin-bottom:12px">' + ic("search") + '<input class="input" id="ex-q" type="search" autocomplete="off" placeholder="' + esc(t("searchActivities")) + '" value="' + esc(SH.q || "") + '"></div>' +
    '<div class="card" style="padding-block:4px"><div class="list" id="ex-list">' + list.map(a => '<button class="row" data-act="exPick" data-id="' + a.id + '"><span class="fthumb green">' + exEmoji(a) + '</span><div class="grow"><div class="t">' + esc(nm(a)) + '</div><div class="s num">~' + fmt(exKcal(a.met, 30)) + " " + esc(t("kcal")) + " / " + fmt(30) + " " + esc(t("min")) + "</div></div>" + ic("right", "flip") + "</button>").join("") + "</div></div>" +
    '<h3 class="section-title">' + esc(t("customExercise")) + '</h3><div class="card stack"><label class="field"><span>' + esc(t("name")) + '</span><input class="input" id="cx-name"></label><div class="grid2"><label class="field"><span>' + esc(t("minutes")) + '</span><input class="input num" id="cx-min" inputmode="numeric"></label><label class="field"><span>' + esc(t("kcal")) + '</span><input class="input num" id="cx-kcal" inputmode="numeric"></label></div><button class="btn leaf block" data-act="cxAdd">' + esc(t("add")) + "</button></div>";
};
SHEETS.exEntry = () => {
  const e = day().ex.find(x => x.u === SH.u);
  return sheetTop(e ? nm(e) : "") + (e ? '<div class="stack"><div class="card center"><div class="hero-num num" style="color:var(--leaf)">+' + fmt(e.kcal) + '</div><div class="muted small num">' + fmt(e.min) + " " + esc(t("min")) + '</div></div><button class="btn danger block" data-act="delEx">' + ic("trash") + esc(t("remove")) + "</button></div>" : "");
};
SHEETS.steps = () => sheetTop(t("steps")) + '<div class="stack"><p class="muted small" style="margin:0">' + esc(t("stepsDesc")) + '</p><label class="field"><span>' + esc(t("stepsToday")) + '</span><input class="input num big-input" id="steps-in" inputmode="numeric" value="' + (day().steps ? fmt(day().steps) : "") + '"></label><button class="btn leaf block big" data-act="saveSteps">' + esc(t("save")) + "</button></div>";

/* ---------- Weight, body, photos ---------- */
SHEETS.weight = () => {
  const ex = S.weights.find(w => w.d === cur);
  const list = S.weights.slice().sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 10);
  return sheetTop(t("logWeight")) + '<div class="stack"><label class="field"><span>' + esc(dateLabel(cur)) + " (" + esc(wUnit()) + ')</span><div class="stepper"><button data-act="wStep" data-d="-0.1" aria-label="−">−</button><input class="input num big-input" id="w-in" inputmode="decimal" value="' + fmt(wShow(ex ? ex.kg : latestWeight()), 1) + '"><button data-act="wStep" data-d="0.1" aria-label="+">+</button></div></label><button class="btn blue block big" data-act="saveWeight">' + esc(t("save")) + "</button>" +
    (list.length ? '<div class="card" style="padding-block:4px"><div class="list">' + list.map(w => '<div class="row"><div class="grow"><div class="t">' + esc(dateLabel(w.d)) + '</div></div><div class="k num">' + fmt(wShow(w.kg), 1) + " " + esc(wUnit()) + '</div><button class="iconbtn sm flat" data-act="delWeight" data-d="' + w.d + '" aria-label="' + esc(t("remove")) + '">' + ic("trash") + "</button></div>").join("") + "</div></div>" : "") + "</div>";
};
const MEAS = ["waist", "neck", "hip", "chest", "arm", "thigh"];
SHEETS.meas = () => {
  const last = S.meas.length ? S.meas[S.meas.length - 1] : {};
  return sheetTop(t("measure")) + '<div class="stack"><p class="small muted" style="margin:0">' + esc(t("measHelp")) + '</p><div class="grid2">' +
    MEAS.map(k => '<label class="field"><span>' + esc(t("m_" + k)) + " (" + esc(lUnit()) + ')</span><input class="input num" id="m-' + k + '" inputmode="decimal" value="' + (last[k] ? fmt(lShow(last[k]), 1) : "") + '"></label>').join("") +
    '</div><button class="btn sun block big" data-act="saveMeas">' + esc(t("save")) + "</button></div>";
};
// IndexedDB photo store
function idb() {
  return new Promise((ok, bad) => {
    try {
      const r = indexedDB.open("xorak", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("photos", { keyPath: "id" });
      r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
    } catch (e) { bad(e); }
  });
}
async function photoOp(mode, val) {
  const db = await idb();
  return new Promise((ok, bad) => {
    const tx = db.transaction("photos", mode === "all" ? "readonly" : "readwrite"), st = tx.objectStore("photos");
    const r = mode === "all" ? st.getAll() : mode === "put" ? st.put(val) : st.delete(val);
    r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
  });
}
let photoURLs = [];
async function photosSorted() {
  photoURLs.forEach(u => URL.revokeObjectURL(u)); photoURLs = [];
  const all = (await photoOp("all")) || [];
  return all.sort((a, b) => (a.d < b.d ? -1 : 1)).map(p => { const u = URL.createObjectURL(p.blob); photoURLs.push(u); return Object.assign({ url: u }, p); });
}
async function loadPhotoStrip() {
  const el = document.getElementById("photo-strip"); if (!el) return;
  try {
    const ps = await photosSorted();
    if (!ps.length) return;
    const show = ps.length > 1 ? [ps[0], ps[ps.length - 1]] : ps;
    el.innerHTML = show.map(p => '<figure><img src="' + p.url + '" alt=""><figcaption class="num">' + esc(shortDate(p.d)) + "</figcaption></figure>").join("");
  } catch (e) { /* no photos */ }
}
SHEETS.photos = () => {
  setTimeout(async () => {
    const g = document.getElementById("photo-grid"); if (!g) return;
    try {
      const ps = await photosSorted();
      g.innerHTML = ps.length ? (ps.length > 1 ? '<div class="compare"><figure><img src="' + ps[0].url + '" alt=""><figcaption>' + esc(t("before")) + " · " + esc(shortDate(ps[0].d)) + '</figcaption></figure><figure><img src="' + ps[ps.length - 1].url + '" alt=""><figcaption>' + esc(t("now")) + " · " + esc(shortDate(ps[ps.length - 1].d)) + "</figcaption></figure></div>" : "") +
        '<div class="pgrid">' + ps.slice().reverse().map(p => '<button data-act="photoDel" data-id="' + p.id + '" aria-label="' + esc(t("remove")) + '"><img src="' + p.url + '" alt=""><span class="num">' + esc(shortDate(p.d)) + "</span></button>").join("") + "</div>"
        : '<p class="empty">' + esc(t("photosEmpty")) + "</p>";
    } catch (e) { g.innerHTML = '<p class="notice err">' + esc(t("photosUnavailable")) + "</p>"; }
  }, 0);
  return sheetTop(t("progressPhotos")) + '<div class="stack"><p class="small muted" style="margin:0">' + esc(t("photosHelp")) + '</p><label class="btn sun block">' + ic("camera") + esc(t("addPhoto")) + '<input type="file" accept="image/*" id="photo-in" hidden></label><div id="photo-grid"></div>' +
    (SH.delId ? '<button class="btn danger block" data-act="photoDelConfirm">' + esc(t("tapAgainDeletePhoto")) + "</button>" : "") + "</div>";
};

/* ---------- Fasting, Ramadan city ---------- */
SHEETS.fast = () => sheetTop(t("fasting")) + fastCard();
SHEETS.city = () => sheetTop(t("city")) + '<div class="stack"><button class="btn ghost block" data-act="useLocation">' + esc(t("useLocation")) + '</button><div id="loc-err"></div><div class="card" style="padding-block:4px"><div class="list">' +
  window.CITIES.map((c, i) => '<button class="row" data-act="pickCity" data-i="' + i + '"><div class="grow"><div class="t">' + esc(c[li()] || c[0]) + "</div></div>" + (!S.cityCustom && S.city === i ? '<span class="tick">' + ic("check") + "</span>" : "") + "</button>").join("") + "</div></div></div>";

/* ---------- Profile ---------- */
SHEETS.profile = () => {
  const p = S.profile, opt = (v, c, l) => '<option value="' + v + '"' + (String(v) === String(c) ? " selected" : "") + ">" + esc(l) + "</option>";
  return sheetTop(t("editProfile")) + '<div class="stack">' +
    '<label class="field"><span>' + esc(t("nameOptional")) + '</span><input class="input" id="pf-name" value="' + esc(p.name) + '"></label>' +
    seg("pfSex", "s", [["m", t("male")], ["f", t("female")]], p.sex) +
    '<div class="grid2"><label class="field"><span>' + esc(t("age")) + '</span><input class="input num" id="pf-age" inputmode="numeric" value="' + fmt(p.age) + '"></label>' +
    '<label class="field"><span>' + esc(t("goalWeight")) + " (" + esc(wUnit()) + ')</span><input class="input num" id="pf-gw" inputmode="decimal" value="' + fmt(wShow(p.goalWeight), 1) + '"></label></div>' +
    bodyInputs() +
    '<label class="field"><span>' + esc(t("activity")) + '</span><select class="input" id="pf-act">' + [0, 1, 2, 3, 4].map(i => opt(i, p.activity, t("actT" + i))).join("") + "</select></label>" +
    '<label class="field"><span>' + esc(t("goal")) + '</span><select class="input" id="pf-goal">' + ["lose_fast", "lose", "lose_slow", "keep", "gain"].map(g => opt(g, p.goal, t("goal_" + g))).join("") + "</select></label>" +
    '<button class="btn sun block big" data-act="saveProfile">' + esc(t("save")) + "</button></div>";
};

/* ---------- Routines & player ---------- */
const moveName = k => (window.MOVES[k] ? window.MOVES[k][li()] : k);
SHEETS.routine = () => {
  const r = window.ROUTINES.find(x => x.id === SH.id), min = routineMinutes(r);
  return sheetTop(r.n[li()]) + '<div class="stack"><div class="tiles"><div class="tile"><b class="num">' + fmt(min) + "</b><span>" + esc(t("minutes")) + '</span></div><div class="tile"><b class="num">' + fmt(r.rounds) + "</b><span>" + esc(t("rounds")) + '</span></div><div class="tile"><b class="num">~' + fmt(exKcal(r.met, min)) + "</b><span>" + esc(t("kcal")) + "</span></div></div>" +
    '<div class="card" style="padding-block:4px"><div class="list">' + r.moves.map((m, i) => '<div class="row"><span class="thumb num">' + fmt(i + 1) + '</span><div class="grow"><div class="t">' + esc(moveName(m)) + '</div><div class="s num">' + fmt(r.work) + " " + esc(t("sec")) + "</div></div></div>").join("") + "</div></div>" +
    '<p class="small muted" style="margin:0">' + esc(t("routineNote", { w: fmt(r.work), r: fmt(r.rest) })) + '</p><button class="btn leaf block big" data-act="startRoutine">' + ic("play") + esc(t("start")) + "</button></div>";
};
let PL = null;
SHEETS.player = () => {
  if (!PL) return "";
  const r = PL.r;
  if (PL.done) {
    const min = PL.workSec / 60;
    return sheetTop(t("greatJob")) + '<div class="player"><div class="time num" style="color:var(--leaf)">' + fmt(exKcal(r.met, min)) + '</div><div class="muted">' + esc(t("kcalBurnedEst")) + " · " + fmt(min, 1) + " " + esc(t("min")) + '</div><button class="btn leaf block big" data-act="saveRoutine">' + esc(t("saveToDiary")) + '</button><button class="btn ghost block" data-act="close">' + esc(t("close")) + "</button></div>";
  }
  const st = PL.steps[PL.i], next = PL.steps.slice(PL.i + 1).find(s => !s.rest);
  const phase = st.k === "ready" ? t("getReady") : st.rest ? t("rest") : t("go");
  const color = st.rest ? "var(--water)" : "var(--leaf)";
  return sheetTop(r.n[li()]) + '<div class="player">' +
    '<div class="progressbar"><i style="width:' + ((PL.i / PL.steps.length) * 100).toFixed(1) + '%"></i></div>' +
    '<span class="phase" style="color:' + color + '">' + esc(phase) + (st.round ? " · " + esc(t("roundN", { n: fmt(st.round), t: fmt(r.rounds) })) : "") + "</span>" +
    '<div class="ex">' + esc(st.rest ? (next ? t("nextUp") + ": " + moveName(next.k) : t("almostDone")) : moveName(st.k)) + "</div>" +
    '<div class="time num" id="pl-time" style="color:' + color + '">' + fmt(PL.left) + "</div>" +
    '<div class="btns" style="width:100%"><button class="btn ghost" data-act="plPause">' + ic(PL.paused ? "play" : "pause") + esc(PL.paused ? t("resume") : t("pause")) + '</button><button class="btn ghost" data-act="plSkip">' + ic("skip", "flip") + esc(t("skip")) + "</button></div>" +
    '<button class="btn danger block" data-act="plFinish">' + esc(t("finishNow")) + "</button></div>";
};
let audioCtx = null, wakeLock = null;
function beep(f = 880, d = 0.12) {
  try {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.18, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
    o.start(); o.stop(audioCtx.currentTime + d);
  } catch (e) { /* no audio */ }
}
function say(text) {
  try { if (!window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(text); u.lang = { en: "en-US", ar: "ar", ckb: "ar", kmr: "tr-TR" }[lang()]; u.rate = 1; if (lang() === "en" || lang() === "ar") speechSynthesis.speak(u); } catch (e) { /* no voice */ }
}
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
  const first = steps.find(s => !s.rest); if (first) say(moveName(first.k));
}
function stopPlayer() { PL = null; try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }
function playerTick() {
  if (!PL || PL.paused || PL.done || !SH || SH.type !== "player") return;
  const st = PL.steps[PL.i];
  PL.left--;
  if (!st.rest) PL.workSec++;
  if (PL.left <= 3 && PL.left > 0) beep(660, 0.08);
  if (PL.left <= 0) {
    PL.i++;
    if (PL.i >= PL.steps.length) { PL.done = true; beep(990, 0.4); confetti(); renderSheet(); return; }
    const ns = PL.steps[PL.i]; PL.left = ns.sec; beep(ns.rest ? 520 : 990, 0.2);
    if (!ns.rest) say(moveName(ns.k));
    renderSheet(); return;
  }
  const el = document.getElementById("pl-time"); if (el) el.textContent = fmt(PL.left);
}

/* ---------- Gym log ---------- */
const est1rm = s => (s.kg || 0) * (1 + (s.reps || 0) / 30);
function bestFor(ex) { let b = 0; S.gym.sessions.forEach(s => s.items.forEach(it => { if (it.ex === ex) it.sets.forEach(x => { b = Math.max(b, est1rm(x)); }); })); return b; }
function lastFor(ex) { for (let i = S.gym.sessions.length - 1; i >= 0; i--) { const it = S.gym.sessions[i].items.find(x => x.ex === ex); if (it && it.sets.length) return it.sets; } return null; }
SHEETS.gym = () => {
  const a = S.gym.active;
  if (!a) return sheetTop(t("gymLog"));
  let h = sheetTop(t("gymLog")) + '<div class="stack"><div class="gym-timer"><span class="muted small">' + esc(t("elapsed")) + '</span><b class="num" data-gym="el">' + dur(Date.now() - a.start) + "</b></div>";
  if (!a.items.length) h += '<p class="empty">' + esc(t("gymEmpty")) + "</p>";
  a.items.forEach((it, gi) => {
    const last = lastFor(it.ex);
    h += '<div class="card gym-ex"><div class="card-head"><h2>' + esc(gymName(it.ex)) + '</h2><button class="iconbtn sm flat" data-act="gymDelEx" data-gi="' + gi + '" aria-label="' + esc(t("remove")) + '">' + ic("trash") + "</button></div>" +
      (last ? '<div class="small muted num" style="margin-bottom:8px">' + esc(t("lastTime")) + ": " + last.map(s => loc((s.kg || 0) + "×" + (s.reps || 0))).join(", ") + " " + esc(t("kg")) + "</div>" : "") +
      '<div class="sets"><div class="set head"><span>#</span><span>' + esc(t("kg")) + "</span><span>" + esc(t("reps")) + "</span><span></span></div>" +
      it.sets.map((s, si) => '<div class="set' + (s.done ? " done" : "") + '"><span class="num">' + fmt(si + 1) + (s.pr ? ' <b class="pr">PR</b>' : "") + '</span><input class="input num" inputmode="decimal" data-gi="' + gi + '" data-si="' + si + '" data-f="kg" value="' + (s.kg != null ? fmt(s.kg, 2) : "") + '" aria-label="' + esc(t("kg")) + '"><input class="input num" inputmode="numeric" data-gi="' + gi + '" data-si="' + si + '" data-f="reps" value="' + (s.reps != null ? fmt(s.reps) : "") + '" aria-label="' + esc(t("reps")) + '"><button class="tickbtn" data-act="gymDone" data-gi="' + gi + '" data-si="' + si + '" aria-pressed="' + !!s.done + '" aria-label="' + esc(t("done")) + '">' + ic("check") + "</button></div>").join("") +
      '</div><button class="link" data-act="gymAddSet" data-gi="' + gi + '">' + ic("plus") + esc(t("addSet")) + "</button></div>";
  });
  h += '<button class="btn ghost block" data-act="gymPick">' + ic("plus") + esc(t("addExercise")) + '</button><button class="btn leaf block big" data-act="gymFinish">' + esc(t("finishWorkout")) + '</button><button class="btn danger block" data-act="gymDiscard">' + esc(SH.discard ? t("tapAgainDiscard") : t("discard")) + "</button></div>";
  return h;
};
SHEETS.gymPick = () => {
  const q = norm(SH.q);
  const keys = Object.keys(window.GYM).filter(k => !q || window.GYM[k].some(x => norm(x).includes(q)));
  return sheetTop(t("addExercise")) + '<div class="search" style="margin-bottom:12px">' + ic("search") + '<input class="input" id="gym-q" type="search" autocomplete="off" placeholder="' + esc(t("searchExercises")) + '" value="' + esc(SH.q || "") + '"></div><div class="card" style="padding-block:4px"><div class="list" id="gym-list">' +
    keys.map(k => { const b = bestFor(k); return '<button class="row" data-act="gymAddEx" data-ex="' + k + '"><div class="grow"><div class="t">' + esc(gymName(k)) + "</div>" + (b ? '<div class="s num">' + esc(t("best1rm")) + " " + fmt(b) + " " + esc(t("kg")) + "</div>" : "") + "</div>" + ic("plus") + "</button>"; }).join("") + "</div></div>";
};

/* ---------- AI ---------- */
SHEETS.aiPhoto = () => {
  const title = SH.mode === "text" ? t("describeMeal") : SH.mode === "voice" ? t("voiceLog") : t("scanMeal");
  if (!aiReady()) return sheetTop(title) + aiNeedKey();
  let h = sheetTop(title) + '<div class="stack">';
  if (SH.ask && !SH.items) {
    h += '<div class="ai-ask"><span class="ask-ic">🤔</span><p>' + esc(SH.ask.q) + '</p></div><div class="chips wrap">' + (SH.ask.options || []).map((o, i) => '<button class="chip big" data-act="aiAnswer" data-i="' + i + '">' + esc(o) + "</button>").join("") + "</div>" +
      '<div class="chat-input" style="position:static;margin:0"><input class="input" id="ai-answer" placeholder="' + esc(t("orTypeAnswer")) + '"><button class="btn sun" data-act="aiAnswer">' + esc(t("send")) + "</button></div>" +
      (SH.busy ? '<div class="notice"><span class="spinner sm"></span> ' + esc(t("analyzing")) + "</div>" : "") + (SH.err ? '<div class="notice err">' + esc(SH.err) + "</div>" : "");
    return h + "</div>";
  }
  if (!SH.items) {
    if (SH.mode === "voice") {
      h += '<div class="voice"><button class="mic-btn' + (SH.rec ? " rec" : "") + '" data-act="' + (SH.rec ? "recStop" : "recStart") + '" aria-label="' + esc(SH.rec ? t("stopRec") : t("startRec")) + '"' + (SH.busy ? " disabled" : "") + ">" + ic(SH.rec ? "stop" : "mic") + "</button>" +
        '<div class="voice-status">' + (SH.busy ? '<span class="spinner sm"></span> ' + esc(t("analyzing")) : SH.rec ? '<b class="num" id="rec-time">' + loc("0:00") + "</b> · " + esc(t("listening")) : esc(t("voiceHelp"))) + "</div>" +
        '<p class="small muted center">' + esc(t("voiceExample")) + "</p></div>" + (SH.err ? '<div class="notice err">' + esc(SH.err) + "</div>" : "");
      return h + "</div>";
    }
    if (SH.mode === "text") {
      h += '<p class="muted small" style="margin:0">' + esc(t("describeHelp")) + '</p><textarea class="input" id="ai-desc" placeholder="' + esc(t("describePh")) + '">' + esc(SH.desc || "") + "</textarea>";
    } else {
      h += (SH.img ? '<img class="photo-prev" src="' + SH.img + '" alt="">' : '<div class="scan-hero">' + ic("camera") + "<p>" + esc(t("scanHelp")) + "</p></div>") +
        '<div class="btns"><label class="btn ' + (SH.img ? "ghost" : "sun") + '">' + ic("camera") + esc(t("takePhoto")) + '<input type="file" accept="image/*" capture="environment" id="ai-cam" hidden></label><label class="btn ghost">' + ic("image") + esc(t("fromLibrary")) + '<input type="file" accept="image/*" id="ai-lib" hidden></label></div>' +
        '<input class="input" id="ai-hint" placeholder="' + esc(t("hintPh")) + '" value="' + esc(SH.hint || "") + '">';
    }
    h += (SH.err ? '<div class="notice err">' + esc(SH.err) + "</div>" : "") +
      '<button class="btn sun block big" data-act="aiRun"' + (SH.busy || (SH.mode !== "text" && !SH.img) ? " disabled" : "") + ">" + (SH.busy ? '<span class="spinner"></span>' + esc(t("analyzing")) : ic("spark") + esc(t("analyze"))) + "</button>";
  } else {
    if (SH.img) h += '<img class="photo-prev" src="' + SH.img + '" alt="" style="max-height:160px">';
    h += '<div class="card" style="padding-block:4px"><div class="list">' + SH.items.map((it, i) =>
      '<div class="row"><input type="checkbox" class="check" data-ai-i="' + i + '"' + (it.on ? " checked" : "") + ' aria-label="' + esc(t("include")) + '"><span class="fthumb">' + foodEmoji(it) + '</span><div class="grow"><div class="t wrap-s">' + esc(nm(it)) + '</div><div class="s num">' + esc(it.s) + " · " + esc(t("p")) + fmt(it.p * it.q) + " " + esc(t("c")) + fmt(it.c * it.q) + " " + esc(t("f")) + fmt(it.f * it.q) + '</div></div><div class="stepper mini"><button data-act="aiQty" data-i="' + i + '" data-d="-0.25" aria-label="−">−</button><b class="num">' + fmt(it.kcal * it.q) + '</b><button data-act="aiQty" data-i="' + i + '" data-d="0.25" aria-label="+">+</button></div></div>').join("") + "</div></div>";
    if (SH.note) h += '<div class="notice ok small">' + esc(SH.note) + "</div>";
    const tot = SH.items.filter(i => i.on).reduce((a, i) => a + i.kcal * i.q, 0);
    h += mealSeg() + '<p class="small muted" style="margin:0">' + esc(t("aiCheck")) + "</p>" +
      '<div class="btns"><button class="btn ghost" data-act="aiRetry">' + esc(t("retry")) + '</button><button class="btn sun" data-act="aiAdd">' + esc(t("addKcal", { n: fmt(tot) })) + "</button></div>";
  }
  return h + "</div>";
};
let mediaRec = null, recChunks = [], recStart = 0;
async function startRecording() {
  SH.err = "";
  try {
    if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error("unsupported");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/mp4", "audio/webm", "audio/ogg"].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
    mediaRec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recChunks = [];
    mediaRec.ondataavailable = e => { if (e.data && e.data.size) recChunks.push(e.data); };
    mediaRec.onstop = async () => {
      stream.getTracks().forEach(tr => tr.stop());
      const type = (mediaRec.mimeType || mime || "audio/mp4").split(";")[0];
      const blob = new Blob(recChunks, { type });
      if (!SH || SH.type !== "aiPhoto") return;
      if (blob.size < 1500) { SH.rec = false; SH.err = t("tooShort"); renderSheet(); return; }
      const data = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
      SH.rec = false; SH.audio = { data, mime: type }; runFoodAI();
    };
    mediaRec.start(); recStart = Date.now(); SH.rec = true; renderSheet();
    setTimeout(() => { if (mediaRec && mediaRec.state === "recording" && Date.now() - recStart > 59000) mediaRec.stop(); }, 60000);
  } catch (e) {
    SH.rec = false;
    SH.err = t("micUnavailable");
    SH.mode = "text"; SH.focus = "ai-desc";
    renderSheet();
  }
}
function stopRecording() { try { if (mediaRec && mediaRec.state === "recording") mediaRec.stop(); } catch (e) { /* ignore */ } }
function aiNeedKey() {
  return '<div class="stack"><div class="scan-hero">' + ic("spark") + "<p>" + esc(t("aiNeedKey")) + '</p></div><button class="btn sun block big" data-act="goAiSettings">' + esc(t("setUpAi")) + '</button><button class="btn ghost block" data-act="foodSearch">' + ic("search") + esc(t("logFood")) + "</button></div>";
}
SHEETS.coach = () => {
  if (!aiReady()) return sheetTop(t("coach")) + aiNeedKey();
  const msgs = S.chat.slice(-30);
  return sheetTop(t("coach")) + '<div class="chat" id="chat">' +
    (msgs.length ? "" : '<div class="msg ai">' + esc(t("coachHello")) + '</div><div class="chips wrap">' + ["q1", "q2", "q3", "q4", "q5"].map(q => '<button class="chip" data-act="coachAsk" data-q="' + esc(t(q)) + '">' + esc(t(q)) + "</button>").join("") + "</div>") +
    msgs.map(m => '<div class="msg ' + (m.r === "me" ? "me" : "ai") + '">' + esc(m.t) + "</div>").join("") +
    (SH.busy ? '<div class="msg ai"><span class="spinner sm"></span></div>' : "") +
    (SH.err ? '<div class="notice err small">' + esc(SH.err) + "</div>" : "") +
    '</div><div class="chat-input"><input class="input" id="coach-in" placeholder="' + esc(t("askAnything")) + '" autocomplete="off" enterkeyhint="send"><button class="btn sun" data-act="coachSend"' + (SH.busy ? " disabled" : "") + ">" + esc(t("send")) + "</button></div>" +
    (msgs.length ? '<button class="link" style="margin-top:10px" data-act="coachClear">' + esc(t("clearChat")) + "</button>" : "");
};
const geminiParts = parts => parts.map(p => (p.image ? { inline_data: { mime_type: "image/jpeg", data: p.image } } : p.audio ? { inline_data: { mime_type: p.audio.mime, data: p.audio.data } } : { text: p.text }));
async function callAI({ system, messages, json }) {
  const key = S.ai.key.trim(), model = (S.ai.model || defaultModel()).trim();
  if (!key && AI_SERVER) {
    const contents = messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: geminiParts(m.parts) }));
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000);
    let res;
    try { res = await fetch(AI_SERVER, { method: "POST", headers: { "content-type": "application/json", "x-device-id": S.deviceId }, body: JSON.stringify({ system: system || null, contents, json: !!json }), signal: ctl.signal }); }
    catch (e) { throw new Error(e && e.name === "AbortError" ? t("aiBusy") : t("netError")); }
    finally { clearTimeout(timer); }
    const j = await res.json().catch(() => ({}));
    if (res.status === 429 && j.error === "limit") throw new Error(t("aiLimit"));
    if (res.status === 503 || res.status === 504 || res.status === 429 || j.error === "busy") throw new Error(t("aiBusy"));
    if (!res.ok || typeof j.text !== "string") throw new Error(j.error || "HTTP " + res.status);
    return j.text;
  }
  if (S.ai.provider === "claude" && messages.some(m => m.parts.some(p => p.audio))) throw new Error(t("voiceNeedsGemini"));
  if (S.ai.provider === "gemini") {
    const contents = messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: geminiParts(m.parts) }));
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
    body: JSON.stringify({ model, max_tokens: 1500, system: system || undefined, messages: messages.map(m => ({ role: m.role, content: m.parts.map(p => (p.image ? { type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.image } } : { type: "text", text: p.text })) })) })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.error && j.error.message) || "HTTP " + res.status);
  return (j.content || []).map(c => c.text || "").join("");
}
const parseJSON = s => { const m = s.match(/\{[\s\S]*\}/); return JSON.parse(m ? m[0] : s); };
const LANG_NAME = { en: "English", ckb: "Sorani Kurdish (Arabic script)", kmr: "Kurmanji Kurdish (Latin script, Badini style)", ar: "Iraqi-friendly Modern Standard Arabic" };
const FOOD_PROMPT = "You are a nutrition expert who knows Kurdish, Iraqi and Middle Eastern home cooking very well (dolma, yaprax, qima, tashreeb, biryani, kubba, shifta, kebab, tikka, savar/bulgur, shla, fasolia, bamya, tapsi, kalana, kade, tanuri and samoon bread, dew, mast, geymar, kleicha, baklava) and international food. " +
  "Identify every food and drink in the user's photo or description, estimate the portion realistically (home portions are often generous and cooked with oil), and estimate nutrition for the portion. If the image is a nutrition label, read it and return one serving. " +
  'Reply with JSON only: {"items":[{"en":"English name","ckb":"Sorani Kurdish name","kmr":"Kurmanji Kurdish name","ar":"Arabic name","portion":"short portion text in the user\'s language","grams":300,"kcal":420,"protein":9,"carbs":54,"fat":19,"fiber":6,"sugar":9,"sodium":720,"potassium":480,"calcium":90,"iron":2.4,"vitc":18}],"note":"one short helpful sentence in the user\'s language"}. ' +
  "Numbers are for the whole portion (fiber, sugar in g; sodium, potassium, calcium, iron, vitc in mg). If you cannot see or hear food, return an empty items list and explain in note. " +
  "Audio input is the user speaking about their meal in Kurdish (Sorani or Kurmanji), Arabic or English. " +
  'Ask before guessing: if ONE missing detail would change the total calories by more than 25% (for example: raw or cooked weight, how many pieces, fried or grilled, with or without sugar, a small or large plate) and you have not already asked, reply ONLY with {"question":"short question in the user\'s language","options":["2-4 short answers in the user\'s language"]} and no items. Never ask more than one question in a row.';
async function imageToBase64(file, max = 1024) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}
function guessEmoji(name) {
  const words = norm(name).split(/[^a-z]+/).filter(w => w.length > 2);
  for (const w of words) { const f = Object.values(FOOD).find(x => norm(x.n[0]).split(/[^a-z]+/).includes(w)); if (f) return foodEmoji(f); }
  return "🍽️";
}
async function runFoodAI(answer) {
  SH.busy = true; SH.err = ""; renderSheet();
  const me = SH;
  try {
    if (!me.conv || answer == null) {
      const parts = [];
      if (me.mode === "text") parts.push({ text: "Meal description: " + me.desc });
      else if (me.mode === "voice") { parts.push({ audio: me.audio }); parts.push({ text: "This is a voice note describing what I ate." }); }
      else { parts.push({ image: me.img.split(",")[1] }); parts.push({ text: me.hint ? "Extra info from the user: " + me.hint : "Analyze this meal." }); }
      parts.push({ text: "The user's language is " + LANG_NAME[lang()] + "." });
      me.conv = [{ role: "user", parts }];
    } else {
      me.conv.push({ role: "user", parts: [{ text: "Answer: " + answer + ". Now give the items JSON. Do not ask another question." }] });
    }
    const raw = await callAI({ system: FOOD_PROMPT, messages: me.conv, json: true });
    const out = parseJSON(raw);
    me.conv.push({ role: "assistant", parts: [{ text: raw }] });
    if (out.question && !(out.items && out.items.length) && me.conv.length < 4) { me.ask = { q: String(out.question), options: (out.options || []).map(String).slice(0, 4) }; }
    else {
      const items = (out.items || []).map(i => ({ id: "ai", n: [String(i.en || "Food"), String(i.ckb || i.en || ""), String(i.kmr || i.en || ""), String(i.ar || i.en || "")], s: String(i.portion || (i.grams ? i.grams + " g" : "")), g: +i.grams || 0, kcal: +i.kcal || 0, p: +i.protein || 0, c: +i.carbs || 0, f: +i.fat || 0, mi: [i.fiber, i.sugar, i.sodium, i.potassium, i.calcium, i.iron, i.vitc].map(v => +v || 0), em: guessEmoji(String(i.en || "")), q: 1, on: true }));
      me.ask = null;
      if (!items.length) me.err = out.note || t("aiNoFood"); else { me.items = items; me.note = out.note || ""; S.scans++; save(); }
    }
  } catch (e) { me.err = [t("aiBusy"), t("aiLimit"), t("netError")].includes(e.message) ? e.message : t("aiError") + " " + e.message; }
  me.busy = false;
  if (SH === me) renderSheet();
}
function coachContext() {
  const tg = targets(), tt = totals(dk()), p = S.profile;
  const foods = day(dk()).food.map(e => nm(e) + " (" + Math.round(e.kcal * e.q) + " kcal)").join(", ") || "nothing yet";
  const week = lastDays(7).map(k => Math.round(totals(k).kcal)).join(", ");
  return "You are the friendly coach inside Xorak, a fitness and nutrition app for Kurdish and Iraqi users. You know Kurdish and Iraqi food, culture and Ramadan fasting. Be practical, warm and brief (under 150 words unless asked for a plan). Prefer local foods in suggestions. Never diagnose; suggest a doctor for medical issues, pregnancy, diabetes or eating disorders. " +
    "Always reply in " + LANG_NAME[lang()] + ". " +
    "User: " + (p.name ? p.name + ", " : "") + (p.sex === "f" ? "female" : "male") + ", " + p.age + " years, " + Math.round(p.height) + " cm, " + latestWeight().toFixed(1) + " kg, goal weight " + p.goalWeight.toFixed(1) + " kg, goal: " + p.goal + ". " +
    "Daily target " + tg.kcal + " kcal, protein " + Math.round(tg.p) + " g. Today so far: " + Math.round(tt.kcal) + " kcal (" + foods + "), protein " + Math.round(tt.p) + " g, exercise " + Math.round(tt.ex) + " kcal, water " + (day(dk()).water || 0) + " glasses. Last 7 days kcal: " + week + "." +
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
  } catch (e) { if (SH) SH.err = t("aiError") + " " + e.message; }
  if (SH && SH.type === "coach") { SH.busy = false; renderSheet(); scrollChat(); }
}
function scrollChat() { const p = sheetEl.querySelector(".sheet-panel"); if (p) p.scrollTop = p.scrollHeight; }

/* ---------- Barcode (camera + manual) ---------- */
let camStream = null, zxReader = null, scanLoop = null;
function stopCamera() {
  if (scanLoop) { clearInterval(scanLoop); scanLoop = null; }
  try { if (zxReader) zxReader.reset(); } catch (e) { /* ignore */ }
  zxReader = null;
  if (camStream) { camStream.getTracks().forEach(tr => tr.stop()); camStream = null; }
}
function loadScript(src) {
  return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
}
function beepOnce() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); beep(1200, 0.08); } catch (e) { /* ignore */ } }
async function startCamera() {
  const v = document.getElementById("bc-video"), st = document.getElementById("bc-cam-status");
  if (!v) return;
  let last = null;
  const onCode = raw => {
    const code = String(raw || "").replace(/\D/g, "");
    if (!barcodeOk(code)) return;
    if (last !== code) { last = code; return; } // wait for a second identical read
    stopCamera(); try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) { /* ignore */ }
    beepOnce();
    const inp = document.getElementById("bc-in"); if (inp) inp.value = code;
    const w = document.getElementById("bc-cam"); if (w) w.hidden = true;
    bcLookup(code);
  };
  try {
    if ("BarcodeDetector" in window) {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } });
      v.srcObject = camStream; await v.play();
      const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
      scanLoop = setInterval(async () => { try { const r = await det.detect(v); if (r && r[0]) onCode(r[0].rawValue); } catch (e) { /* keep trying */ } }, 200);
    } else {
      if (!window.ZXing) await loadScript("https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js");
      zxReader = new window.ZXing.BrowserMultiFormatReader();
      await zxReader.decodeFromConstraints({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } }, v, (res) => { if (res) onCode(res.getText()); });
    }
    if (st) st.textContent = t("pointCamera");
  } catch (e) {
    stopCamera();
    const w = document.getElementById("bc-cam"); if (w) w.hidden = true;
    if (st) st.textContent = "";
    const n = document.getElementById("bc-note"); if (n) n.innerHTML = '<div class="notice small">' + esc(t("cameraUnavailable")) + "</div>";
  }
}
SHEETS.barcode = () => {
  SH.after = startCamera;
  return sheetTop(t("barcode")) + '<div class="stack"><div id="bc-cam" class="cam"><video id="bc-video" playsinline muted></video><div class="cam-frame"></div><span id="bc-cam-status" class="cam-status">' + esc(t("startingCamera")) + '</span></div><div id="bc-note"></div>' +
    '<div class="field"><span>' + esc(t("orTypeCode")) + '</span><div class="chat-input" style="margin:0"><input class="input num" id="bc-in" inputmode="numeric" placeholder="6281006…"><button class="btn sun" data-act="bcLookup">' + esc(t("lookUp")) + "</button></div></div>" +
    '<div id="bc-result"></div></div>';
};
let BC = null;
// Check digit for EAN-8, UPC-A, EAN-13, GTIN-14
function barcodeOk(c) {
  if (![8, 12, 13, 14].includes(c.length)) return c.length >= 6 && c.length <= 14;
  const d = c.split("").map(Number), check = d.pop();
  let sum = 0; d.reverse().forEach((x, i) => { sum += x * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}
function barcodeVariants(c) {
  const v = [c];
  if (c.length === 12) v.push("0" + c);
  if (c.length === 13 && c[0] === "0") v.push(c.slice(1));
  if (c.length === 14 && c[0] === "0") v.push(c.slice(1));
  return v;
}
function offParse(p) {
  const n = p.nutriments || {}, sq = +p.serving_quantity || 0;
  let kcal = n["energy-kcal_100g"];
  if (kcal == null && n["energy-kj_100g"] != null) kcal = n["energy-kj_100g"] / 4.184;
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
  let per = 1;
  if (kcal == null && n["energy-kcal_serving"] != null && sq) { kcal = n["energy-kcal_serving"]; per = 100 / sq; kcal *= per; }
  const v = (k, mul = 1) => { const x = n[k + "_100g"] != null ? n[k + "_100g"] : n[k + "_serving"] != null && sq ? n[k + "_serving"] * (100 / sq) : null; return x == null ? 0 : +x * mul; };
  const base = (lang() === "ar" && p.product_name_ar) || (lang() === "ckb" && (p.product_name_ckb || p.product_name_ku)) || p.product_name_en || p.product_name || p.generic_name || "";
  const brand = p.brands ? String(p.brands).split(",")[0].trim() : "";
  const name = brand && !base.toLowerCase().includes(brand.toLowerCase()) ? (base ? base + " · " + brand : brand) : base;
  return { name, kcal: kcal == null ? null : +kcal, p: v("proteins"), c: v("carbohydrates"), f: v("fat"), mi: [v("fiber"), v("sugars"), v("sodium", 1000), v("potassium", 1000), v("calcium", 1000), v("iron", 1000), v("vitamin-c", 1000)], grams: sq || 100 };
}
async function bcLookup(code) {
  code = String(code || "").replace(/\D/g, "");
  const out = document.getElementById("bc-result"); if (!out || !code) return;
  if (!barcodeOk(code)) { out.innerHTML = '<div class="notice err">' + esc(t("invalidCode")) + "</div>"; return; }
  BC = null; SH.code = code;
  // Saved on this phone already?
  const mem = (S.barcodes || {})[code];
  if (mem) {
    if (mem.food && getFood(mem.food)) { pushSheet({ type: "foodDetail", id: mem.food, qty: 1, m: SH.m, unitMode: "srv" }); return; }
    if (mem.kcal != null) { BC = Object.assign({ code, saved: true }, mem); bcRender(); return; }
  }
  out.innerHTML = '<div class="notice"><span class="spinner sm"></span> ' + esc(t("lookingUp")) + "</div>";
  let found = null, netFail = false;
  for (const c of barcodeVariants(code)) {
    try {
      const r = await fetch("https://world.openfoodfacts.org/api/v2/product/" + c + ".json?fields=product_name,product_name_en,product_name_ar,product_name_ckb,product_name_ku,generic_name,brands,nutriments,serving_quantity");
      if (r.status === 404) continue;
      const j = await r.json();
      if (j && j.product && (j.status === 1 || j.product.product_name || j.product.nutriments)) { found = j.product; break; }
    } catch (e) { netFail = true; }
  }
  if (!SH || SH.type !== "barcode") return;
  if (found) {
    const x = offParse(found);
    if (x.kcal != null && x.kcal >= 0) { BC = Object.assign({ code }, x, { name: x.name || code }); bcRender(); return; }
    bcMissing(x.name, "noNutrition"); return;
  }
  if (netFail) { out.innerHTML = '<div class="notice err">' + esc(t("netError")) + '</div><button class="btn ghost block" style="margin-top:10px" data-act="bcLookup">' + esc(t("retry")) + "</button>"; return; }
  bcMissing("", "notFoundAdd");
}
function bcMissing(name, msgKey) {
  const out = document.getElementById("bc-result"); if (!out) return;
  SH.prodName = name || "";
  out.innerHTML = '<div class="card stack"><div class="food-hero"><span class="big-emoji">📦</span><div>' + (name ? "<b>" + esc(name) + "</b>" : "") + '<div class="small muted">' + esc(t(msgKey)) + "</div></div></div>" +
    '<button class="btn sun block big" data-act="bcLabel">' + ic("camera") + esc(t("scanLabel")) + '</button><button class="btn ghost block" data-act="bcManual">' + ic("pen") + esc(t("enterYourself")) + '</button><p class="small muted" style="margin:0">' + esc(t("bcRemember")) + "</p></div>";
}
function bcRender() {
  const out = document.getElementById("bc-result"); if (!out || !BC) return;
  const g = BC.grams;
  out.innerHTML = '<div class="card stack"><div class="food-hero"><span class="big-emoji">📦</span><div><b>' + esc(BC.name) + '</b><div class="small muted">' + esc(t("per100", { k: fmt(BC.kcal) })) + (BC.saved ? " · " + esc(t("savedOnPhone")) : "") + '</div></div></div><label class="field"><span>' + esc(t("grams")) + '</span><input class="input num" id="bc-g" inputmode="decimal" value="' + fmt(g) + '"></label>' +
    '<div id="bc-tiles">' + nutriTiles(BC.kcal * g / 100, BC.p * g / 100, BC.c * g / 100, BC.f * g / 100) + "</div>" + mealSeg() + '<button class="btn sun block big" data-act="bcAdd">' + esc(t("addTo", { meal: mealName(SH.m) })) + "</button></div>";
}
function rememberBarcode(code, val) { if (!code) return; S.barcodes = S.barcodes || {}; S.barcodes[code] = val; save(); }

/* ---------- Share card ---------- */
async function makeShareImage() {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"), tg = targets(), tt = totals(dk()), sc = dayScore(dk()), rtl = !!RTL[lang()];
  const font = (w, s) => w + " " + s + "px " + (rtl ? '"Noto Sans Arabic", "Geeza Pro", sans-serif' : 'ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", sans-serif');
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1d2620"); bg.addColorStop(1, "#0e1210");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.direction = rtl ? "rtl" : "ltr"; x.textAlign = rtl ? "right" : "left";
  const L = rtl ? W - 90 : 90;
  // sun logo
  const lx = rtl ? 150 : W - 150, ly = 150;
  x.fillStyle = "#e89a00"; x.beginPath(); x.arc(lx, ly, 70, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#1b1300"; x.beginPath(); x.arc(lx, ly, 22, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "#1b1300"; x.lineWidth = 6; x.lineCap = "round";
  for (let i = 0; i < 21; i++) { const a = (i / 21) * Math.PI * 2; x.beginPath(); x.moveTo(lx + Math.cos(a) * 32, ly + Math.sin(a) * 32); x.lineTo(lx + Math.cos(a) * 46, ly + Math.sin(a) * 46); x.stroke(); }
  x.fillStyle = "#98a29a"; x.font = font("600", 40); x.fillText(dateLabel(dk(), true), L, 130);
  x.fillStyle = "#eef2ee"; x.font = font("800", 72); x.fillText(t("myDay"), L, 215);
  // ring
  const cx = W / 2, cy = 560, r = 230;
  x.lineWidth = 46; x.strokeStyle = "#202722"; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
  const pct = Math.min(1, tt.kcal / Math.max(1, tg.kcal + tt.ex));
  x.strokeStyle = "#ffb22e"; x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); x.stroke();
  x.textAlign = "center"; x.fillStyle = "#eef2ee"; x.font = font("800", 120); x.fillText(fmt(tt.kcal), cx, cy + 20);
  x.fillStyle = "#98a29a"; x.font = font("600", 40); x.fillText(t("kcalOf", { n: fmt(tg.kcal) }), cx, cy + 80);
  // stats
  const stats = [[t("protein"), fmt(tt.p) + t("g"), "#ff6f97"], [t("water"), fmt(day(dk()).water || 0), "#5aa9f0"], [t("exercise"), "+" + fmt(tt.ex), "#35c47c"], [t("dayScore"), fmt(sc.total), "#ffb22e"]];
  stats.forEach((s, i) => {
    const bx = 90 + (i % 2) * 460, by = 880 + Math.floor(i / 2) * 190;
    x.fillStyle = "#171c19"; roundRect(x, bx, by, 440, 160, 32); x.fill();
    x.textAlign = rtl ? "right" : "left"; const tx = rtl ? bx + 400 : bx + 40;
    x.fillStyle = s[2]; x.font = font("800", 64); x.fillText(s[1], tx, by + 85);
    x.fillStyle = "#98a29a"; x.font = font("600", 34); x.fillText(s[0], tx, by + 132);
  });
  x.textAlign = "center"; x.fillStyle = "#98a29a"; x.font = font("600", 36);
  x.fillText((streak() > 1 ? t("streakShare", { n: fmt(streak()) }) + " · " : "") + "Xorak · خۆراک", W / 2, H - 70);
  return new Promise(ok => c.toBlob(b => ok(b), "image/png"));
}
function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
SHEETS.share = () => sheetTop(t("shareDay")) + '<div class="stack"><img class="share-img" src="' + SH.url + '" alt="' + esc(t("myDay")) + '"><p class="small muted center" style="margin:0">' + esc(t("holdToSave")) + "</p></div>";

/* ---------- Info sheets ---------- */
SHEETS.help = () => sheetTop(t("howTo")) + '<div class="stack">' + [1, 2, 3, 4, 5, 6, 7, 8].map(i => '<div class="card help"><span class="thumb num sun">' + fmt(i) + "</span><p>" + esc(t("help" + i)) + "</p></div>").join("") + "</div>";
SHEETS.badge = () => {
  const b = BADGES.find(x => x.id === SH.id), got = S.badges[b.id];
  return sheetTop(t("b_" + b.id)) + '<div class="stack center"><div class="badge big' + (got ? " on" : "") + '"><i>' + ic(b.icon) + "</i></div><p>" + esc(t("bd_" + b.id)) + '</p><p class="small muted">' + esc(got ? t("earnedOn", { d: dateLabel(got, true) }) : t("notYet")) + "</p></div>";
};
SHEETS.exportData = () => sheetTop(t("exportData")) + '<div class="stack"><p class="small muted" style="margin:0">' + esc(t("exportDesc")) + '</p><div class="btns"><button class="btn sun" data-act="downloadExport">' + ic("share") + esc(t("saveFile")) + '</button><button class="btn ghost" data-act="copyExport">' + ic("copy") + esc(t("copy")) + '</button></div><textarea class="input num" id="exp-text" readonly style="min-height:120px;font-size:12px">' + esc(JSON.stringify(S)) + "</textarea></div>";
SHEETS.importData = () => sheetTop(t("importData")) + '<div class="stack"><p class="small muted" style="margin:0">' + esc(t("importDesc")) + '</p><label class="field"><span>' + esc(t("chooseFile")) + '</span><input type="file" id="imp-file" accept="application/json,.json,.txt"></label><textarea class="input" id="imp-text" spellcheck="false" placeholder="' + esc(t("orPaste")) + '"></textarea><div id="imp-err"></div><button class="btn sun block" data-act="doImport">' + esc(SH.confirm ? t("tapAgainReplace") : t("restore")) + "</button></div>";

/* ---------- Actions ---------- */
function pushRecent(id) { S.recent = [id].concat(S.recent.filter(x => x !== id)).slice(0, 40); }
function snapshot(f, q, m) {
  return { u: uid(), id: f.id, n: f.n.slice(), unit: f.unit || null, cnt: f.cnt || 1, g: f.g || 0, s: f.s || "", kcal: +f.kcal || 0, p: +f.p || 0, c: +f.c || 0, f: +f.f || 0, mi: f.mi ? f.mi.slice() : null, em: f.em || foodEmoji(f), q, m };
}
function addEntry(f, q, m, k = cur) {
  day(k, true).food.push(snapshot(f, q, m));
  if (f.id && FOOD[f.id] || S.custom.some(c => c.id === f.id)) pushRecent(f.id);
  save();
}
function readQty() {
  const i = document.getElementById("qty"); if (i) { const v = num(i.value); if (v > 0) SH.qty = v; }
  const g = document.getElementById("grams"); if (g && SH.id) { const f = getFood(SH.id), v = num(g.value); if (v > 0 && f.g) SH.qty = v / f.g; }
}
function readExMin() { const i = document.getElementById("ex-min"); if (i) { const v = num(i.value); if (v > 0) SH.min = Math.round(v); } }
function keepInputs(ids, fn) {
  const vals = {}; ids.forEach(id => { const e = document.getElementById(id); if (e) vals[id] = e.value; });
  fn(); ids.forEach(id => { const e = document.getElementById(id); if (e && vals[id] != null) e.value = vals[id]; });
}
const CF_IDS = ["cf-name", "cf-sv", "cf-g", "cf-kcal", "cf-p", "cf-c", "cf-f"];
const curMeal = () => (SH && SH.m) || defaultMeal();
const ONB_NEXT = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };

const A = {
  tab: el => { view = el.dataset.v; window.scrollTo(0, 0); render(); },
  day: el => { cur = addDays(cur, Number(el.dataset.n)); render(); },
  goToday: () => { cur = dk(); render(); },
  hideInstall: () => { S.installHidden = true; save(); render(); },
  close: () => closeSheet(),
  sheetBack: () => backSheet(),
  undo: () => {
    if (!undoBuf) return;
    const d = day(undoBuf.k, true);
    (undoBuf.kind === "food" ? d.food : d.ex).splice(undoBuf.i, 0, undoBuf.item);
    undoBuf = null; save(); render(); const tt = document.querySelector(".toast"); if (tt) tt.remove();
  },

  // onboarding
  pickLang: el => { S.lang = el.dataset.l; onb = 1; save(); render(); },
  onbBack: () => { readBody(); onb = onb === 5 && (S.profile.goal === "keep" || S.profile.goal === "gain") ? 3 : Math.max(0, onb - 1); render(); },
  onbNext: () => {
    readBody();
    if (onb >= 6) { S.onboarded = true; save(); badgeCheckReady = true; render(); confetti(); toast(t("welcome")); return; }
    onb = ONB_NEXT[onb] || onb + 1; save(); render(); window.scrollTo(0, 0);
  },
  onbGoal: el => { const g = el.dataset.g; S.profile.healthy = g === "healthy"; S.profile.goal = g === "lose" ? "lose" : g === "gain" ? "gain" : "keep"; if (g === "gain") S.profile.macro = "pro"; save(); onb = 2; render(); },
  onbPace: el => { S.profile.goal = el.dataset.g; readBody(); save(); render(); },
  onbAct: el => { S.profile.activity = Number(el.dataset.a); save(); onb = 6; render(); },
  onbAge: el => { readBody(); S.profile.age = Math.min(100, Math.max(12, S.profile.age + Number(el.dataset.d))); const o = document.getElementById("age-out"); if (o) o.textContent = fmt(S.profile.age); },
  pfSex: el => { readBody(); S.profile.sex = el.dataset.s; save(); SH ? keepInputs(["pf-name", "pf-age", "pf-gw", "pf-h", "pf-w", "pf-hft", "pf-hin"], renderSheet) : render(); },
  setUnits: el => { readBody(); saveSettingsInputs(); S.units = el.dataset.u; save(); SH ? renderSheet() : render(); },

  // settings
  setLang: el => { saveSettingsInputs(); S.lang = el.dataset.l; save(); render(); },
  setTheme: el => { saveSettingsInputs(); S.theme = el.dataset.th; save(); render(); },
  setSize: el => { saveSettingsInputs(); S.textSize = el.dataset.z; save(); render(); },
  setMacro: el => { saveSettingsInputs(); S.profile.macro = el.dataset.m; save(); render(); },
  setProvider: el => { saveSettingsInputs(); S.ai.provider = el.dataset.pv; S.ai.model = ""; save(); render(); },
  editProfile: () => openSheet({ type: "profile" }),
  saveProfile: () => { readBody(); save(); closeSheet(); toast(t("saved")); },
  saveAi: () => { readAiInputs(); saveSettingsInputs(); save(); render(); toast(t("saved")); },
  testAi: async () => {
    readAiInputs(); save();
    const st = document.getElementById("ai-status");
    if (!S.ai.key) { st.innerHTML = '<div class="notice err">' + esc(t("aiNeedKey")) + "</div>"; return; }
    st.innerHTML = '<div class="notice"><span class="spinner sm"></span> ' + esc(t("testing")) + "</div>";
    try { await callAI({ messages: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }] }); st.innerHTML = '<div class="notice ok">' + esc(t("aiWorks")) + "</div>"; }
    catch (e) { st.innerHTML = '<div class="notice err">' + esc(t("aiError") + " " + e.message) + "</div>"; }
  },
  goAiSettings: () => { closeSheet(); view = "me"; render(); setTimeout(() => { const k = document.getElementById("ai-key"); if (k) { k.scrollIntoView({ block: "center" }); k.focus(); } }, 60); },
  help: () => openSheet({ type: "help" }),
  badgeInfo: el => openSheet({ type: "badge", id: el.dataset.id }),
  citySheet: () => openSheet({ type: "city" }),
  pickCity: el => { S.city = Number(el.dataset.i); S.cityCustom = null; save(); closeSheet(); },
  useLocation: () => {
    const err = document.getElementById("loc-err");
    try {
      navigator.geolocation.getCurrentPosition(p => { S.cityCustom = { lat: p.coords.latitude, lng: p.coords.longitude }; save(); closeSheet(); toast(t("saved")); },
        () => { if (err) err.innerHTML = '<div class="notice err small">' + esc(t("locationDenied")) + "</div>"; }, { timeout: 10000 });
    } catch (e) { if (err) err.innerHTML = '<div class="notice err small">' + esc(t("locationDenied")) + "</div>"; }
  },

  // food
  addMenu: () => openSheet({ type: "addMenu" }),
  foodSearch: el => openSheet({ type: "food", m: (el && el.dataset.m) || curMeal(), cat: "all", q: "" }),
  foodCat: el => { SH.cat = el.dataset.c; renderSheet(); },
  pickMeal: el => {
    SH.m = el.dataset.m;
    if (SH.type === "entry" || SH.type === "foodDetail") readQty();
    if (SH.type === "custom") return keepInputs(CF_IDS, renderSheet);
    if (SH.type === "barcode") { document.querySelectorAll('[data-act="pickMeal"]').forEach(b => b.classList.toggle("on", b.dataset.m === SH.m)); const btn = document.querySelector('[data-act="bcAdd"]'); if (btn) btn.textContent = t("addTo", { meal: mealName(SH.m) }); return; }
    renderSheet();
  },
  foodPick: el => pushSheet({ type: "foodDetail", id: el.dataset.id, qty: 1, m: SH.m, mode: SH.mode, unitMode: "srv" }),
  quickPick: el => {
    const f = getFood(el.dataset.id);
    if (SH.mode === "recipe") { RECIPE.items.push(snapshot(f, 1, "")); openSheet({ type: "recipe" }); return; }
    addEntry(f, 1, SH.m); toast(t("addedTo", { meal: mealName(SH.m) }));
    const l = document.getElementById("food-list"); if (l) l.innerHTML = foodRows();
  },
  quickLog: el => { const f = getFood(el.dataset.id); addEntry(f, 1, defaultMeal(), dk()); render(); toast(t("addedTo", { meal: mealName(defaultMeal()) })); },
  qty: el => { readQty(); SH.qty = Math.max(0.25, Math.round((SH.qty + Number(el.dataset.d)) * 4) / 4); renderSheet(); },
  qtySet: el => { SH.qty = Number(el.dataset.v); renderSheet(); },
  unitMode: el => { readQty(); SH.unitMode = el.dataset.um; renderSheet(); },
  gStep: el => { readQty(); const f = getFood(SH.id); SH.qty = Math.max(1, Math.round(SH.qty * f.g + Number(el.dataset.d))) / f.g; renderSheet(); },
  toggleFav: () => { const id = SH.id; S.fav = S.fav.includes(id) ? S.fav.filter(x => x !== id) : [id].concat(S.fav); save(); renderSheet(); },
  addFood: () => { readQty(); addEntry(servedFood(getFood(SH.id), SH.unitMode === "g" ? 0 : SH.alt), SH.qty, SH.m); const m = SH.m; closeSheet(); toast(t("addedTo", { meal: mealName(m) })); },
  servAlt: el => { readQty(); SH.alt = Number(el.dataset.i); SH.qty = 1; renderSheet(); },
  delCustom: () => A.delCustomId({ dataset: { id: SH.id } }),
  delCustomId: el => { const id = el.dataset.id; S.custom = S.custom.filter(c => c.id !== id); S.fav = S.fav.filter(x => x !== id); S.recent = S.recent.filter(x => x !== id); save(); if (SH && SH.type === "myFoods") renderSheet(); else closeSheet(); },
  customFood: () => pushSheet({ type: "custom", m: curMeal(), name: (SH && SH.q) || "" }),
  quickAdd: () => pushSheet({ type: "custom", quick: true, m: curMeal() }),
  saveCustom: () => {
    const g = id => document.getElementById(id);
    const name = g("cf-name").value.trim() || t("quickAdd"), kcal = num(g("cf-kcal").value);
    if (!(kcal >= 0)) { g("cf-err").innerHTML = '<div class="notice err">' + esc(t("needKcal")) + "</div>"; return; }
    const grams = SH.quick ? 0 : num(g("cf-g").value) || 0;
    const f = { id: SH.quick ? "quick" : "c" + uid(), n: [name, name, name, name], unit: "portion", cnt: 1, g: grams, s: SH.quick ? "" : g("cf-sv").value.trim(), kcal, p: num(g("cf-p").value) || 0, c: num(g("cf-c").value) || 0, f: num(g("cf-f").value) || 0, cat: "mine" };
    if (f.s) f.unit = null;
    if (SH.barcode) f.em = "📦";
    if (!SH.quick && (g("cf-save").checked || SH.barcode)) { S.custom.push(f); if (SH.barcode) rememberBarcode(SH.barcode, { food: f.id }); }
    addEntry(f, 1, SH.m); const m = SH.m; closeSheet(); toast(t("addedTo", { meal: mealName(m) }));
  },
  entry: el => { const e = day().food.find(x => x.u === el.dataset.u); openSheet({ type: "entry", u: e.u, qty: e.q, m: e.m }); },
  saveEntry: () => { readQty(); const e = day().food.find(x => x.u === SH.u); if (e) { e.q = SH.qty; e.m = SH.m; save(); } closeSheet(); },
  delEntry: () => {
    const d = day(cur, true), i = d.food.findIndex(x => x.u === SH.u);
    if (i >= 0) { undoBuf = { kind: "food", k: cur, i, item: d.food[i] }; d.food.splice(i, 1); save(); }
    closeSheet(); toast(t("removed"), true);
  },
  copyMeal: el => { const m = el.dataset.m, y = day(addDays(cur, -1)).food.filter(e => e.m === m); const d = day(cur, true); y.forEach(e => d.food.push(Object.assign({}, e, { u: uid() }))); save(); render(); toast(t("copied")); },
  saveMeal: el => { const m = el.dataset.m; openSheet({ type: "saveMeal", m, name: mealName(m) + " · " + shortDate(cur), focus: "sm-name" }); },
  doSaveMeal: () => {
    const items = day().food.filter(e => e.m === SH.m).map(e => { const c = Object.assign({}, e); delete c.u; delete c.m; return c; });
    S.meals.push({ id: "m" + uid(), name: document.getElementById("sm-name").value.trim() || mealName(SH.m), items }); save(); closeSheet(); toast(t("mealSaved"));
  },
  addSavedMeal: el => { const ml = S.meals.find(x => x.id === el.dataset.id); const d = day(cur, true); ml.items.forEach(e => d.food.push(Object.assign({}, e, { u: uid(), m: SH.m }))); save(); const m = SH.m; closeSheet(); toast(t("addedTo", { meal: mealName(m) })); },
  delMeal: el => { S.meals = S.meals.filter(m => m.id !== el.dataset.id); save(); renderSheet(); },
  myFoods: () => openSheet({ type: "myFoods" }),

  // recipes
  recipeNew: () => { RECIPE = { name: "", servings: 4, items: [] }; openSheet({ type: "recipe" }); },
  rcAdd: () => { RECIPE.name = document.getElementById("rc-name").value; pushSheet({ type: "food", mode: "recipe", cat: "all", q: "" }); },
  rcServ: el => { RECIPE.name = document.getElementById("rc-name").value; RECIPE.servings = Math.max(1, RECIPE.servings + Number(el.dataset.d)); renderSheet(); },
  rcDel: el => { RECIPE.name = document.getElementById("rc-name").value; RECIPE.items.splice(Number(el.dataset.i), 1); renderSheet(); },
  addToRecipe: () => { readQty(); RECIPE.items.push(snapshot(servedFood(getFood(SH.id), SH.unitMode === "g" ? 0 : SH.alt), SH.qty, "")); openSheet({ type: "recipe" }); },
  rcSave: () => {
    const name = document.getElementById("rc-name").value.trim();
    if (!name || !RECIPE.items.length) { document.getElementById("rc-err").innerHTML = '<div class="notice err">' + esc(t("recipeNeed")) + "</div>"; return; }
    const sv = RECIPE.servings, sum = k => RECIPE.items.reduce((a, i) => a + i[k] * i.q, 0);
    const grams = RECIPE.items.reduce((a, i) => a + (i.g || 0) * i.q, 0);
    S.custom.push({ id: "c" + uid(), n: [name, name, name, name], unit: "portion", cnt: 1, g: grams ? Math.round(grams / sv) : 0, kcal: sum("kcal") / sv, p: sum("p") / sv, c: sum("c") / sv, f: sum("f") / sv, cat: "recipe", items: RECIPE.items.map(i => ({ n: i.n, q: i.q })) });
    save(); RECIPE = null; closeSheet(); toast(t("recipeSaved"));
  },

  // exercise
  exSheet: () => openSheet({ type: "ex", q: "" }),
  exPick: el => pushSheet({ type: "ex", pick: el.dataset.id, min: 30 }),
  exMin: el => { readExMin(); SH.min = Math.max(5, SH.min + Number(el.dataset.d)); renderSheet(); },
  exMinSet: el => { SH.min = Number(el.dataset.v); renderSheet(); },
  exAdd: () => { readExMin(); const a = ACT.find(x => x.id === SH.pick); day(cur, true).ex.push({ u: uid(), id: a.id, n: a.n.slice(), min: SH.min, kcal: Math.round(exKcal(a.met, SH.min)) }); save(); closeSheet(); toast(t("exAdded")); },
  cxAdd: () => {
    const n = document.getElementById("cx-name").value.trim(), k = num(document.getElementById("cx-kcal").value), mn = num(document.getElementById("cx-min").value) || 0;
    if (!n || !(k > 0)) { toast(t("needNameKcal")); return; }
    day(cur, true).ex.push({ u: uid(), id: "custom", n: [n, n, n, n], min: mn, kcal: Math.round(k) }); save(); closeSheet(); toast(t("exAdded"));
  },
  exEntry: el => openSheet({ type: "exEntry", u: el.dataset.u }),
  delEx: () => {
    const d = day(cur, true), i = d.ex.findIndex(x => x.u === SH.u);
    if (i >= 0) { undoBuf = { kind: "ex", k: cur, i, item: d.ex[i] }; d.ex.splice(i, 1); save(); }
    closeSheet(); toast(t("removed"), true);
  },
  stepsSheet: () => openSheet({ type: "steps", focus: "steps-in" }),
  saveSteps: () => { const v = num(document.getElementById("steps-in").value); day(cur, true).steps = v > 0 ? Math.round(v) : 0; save(); closeSheet(); },

  // water, sleep, mood
  waterAdd: el => { const d = day(cur, true); d.water = Math.max(0, (d.water || 0) + Number(el.dataset.n)); save(); render(); if (d.water === targets().water && Number(el.dataset.n) > 0) { confetti(); toast(t("waterGoalHit")); } },
  waterQuick: () => { const d = day(cur, true); d.water = (d.water || 0) + 1; save(); closeSheet(); toast(t("waterAdded", { n: fmt(d.water) })); },
  sleep: el => { const d = day(cur, true), v = Number(el.dataset.v); d.sleep = d.sleep === v ? null : v; save(); render(); },
  mood: el => { const d = day(cur, true), v = Number(el.dataset.v); d.mood = d.mood === v ? null : v; save(); render(); },

  // weight & body
  weightSheet: () => openSheet({ type: "weight" }),
  wStep: el => { const i = document.getElementById("w-in"); const v = num(i.value) || wShow(latestWeight()); i.value = fmt(Math.max(1, v + Number(el.dataset.d)), 1); },
  saveWeight: () => {
    const v = wIn(num(document.getElementById("w-in").value));
    if (!(v > 25 && v < 350)) { toast(t("badWeight")); return; }
    const ex = S.weights.find(w => w.d === cur); if (ex) ex.kg = v; else S.weights.push({ d: cur, kg: v });
    S.profile.weight = latestWeight(); save(); closeSheet(); toast(t("saved"));
  },
  delWeight: el => { S.weights = S.weights.filter(w => w.d !== el.dataset.d); save(); renderSheet(); },
  measSheet: () => openSheet({ type: "meas" }),
  saveMeas: () => {
    const m = { d: dk() }; let any = false;
    MEAS.forEach(k => { const v = lIn(num(document.getElementById("m-" + k).value)); if (v > 10 && v < 250) { m[k] = v; any = true; } });
    if (!any) { toast(t("measNeed")); return; }
    S.meas = S.meas.filter(x => x.d !== m.d); S.meas.push(m); save(); closeSheet(); toast(t("saved"));
  },
  photoSheet: () => openSheet({ type: "photos" }),
  photoDel: el => { SH.delId = el.dataset.id; renderSheet(); },
  photoDelConfirm: async () => { try { await photoOp("del", SH.delId); } catch (e) { /* ignore */ } SH.delId = null; renderSheet(); },
  calRange: el => { calRange = Number(el.dataset.r); render(); },

  // fasting
  fastSheet: () => openSheet({ type: "fast" }),
  fastPlan: el => { S.fast.plan = Number(el.dataset.p); save(); SH ? renderSheet() : render(); },
  fastStart: () => { S.fast.start = Date.now(); save(); SH ? renderSheet() : render(); toast(t("fastStarted")); },
  fastEnd: () => {
    const ok = Date.now() - S.fast.start >= S.fast.plan * 3600000;
    S.fast.history.push({ start: S.fast.start, end: Date.now(), plan: S.fast.plan }); S.fast.history = S.fast.history.slice(-100); S.fast.start = null; save();
    SH ? renderSheet() : render(); if (ok) { confetti(); toast(t("fastDone")); }
  },

  // workouts
  routine: el => openSheet({ type: "routine", id: el.dataset.id }),
  startRoutine: () => startPlayer(window.ROUTINES.find(x => x.id === SH.id)),
  plPause: () => { PL.paused = !PL.paused; renderSheet(); },
  plSkip: () => { PL.left = 1; PL.paused = false; playerTick(); },
  plFinish: () => { PL.done = true; renderSheet(); },
  saveRoutine: () => {
    const r = PL.r, min = PL.workSec / 60;
    if (min > 0.2) day(dk(), true).ex.push({ u: uid(), id: "r_" + r.id, n: r.n.slice(), min: Math.max(1, Math.round(min)), kcal: Math.round(exKcal(r.met, min)) });
    save(); closeSheet(); toast(t("exAdded"));
  },

  // gym
  gymStart: () => { S.gym.active = { start: Date.now(), items: [] }; save(); openSheet({ type: "gym", full: true }); pushSheet({ type: "gymPick", q: "", full: true }); },
  gymOpen: () => openSheet({ type: "gym", full: true }),
  gymPick: () => pushSheet({ type: "gymPick", q: "", full: true }),
  gymAddEx: el => {
    const ex = el.dataset.ex, last = lastFor(ex);
    const sets = last ? last.map(s => ({ kg: s.kg, reps: s.reps, done: false })) : [{ kg: null, reps: null, done: false }, { kg: null, reps: null, done: false }, { kg: null, reps: null, done: false }];
    S.gym.active.items.push({ ex, sets }); save(); backSheet();
  },
  gymDelEx: el => { S.gym.active.items.splice(Number(el.dataset.gi), 1); save(); renderSheet(); },
  gymAddSet: el => { const it = S.gym.active.items[Number(el.dataset.gi)], l = it.sets[it.sets.length - 1]; it.sets.push({ kg: l ? l.kg : null, reps: l ? l.reps : null, done: false }); save(); renderSheet(); },
  gymDone: el => {
    const it = S.gym.active.items[Number(el.dataset.gi)], s = it.sets[Number(el.dataset.si)];
    s.done = !s.done;
    if (s.done && s.kg && s.reps) {
      const best = bestFor(it.ex); const mine = est1rm(s);
      const sessionBest = Math.max(0, ...it.sets.filter(x => x !== s && x.pr).map(est1rm));
      if (best > 0 && mine > best && mine > sessionBest) { s.pr = true; confetti(); toast(t("newRecord")); }
      beep(880, 0.08);
    } else s.pr = false;
    save(); renderSheet();
  },
  gymFinish: () => {
    const a = S.gym.active;
    const items = a.items.map(it => ({ ex: it.ex, sets: it.sets.filter(s => s.done && (s.reps || s.kg)).map(s => ({ kg: s.kg || 0, reps: s.reps || 0 })) })).filter(it => it.sets.length);
    const min = Math.min(180, Math.max(1, Math.round((Date.now() - a.start) / 60000)));
    if (items.length) {
      S.gym.sessions.push({ id: uid(), d: dk(), start: a.start, end: Date.now(), items });
      const n = LANGS.map(l => window.I18N[l].gymWorkout || window.I18N.en.gymWorkout);
      day(dk(), true).ex.push({ u: uid(), id: "gym", n, min, kcal: Math.round(exKcal(5, min)) });
    }
    S.gym.active = null; save(); closeSheet(); if (items.length) { confetti(); toast(t("workoutSaved")); }
  },
  gymDiscard: () => { if (!SH.discard) { SH.discard = true; renderSheet(); return; } S.gym.active = null; save(); closeSheet(); },

  // AI
  aiPhoto: () => openSheet({ type: "aiPhoto", mode: "photo", m: curMeal() }),
  aiText: () => openSheet({ type: "aiPhoto", mode: "text", m: curMeal(), focus: "ai-desc" }),
  aiTextFrom: () => openSheet({ type: "aiPhoto", mode: "text", m: curMeal(), desc: SH.q, focus: "ai-desc" }),
  aiRun: () => {
    if (SH.mode === "text") { SH.desc = document.getElementById("ai-desc").value.trim(); if (!SH.desc) return; }
    else { const h = document.getElementById("ai-hint"); SH.hint = h ? h.value.trim() : ""; }
    runFoodAI();
  },
  aiQty: el => { const it = SH.items[Number(el.dataset.i)]; it.q = Math.max(0.25, Math.round((it.q + Number(el.dataset.d)) * 4) / 4); renderSheet(); },
  aiRetry: () => { SH.items = null; SH.err = ""; SH.conv = null; SH.ask = null; SH.audio = null; renderSheet(); },
  aiVoice: () => openSheet({ type: "aiPhoto", mode: "voice", m: curMeal() }),
  recStart: () => startRecording(),
  recStop: () => stopRecording(),
  aiAnswer: el => {
    let a = el.dataset.i != null ? SH.ask.options[Number(el.dataset.i)] : (document.getElementById("ai-answer") || {}).value;
    a = String(a || "").trim(); if (!a) return;
    runFoodAI(a);
  },
  aiAdd: () => {
    const items = SH.items.filter(i => i.on); if (!items.length) return;
    if (SH.barcode) {
      const sum = k => items.reduce((a, i) => a + i[k] * i.q, 0), nm0 = SH.prodName || items[0].n[0];
      const f = { id: "c" + uid(), n: SH.prodName ? [nm0, nm0, nm0, nm0] : items[0].n.slice(), unit: "portion", cnt: 1, g: Math.round(items.reduce((a, i) => a + (i.g || 0) * i.q, 0)), kcal: sum("kcal"), p: sum("p"), c: sum("c"), f: sum("f"), mi: [0, 1, 2, 3, 4, 5, 6].map(x => items.reduce((a, i) => a + ((i.mi && i.mi[x]) || 0) * i.q, 0)), em: "📦", cat: "mine" };
      S.custom.push(f); rememberBarcode(SH.barcode, { food: f.id }); addEntry(f, 1, SH.m);
      const m = SH.m; closeSheet(); toast(t("addedTo", { meal: mealName(m) })); return;
    }
    items.forEach(i => addEntry(i, i.q, SH.m)); const m = SH.m; closeSheet(); toast(t("addedTo", { meal: mealName(m) })); },
  coach: () => openSheet({ type: "coach", full: true }),
  coachSend: () => { const i = document.getElementById("coach-in"); coachSend(i.value); },
  coachAsk: el => coachSend(el.dataset.q),
  coachClear: () => { S.chat = []; save(); renderSheet(); },

  // barcode
  barcode: () => { BC = null; openSheet({ type: "barcode", m: curMeal() }); },
  bcLookup: () => { stopCamera(); const w = document.getElementById("bc-cam"); if (w) w.hidden = true; bcLookup(document.getElementById("bc-in").value); },
  bcLabel: () => pushSheet({ type: "aiPhoto", mode: "photo", m: SH.m, barcode: SH.code, prodName: SH.prodName, hint: t("labelHint") + (SH.prodName ? " (" + SH.prodName + ")" : "") }),
  bcManual: () => pushSheet({ type: "custom", m: SH.m, name: SH.prodName || "", barcode: SH.code }),
  bcAdd: () => {
    const g = num((document.getElementById("bc-g") || {}).value) || BC.grams;
    rememberBarcode(BC.code, { name: BC.name, kcal: BC.kcal, p: BC.p, c: BC.c, f: BC.f, mi: BC.mi || null, grams: g });
    addEntry({ id: "bc", n: [BC.name, BC.name, BC.name, BC.name], unit: "g", cnt: g, g, kcal: BC.kcal * g / 100, p: BC.p * g / 100, c: BC.c * g / 100, f: BC.f * g / 100, mi: BC.mi ? BC.mi.map(x => x * g / 100) : null, em: "📦" }, 1, SH.m);
    const m = SH.m; closeSheet(); toast(t("addedTo", { meal: mealName(m) }));
  },

  // share
  shareDay: async () => {
    try {
      const blob = await makeShareImage();
      const file = new File([blob], "xorak-" + dk() + ".png", { type: "image/png" });
      S.shares++; save();
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: t("shareText") }); return; }
      openSheet({ type: "share", url: URL.createObjectURL(blob) });
    } catch (e) { if (e && e.name !== "AbortError") toast(t("shareFailed")); }
  },

  // backup
  exportData: () => openSheet({ type: "exportData" }),
  copyExport: () => {
    const ta = document.getElementById("exp-text");
    try { navigator.clipboard.writeText(ta.value).then(() => toast(t("copied")), () => { ta.select(); toast(t("selectCopy")); }); } catch (e) { ta.select(); toast(t("selectCopy")); }
  },
  downloadExport: async () => {
    const text = JSON.stringify(S), name = "xorak-backup-" + dk() + ".json";
    try {
      const file = new File([text], name, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    } catch (e) { if (e && e.name !== "AbortError") A.copyExport(); }
  },
  importSheet: () => openSheet({ type: "importData" }),
  doImport: async () => {
    const ta = document.getElementById("imp-text"), fi = document.getElementById("imp-file"), err = document.getElementById("imp-err");
    let text = ta.value.trim();
    if (!text && fi.files && fi.files[0]) text = await fi.files[0].text();
    if (!text && SH.pending) text = SH.pending;
    try { const d = JSON.parse(text); if (!d || !d.v || !d.days) throw new Error("bad"); }
    catch (e) { err.innerHTML = '<div class="notice err">' + esc(t("badBackup")) + "</div>"; return; }
    if (!SH.confirm) { SH.confirm = true; SH.pending = text; renderSheet(); return; }
    try { localStorage.setItem(KEY, text); } catch (e) { /* ignore */ }
    S = load(); S.onboarded = true; save(); closeSheet(); toast(t("restored"));
  },
  reset: el => {
    if (el.dataset.armed) { try { localStorage.removeItem(KEY); indexedDB.deleteDatabase("xorak"); } catch (e) { /* ignore */ } S = defaults(); onb = 0; view = "today"; cur = dk(); render(); return; }
    el.dataset.armed = "1"; el.textContent = t("tapAgainErase"); setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = t("resetAll"); } }, 4000);
  }
};
function readAiInputs() {
  const k = document.getElementById("ai-key"), m = document.getElementById("ai-model");
  if (k) S.ai.key = k.value.trim();
  if (m) S.ai.model = m.value.trim();
}

/* ---------- Nutrients ---------- */
SHEETS.nutrients = () => {
  const tt = totals(), tg = targets(), mt = window.MICRO_TARGET[S.profile.sex === "f" ? "f" : "m"];
  const bar = (label, v, goal, unit, color, isMax) => {
    const pct = Math.min(1, v / goal), over = isMax && v > goal;
    return '<div class="nrow"><div class="nrow-top"><span>' + esc(label) + '</span><b class="num">' + fmt(v, unit === t("mg") && v < 20 ? 1 : 0) + " / " + fmt(goal) + " " + esc(unit) + (isMax ? ' <small class="muted">' + esc(t("max")) + "</small>" : "") + '</b></div><div class="bar"><i style="width:' + (pct * 100).toFixed(0) + "%;background:" + (over ? "var(--pom)" : color) + '"></i></div></div>';
  };
  let h = sheetTop(t("nutrients")) + '<div class="stack"><div class="card">' +
    bar(t("calories"), tt.kcal, tg.kcal + tt.ex, t("kcal"), "var(--sun)") + bar(t("protein"), tt.p, tg.p, t("g"), "var(--protein)") + bar(t("carbs"), tt.c, tg.c, t("g"), "var(--carbs)") + bar(t("fat"), tt.f, tg.f, t("g"), "var(--fat)") + "</div>" +
    '<div class="label" style="margin:4px 4px 0">' + esc(t("vitaminsMinerals")) + '</div><div class="card">';
  const colors = ["var(--leaf)", "var(--pom)", "var(--water)", "var(--fat)", "var(--sun)", "var(--protein)", "var(--leaf)"];
  window.MICRO_KEYS.forEach((k, i) => { h += bar(t("mi_" + k), tt.mi[i], mt[i], i < 2 ? t("g") : t("mg"), colors[i], i === 1 || i === 2); });
  h += "</div>";
  const d = day();
  if (d.food.length && tt.miKnown < d.food.length) h += '<p class="small muted" style="margin:0">' + esc(t("microPartial")) + "</p>";
  h += '<p class="small muted" style="margin:0">' + esc(t("microNote")) + "</p></div>";
  return h;
};

/* ---------- Meal planner ---------- */
SHEETS.planner = () => {
  if (!S.plan || planDayIndex() < 0) {
    return sheetTop(t("mealPlan")) + '<div class="stack center"><div class="big-emoji huge">🗓️</div><p>' + esc(t("plannerIntro", { n: fmt(targets().kcal) })) + '</p><button class="btn sun block big" data-act="planNew">' + ic("calendar") + esc(t("makePlan")) + "</button></div>";
  }
  const di = SH.day != null ? SH.day : Math.max(0, planDayIndex());
  const pd = S.plan.days[di], k = addDays(S.plan.start, di), logged = (day(k).planned) || {};
  let h = sheetTop(t("mealPlan")) + '<div class="chips daychips">' + S.plan.days.map((_, i) => { const kk = addDays(S.plan.start, i); return '<button class="chip' + (i === di ? " on" : "") + '" data-act="planDay" data-i="' + i + '">' + esc(kk === dk() ? t("today") : weekdayShort(kk)) + "</button>"; }).join("") + "</div>";
  const total = ["b", "l", "d", "s"].reduce((a, m) => a + planKcal(pd[m].items), 0);
  h += '<p class="small muted num" style="margin:10px 4px">' + esc(dateLabel(k, true)) + " · " + fmt(total) + " " + esc(t("kcal")) + "</p>";
  ["b", "l", "d", "s"].forEach(m => {
    const it = pd[m];
    h += '<section class="card" style="margin-bottom:12px"><div class="meal-head"><span class="meal-ic">' + mealEmoji(m) + "</span><h2>" + esc(mealName(m)) + '</h2><span class="meal-kcal num">' + fmt(planKcal(it.items)) + '</span><button class="iconbtn sm flat" data-act="planShuffle" data-day="' + di + '" data-m="' + m + '" aria-label="' + esc(t("shuffle")) + '">' + ic("shuffle") + "</button></div>" +
      '<div class="list">' + it.items.map(x => { const f = FOOD[x[0]]; return '<div class="row"><span class="fthumb">' + foodEmoji(f) + '</span><div class="grow"><div class="t">' + esc(nm(f)) + '</div><div class="s num">' + esc(servingLabel(f, x[1])) + '</div></div><div class="k num">' + fmt(f.kcal * x[1]) + "</div></div>"; }).join("") + "</div>" +
      (k === dk() ? (logged[m] ? '<div class="small muted" style="margin-top:8px">' + ic("check") + " " + esc(t("logged")) + "</div>" : '<button class="btn ghost block" style="margin-top:8px" data-act="logPlan" data-day="' + di + '" data-m="' + m + '">' + ic("plus") + esc(t("logThis")) + "</button>") : "") + "</section>";
  });
  h += '<button class="btn ghost block" data-act="planNew">' + ic("shuffle") + esc(t("newPlan")) + "</button>";
  return h;
};

/* ---------- Monthly report ---------- */
function monthKeys(y, m) { const out = [], d = new Date(y, m, 1); while (d.getMonth() === m) { out.push(dk(d)); d.setDate(d.getDate() + 1); } return out; }
function monthName(y, m) { return lang() === "en" ? new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : MONTHS[lang()][m] + " " + loc(y); }
SHEETS.report = () => {
  const now = new Date(), y = SH.y != null ? SH.y : now.getFullYear(), m = SH.m2 != null ? SH.m2 : now.getMonth();
  const keys = monthKeys(y, m).filter(k => k <= dk()), tg = targets();
  const lg = keys.filter(k => day(k).food.length);
  const avg = f => (lg.length ? lg.reduce((a, k) => a + totals(k)[f], 0) / lg.length : 0);
  const avgMi = i => (lg.length ? lg.reduce((a, k) => a + totals(k).mi[i], 0) / lg.length : 0);
  let ex = 0, exMin = 0, exKc = 0; keys.forEach(k => day(k).ex.forEach(e => { ex++; exMin += e.min || 0; exKc += e.kcal; }));
  const ws = sortedWeights().filter(w => w.d.slice(0, 7) === keys[0].slice(0, 7));
  const wChange = ws.length > 1 ? ws[ws.length - 1].kg - ws[0].kg : null;
  const fasts = S.fast.history.filter(f => dk(new Date(f.start)).slice(0, 7) === keys[0].slice(0, 7) && f.end - f.start >= f.plan * 3600000).length;
  const counts = {}; lg.forEach(k => day(k).food.forEach(e => { const key = e.n[0]; counts[key] = counts[key] || { e, n: 0 }; counts[key].n++; }));
  const top = Object.values(counts).sort((a, b) => b.n - a.n).slice(0, 5);
  const onTarget = lg.filter(k => Math.abs(totals(k).kcal - tg.kcal) <= tg.kcal * 0.1).length;
  const sl = keys.map(k => day(k).sleep).filter(Boolean);
  let h = sheetTop(t("monthlyReport"), { extra: '<button class="iconbtn" data-act="printReport" aria-label="' + esc(t("savePdf")) + '">' + ic("print") + "</button>" }) +
    '<div class="month-nav"><button class="iconbtn sm" data-act="reportMonth" data-d="-1" aria-label="' + esc(t("prevMonth")) + '">' + ic("left", "flip") + "</button><b>" + esc(monthName(y, m)) + '</b><button class="iconbtn sm" data-act="reportMonth" data-d="1" aria-label="' + esc(t("nextMonth")) + '"' + (y === now.getFullYear() && m === now.getMonth() ? " disabled" : "") + ">" + ic("right", "flip") + "</button></div>" +
    '<div id="print-area" class="stack">' +
    '<div class="print-only"><h1>Xorak · خۆراک</h1><p>' + esc(t("monthlyReport")) + " · " + esc(monthName(y, m)) + (S.profile.name ? " · " + esc(S.profile.name) : "") + "</p></div>";
  if (!lg.length && !ex) return h + '<p class="empty pad">' + esc(t("reportEmpty")) + "</p></div>";
  h += '<div class="tiles"><div class="tile"><b class="num">' + fmt(lg.length) + "<small>/" + fmt(keys.length) + "</small></b><span>" + esc(t("daysLogged")) + '</span></div><div class="tile"><b class="num">' + fmt(onTarget) + "</b><span>" + esc(t("daysOnTarget")) + '</span></div><div class="tile"><b class="num">' + (wChange == null ? "–" : (wChange > 0 ? "+" : "") + fmt(wShow(wChange), 1)) + "</b><span>" + esc(t("weightChange")) + " (" + esc(wUnit()) + ")</span></div></div>" +
    '<div class="card">' + calChart(keys, tg.kcal) + "</div>" +
    '<div class="tiles"><div class="tile"><b class="num">' + fmt(avg("kcal")) + "</b><span>" + esc(t("avgKcal")) + '</span></div><div class="tile"><b class="num">' + fmt(avg("p")) + esc(t("g")) + "</b><span>" + esc(t("avgProtein")) + '</span></div><div class="tile"><b class="num">' + fmt(avgMi(0)) + esc(t("g")) + "</b><span>" + esc(t("avgFiber")) + "</span></div></div>" +
    '<div class="tiles"><div class="tile"><b class="num">' + fmt(ex) + "</b><span>" + esc(t("workouts")) + '</span></div><div class="tile"><b class="num">' + fmt(exMin) + "</b><span>" + esc(t("minutes")) + '</span></div><div class="tile"><b class="num">' + fmt(exKc) + "</b><span>" + esc(t("kcalBurned")) + "</span></div></div>" +
    '<div class="tiles"><div class="tile"><b class="num">' + fmt(fasts) + "</b><span>" + esc(t("fastsDone")) + '</span></div><div class="tile"><b class="num">' + (sl.length ? fmt(sl.reduce((a, b) => a + b, 0) / sl.length, 1) : "–") + "</b><span>" + esc(t("avgSleep")) + '</span></div><div class="tile"><b class="num">' + fmt(avgMi(2)) + "</b><span>" + esc(t("avgSodium")) + "</span></div></div>";
  if (top.length) h += '<div class="card"><div class="card-head"><h2>' + esc(t("topFoods")) + '</h2></div><div class="list">' + top.map(x => '<div class="row"><span class="fthumb">' + foodEmoji(x.e) + '</span><div class="grow"><div class="t">' + esc(nm(x.e)) + '</div></div><div class="k num">' + fmt(x.n) + "×</div></div>").join("") + "</div></div>";
  h += '</div><button class="btn sun block big" data-act="printReport">' + ic("print") + esc(t("savePdf")) + '</button><p class="small muted center" style="margin:6px 0 0">' + esc(t("pdfHelp")) + "</p>";
  return h;
};

Object.assign(A, {
  nutrients: () => openSheet({ type: "nutrients" }),
  planner: () => openSheet({ type: "planner", full: true }),
  planNew: () => { makePlan(); SH.day = null; renderSheet(); toast(t("planReadyToast")); },
  planDay: el => { SH.day = Number(el.dataset.i); renderSheet(); },
  planShuffle: el => {
    const di = Number(el.dataset.day), m = el.dataset.m, cur0 = S.plan.days[di][m];
    S.plan.days[di][m] = planMeal(m, targets().kcal * MEAL_SHARE[m], cur0.i); save(); renderSheet();
  },
  logPlan: el => {
    const di = Number(el.dataset.day), m = el.dataset.m, pd = S.plan.days[di][m], d = day(dk(), true);
    pd.items.forEach(x => d.food.push(snapshot(FOOD[x[0]], x[1], m)));
    d.planned = Object.assign({}, d.planned, { [m]: true }); save();
    if (SH) renderSheet(); else render();
    toast(t("addedTo", { meal: mealName(m) }));
  },
  report: () => openSheet({ type: "report", full: true }),
  reportMonth: el => {
    const now = new Date(); let y = SH.y != null ? SH.y : now.getFullYear(), m = (SH.m2 != null ? SH.m2 : now.getMonth()) + Number(el.dataset.d);
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth())) return;
    SH.y = y; SH.m2 = m; renderSheet();
  },
  printReport: () => {
    document.body.classList.add("printing");
    const done = () => document.body.classList.remove("printing");
    window.addEventListener("afterprint", done, { once: true });
    try { window.print(); } catch (e) { done(); toast(t("pdfUnavailable")); }
    setTimeout(done, 60000);
  }
});

/* ---------- Drag a sheet down to close ---------- */
(function sheetDrag() {
  let y0 = null, panel = null, dy = 0;
  sheetEl.addEventListener("touchstart", e => {
    panel = e.target.closest(".sheet-panel");
    if (!panel || panel.scrollTop > 0 || e.target.closest("input,textarea,select,.cam,.chips")) { panel = null; return; }
    y0 = e.touches[0].clientY; dy = 0; panel.style.transition = "none";
  }, { passive: true });
  sheetEl.addEventListener("touchmove", e => {
    if (!panel || y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (panel.scrollTop > 0) dy = 0;
    panel.style.transform = dy ? "translateY(" + dy + "px)" : "";
  }, { passive: true });
  sheetEl.addEventListener("touchend", () => {
    if (!panel) return;
    panel.style.transition = "transform .2s ease";
    if (dy > 110) { panel.style.transform = "translateY(100%)"; setTimeout(() => { if (SH && SH.type === "player" && PL && !PL.done) { panel.style.transform = ""; return; } closeSheet(); }, 180); }
    else panel.style.transform = "";
    y0 = null; panel = null; dy = 0;
  });
})();

/* ---------- Events ---------- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); e.stopPropagation(); fn(el); }
});
document.addEventListener("input", e => {
  const el = e.target, id = el.id;
  if (id === "food-q" && SH) { SH.q = el.value; const l = document.getElementById("food-list"); if (l) l.innerHTML = foodRows(); }
  if (id === "ex-q" && SH) {
    SH.q = el.value; const q = norm(SH.q), l = document.getElementById("ex-list");
    if (l) l.querySelectorAll(".row").forEach(r => { const a = ACT.find(x => x.id === r.dataset.id); r.hidden = !!q && !a.n.some(x => norm(x).includes(q)); });
  }
  if (id === "gym-q" && SH) {
    SH.q = el.value; const q = norm(SH.q), l = document.getElementById("gym-list");
    if (l) l.querySelectorAll(".row").forEach(r => { r.hidden = !!q && !window.GYM[r.dataset.ex].some(x => norm(x).includes(q)); });
  }
  if (id === "bc-g" && BC) { const v = num(el.value); if (v > 0) { BC.grams = v; const tl = document.getElementById("bc-tiles"); if (tl) tl.innerHTML = nutriTiles(BC.kcal * v / 100, BC.p * v / 100, BC.c * v / 100, BC.f * v / 100); } }
  if (el.dataset && el.dataset.gi != null && el.dataset.f && S.gym.active) {
    const s = S.gym.active.items[Number(el.dataset.gi)].sets[Number(el.dataset.si)]; const v = num(el.value);
    s[el.dataset.f] = isNaN(v) ? null : v; save();
  }
});
document.addEventListener("change", async e => {
  const el = e.target;
  if (el.dataset && el.dataset.aiI != null && SH && SH.items) { SH.items[Number(el.dataset.aiI)].on = el.checked; renderSheet(); return; }
  if ((el.id === "ai-cam" || el.id === "ai-lib") && el.files && el.files[0]) {
    const h = document.getElementById("ai-hint"); SH.hint = h ? h.value : "";
    try { SH.img = await imageToBase64(el.files[0]); SH.err = ""; } catch (er) { SH.err = t("photoError"); }
    renderSheet(); return;
  }
  if (el.id === "photo-in" && el.files && el.files[0]) {
    try {
      const data = await imageToBase64(el.files[0], 900);
      const blob = await (await fetch(data)).blob();
      await photoOp("put", { id: uid(), d: dk(), blob });
      toast(t("saved"));
    } catch (er) { toast(t("photosUnavailable")); }
    renderSheet(); return;
  }
  if (el.id === "set-ramadan") { S.ramadan = el.checked; save(); render(); }
  if (["set-kcal", "set-water", "set-steps", "set-glass"].includes(el.id)) { saveSettingsInputs(); save(); render(); }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && SH) closeSheet();
  if (e.key === "Enter" && e.target.id === "coach-in") { e.preventDefault(); coachSend(e.target.value); }
  if (e.key === "Enter" && e.target.id === "bc-in") { e.preventDefault(); A.bcLookup(); }
  if (e.key === "Enter" && e.target.id === "food-q") { e.preventDefault(); e.target.blur(); }
});

/* ---------- Timers ---------- */
setInterval(() => {
  playerTick();
  const st = fastState();
  if (st) {
    document.querySelectorAll('[data-fast="el"]').forEach(n => { n.textContent = dur(st.el); });
    document.querySelectorAll('[data-fast="pct"]').forEach(n => { n.textContent = fmt(st.pct * 100) + "%"; });
  }
  const rc = document.querySelector('[data-rc="left"]'); if (rc) rc.textContent = dur(ramadanCountdown().left);
  const rt = document.getElementById("rec-time"); if (rt && SH && SH.rec) { const s = Math.floor((Date.now() - recStart) / 1000); rt.textContent = loc(Math.floor(s / 60) + ":" + pad(s % 60)); }
  const ge = document.querySelector('[data-gym="el"]'); if (ge && S.gym.active) ge.textContent = dur(Date.now() - S.gym.active.start);
}, 1000);
let lastToday = dk();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && dk() !== lastToday) { if (cur === lastToday) cur = dk(); lastToday = dk(); if (!SH) render(); }
});

/* ---------- Start ---------- */
if (S.lang && !S.onboarded) onb = 1;
render();
badgeCheckReady = true;
if (toastLater) { toast(t(toastLater)); toastLater = null; }
if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|anthropic/.test(location.hostname)) {
  try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (e) { /* ignore */ }
}
