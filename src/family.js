/* Aplikacija za roditelje: program porodice, aktivnosti, zapažanja, podrška. */

import { family as api } from "./api.js";
import { PROFILE, ISKUSTVA, BUDNOST, SAGLASNOST, PODRAZUMEVANI_SAVETI, CESTA_PITANJA } from "./config.js";
import {
  $, esc, md, toast, openModal, closeModal, modalOpen, fmtDate, todayISO, longToday, relTime, lastDays, isoOf,
  ICON, HERO_ART, artAt, bgAt, areaIndex, ring, store, download, formCode, copyText, daysBetween,
} from "./util.js";
import {
  normalizeContent, currentWeek, weekGroups, groupForWeek, activitiesForGroup, activityByCode, activityByTitle, todaysPick,
} from "./program.js";
import { hydrateImages } from "./images.js";

const S = {
  code: null, data: null, offline: false,
  filter: "sve", search: "", notesTab: "dnevna", pickOffset: 0, groupIndex: null,
  run: null, timer: null, preview: false,
};

const content = () => S.data.program.content;
const program = () => S.data.program;
const tried = code => S.data.tried.includes(code);
const iskustvo = id => ISKUSTVA.find(i => i.id === id);
const imgFetcher = ids => (S.preview ? S.previewImages(ids) : api.images(S.code, ids));

export const NAV = [
  { page: "plan", label: "Moj program", short: "Program", icon: ICON.grid },
  { page: "aktivnosti", label: "Aktivnosti", short: "Aktivnosti", icon: ICON.book },
  { page: "zapazanja", label: "Naša zapažanja", short: "Zapažanja", icon: ICON.doc },
  { page: "podrska", label: `Podrška ${PROFILE.imeGenitiv}`, short: "Podrška", icon: ICON.heart },
];

/* ================================================================ UČITAVANJE */

export async function load(code, { quiet = false } = {}) {
  S.code = code;
  try {
    const data = await api.get(code);
    prepare(data);
    S.offline = false;
    store.set("cache_" + code, data);
    return true;
  } catch (e) {
    if (e.code === "offline") {
      const cached = store.get("cache_" + code, null);
      if (cached) { prepare(cached); S.offline = true; return true; }
    }
    if (!quiet) throw e;
    return false;
  }
}

function prepare(data) {
  if (data.program) data.program.content = normalizeContent(data.program.content);
  S.data = data;
}

/* Pregled programa iz Draganinog editora (bez čuvanja). */
export function setPreview(programObj, familyObj, imageFetcher) {
  S.preview = true;
  S.previewImages = imageFetcher;
  S.code = "PREVIEW";
  S.data = {
    family: { name: familyObj.name, children: familyObj.children, consent_at: new Date().toISOString() },
    program: { ...programObj, content: normalizeContent(programObj.content) },
    history: [], tried: [], observations: [], reviews: [], messages: [],
  };
}

export const hasData = () => Boolean(S.data);
export const unreadCount = () => (S.data ? S.data.messages.filter(m => m.sender === "owner" && !m.read_at).length : 0);

/* ================================================================ RENDER */

export function render(page) {
  if (!S.data) return "";
  if (!S.data.family.consent_at && !S.preview) return consentScreen();
  const banner = S.offline ? `<div class="notice offline">${ICON.info} Nema interneta – prikazujem poslednje sačuvanu verziju. Nove beleške sačuvajte kada se veza vrati.</div>` : "";
  const previewBar = S.preview ? `<div class="preview-bar">${ICON.eye} Pregled – ovako će roditelji videti program <button class="btn-link" data-action="exit-preview">Zatvori pregled</button></div>` : "";
  if (!S.data.program && page !== "podrska") return previewBar + banner + noProgram();
  const fn = { plan: pagePlan, aktivnosti: pageAktivnosti, zapazanja: pageZapazanja, podrska: pagePodrska, procena: pageProcena }[page] || pagePlan;
  return previewBar + banner + fn();
}

export function crumb(page) {
  return { plan: "Moj program", aktivnosti: "Aktivnosti", zapazanja: "Naša zapažanja", podrska: `Podrška ${PROFILE.imeGenitiv}`, procena: "Procena i vodič" }[page] || "Moj program";
}

export function afterRender(root) { hydrateImages(root, imgFetcher); }

function consentScreen() {
  const f = S.data.family;
  return `
    <section class="welcome-card">
      <p class="eyebrow">Dobro došli</p>
      <h1>${esc(f.name)}</h1>
      <p class="lead">Ovde je vaš program podrške${f.children ? ` za ${esc(f.children)}` : ""}, aktivnosti korak po korak i prostor za vaša zapažanja.</p>
      <div class="consent-box">
        <h3>Pre nego što počnete</h3>
        <p>${esc(SAGLASNOST)}</p>
      </div>
      <button class="btn btn-lg" data-action="consent">Razumem i slažem se</button>
    </section>`;
}

function noProgram() {
  return `
    <div class="page-head"><p class="eyebrow">${esc(S.data.family.name)}</p><h1>Vaš program se priprema.</h1>
    <p class="lead">${PROFILE.imeKratko} uskoro objavljuje program za vašu porodicu. Do tada joj možete pisati u delu „Podrška“.</p></div>
    <a class="btn" href="#/podrska">${ICON.send} Pišite ${esc(PROFILE.imeDativ)}</a>`;
}

/* ---------------------------------------------------------------- Moj program */

function thumbFor(a, cls = "act-thumb") {
  const c = content();
  const i = areaIndex(c, a.areaId);
  if (a.imageIds.length) return `<span class="${cls} ${bgAt(i)} img-wrap"><img data-img="${esc(a.imageIds[0])}" alt="">${artAt(i)}</span>`;
  return `<span class="${cls} ${bgAt(i)}">${artAt(i)}</span>`;
}

function todayCard() {
  const a = todaysPick(program(), S.data.observations, S.pickOffset);
  if (!a) return "";
  const c = content();
  const area = c.areas[areaIndex(c, a.areaId)];
  const doneToday = S.data.observations.some(o => o.obs_date === todayISO());
  return `
    <section class="today">
      ${thumbFor(a, "today-art")}
      <div class="today-body">
        <p class="eyebrow">Predlog za danas · ${longToday()}</p>
        <h3>${esc(a.title)}</h3>
        <p>${a.steps.length ? `${a.steps.length} kratkih koraka` : "Kratka aktivnost"}${area ? " · " + esc(area.title) : ""}${tried(a.code) ? " · već poznata igra" : ""}</p>
        <div class="today-actions">
          ${a.steps.length ? `<button class="btn" data-steps="${esc(a.code)}">▶ Krenimo</button>` : ""}
          <button class="btn-ghost" data-open="${esc(a.code)}">Pročitaj ceo opis</button>
          <button class="btn-link" data-action="another">Drugi predlog ↻</button>
        </div>
      </div>
      ${doneToday ? `<span class="today-done">✓ Danas ste već zabeležili igru</span>` : ""}
    </section>`;
}

function pagePlan() {
  const c = content();
  const p = program();
  const groups = weekGroups(c);
  const cw = currentWeek(p);
  const curGroup = groupForWeek(c, cw);
  const gi = S.groupIndex ?? Math.max(0, groups.indexOf(curGroup));
  const g = groups[gi] || groups[0];
  const acts = activitiesForGroup(c, g);
  const total = c.activities.length;
  const done = S.data.tried.filter(code => activityByCode(c, code)).length;
  const f = S.data.family;
  const unread = unreadCount();

  const list = acts.length
    ? acts.map(a => `
      <button class="act-row ${tried(a.code) ? "done" : ""}" data-open="${esc(a.code)}">
        ${thumbFor(a)}
        <span class="act-text">
          <span class="eyebrow">Aktivnost ${esc(a.code)}</span>
          <strong>${esc(a.title)}</strong>
          <small>${a.steps.length} koraka${a.imageIds.length ? " · ilustracija" : ""}${tried(a.code) ? " · isprobano ✓" : ""}</small>
        </span>
        <span class="go">${tried(a.code) ? "✓" : "→"}</span>
      </button>`).join("")
    : (c.routines.length
      ? `<div class="routines">${c.routines.map(r => `<div class="routine"><strong>${esc(r.title)}</strong><span>${esc(r.focus || r.text.slice(0, 140))}</span></div>`).join("")}</div>
         <a class="btn-link" href="#/procena" style="display:inline-block;margin-top:12px">Pogledaj sve rutine ↗</a>`
      : `<p class="muted">Za ovu nedelju nema posebnih aktivnosti – ponavljajte one koje detetu najviše prijaju.</p>`);

  return `
    <div class="page-head row-between">
      <div>
        <p class="eyebrow">${esc(f.name)}${c.childNames ? " · " + esc(c.childNames) : ""}</p>
        <h1>${esc(c.title || p.title || "Dobro došli u vaš program.")}</h1>
        <p class="lead">${p.start_date ? `Program je počeo ${fmtDate(p.start_date)} · ${cw}. od ${c.durationWeeks} nedelja` : "Individualizovan plan podrške porodici"}</p>
      </div>
      <span class="date-pill">${ICON.calendar} ${c.durationWeeks} nedelja</span>
    </div>

    ${unread ? `<a class="notice notice-msg" href="#/podrska">${ICON.send} ${PROFILE.imeKratko} vam je poslala ${unread === 1 ? "novu poruku" : unread + " nove poruke"}. Pročitajte →</a>` : ""}

    <section class="hero">
      <div>
        <p class="eyebrow">Kućni defektolog · uz vas, korak po korak</p>
        <h2>Mali koraci.<br>Vaš porodični ritam.</h2>
        <p>${esc(c.intro || "Ne morate uraditi sve. Biramo kratke aktivnosti koje mogu da stanu u vaš dan.")}</p>
      </div>
      ${HERO_ART}
    </section>

    ${todayCard()}

    <div class="quick">
      <a href="#/procena">${ICON.leaf}<span><strong>Procena i ciljevi</strong><small>Pročitajte celu procenu i vodič</small></span><span class="arrow">↗</span></a>
      <a href="#/procena" data-scroll="rutine">${ICON.home}<span><strong>Podrška kroz dan</strong><small>${c.routines.length ? c.routines.length + " poznatih rutina" : "Saveti za svakodnevicu"}</small></span><span class="arrow">↗</span></a>
    </div>

    <div class="row-between" style="align-items:center">
      <h2 class="section-title">Vaš plan po nedeljama</h2>
      <a href="#/aktivnosti" class="btn-link">Sve aktivnosti ↗</a>
    </div>
    <div class="weeks" style="--n:${Math.min(groups.length, 6)}">
      ${groups.map((w, i) => `
        <button class="week ${i === gi ? "active" : ""} ${w === curGroup ? "current" : ""}" data-group="${i}">
          <span class="eyebrow">${w.fromWeek === w.toWeek ? "Nedelja" : "Nedelje"}${w === curGroup ? " · sada" : ""}</span>
          <b>${w.fromWeek === w.toWeek ? String(w.fromWeek).padStart(2, "0") : `${w.fromWeek}–${w.toWeek}`}</b>
          <span>${esc(w.title || w.focus || "")}</span>
        </button>`).join("")}
    </div>

    <div class="week-grid">
      <div>
        <p class="eyebrow">${esc(g.label)}</p>
        <h2>${esc(g.title || g.focus || "Aktivnosti nedelje")}</h2>
        ${g.summary ? `<p>${esc(g.summary)}</p>` : ""}
        ${list}
        <a class="note-cta" href="#/zapazanja">${ICON.note}<div><strong>Šta ste danas primetili?</strong><small>Zabeležite reakciju i budnost pre i posle igre.</small></div><span>↗</span></a>
        <p class="gentle">${ICON.heart} Ne morate uraditi sve. Jedna dobra, kratka interakcija može biti sasvim dovoljna za taj dan.</p>
      </div>
      <aside class="focus">
        <span class="circle">${ICON.leaf}</span>
        <p class="eyebrow">Fokus</p>
        <h3>${esc(g.focus || g.title || c.title)}</h3>
        ${g.summary && g.focus ? "" : ""}
        <p>${esc((c.areas.find(a => acts[0] && String(a.id) === String(acts[0].areaId)) || {}).intro || c.assessment.summary || "")}</p>
        <div class="progress">
          <div class="row-between"><span>Isprobano u programu</span><b>${done} / ${total}</b></div>
          <div class="bar"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
          <small>Ovo je beleška o iskustvu, bez obaveze da sve završite.</small>
        </div>
      </aside>
    </div>`;
}

/* ---------------------------------------------------------------- Aktivnosti */

function activityCards() {
  const c = content();
  const q = S.search.trim().toLowerCase();
  const list = c.activities.filter(a =>
    (S.filter === "sve" || String(a.areaId) === S.filter) &&
    (!q || (a.title + " " + a.goal + " " + a.steps.join(" ")).toLowerCase().includes(q)));
  if (!list.length) return `<p class="empty-state">Nema aktivnosti za ovu pretragu.</p>`;
  return list.map(a => {
    const i = areaIndex(c, a.areaId);
    const area = c.areas[i];
    return `
      <article class="card">
        <div class="card-art ${bgAt(i)} ${a.imageIds.length ? "has-img img-wrap" : ""}" data-open="${esc(a.code)}">
          <span class="num">${esc(a.code)}</span>
          ${a.imageIds.length ? `<img data-img="${esc(a.imageIds[0])}" alt="Ilustracija aktivnosti">` : ""}${artAt(i)}
          ${a.imageIds.length ? `<span class="tag">Sa ilustracijom</span>` : ""}
        </div>
        <p class="cat">${esc(area ? area.title : "")}</p>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.goal)}</p>
        <div class="print-steps">${a.steps.length ? `<ol>${a.steps.map(k => `<li>${esc(k)}</li>`).join("")}</ol>` : ""}</div>
        <div class="card-foot">
          <button class="btn-link" data-open="${esc(a.code)}">Pogledaj korake ↗</button>
          <button class="tried ${tried(a.code) ? "on" : ""}" data-tried="${esc(a.code)}"><i>${tried(a.code) ? "✓" : ""}</i> Isprobali smo</button>
        </div>
      </article>`;
  }).join("");
}

function pageAktivnosti() {
  const c = content();
  const chips = [["sve", "Sve aktivnosti"], ...c.areas.filter(a => c.activities.some(x => String(x.areaId) === String(a.id))).map(a => [String(a.id), a.title])];
  return `
    <div class="page-head">
      <p class="eyebrow">Sve na jednom mestu</p>
      <h1>Aktivnosti vašeg programa.</h1>
      <p class="lead">Otvorite aktivnost za cilj, korake, ilustraciju i smernice za praćenje.</p>
    </div>
    <div class="toolbar">
      <label class="search">${ICON.search}<input id="search" type="search" placeholder="Pronađi aktivnost..." value="${esc(S.search)}"></label>
      <button class="btn-ghost" data-action="print">${ICON.print} Štampaj program</button>
    </div>
    <div class="chips chips-scroll">
      ${chips.map(([k, n]) => `<button class="chip ${S.filter === k ? "active" : ""}" data-filter="${esc(k)}">${esc(n)}</button>`).join("")}
    </div>
    <div class="cards" id="cards">${activityCards()}</div>`;
}

/* ---------------------------------------------------------------- Procena i vodič */

function bulletList(items) { return items.length ? `<ul class="clean-list">${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""; }

function pageProcena() {
  const c = content();
  const as = c.assessment;
  const toc = [];
  const sec = (id, title, html) => { if (!html) return ""; toc.push([id, title]); return `<section class="doc-section" id="sec-${id}"><h2>${esc(title)}</h2>${html}</section>`; };

  const assessHtml = (as.summary || as.intro || as.areas.length || as.conclusion) ? `
    ${as.summary ? `<div class="summary-box">${md(as.summary)}</div>` : ""}
    ${as.intro ? `<div class="prose">${md(as.intro)}</div>` : ""}
    ${as.areas.map(a => `
      <details class="area-block" open>
        <summary>${esc(a.title)}</summary>
        ${a.text ? `<div class="prose">${md(a.text)}</div>` : ""}
        <div class="sn-grid">
          ${a.strengths.length ? `<div class="sn sn-green"><h4>Očuvane sposobnosti</h4>${bulletList(a.strengths)}</div>` : ""}
          ${a.needs.length ? `<div class="sn sn-orange"><h4>Potrebe za podrškom</h4>${bulletList(a.needs)}</div>` : ""}
          ${a.parentTracks.length ? `<div class="sn sn-purple"><h4>Šta roditelj prati</h4>${bulletList(a.parentTracks)}</div>` : ""}
        </div>
      </details>`).join("")}
    ${as.keyPoints.length ? `<div class="summary-box"><h4>Ključne tačke</h4>${bulletList(as.keyPoints)}</div>` : ""}
    ${as.conclusion ? `<h3>Zaključak</h3><div class="prose">${md(as.conclusion)}</div>` : ""}` : "";

  const goalsHtml = c.goals.length ? c.goals.map(g => `
    <div class="goal"><p class="eyebrow">${esc(g.area)}</p><p class="goal-text">${esc(g.goal)}</p>${bulletList(g.outcomes)}</div>`).join("") : "";

  const principlesHtml = c.principles.length ? `<div class="principles">${c.principles.map(p => `<div><strong>${esc(p.title)}</strong><span>${esc(p.text)}</span></div>`).join("")}</div>` : "";

  const routinesHtml = c.routines.length ? c.routines.map(r => {
    const linked = r.activityTitles.map(t => activityByTitle(c, t)).filter(Boolean);
    return `
    <details class="area-block">
      <summary>${esc(r.title)}${r.focus ? `<small>${esc(r.focus)}</small>` : ""}</summary>
      ${r.text ? `<div class="prose">${md(r.text)}</div>` : ""}
      ${r.activityTitles.length ? `<h4>Koristimo aktivnosti</h4><div class="chip-row">${r.activityTitles.map(t => { const a = activityByTitle(c, t); return a ? `<button class="chip" data-open="${esc(a.code)}">${esc(t)}</button>` : `<span class="chip static">${esc(t)}</span>`; }).join("")}</div>` : ""}
      ${r.parentTracks.length ? `<h4>Šta pratimo</h4>${bulletList(r.parentTracks)}` : ""}
      ${r.note ? `<div class="note-box">${md(r.note)}</div>` : ""}
      ${linked.length ? "" : ""}
    </details>`;
  }).join("") : "";

  const sectionsHtml = c.sections.length ? c.sections.map(x => `<details class="area-block"><summary>${esc(x.title)}</summary><div class="prose">${md(x.body)}</div></details>`).join("") : "";

  const historyHtml = S.data.history.length ? `<ul class="clean-list">${S.data.history.map(h => `<li>${esc(h.title)}${h.start_date ? ` <small class="muted">· od ${fmtDate(h.start_date)}</small>` : ""}</li>`).join("")}</ul>` : "";

  const body = [
    sec("procena", "Defektološka procena", assessHtml),
    sec("ciljevi", "Ciljevi razvoja", goalsHtml),
    sec("pravila", "Pravila za roditelje", principlesHtml),
    sec("rutine", "Podrška kroz dan – rutine", routinesHtml),
    sec("vodic", "Vodič za roditelje", sectionsHtml),
    sec("istorija", "Prethodni programi", historyHtml),
  ].join("");

  return `
    <div class="page-head">
      <p class="eyebrow">Polazište vašeg programa</p>
      <h1>Procena, ciljevi i vodič.</h1>
      <p class="lead">Ceo stručni deo programa na jednom mestu. Otvorite poglavlje koje vas zanima.</p>
    </div>
    ${toc.length > 1 ? `<nav class="toc">${toc.map(([id, t]) => `<a href="#/procena" data-scroll="${id}">${esc(t)}</a>`).join("")}</nav>` : ""}
    ${body || `<p class="muted">Procena još nije uneta u program.</p>`}
    ${c.motto ? `<blockquote class="motto">„${esc(c.motto.replace(/^[„"“]|[“"”]$/g, ""))}“</blockquote>` : ""}`;
}

/* ---------------------------------------------------------------- Zapažanja */

function notesList() {
  if (S.notesTab === "nedeljni") {
    if (!S.data.reviews.length) return emptyNotes();
    return S.data.reviews.slice().reverse().map(r => `
      <div class="note">
        <div class="meta"><span>${r.week}. nedelja · ${fmtDate(r.review_date)}</span>${S.preview ? "" : `<button class="del" data-del-review="${r.id}">Obriši</button>`}</div>
        ${r.good ? `<p><b>Šta je išlo dobro:</b> ${esc(r.good)}</p>` : ""}
        ${r.hard ? `<p><b>Šta je bilo teško:</b> ${esc(r.hard)}</p>` : ""}
        ${r.next_steps ? `<p><b>Za sledeću nedelju:</b> ${esc(r.next_steps)}</p>` : ""}
      </div>`).join("");
  }
  if (!S.data.observations.length) return emptyNotes();
  return S.data.observations.slice().reverse().map(n => {
    const isk = iskustvo(n.experience);
    return `
      <div class="note">
        <div class="meta"><span>${fmtDate(n.obs_date)}${n.obs_time ? " · " + esc(n.obs_time) : ""}${n.tried === "ne" ? " · nismo probali" : n.tried === "delimicno" ? " · delimično" : ""}</span><button class="del" data-del-note="${n.id}">Obriši</button></div>
        <strong>${esc(n.activity_title || "Aktivnost")}</strong>
        ${isk ? `<span class="badge" style="--c:${isk.boja}">${isk.ikona} ${esc(isk.naziv)}</span>` : ""}
        ${n.alert_before || n.alert_after ? `<p>Budnost: ${esc(n.alert_before || "–")} → ${esc(n.alert_after || "–")}</p>` : ""}
        ${n.details ? `<p>${esc(n.details)}</p>` : ""}
        ${n.remember ? `<p><b>Zapamtiti:</b> ${esc(n.remember)}</p>` : ""}
      </div>`;
  }).join("");
}

const emptyNotes = () => `
  <div class="empty-notes">${ICON.note}<h3>Mali trenuci su važni.</h3>
  <p>Ovde će se pojaviti sačuvana zapažanja. Dovoljno je zabeležiti ono što je novo ili korisno za sledeće planiranje.</p></div>`;

function noteForm() {
  const c = content();
  if (S.notesTab === "nedeljni") {
    return `
      <form class="panel" id="review-form">
        <h2>Nedeljni osvrt</h2>
        <div class="two">
          <div class="field"><label for="r-week">Nedelja</label>
            <select class="input" id="r-week" name="week">${Array.from({ length: c.durationWeeks }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === currentWeek(program()) ? "selected" : ""}>${n}. nedelja</option>`).join("")}</select></div>
          <div class="field"><label for="r-date">Datum</label><input class="input" type="date" id="r-date" name="review_date" value="${todayISO()}"></div>
        </div>
        <div class="field"><label>Šta je išlo dobro ove nedelje?</label><textarea class="input" name="good" placeholder="Najviše mu je prijalo..."></textarea></div>
        <div class="field"><label>Šta je bilo teško? <small>(opciono)</small></label><textarea class="input" name="hard"></textarea></div>
        <div class="field"><label>Šta želite da probate sledeće nedelje? <small>(opciono)</small></label><textarea class="input" name="next_steps"></textarea></div>
        <button class="btn" type="submit">Sačuvaj osvrt</button>
      </form>`;
  }
  return `
    <form class="panel" id="note-form">
      <h2>Novo zapažanje</h2>
      <div class="field"><label for="n-akt">Aktivnost</label>
        <select class="input" id="n-akt" name="activity_code">
          ${c.activities.map(a => `<option value="${esc(a.code)}">${esc(a.code)} · ${esc(a.title)}</option>`).join("")}
          <option value="">Nešto drugo / rutina</option>
        </select></div>
      <div class="two">
        <div class="field"><label for="n-datum">Datum</label><input class="input" type="date" id="n-datum" name="obs_date" value="${todayISO()}" required></div>
        <div class="field"><label for="n-vreme">Vreme <small>(opciono)</small></label><input class="input" type="time" id="n-vreme" name="obs_time"></div>
      </div>
      <div class="field"><label for="n-probali">Da li ste probali aktivnost?</label>
        <select class="input" id="n-probali" name="tried"><option value="da">Da</option><option value="delimicno">Delimično</option><option value="ne">Ne, ne danas</option></select></div>
      <div class="field"><span class="label">Kako je izgledalo iskustvo?</span>
        <div class="radio-grid">${ISKUSTVA.map(i => `<label><input type="radio" name="experience" value="${i.id}"> ${i.ikona} ${esc(i.naziv)}</label>`).join("")}</div></div>
      <details class="more"><summary>Budnost pre / posle i detalji <small>opciono</small></summary>
        <div class="two">
          <div class="field"><label>Pre igre</label><select class="input" name="alert_before">${BUDNOST.map(b => `<option>${b}</option>`).join("")}</select></div>
          <div class="field"><label>Posle igre</label><select class="input" name="alert_after">${BUDNOST.map(b => `<option>${b}</option>`).join("")}</select></div>
        </div>
        <div class="field" style="margin:0"><label>Detalji</label><textarea class="input" name="details" placeholder="Kako je reagovao, koliko je trajalo, šta je pomoglo..."></textarea></div>
      </details>
      <div class="field"><label>Šta želite da zapamtite? <small>(opciono)</small></label><textarea class="input" name="remember" placeholder="Šta je bilo novo ili neobično?"></textarea></div>
      <button class="btn" type="submit">${S.preview ? "Sačuvaj (u pregledu se ne čuva)" : `Sačuvaj i pošalji ${esc(PROFILE.imeDativ)}`}</button>
    </form>`;
}

function pageZapazanja() {
  const count = S.notesTab === "nedeljni" ? S.data.reviews.length : S.data.observations.length;
  return `
    <div class="page-head">
      <p class="eyebrow">Dnevnik vašeg programa</p>
      <h1>Šta ste primetili?</h1>
      <p class="lead">Nije potrebno popunjavati tabelu posle svake igre. Dovoljno je zabeležiti ono što je novo, neobično ili korisno za sledeće planiranje.</p>
    </div>
    <div class="notice">${ICON.info} Sačuvana zapažanja automatski vidi ${esc(PROFILE.imeKratko)}. Nije potrebno ništa slati posebno.</div>
    <div class="row-between notes-bar">
      <div class="chips">
        <button class="chip ${S.notesTab === "dnevna" ? "active" : ""}" data-tab="dnevna">Dnevna zapažanja</button>
        <button class="chip ${S.notesTab === "nedeljni" ? "active" : ""}" data-tab="nedeljni">Nedeljni osvrt</button>
        <button class="chip ${S.notesTab === "pregled" ? "active" : ""}" data-tab="pregled">Pregled napretka</button>
      </div>
      <div class="bar-actions">
        <button class="btn-link" data-action="download">${ICON.download} Preuzmi beleške</button>
      </div>
    </div>
    ${S.notesTab === "pregled" ? progressView(S.data, content()) : `
    <div class="notes-grid">
      ${noteForm()}
      <div>
        <div class="list-head"><h2>Naša zapažanja</h2><small>(${count})</small></div>
        ${notesList()}
      </div>
    </div>`}`;
}

/* Pregled napretka – koristi ga i Dragana u svom delu. */
export function stats(data, c) {
  const days = lastDays(28);
  const byDay = {};
  data.observations.forEach(n => (byDay[n.obs_date] = byDay[n.obs_date] || []).push(n));
  const activeDays = days.filter(d => byDay[d]).length;
  const titles = {};
  data.observations.forEach(n => { if (n.activity_code) titles[n.activity_code] = n.activity_title; });
  const codes = [...new Set(data.observations.map(n => n.activity_code).filter(Boolean))];
  const perAct = codes.map(code => {
    const a = c && activityByCode(c, code);
    const ns = data.observations.filter(n => n.activity_code === code);
    const count = k => ns.filter(n => n.experience === k).length;
    return { code, title: a ? a.title : titles[code], total: ns.length, prijalo: count("prijalo"), prilagodjavanje: count("prilagodjavanje"), pauza: count("pauza"), istrazujemo: count("istrazujemo") };
  }).sort((x, y) => y.prijalo - x.prijalo || y.total - x.total);
  return { days, byDay, activeDays, perAct };
}

export function progressView(data, c, { showReport = true } = {}) {
  const { days, byDay, activeDays, perAct } = stats(data, c);
  const triedN = data.tried.length;
  const first = new Date(days[0] + "T00:00");
  const lead = (first.getDay() + 6) % 7;
  const cells = Array(lead).fill(`<span class="cal-empty"></span>`).concat(days.map(d => {
    const ns = byDay[d] || [];
    const last = ns[ns.length - 1];
    const isk = last && iskustvo(last.experience);
    const color = isk ? isk.boja : (ns.length ? "#7d9a7b" : "");
    const title = ns.length ? `${fmtDate(d)} – ${ns.map(n => n.activity_title).join(", ")}` : fmtDate(d);
    return `<span class="cal-day${d === todayISO() ? " is-today" : ""}" title="${esc(title)}" style="${color ? `background:${color};color:#fff` : ""}">${Number(d.slice(8))}</span>`;
  }));
  const max = Math.max(1, ...perAct.map(x => x.total));
  return `
    <div class="stat-row">
      <div class="stat"><b>${activeDays}</b><span>dana sa igrom<br>u poslednje 4 nedelje</span></div>
      <div class="stat"><b>${data.observations.length}</b><span>sačuvanih<br>zapažanja</span></div>
      <div class="stat"><b>${triedN}<small> / ${c ? c.activities.length : "–"}</small></b><span>isprobanih<br>aktivnosti</span></div>
    </div>
    <div class="progress-grid">
      <div class="panel">
        <h2>Poslednje 4 nedelje</h2>
        <div class="cal">${["P", "U", "S", "Č", "P", "S", "N"].map(x => `<span class="cal-h">${x}</span>`).join("")}${cells.join("")}</div>
        <div class="legend">${ISKUSTVA.map(i => `<span><i style="background:${i.boja}"></i>${esc(i.naziv)}</span>`).join("")}</div>
      </div>
      <div class="panel">
        <h2>Šta najviše prija</h2>
        ${perAct.length ? perAct.slice(0, 8).map(x => `
          <div class="hbar">
            <div class="row-between"><span>${esc(x.title || x.code)}</span><small>${x.total}×</small></div>
            <div class="hbar-track" style="width:${(x.total / max) * 100}%">
              ${ISKUSTVA.map(i => x[i.id] ? `<i style="flex:${x[i.id]};background:${i.boja}" title="${esc(i.naziv)}: ${x[i.id]}"></i>` : "").join("")}
            </div>
          </div>`).join("") : `<p class="muted">Kada se sačuvaju prva zapažanja, ovde se vidi koje igre detetu najviše prijaju.</p>`}
      </div>
    </div>
    ${showReport ? `<div class="report-cta">
      <div><strong>Izveštaj za konsultacije</strong><small>Pregled poslednjih 30 dana, spreman za štampu ili čuvanje kao PDF.</small></div>
      <button class="btn" data-action="report">Napravi izveštaj</button>
    </div>` : ""}`;
}

export function reportHtml(data, c, familyName, programTitle) {
  const since = lastDays(30)[0];
  const notes = data.observations.filter(n => n.obs_date >= since).sort((a, b) => (a.obs_date + a.obs_time).localeCompare(b.obs_date + b.obs_time));
  const reviews = data.reviews.filter(r => r.review_date >= since);
  const { activeDays, perAct } = stats(data, c);
  const row = n => {
    const isk = iskustvo(n.experience);
    return `<tr><td>${fmtDate(n.obs_date)}${n.obs_time ? "<br><small>" + esc(n.obs_time) + "</small>" : ""}</td><td>${esc(n.activity_title)}</td>
      <td>${isk ? esc(isk.naziv) : "–"}</td><td>${n.alert_before || n.alert_after ? esc(n.alert_before || "–") + " → " + esc(n.alert_after || "–") : "–"}</td>
      <td>${esc([n.details, n.remember].filter(Boolean).join(" · ")) || "–"}</td></tr>`;
  };
  return `<!doctype html><html lang="sr"><head><meta charset="utf-8"><title>Izveštaj – ${esc(familyName)}</title>
    <style>
      body{font:13px/1.55 system-ui,"Segoe UI",sans-serif;color:#2b3a33;max-width:820px;margin:36px auto;padding:0 24px}
      h1,h2{font-family:Georgia,serif;font-weight:400;color:#1f3a32} h1{font-size:30px;margin:4px 0} h2{font-size:20px;margin:30px 0 10px;border-bottom:1px solid #ddd;padding-bottom:6px}
      .eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#7a8279}
      .stats{display:flex;gap:14px;margin-top:20px}.stats div{flex:1;background:#f1f3ec;border-radius:10px;padding:12px 14px}.stats b{display:block;font-size:22px;color:#234d43}
      table{width:100%;border-collapse:collapse;font-size:12px}td,th{text-align:left;padding:7px 6px;border-bottom:1px solid #e6e1d6;vertical-align:top}th{font-size:10px;text-transform:uppercase;color:#7a8279;letter-spacing:.06em}
      .btn{position:fixed;right:20px;top:20px;background:#234d43;color:#fff;border:0;border-radius:8px;padding:10px 16px;cursor:pointer}
      @media print{.btn{display:none}body{margin:0}}
    </style></head><body>
    <button class="btn" onclick="print()">Štampaj / Sačuvaj PDF</button>
    <p class="eyebrow">Kućni defektolog · ${esc(familyName)}</p>
    <h1>Izveštaj o napretku</h1>
    <p>${esc(programTitle || "")}<br>Period: ${fmtDate(since)} – ${fmtDate(todayISO())} · ${esc(PROFILE.ime)}, ${esc(PROFILE.titula)}</p>
    <div class="stats"><div><b>${activeDays}</b>dana sa igrom (4 ned.)</div><div><b>${notes.length}</b>zapažanja</div><div><b>${data.tried.length} / ${c ? c.activities.length : "–"}</b>isprobanih aktivnosti</div></div>
    <h2>Šta najviše prija</h2>
    ${perAct.length ? `<table><tr><th>Aktivnost</th><th>Puta</th><th>Prijalo</th><th>Uz prilagođavanje</th><th>Pauza</th></tr>
      ${perAct.map(x => `<tr><td>${esc(x.title || x.code)}</td><td>${x.total}</td><td>${x.prijalo}</td><td>${x.prilagodjavanje}</td><td>${x.pauza}</td></tr>`).join("")}</table>` : "<p>Još nema zapažanja.</p>"}
    <h2>Dnevna zapažanja</h2>
    ${notes.length ? `<table><tr><th>Datum</th><th>Aktivnost</th><th>Iskustvo</th><th>Budnost</th><th>Beleška</th></tr>${notes.map(row).join("")}</table>` : "<p>Nema zapažanja u ovom periodu.</p>"}
    ${reviews.length ? `<h2>Nedeljni osvrti</h2>${reviews.map(r => `<p><b>${r.week}. nedelja</b> (${fmtDate(r.review_date)})<br>${r.good ? "Dobro: " + esc(r.good) + "<br>" : ""}${r.hard ? "Teško: " + esc(r.hard) + "<br>" : ""}${r.next_steps ? "Sledeće: " + esc(r.next_steps) : ""}</p>`).join("")}` : ""}
    </body></html>`;
}

export function openReportWindow(html) {
  const w = window.open("", "_blank");
  if (!w) return toast("Dozvolite iskačuće prozore da bi se otvorio izveštaj.", "error");
  w.document.write(html);
  w.document.close();
}

/* ---------------------------------------------------------------- Podrška */

function pagePodrska() {
  const c = S.data.program ? content() : null;
  const tips = c && c.encouragements.length ? c.encouragements : PODRAZUMEVANI_SAVETI;
  const msgs = S.data.messages;
  return `
    <div class="page-head">
      <p class="eyebrow">Uz vas, korak po korak</p>
      <h1>Prostor za vaša pitanja.</h1>
      <p class="lead">Pišite kada vas nešto zanima – poruka stiže direktno ${esc(PROFILE.imeDativ)}.</p>
    </div>
    <div class="support-grid">
      <div class="profile">
        <div class="big-avatar">${esc(PROFILE.inicijali)}</div>
        <p class="eyebrow">Vaša podrška u programu</p>
        <h2>${esc(PROFILE.ime)}</h2>
        <p>${esc(PROFILE.titula)}<br>${esc(PROFILE.uloga)}</p>
        <p style="margin-top:20px">${esc(PROFILE.opis)}</p>
        <blockquote>„${esc((c && c.motto ? c.motto : PROFILE.citat).replace(/^[„"“]|[“"”]$/g, ""))}“</blockquote>
      </div>
      <div class="panel chat-panel">
        <h2 style="margin-bottom:8px">Poruke</h2>
        <div class="chat" id="chat">
          ${msgs.length ? msgs.map(m => `
            <div class="msg ${m.sender === "family" ? "me" : "her"}">
              <p>${esc(m.body).replace(/\n/g, "<br>")}</p>
              <small>${m.sender === "owner" ? esc(PROFILE.imeKratko) + " · " : ""}${relTime(m.created_at)}</small>
            </div>`).join("") : `<p class="muted chat-empty">Još nema poruka. Napišite pitanje ili podelite nešto što ste primetili.</p>`}
        </div>
        <form id="msg-form" class="msg-form">
          <textarea class="input" name="body" id="msg-body" placeholder="Volela bih da razgovaramo o..." rows="3">${esc(store.get("msg_draft_" + S.code, ""))}</textarea>
          <button class="btn" type="submit" ${S.preview ? "disabled" : ""}>${ICON.send} Pošalji</button>
        </form>
      </div>
    </div>

    <section class="tips">
      <h2>Za lake i teške dane.</h2>
      <ul>${tips.map(s => `<li>${ICON.heart}<span>${esc(s)}</span></li>`).join("")}</ul>
    </section>
    <section class="faq">
      <h2>O korišćenju programa</h2>
      ${CESTA_PITANJA.map(f => `<details><summary>${esc(f.p)}</summary><p>${esc(f.o)}</p></details>`).join("")}
    </section>
    ${S.preview ? "" : `
    <section class="faq">
      <h2>Vaš pristup</h2>
      <div class="code-box">
        <div><small>Kod porodice</small><b>${esc(formCode(S.code))}</b></div>
        <button class="btn-ghost" data-action="copy-link">${ICON.link} Kopiraj link</button>
        <button class="btn-link" data-action="forget">Odjavi ovaj uređaj</button>
      </div>
      <p class="muted" style="margin-top:10px">Kod vam treba ako aplikaciju otvorite na drugom telefonu ili sa početnog ekrana. Ne delite ga sa drugima.</p>
    </section>`}`;
}

/* ================================================================ AKTIVNOST – DETALJ */

function openActivity(code) {
  const c = content();
  const a = activityByCode(c, code);
  if (!a) return;
  const i = areaIndex(c, a.areaId);
  const area = c.areas[i];
  const imgs = a.imageIds.length
    ? `<div class="gallery">${a.imageIds.map(id => `<button class="gallery-item img-wrap" data-zoom="${esc(id)}"><img data-img="${esc(id)}" alt="Ilustracija"></button>`).join("")}</div>`
    : `<div class="card-art ${bgAt(i)}"><span class="num">${esc(a.code)}</span>${artAt(i)}</div>`;
  openModal(`
    ${imgs}
    <p class="cat modal-cat">${esc(area ? area.title : "")}${a.weeks.length ? ` · ${a.weeks.length > 1 ? "nedelje " + a.weeks.join(", ") : a.weeks[0] + ". nedelja"}` : ""}</p>
    <h2>${esc(a.title)}</h2>
    ${a.goal ? `<h4>Cilj</h4><p class="modal-p">${esc(a.goal)}</p>` : ""}
    ${a.materials.length ? `<h4>Potrebno</h4><ul>${a.materials.map(m => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
    ${a.frequency ? `<h4>Kada i koliko često</h4><p class="modal-p">${esc(a.frequency)}</p>` : ""}
    ${a.steps.length ? `<h4>Kako se izvodi</h4><ol class="steps-list">${a.steps.map(k => `<li>${esc(k)}</li>`).join("")}</ol>` : ""}
    ${a.levels.length ? `<h4>Nivoi</h4>${a.levels.map(l => `<p class="modal-p"><b>${esc(l.name)}:</b> ${esc(l.text)}</p>`).join("")}` : ""}
    ${a.adapt ? `<h4>Kako prilagoditi</h4><div class="modal-p">${md(a.adapt)}</div>` : ""}
    ${a.parentTracks.length ? `<h4>Šta pratimo</h4><ul>${a.parentTracks.map(k => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
    ${a.develops ? `<h4>Šta razvijamo</h4><p class="modal-p">${esc(a.develops)}</p>` : ""}
    ${a.note ? `<div class="note-box"><b>Važna napomena:</b> ${esc(a.note)}</div>` : ""}
    ${a.video ? `<a class="video-link" href="${esc(a.video)}" target="_blank" rel="noopener">▶ Pogledaj video-prikaz</a>` : ""}
    <div class="modal-actions">
      ${a.steps.length ? `<button class="btn" data-steps="${esc(a.code)}">▶ Korak po korak</button>` : ""}
      <button class="btn-ghost" data-tried="${esc(a.code)}" data-in-modal>${tried(a.code) ? "✓ Isprobali smo" : "Označi: isprobali smo"}</button>
      <button class="btn-link" data-note-for="${esc(a.code)}">Zabeleži zapažanje</button>
    </div>`, "activity-modal");
  afterRender($("#modal-card"));
}

function zoomImage(id) {
  const el = document.querySelector(`img[data-img="${CSS.escape(id)}"]`);
  if (!el || !el.src) return;
  const z = document.createElement("div");
  z.className = "zoom";
  z.innerHTML = `<img src="${el.src}" alt=""><button aria-label="Zatvori">×</button>`;
  z.addEventListener("click", () => z.remove());
  document.body.appendChild(z);
}

/* ---------------------------------------------------------------- Korak po korak + tajmer */

function openSteps(code) {
  if (!activityByCode(content(), code)) return;
  S.run = { code, i: 0 };
  renderSteps();
}

function renderSteps() {
  const c = content();
  const a = activityByCode(c, S.run.code);
  const n = a.steps.length;
  const finished = S.run.i >= n;
  const ai = areaIndex(c, a.areaId);
  const dots = a.steps.map((_, k) => `<i class="${k < S.run.i ? "past" : k === S.run.i ? "now" : ""}"></i>`).join("");
  const body = finished
    ? `<div class="steps-end">
         <p class="eyebrow">Gotovo</p>
         <h2>Bravo, uradili ste to zajedno!</h2>
         <p>Kako je prošlo? Jedan klik je dovoljan – ${esc(PROFILE.imeKratko)} će videti.</p>
         <div class="quick-exp">${ISKUSTVA.map(i => `<button data-quick="${i.id}" style="--c:${i.boja}"><span>${i.ikona}</span>${esc(i.naziv)}</button>`).join("")}</div>
         <button class="btn-link" data-note-for="${esc(a.code)}">Želim da napišem detaljnije zapažanje →</button>
       </div>`
    : `<p class="step-count">Korak ${S.run.i + 1} od ${n}</p><p class="step-text">${esc(a.steps[S.run.i])}</p>`;
  openModal(`
    <div class="steps-head">
      <span class="steps-icon ${bgAt(ai)}">${a.imageIds.length ? `<img data-img="${esc(a.imageIds[0])}" alt="">` : artAt(ai)}</span>
      <div><p class="eyebrow">Korak po korak</p><strong>${esc(a.title)}</strong></div>
    </div>
    <div class="dots">${dots}</div>
    <div class="steps-body">${body}</div>
    <div class="timer">
      <span class="timer-label">Tajmer</span>
      ${[3, 5, 10].map(m => `<button class="chip ${S.timer && S.timer.total === m * 60 ? "active" : ""}" data-timer="${m}">${m} min</button>`).join("")}
      <span class="timer-display" id="timer-display">${timerText()}</span>
      ${S.timer ? `<button class="chip" data-action="timer-toggle">${S.timer.running ? "Pauza" : "Nastavi"}</button>` : ""}
    </div>
    ${finished ? "" : `
    <div class="steps-nav">
      <button class="btn-ghost" data-step="-1" ${S.run.i === 0 ? "disabled" : ""}>← Nazad</button>
      <button class="btn" data-step="1">${S.run.i === n - 1 ? "Završili smo ✓" : "Sledeći korak →"}</button>
    </div>`}`, "steps-mode", () => { S.run = null; stopTimer(); });
  afterRender($("#modal-card"));
}

const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const timerText = () => (S.timer ? fmtTime(S.timer.left) : "--:--");
function startTimer(min) { stopTimer(); S.timer = { total: min * 60, left: min * 60, running: false, handle: null }; toggleTimer(); }
function toggleTimer() {
  const t = S.timer;
  if (!t) return;
  if (t.running) { clearInterval(t.handle); t.running = false; }
  else {
    t.running = true;
    t.handle = setInterval(() => {
      t.left--;
      const el = $("#timer-display");
      if (el) el.textContent = timerText();
      if (t.left <= 0) { stopTimer(); ring(); toast("Vreme je isteklo. Lepo završite igru."); if (S.run) renderSteps(); }
    }, 1000);
  }
  if (S.run) renderSteps();
}
function stopTimer() { if (S.timer) clearInterval(S.timer.handle); S.timer = null; }

/* ================================================================ AKCIJE */

async function saveObservation(obs) {
  if (S.preview) { toast("U pregledu se ne čuva."); return null; }
  const saved = await api.addObservation(S.code, obs);
  S.data.observations.push(saved);
  if (obs.activity_code && obs.tried !== "ne" && !tried(obs.activity_code)) S.data.tried.push(obs.activity_code);
  store.set("cache_" + S.code, S.data);
  return saved;
}

export async function onClick(e, t, rerender) {
  const d = t.dataset;
  try {
    if (d.open) { openActivity(d.open); return; }
    if (d.steps) { openSteps(d.steps); return; }
    if (d.zoom) { zoomImage(d.zoom); return; }
    if (d.step && S.run) { S.run.i = Math.max(0, S.run.i + Number(d.step)); renderSteps(); return; }
    if (d.timer) { startTimer(Number(d.timer)); return; }
    if (d.quick && S.run) {
      const a = activityByCode(content(), S.run.code);
      await saveObservation({ activity_code: a.code, activity_title: a.title, obs_date: todayISO(), obs_time: new Date().toTimeString().slice(0, 5), tried: "da", experience: d.quick });
      closeModal();
      rerender(true);
      toast("Sačuvano. Hvala što ste se igrali!");
      return;
    }
    if (d.group !== undefined) { S.groupIndex = Number(d.group); rerender(true); return; }
    if (d.filter) {
      S.filter = d.filter;
      document.querySelectorAll("[data-filter]").forEach(c => c.classList.toggle("active", c === t));
      $("#cards").innerHTML = activityCards();
      afterRender($("#cards"));
      return;
    }
    if (d.tab) { S.notesTab = d.tab; rerender(true); return; }
    if (d.tried) {
      if (S.preview) return toast("U pregledu se ne čuva.");
      const code = d.tried;
      const value = !tried(code);
      await api.setTried(S.code, code, value);
      S.data.tried = value ? [...S.data.tried, code] : S.data.tried.filter(x => x !== code);
      if (d.inModal !== undefined) t.textContent = value ? "✓ Isprobali smo" : "Označi: isprobali smo";
      rerender(true);
      return;
    }
    if (d.delNote) {
      if (!confirm("Obrisati ovo zapažanje?")) return;
      await api.deleteObservation(S.code, d.delNote);
      S.data.observations = S.data.observations.filter(n => n.id !== d.delNote);
      rerender(true);
      return;
    }
    if (d.delReview) {
      if (!confirm("Obrisati ovaj osvrt?")) return;
      await api.deleteReview(S.code, d.delReview);
      S.data.reviews = S.data.reviews.filter(n => n.id !== d.delReview);
      rerender(true);
      return;
    }
    if (d.noteFor) {
      closeModal();
      S.notesTab = "dnevna";
      if (location.hash === "#/zapazanja") rerender(false); else location.hash = "#/zapazanja";
      setTimeout(() => { const s = $("#n-akt"); if (s) s.value = d.noteFor; s && s.scrollIntoView({ block: "center" }); }, 50);
      return;
    }
    if (d.scroll) {
      e.preventDefault();
      const go = () => { const el = document.getElementById("sec-" + d.scroll); if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); const det = el.querySelector("details"); if (det) det.open = true; } };
      if (location.hash !== "#/procena") { location.hash = "#/procena"; setTimeout(go, 80); } else go();
      return;
    }
    switch (d.action) {
      case "consent":
        await api.consent(S.code);
        S.data.family.consent_at = new Date().toISOString();
        rerender(false);
        break;
      case "another": S.pickOffset++; rerender(true); break;
      case "timer-toggle": toggleTimer(); break;
      case "print": window.print(); break;
      case "report": openReportWindow(reportHtml(S.data, content(), S.data.family.name, program().title)); break;
      case "download": downloadNotes(); break;
      case "copy-link": {
        const link = `${location.origin}${location.pathname}#/p/${formCode(S.code)}`;
        if (await copyText(link)) toast("Link je kopiran.");
        break;
      }
      case "forget":
        if (!confirm("Odjaviti ovaj uređaj? Beleške ostaju sačuvane – za ponovni ulaz treba vam kod ili link.")) return;
        store.del("code");
        store.del("cache_" + S.code);
        S.data = null; S.code = null;
        location.hash = "#/";
        break;
    }
  } catch (err) {
    toast(err.message || "Došlo je do greške.", "error");
  }
}

export function onInput(e) {
  if (e.target.id === "search") { S.search = e.target.value; $("#cards").innerHTML = activityCards(); afterRender($("#cards")); }
  if (e.target.id === "msg-body") store.set("msg_draft_" + S.code, e.target.value);
}

export async function onSubmit(e, rerender) {
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const btn = form.querySelector("button[type=submit]");
  try {
    if (btn) btn.disabled = true;
    if (form.id === "note-form") {
      const a = activityByCode(content(), data.activity_code);
      await saveObservation({ ...data, activity_title: a ? a.title : "Rutina / drugo" });
      if (!S.preview) toast(`Zapažanje je sačuvano i stiže ${PROFILE.imeDativ}.`);
      rerender(true);
    } else if (form.id === "review-form") {
      if (!data.good && !data.hard && !data.next_steps) { toast("Upišite bar jednu misao."); return; }
      if (S.preview) { toast("U pregledu se ne čuva."); return; }
      const saved = await api.addReview(S.code, data);
      S.data.reviews.push(saved);
      toast("Osvrt je sačuvan.");
      rerender(true);
    } else if (form.id === "msg-form") {
      const body = (data.body || "").trim();
      if (!body) return;
      const saved = await api.sendMessage(S.code, body);
      S.data.messages.push(saved);
      S.data.messages.forEach(m => { if (m.sender === "owner") m.read_at = m.read_at || new Date().toISOString(); });
      store.del("msg_draft_" + S.code);
      toast(`Poruka je poslata ${PROFILE.imeDativ}.`);
      rerender(true);
      setTimeout(() => { const c = $("#chat"); if (c) c.scrollTop = c.scrollHeight; }, 30);
    }
  } catch (err) {
    toast(err.message || "Nije sačuvano.", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* Kada roditelj otvori Podršku, poruke se označe kao pročitane. */
export async function onPageShown(page) {
  if (page === "podrska" && S.data && unreadCount() && !S.preview) {
    try { await api.readMessages(S.code); S.data.messages.forEach(m => { if (m.sender === "owner") m.read_at = m.read_at || new Date().toISOString(); }); } catch {}
    const c = $("#chat"); if (c) c.scrollTop = c.scrollHeight;
  } else if (page === "podrska") {
    const c = $("#chat"); if (c) c.scrollTop = c.scrollHeight;
  }
}

function downloadNotes() {
  const lines = [`Kućni defektolog – ${S.data.family.name} – beleške (${fmtDate(todayISO())})`, ""];
  lines.push("DNEVNA ZAPAŽANJA", "");
  S.data.observations.forEach(n => {
    const isk = iskustvo(n.experience);
    lines.push(`${fmtDate(n.obs_date)}${n.obs_time ? " " + n.obs_time : ""} – ${n.activity_title}`);
    if (isk) lines.push(`  Iskustvo: ${isk.naziv}`);
    if (n.alert_before || n.alert_after) lines.push(`  Budnost: ${n.alert_before || "–"} → ${n.alert_after || "–"}`);
    if (n.details) lines.push(`  Detalji: ${n.details}`);
    if (n.remember) lines.push(`  Zapamtiti: ${n.remember}`);
    lines.push("");
  });
  lines.push("NEDELJNI OSVRTI", "");
  S.data.reviews.forEach(r => {
    lines.push(`${r.week}. nedelja (${fmtDate(r.review_date)})`);
    if (r.good) lines.push(`  Dobro: ${r.good}`);
    if (r.hard) lines.push(`  Teško: ${r.hard}`);
    if (r.next_steps) lines.push(`  Sledeće: ${r.next_steps}`);
    lines.push("");
  });
  download(`zapazanja-${todayISO()}.txt`, lines.join("\n"));
}

export const isPreview = () => S.preview;
export function exitPreview() { S.preview = false; S.data = null; S.code = null; }
export const stopAll = () => { S.run = null; stopTimer(); };
