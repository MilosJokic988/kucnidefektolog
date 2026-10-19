import './style.css';
import { PROGRAM } from './data.js';

/* Kućni defektolog – logika aplikacije.
   Svi podaci roditelja (isprobane aktivnosti, zapažanja, pitanja)
   čuvaju se SAMO u ovom pregledaču (localStorage). */

(() => {
  const P = PROGRAM;
  const $ = (s, el = document) => el.querySelector(s);
  const content = $("#content");

  // ---------- Čuvanje podataka ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("kd_" + key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("kd_" + key, JSON.stringify(value)); } catch {}
    }
  };
  const state = {
    tried: store.get("tried", []),
    notes: store.get("notes", []),
    reviews: store.get("reviews", []),
    week: store.get("week", 1),
    filter: "sve",
    search: "",
    notesTab: "dnevna",
    pickOffset: 0
  };
  let run = null;   // aktivnost u režimu "korak po korak": { id, i }
  let timer = null; // { total, left, running, handle }
  const save = () => {
    store.set("tried", state.tried);
    store.set("notes", state.notes);
    store.set("reviews", state.reviews);
    store.set("week", state.week);
  };

  const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const actById = id => P.aktivnosti.find(a => a.id === id);
  const isTried = id => state.tried.includes(id);
  const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayISO = () => isoOf(new Date());
  const DANI = ["nedelja", "ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota"];
  const MESECI = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];
  const longToday = () => { const d = new Date(); return `${DANI[d.getDay()]}, ${d.getDate()}. ${MESECI[d.getMonth()]}`; };
  const ISK_BOJA = { prijalo: "#7d9a7b", prilagodjavanje: "#d5a24c", pauza: "#c98b6b", istrazujemo: "#a9b4c2" };
  const fmtDate = iso => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}.`; };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- Ilustracije ----------
  const ART = {
    knjiga: `<svg viewBox="0 0 100 80"><g stroke="#4f6b55" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M30 8l4 5M50 6v6M70 8l-4 5"/>
      <path d="M22 24c10-4 20-3 28 2v40c-8-5-18-6-28-2z" fill="#fbf8ef"/>
      <path d="M78 24c-10-4-20-3-28 2v40c8-5 18-6 28-2z" fill="#fbf8ef"/>
      <path d="M27 31c7-2 13-1 18 2M27 37c7-2 13-1 18 2M56 33c5-3 11-4 17-2M56 39c5-3 11-4 17-2"/></g>
      <path d="M30 56l6-10 6 10z" fill="#7d9a7b"/><circle cx="64" cy="51" r="6" fill="#d5a24c"/>
      <ellipse cx="50" cy="74" rx="26" ry="3" fill="#7d9a7b" opacity=".25"/></svg>`,
    muzika: `<svg viewBox="0 0 100 80"><path d="M14 18l2-6 2 6 6 2-6 2-2 6-2-6-6-2z" fill="#d5a24c"/>
      <path d="M38 22l38-8v38" stroke="#5f7d61" stroke-width="5" fill="none"/><path d="M38 22v42" stroke="#5f7d61" stroke-width="5"/>
      <path d="M38 30l38-8" stroke="#5f7d61" stroke-width="5"/>
      <ellipse cx="31" cy="64" rx="9" ry="7" fill="#5f7d61"/><ellipse cx="69" cy="54" rx="9" ry="7" fill="#5f7d61"/>
      <path d="M84 46c3 3 3 9 0 12M89 43c5 5 5 13 0 18" stroke="#d5a24c" stroke-width="1.6" fill="none"/>
      <ellipse cx="50" cy="76" rx="26" ry="3" fill="#7d9a7b" opacity=".25"/></svg>`,
    deca: `<svg viewBox="0 0 100 80"><path d="M27 15l4 4 4-5 4 5 4-4-1 7H28z" fill="#d5a24c"/>
      <circle cx="35" cy="31" r="10" fill="#f6e9c9"/><circle cx="31.5" cy="30" r="1" fill="#3a463f"/><circle cx="38.5" cy="30" r="1" fill="#3a463f"/>
      <path d="M32 34q3 2 6 0" stroke="#3a463f" stroke-width="1" fill="none"/>
      <rect x="24" y="42" width="22" height="30" rx="11" fill="#6f8a6c"/>
      <circle cx="63" cy="37" r="9" fill="#f6e9c9"/><circle cx="60" cy="36" r="1" fill="#3a463f"/><circle cx="66" cy="36" r="1" fill="#3a463f"/>
      <path d="M60 40q3 2 6 0" stroke="#3a463f" stroke-width="1" fill="none"/>
      <rect x="53" y="47" width="20" height="25" rx="10" fill="#c98b6b"/>
      <rect x="54" y="12" width="13" height="8" rx="4" fill="#fff"/><circle cx="57.5" cy="16" r=".9" fill="#7a8279"/><circle cx="60.5" cy="16" r=".9" fill="#7a8279"/><circle cx="63.5" cy="16" r=".9" fill="#7a8279"/>
      <ellipse cx="49" cy="75" rx="28" ry="3" fill="#7d9a7b" opacity=".25"/></svg>`,
    biljka: `<svg viewBox="0 0 260 200" fill="none">
      <circle cx="160" cy="88" r="78" fill="#2f5d51"/>
      <path d="M40 55l3-9 3 9 9 3-9 3-3 9-3-9-9-3z" fill="#d5a24c"/>
      <circle cx="78" cy="30" r="3" fill="#7d9a7b"/>
      <path d="M200 20l-6 6M215 50h-8M205 78l-5-5" stroke="#9fb39b" stroke-width="2" stroke-linecap="round"/>
      <path d="M8 180q120-14 244 0" stroke="#9fb39b" stroke-width="1.5"/>
      <rect x="135" y="92" width="26" height="80" rx="4" fill="#a7bd98"/>
      <path d="M148 92V45" stroke="#7d9a7b" stroke-width="3"/>
      <path d="M148 60c-12 0-22-10-20-24 12 0 20 10 20 24z" fill="#8fae86"/>
      <path d="M148 72c12-2 22-14 18-28-12 2-20 14-18 28z" fill="#cfe0c0"/>
      <path d="M140 172c0 8 16 8 16 0" fill="#c98b6b"/>
      <circle cx="187" cy="105" r="16" fill="#c98b6b"/><path d="M180 105l5 5 9-10" stroke="#f3efe4" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="30" y="150" width="90" height="16" rx="3" fill="#c98b6b"/><path d="M38 150v16M44 150v16" stroke="#f3e2d6" stroke-width="1.5"/>
      <rect x="25" y="133" width="88" height="17" rx="3" fill="#a7bd98"/><path d="M33 133v17M39 133v17" stroke="#e3ecd9" stroke-width="1.5"/>
      <path d="M45 132c10-6 18-6 25-2 7-4 15-4 25 2v-12c-10-6-18-6-25-2-7-4-15-4-25 2z" fill="#f6f2e8"/>
      </svg>`
  };
  const artFor = a => ART[P.kategorije[a.kategorija].ilustracija];

  const ICON = {
    leaf: `<svg class="ico" viewBox="0 0 24 24"><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/></svg>`,
    home: `<svg class="ico" viewBox="0 0 24 24"><path d="M4 11 12 4.5l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/></svg>`,
    note: `<svg class="ico" viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/></svg>`,
    heart: `<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>`,
    info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>`,
    search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7a8279" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>`,
    print: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><rect x="7" y="13" width="10" height="7"/></svg>`,
    copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>`,
    download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>`,
    calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>`
  };

  // ---------- Predlog za danas ----------
  function todaysPick() {
    let pool = P.aktivnosti.filter(a => a.nedelja === state.week);
    if (!pool.length) pool = P.aktivnosti.filter(a => isTried(a.id)); // 4. nedelja: poznate aktivnosti
    if (!pool.length) pool = P.aktivnosti;
    const recent = new Set(state.notes
      .filter(n => (Date.now() - new Date(n.datum)) / 864e5 < 2)
      .map(n => n.aktivnost));
    const fresh = pool.filter(a => !recent.has(a.id));
    const list = fresh.length ? fresh : pool;
    const day = Math.floor(Date.now() / 864e5);
    return list[(day + state.pickOffset) % list.length];
  }

  function todayCard() {
    const a = todaysPick();
    const doneToday = state.notes.some(n => n.datum === todayISO());
    return `
      <section class="today">
        <div class="today-art bg-${a.kategorija}">${artFor(a)}</div>
        <div class="today-body">
          <p class="eyebrow">Predlog za danas · ${longToday()}</p>
          <h3>${esc(a.naziv)}</h3>
          <p>${a.koraci.length} kratkih koraka · ${esc(P.kategorije[a.kategorija].naziv)}${isTried(a.id) ? " · već poznata igra" : ""}</p>
          <div class="today-actions">
            <button class="btn" data-steps="${a.id}">▶ Krenimo</button>
            <button class="btn-ghost" data-open="${a.id}">Pročitaj ceo opis</button>
            <button class="btn-link" data-action="another">Drugi predlog ↻</button>
          </div>
        </div>
        ${doneToday ? `<span class="today-done">✓ Danas ste već zabeležili igru</span>` : ""}
      </section>`;
  }

  // ---------- Stranica: Moj program ----------
  function pagePlan() {
    const w = P.nedelje.find(n => n.broj === state.week) || P.nedelje[0];
    const acts = P.aktivnosti.filter(a => a.nedelja === w.broj);
    const total = P.aktivnosti.length;
    const done = state.tried.filter(id => actById(id)).length;

    const list = w.rutine
      ? `<div class="routines">${P.rutine.map(r => `<div class="routine"><strong>${esc(r.naziv)}</strong><span>${esc(r.savet)}</span></div>`).join("")}</div>`
      : acts.map(a => `
        <button class="act-row ${isTried(a.id) ? "done" : ""}" data-open="${a.id}">
          <span class="act-thumb bg-${a.kategorija}">${artFor(a)}</span>
          <span>
            <span class="eyebrow">Aktivnost ${a.id}</span>
            <strong>${esc(a.naziv)}</strong>
            <small>${a.koraci.length} koraka · ilustracija${isTried(a.id) ? " · isprobano ✓" : ""}</small>
          </span>
          <span class="go">${isTried(a.id) ? "✓" : "→"}</span>
        </button>`).join("");

    return `
      <div class="page-head row-between">
        <div>
          <p class="eyebrow">${esc(P.porodica)}</p>
          <h1>Dobro došli u vaš program.</h1>
          <p class="lead">Individualizovan plan podrške porodici</p>
        </div>
        <span class="date-pill">${ICON.calendar} ${esc(P.trajanje)}</span>
      </div>

      <section class="hero">
        <div>
          <p class="eyebrow">Kućni defektolog · uz vas, korak po korak</p>
          <h2>Mali koraci.<br>Vaš porodični ritam.</h2>
          <p>Ne morate uraditi sve. Biramo kratke aktivnosti koje mogu da stanu u vaš dan.</p>
        </div>
        ${ART.biljka}
      </section>

      ${todayCard()}

      <div class="quick">
        <a href="#" data-action="procena">${ICON.leaf}<span><strong>Procena i ciljevi</strong><small>Polazište vašeg programa</small></span><span class="arrow">↗</span></a>
        <a href="#" data-action="rutine">${ICON.home}<span><strong>Podrška kroz dan</strong><small>${P.rutine.length} poznatih rutina</small></span><span class="arrow">↗</span></a>
      </div>

      <div class="row-between" style="align-items:center">
        <h2 class="section-title">Vaš mesečni plan</h2>
        <a href="#aktivnosti" class="btn-link">Sve aktivnosti ↗</a>
      </div>
      <div class="weeks">
        ${P.nedelje.map(n => `
          <button class="week ${n.broj === w.broj ? "active" : ""}" data-week="${n.broj}">
            <span class="eyebrow">Nedelja</span>
            <b>${String(n.broj).padStart(2, "0")}</b>
            <span>${esc(n.kratko)}</span>
          </button>`).join("")}
      </div>

      <div class="week-grid">
        <div>
          <p class="eyebrow">${w.broj}. nedelja</p>
          <h2>${esc(w.naslov)}</h2>
          <p>${esc(w.opis)}</p>
          ${list}
          <a class="note-cta" href="#zapazanja">${ICON.note}<div><strong>Šta ste danas primetili?</strong><small>Zabeležite reakciju i budnost pre i posle igre.</small></div><span>↗</span></a>
          <p class="gentle">${ICON.heart} Ne morate uraditi sve. Jedna dobra, kratka interakcija može biti sasvim dovoljna za taj dan.</p>
        </div>
        <aside class="focus">
          <span class="circle">${ICON.leaf}</span>
          <p class="eyebrow">Fokus nedelje</p>
          <h3>${esc(w.fokusNaslov)}</h3>
          <p>${esc(w.fokusTekst)}</p>
          <div class="progress">
            <div class="row-between"><span>Isprobano u programu</span><b>${done} / ${total}</b></div>
            <div class="bar"><i style="width:${(done / total) * 100}%"></i></div>
            <small>Ovo je beleška o iskustvu, bez obaveze da sve završite.</small>
          </div>
        </aside>
      </div>`;
  }

  // ---------- Stranica: Aktivnosti ----------
  function activityCards() {
    const q = state.search.trim().toLowerCase();
    const list = P.aktivnosti.filter(a =>
      (state.filter === "sve" || a.kategorija === state.filter) &&
      (!q || (a.naziv + " " + a.cilj).toLowerCase().includes(q)));
    if (!list.length) return `<p class="empty-state">Nema aktivnosti za ovu pretragu.</p>`;
    return list.map(a => `
      <article class="card">
        <div class="card-art bg-${a.kategorija}">
          <span class="num">${a.id}</span>${artFor(a)}<span class="tag">Sa ilustracijom</span>
        </div>
        <p class="cat">${esc(P.kategorije[a.kategorija].naziv)}</p>
        <h3>${esc(a.naziv)}</h3>
        <p>${esc(a.cilj)}</p>
        <ol class="print-steps">${a.koraci.map(k => `<li>${esc(k)}</li>`).join("")}</ol>
        <div class="card-foot">
          <button class="btn-link" data-open="${a.id}">Pogledaj korake ↗</button>
          <button class="tried ${isTried(a.id) ? "on" : ""}" data-tried="${a.id}"><i>${isTried(a.id) ? "✓" : ""}</i> Isprobali smo</button>
        </div>
      </article>`).join("");
  }

  function pageAktivnosti() {
    const chips = [["sve", "Sve aktivnosti"], ...Object.entries(P.kategorije).map(([k, v]) => [k, v.naziv])];
    return `
      <div class="page-head">
        <p class="eyebrow">Sve na jednom mestu</p>
        <h1>Aktivnosti vašeg programa.</h1>
        <p class="lead">Otvorite aktivnost za cilj, korake, ilustraciju i smernice za praćenje.</p>
      </div>
      <div class="toolbar">
        <label class="search">${ICON.search}<input id="search" type="search" placeholder="Pronađi aktivnost..." value="${esc(state.search)}"></label>
        <button class="btn-ghost" data-action="print">${ICON.print} Štampaj program</button>
      </div>
      <div class="chips">
        ${chips.map(([k, n]) => `<button class="chip ${state.filter === k ? "active" : ""}" data-filter="${k}">${esc(n)}</button>`).join("")}
      </div>
      <div class="cards" id="cards">${activityCards()}</div>`;
  }

  // ---------- Stranica: Naša zapažanja ----------
  function notesList() {
    if (state.notesTab === "nedeljni") {
      if (!state.reviews.length) return emptyNotes();
      return state.reviews.slice().reverse().map(r => `
        <div class="note">
          <div class="meta"><span>${r.nedelja}. nedelja · ${fmtDate(r.datum)}</span><button class="del" data-del-review="${r.id}">Obriši</button></div>
          ${r.dobro ? `<p><b>Šta je išlo dobro:</b> ${esc(r.dobro)}</p>` : ""}
          ${r.tesko ? `<p><b>Šta je bilo teško:</b> ${esc(r.tesko)}</p>` : ""}
          ${r.dalje ? `<p><b>Za sledeću nedelju:</b> ${esc(r.dalje)}</p>` : ""}
        </div>`).join("");
    }
    if (!state.notes.length) return emptyNotes();
    return state.notes.slice().reverse().map(n => {
      const a = actById(n.aktivnost);
      const isk = P.iskustva.find(i => i.id === n.iskustvo);
      return `
        <div class="note">
          <div class="meta"><span>${fmtDate(n.datum)}${n.vreme ? " · " + esc(n.vreme) : ""}${n.probali === "ne" ? " · nismo probali" : ""}</span><button class="del" data-del-note="${n.id}">Obriši</button></div>
          <strong>${a ? esc(a.naziv) : "Aktivnost"}</strong>
          ${isk ? `<span class="badge">${isk.ikona} ${esc(isk.naziv)}</span>` : ""}
          ${n.pre || n.posle ? `<p>Budnost: ${esc(n.pre || "–")} → ${esc(n.posle || "–")}</p>` : ""}
          ${n.detalji ? `<p>${esc(n.detalji)}</p>` : ""}
          ${n.zapamti ? `<p><b>Zapamtiti:</b> ${esc(n.zapamti)}</p>` : ""}
        </div>`;
    }).join("");
  }
  const emptyNotes = () => `
    <div class="empty-notes">
      ${ICON.note}
      <h3>Mali trenuci su važni.</h3>
      <p>Ovde će se pojaviti sačuvana zapažanja. Dovoljno je zabeležiti ono što je novo ili korisno za sledeće planiranje.</p>
    </div>`;

  const BUDNOST = ["", "Pospano, usporeno", "Mirno i dostupno", "Uzbuđeno, nemirno", "Preopterećeno"];

  function noteForm() {
    if (state.notesTab === "nedeljni") {
      return `
        <form class="panel" id="review-form">
          <h2>Nedeljni osvrt</h2>
          <div class="two">
            <div class="field"><label for="r-nedelja">Nedelja</label>
              <select class="input" id="r-nedelja" name="nedelja">${P.nedelje.map(n => `<option value="${n.broj}" ${n.broj === state.week ? "selected" : ""}>${n.broj}. nedelja – ${esc(n.kratko)}</option>`).join("")}</select></div>
            <div class="field"><label for="r-datum">Datum</label><input class="input" type="date" id="r-datum" name="datum" value="${todayISO()}"></div>
          </div>
          <div class="field"><label>Šta je išlo dobro ove nedelje?</label><textarea class="input" name="dobro" placeholder="Najviše mu je prijalo..."></textarea></div>
          <div class="field"><label>Šta je bilo teško? <small>(opciono)</small></label><textarea class="input" name="tesko"></textarea></div>
          <div class="field"><label>Šta želite da probate sledeće nedelje? <small>(opciono)</small></label><textarea class="input" name="dalje"></textarea></div>
          <button class="btn" type="submit">Sačuvaj osvrt</button>
        </form>`;
    }
    return `
      <form class="panel" id="note-form">
        <h2>Novo zapažanje</h2>
        <div class="field"><label for="n-akt">Aktivnost</label>
          <select class="input" id="n-akt" name="aktivnost">${P.aktivnosti.map(a => `<option value="${a.id}">${esc(a.naziv)}</option>`).join("")}</select></div>
        <div class="two">
          <div class="field"><label for="n-datum">Datum</label><input class="input" type="date" id="n-datum" name="datum" value="${todayISO()}" required></div>
          <div class="field"><label for="n-vreme">Vreme <small>(opciono)</small></label><input class="input" type="time" id="n-vreme" name="vreme"></div>
        </div>
        <div class="field"><label for="n-probali">Da li ste probali aktivnost?</label>
          <select class="input" id="n-probali" name="probali"><option value="da">Da</option><option value="delimicno">Delimično</option><option value="ne">Ne, ne danas</option></select></div>
        <div class="field"><span class="label">Kako je izgledalo iskustvo?</span>
          <div class="radio-grid">${P.iskustva.map(i => `<label><input type="radio" name="iskustvo" value="${i.id}"> ${i.ikona} ${esc(i.naziv)}</label>`).join("")}</div></div>
        <details class="more"><summary>Budnost pre / posle i detalji <small>opciono</small></summary>
          <div class="two">
            <div class="field"><label>Pre igre</label><select class="input" name="pre">${BUDNOST.map(b => `<option>${b}</option>`).join("")}</select></div>
            <div class="field"><label>Posle igre</label><select class="input" name="posle">${BUDNOST.map(b => `<option>${b}</option>`).join("")}</select></div>
          </div>
          <div class="field" style="margin:0"><label>Detalji</label><textarea class="input" name="detalji" placeholder="Kako je reagovao, koliko je trajalo, šta je pomoglo..."></textarea></div>
        </details>
        <div class="field"><label>Šta želite da zapamtite? <small>(opciono)</small></label><textarea class="input" name="zapamti" placeholder="Šta je bilo novo ili neobično?"></textarea></div>
        <button class="btn" type="submit">Sačuvaj zapažanje</button>
      </form>`;
  }

  function pageZapazanja() {
    const count = state.notesTab === "nedeljni" ? state.reviews.length : state.notes.length;
    return `
      <div class="page-head">
        <p class="eyebrow">Dnevnik vašeg programa</p>
        <h1>Šta ste primetili?</h1>
        <p class="lead">Nije potrebno popunjavati tabelu posle svake igre. Dovoljno je zabeležiti ono što je novo, neobično ili korisno za sledeće planiranje.</p>
      </div>
      <div class="notice">${ICON.info} Beleške ostaju samo u ovom pregledaču na ovom uređaju. Povremeno napravite rezervnu kopiju, a izveštaj možete poslati ${esc(P.defektolog.ime.split(" ")[0].replace(/a$/, "i"))}.</div>
      <div class="row-between notes-bar">
        <div class="chips">
          <button class="chip ${state.notesTab === "dnevna" ? "active" : ""}" data-tab="dnevna">Dnevna zapažanja</button>
          <button class="chip ${state.notesTab === "nedeljni" ? "active" : ""}" data-tab="nedeljni">Nedeljni osvrt</button>
          <button class="chip ${state.notesTab === "pregled" ? "active" : ""}" data-tab="pregled">Pregled napretka</button>
        </div>
        <div class="bar-actions">
          <button class="btn-link" data-action="download">${ICON.download} Beleške (.txt)</button>
          <button class="btn-link" data-action="backup">${ICON.download} Rezervna kopija</button>
          <button class="btn-link" data-action="restore">↺ Vrati kopiju</button>
          <input type="file" id="restore-input" accept=".json,application/json" hidden>
        </div>
      </div>
      ${state.notesTab === "pregled" ? progressView() : `
      <div class="notes-grid">
        ${noteForm()}
        <div>
          <div class="list-head"><h2>Naša zapažanja</h2><small>(${count})</small></div>
          ${notesList()}
        </div>
      </div>`}`;
  }

  // ---------- Pregled napretka ----------
  function lastDays(n) {
    const out = [];
    const d = new Date();
    for (let k = n - 1; k >= 0; k--) {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - k);
      out.push(isoOf(x));
    }
    return out;
  }

  function stats() {
    const days = lastDays(28);
    const byDay = {};
    state.notes.forEach(n => (byDay[n.datum] = byDay[n.datum] || []).push(n));
    const activeDays = days.filter(d => byDay[d]).length;
    const perAct = P.aktivnosti.map(a => {
      const ns = state.notes.filter(n => n.aktivnost === a.id);
      const count = k => ns.filter(n => n.iskustvo === k).length;
      return { a, total: ns.length, prijalo: count("prijalo"), prilagodjavanje: count("prilagodjavanje"), pauza: count("pauza"), istrazujemo: count("istrazujemo") };
    }).filter(x => x.total).sort((x, y) => y.prijalo - x.prijalo || y.total - x.total);
    return { days, byDay, activeDays, perAct };
  }

  function progressView() {
    const { days, byDay, activeDays, perAct } = stats();
    const tried = state.tried.filter(id => actById(id)).length;
    const first = new Date(days[0]);
    const lead = (first.getDay() + 6) % 7; // pomeraj da kalendar počne od ponedeljka
    const cells = Array(lead).fill(`<span class="cal-empty"></span>`).concat(days.map(d => {
      const ns = byDay[d] || [];
      const last = ns[ns.length - 1];
      const color = last && last.iskustvo ? ISK_BOJA[last.iskustvo] : (ns.length ? "#7d9a7b" : "");
      const title = ns.length ? `${fmtDate(d)} – ${ns.map(n => (actById(n.aktivnost) || {}).naziv).join(", ")}` : fmtDate(d);
      return `<span class="cal-day ${d === todayISO() ? "today" : ""}" title="${esc(title)}" style="${color ? `background:${color};color:#fff` : ""}">${Number(d.slice(8))}</span>`;
    }));
    const max = Math.max(1, ...perAct.map(x => x.total));

    return `
      <div class="stat-row">
        <div class="stat"><b>${activeDays}</b><span>dana sa igrom<br>u poslednje 4 nedelje</span></div>
        <div class="stat"><b>${state.notes.length}</b><span>sačuvanih<br>zapažanja</span></div>
        <div class="stat"><b>${tried}<small> / ${P.aktivnosti.length}</small></b><span>isprobanih<br>aktivnosti</span></div>
      </div>
      <div class="progress-grid">
        <div class="panel">
          <h2>Poslednje 4 nedelje</h2>
          <div class="cal">
            ${["P", "U", "S", "Č", "P", "S", "N"].map(x => `<span class="cal-h">${x}</span>`).join("")}
            ${cells.join("")}
          </div>
          <div class="legend">${P.iskustva.map(i => `<span><i style="background:${ISK_BOJA[i.id]}"></i>${esc(i.naziv)}</span>`).join("")}</div>
        </div>
        <div class="panel">
          <h2>Šta najviše prija</h2>
          ${perAct.length ? perAct.slice(0, 8).map(x => `
            <div class="hbar">
              <div class="row-between"><span>${esc(x.a.naziv)}</span><small>${x.total}×</small></div>
              <div class="hbar-track" style="width:${(x.total / max) * 100}%">
                ${P.iskustva.map(i => x[i.id] ? `<i style="flex:${x[i.id]};background:${ISK_BOJA[i.id]}" title="${esc(i.naziv)}: ${x[i.id]}"></i>` : "").join("")}
              </div>
            </div>`).join("") : `<p class="muted">Kada sačuvate prva zapažanja, ovde ćete videti koje igre detetu najviše prijaju.</p>`}
        </div>
      </div>
      <div class="report-cta">
        <div><strong>Izveštaj za konsultacije</strong><small>Pregled poslednjih 30 dana, spreman za štampu ili čuvanje kao PDF.</small></div>
        <button class="btn" data-action="report">Napravi izveštaj</button>
      </div>`;
  }

  // ---------- Izveštaj (štampa / PDF) ----------
  function openReport() {
    const since = lastDays(30)[0];
    const notes = state.notes.filter(n => n.datum >= since).sort((a, b) => (a.datum + (a.vreme || "")).localeCompare(b.datum + (b.vreme || "")));
    const reviews = state.reviews.filter(r => r.datum >= since);
    const { activeDays, perAct } = stats();
    const pitanja = store.get("pitanja", "");
    const d = P.defektolog;
    const row = n => {
      const a = actById(n.aktivnost);
      const isk = P.iskustva.find(i => i.id === n.iskustvo);
      return `<tr><td>${fmtDate(n.datum)}${n.vreme ? "<br><small>" + esc(n.vreme) + "</small>" : ""}</td><td>${a ? esc(a.naziv) : ""}</td>
        <td>${isk ? esc(isk.naziv) : "–"}</td><td>${n.pre || n.posle ? esc(n.pre || "–") + " → " + esc(n.posle || "–") : "–"}</td>
        <td>${esc([n.detalji, n.zapamti].filter(Boolean).join(" · ")) || "–"}</td></tr>`;
    };
    const html = `<!doctype html><html lang="sr"><head><meta charset="utf-8"><title>Izveštaj – Kućni defektolog</title>
      <style>
        body{font:13px/1.55 system-ui,"Segoe UI",sans-serif;color:#2b3a33;max-width:820px;margin:36px auto;padding:0 24px}
        h1,h2{font-family:Georgia,serif;font-weight:400;color:#1f3a32} h1{font-size:30px;margin:4px 0} h2{font-size:20px;margin:30px 0 10px;border-bottom:1px solid #ddd;padding-bottom:6px}
        .eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#7a8279}
        .stats{display:flex;gap:14px;margin-top:20px}.stats div{flex:1;background:#f1f3ec;border-radius:10px;padding:12px 14px}.stats b{display:block;font-size:22px;color:#234d43}
        table{width:100%;border-collapse:collapse;font-size:12px}td,th{text-align:left;padding:7px 6px;border-bottom:1px solid #e6e1d6;vertical-align:top}th{font-size:10px;text-transform:uppercase;color:#7a8279;letter-spacing:.06em}
        .q{white-space:pre-wrap;background:#faf7f0;border-radius:10px;padding:14px}.btn{position:fixed;right:20px;top:20px;background:#234d43;color:#fff;border:0;border-radius:8px;padding:10px 16px;cursor:pointer}
        @media print{.btn{display:none}body{margin:0}}
      </style></head><body>
      <button class="btn" onclick="print()">Štampaj / Sačuvaj PDF</button>
      <p class="eyebrow">Kućni defektolog · ${esc(P.porodica)}</p>
      <h1>Izveštaj za konsultacije</h1>
      <p>Period: ${fmtDate(since)} – ${fmtDate(todayISO())} · Za: ${esc(d.ime)}, ${esc(d.titula)}</p>
      <div class="stats"><div><b>${activeDays}</b>dana sa igrom (4 ned.)</div><div><b>${notes.length}</b>zapažanja</div><div><b>${state.tried.length} / ${P.aktivnosti.length}</b>isprobanih aktivnosti</div></div>
      <h2>Šta najviše prija</h2>
      ${perAct.length ? `<table><tr><th>Aktivnost</th><th>Puta</th><th>Prijalo</th><th>Uz prilagođavanje</th><th>Pauza</th></tr>
        ${perAct.map(x => `<tr><td>${esc(x.a.naziv)}</td><td>${x.total}</td><td>${x.prijalo}</td><td>${x.prilagodjavanje}</td><td>${x.pauza}</td></tr>`).join("")}</table>` : "<p>Još nema zapažanja.</p>"}
      <h2>Dnevna zapažanja</h2>
      ${notes.length ? `<table><tr><th>Datum</th><th>Aktivnost</th><th>Iskustvo</th><th>Budnost</th><th>Beleška</th></tr>${notes.map(row).join("")}</table>` : "<p>Nema zapažanja u ovom periodu.</p>"}
      ${reviews.length ? `<h2>Nedeljni osvrti</h2>${reviews.map(r => `<p><b>${r.nedelja}. nedelja</b> (${fmtDate(r.datum)})<br>${r.dobro ? "Dobro: " + esc(r.dobro) + "<br>" : ""}${r.tesko ? "Teško: " + esc(r.tesko) + "<br>" : ""}${r.dalje ? "Sledeće: " + esc(r.dalje) : ""}</p>`).join("")}` : ""}
      ${pitanja.trim() ? `<h2>Pitanja za razgovor</h2><div class="q">${esc(pitanja)}</div>` : ""}
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast("Dozvolite iskačuće prozore da bi se otvorio izveštaj.");
    w.document.write(html);
    w.document.close();
  }

  // ---------- Rezervna kopija ----------
  function downloadBackup() {
    const data = {
      app: "kucni-defektolog", verzija: 1, napravljeno: new Date().toISOString(),
      tried: state.tried, notes: state.notes, reviews: state.reviews, week: state.week, pitanja: store.get("pitanja", "")
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kucni-defektolog-kopija-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Rezervna kopija je preuzeta.");
  }

  function restoreBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.app !== "kucni-defektolog") throw new Error();
        const merge = (cur, inc) => { const ids = new Set(cur.map(x => x.id)); return cur.concat((inc || []).filter(x => !ids.has(x.id))); };
        const before = state.notes.length + state.reviews.length;
        state.notes = merge(state.notes, data.notes);
        state.reviews = merge(state.reviews, data.reviews);
        state.tried = [...new Set(state.tried.concat(data.tried || []))];
        if (data.pitanja && !store.get("pitanja", "")) store.set("pitanja", data.pitanja);
        save();
        render(true);
        toast(`Kopija je vraćena (${state.notes.length + state.reviews.length - before} novih beleški).`);
      } catch {
        toast("Ovo nije ispravna rezervna kopija.");
      }
    };
    reader.readAsText(file);
  }

  // ---------- Stranica: Podrška ----------
  function pagePodrska() {
    const d = P.defektolog;
    const ime = d.ime.split(" ")[0];
    const draft = store.get("pitanja", "");
    return `
      <div class="page-head">
        <p class="eyebrow">Uz vas, korak po korak</p>
        <h1>Prostor za vaša pitanja.</h1>
        <p class="lead">Zabeležite nedoumice i pripremite se za zajednički razgovor.</p>
      </div>
      <div class="support-grid">
        <div class="profile">
          <div class="big-avatar">${esc(d.inicijali)}</div>
          <p class="eyebrow">Vaša podrška u programu</p>
          <h2>${esc(d.ime)}</h2>
          <p>${esc(d.titula)}<br>${esc(d.uloga)}</p>
          <p style="margin-top:20px">${esc(d.opis)}</p>
          <blockquote>„${esc(d.citat)}“</blockquote>
        </div>
        <div class="panel">
          <h2 style="margin-bottom:8px">Priprema za konsultacije</h2>
          <p style="font-size:11px;margin:0 0 22px">Kopirajte pitanja i prosledite ih putem dogovorenog kanala.</p>
          <div class="field"><label for="pitanja">Moja pitanja za ${esc(ime.replace(/a$/, "u"))}</label>
            <textarea class="input" id="pitanja" style="min-height:180px" placeholder="Volela bih da razgovaramo o...">${esc(draft)}</textarea>
            <small style="font-size:10px;color:var(--muted)">Nacrt se čuva samo u ovom pregledaču.</small>
          </div>
          <div class="modal-actions" style="margin-top:0">
            <button class="btn" data-action="copy">${ICON.copy} Kopiraj pitanja</button>
            <button class="btn-link" data-action="add-notes">Dodaj zapažanja</button>
          </div>
          <div class="notice" style="margin-top:22px">${ICON.info} Poruke se ne šalju kroz aplikaciju.</div>
        </div>
      </div>

      <section class="tips">
        <h2>Za lake i teške dane.</h2>
        <ul>${P.saveti.map(s => `<li>${ICON.heart}<span>${esc(s)}</span></li>`).join("")}</ul>
      </section>
      <section class="faq">
        <h2>O korišćenju programa</h2>
        ${P.cesta_pitanja.map(f => `<details><summary>${esc(f.p)}</summary><p>${esc(f.o)}</p></details>`).join("")}
      </section>`;
  }

  // ---------- Modal ----------
  function openModal(html, extraClass = "") {
    const card = $("#modal-card");
    card.className = "modal-card " + extraClass;
    card.innerHTML = `<button class="modal-close" data-close aria-label="Zatvori">×</button>` + html;
    $("#modal").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    $("#modal").hidden = true;
    document.body.style.overflow = "";
    run = null;
    stopTimer();
  }

  // ---------- Režim "korak po korak" ----------
  function openSteps(id) {
    if (!actById(id)) return;
    run = { id, i: 0 };
    renderSteps();
  }

  function renderSteps() {
    const a = actById(run.id);
    const n = a.koraci.length;
    const finished = run.i >= n;
    const dots = a.koraci.map((_, k) => `<i class="${k < run.i ? "past" : k === run.i ? "now" : ""}"></i>`).join("");

    const body = finished
      ? `<div class="steps-end">
           <p class="eyebrow">Gotovo</p>
           <h2>Bravo, uradili ste to zajedno!</h2>
           <p>Kako je prošlo? Jedan klik je dovoljan.</p>
           <div class="quick-exp">${P.iskustva.map(i => `
             <button data-quick="${i.id}" style="--c:${ISK_BOJA[i.id]}"><span>${i.ikona}</span>${esc(i.naziv)}</button>`).join("")}
           </div>
           <button class="btn-link" data-note-for="${a.id}">Želim da napišem detaljnije zapažanje →</button>
         </div>`
      : `<p class="step-count">Korak ${run.i + 1} od ${n}</p>
         <p class="step-text">${esc(a.koraci[run.i])}</p>`;

    openModal(`
      <div class="steps-head">
        <span class="steps-icon bg-${a.kategorija}">${artFor(a)}</span>
        <div><p class="eyebrow">Korak po korak</p><strong>${esc(a.naziv)}</strong></div>
      </div>
      <div class="dots">${dots}</div>
      <div class="steps-body">${body}</div>
      <div class="timer">
        <span class="timer-label">Tajmer</span>
        ${[3, 5, 10].map(m => `<button class="chip ${timer && timer.total === m * 60 ? "active" : ""}" data-timer="${m}">${m} min</button>`).join("")}
        <span class="timer-display" id="timer-display">${timerText()}</span>
        ${timer ? `<button class="chip" data-action="timer-toggle">${timer.running ? "Pauza" : "Nastavi"}</button>` : ""}
      </div>
      ${finished ? "" : `
      <div class="steps-nav">
        <button class="btn-ghost" data-step="-1" ${run.i === 0 ? "disabled" : ""}>← Nazad</button>
        <button class="btn" data-step="1">${run.i === n - 1 ? "Završili smo ✓" : "Sledeći korak →"}</button>
      </div>`}`, "steps-mode");
  }

  function quickNote(iskustvo) {
    const id = run.id;
    state.notes.push({ id: Date.now().toString(36), aktivnost: id, datum: todayISO(), vreme: new Date().toTimeString().slice(0, 5), probali: "da", iskustvo });
    if (!isTried(id)) state.tried.push(id);
    save();
    closeModal();
    render(true);
    toast("Sačuvano. Hvala što ste se igrali!");
  }

  // ---------- Tajmer ----------
  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const timerText = () => timer ? fmtTime(timer.left) : "--:--";

  function startTimer(min) {
    stopTimer();
    timer = { total: min * 60, left: min * 60, running: false, handle: null };
    toggleTimer();
  }
  function toggleTimer() {
    if (!timer) return;
    if (timer.running) {
      clearInterval(timer.handle);
      timer.running = false;
    } else {
      timer.running = true;
      timer.handle = setInterval(() => {
        timer.left--;
        const el = $("#timer-display");
        if (el) el.textContent = timerText();
        if (timer.left <= 0) { stopTimer(); ring(); toast("Vreme je isteklo. Lepo završite igru."); if (run) renderSteps(); }
      }, 1000);
    }
    if (run) renderSteps();
  }
  function stopTimer() {
    if (timer) clearInterval(timer.handle);
    timer = null;
  }
  function ring() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach(t => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 660; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.32);
      });
    } catch {}
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  function openActivity(id) {
    const a = actById(id);
    if (!a) return;
    openModal(`
      <div class="card-art bg-${a.kategorija}"><span class="num">${a.id}</span>${artFor(a)}</div>
      <p class="cat" style="font-size:10px;font-weight:600;color:#5d6f5b;margin:20px 0 4px">${esc(P.kategorije[a.kategorija].naziv)} · ${a.nedelja}. nedelja</p>
      <h2>${esc(a.naziv)}</h2>
      <h4>Cilj</h4><p style="margin:0;font-size:13px">${esc(a.cilj)}</p>
      <h4>Koraci</h4><ol>${a.koraci.map(k => `<li>${esc(k)}</li>`).join("")}</ol>
      <h4>Šta pratimo</h4><ul>${a.pratimo.map(k => `<li>${esc(k)}</li>`).join("")}</ul>
      ${a.video ? `<a class="video-link" href="${esc(a.video)}" target="_blank" rel="noopener">▶ Pogledaj video-prikaz</a>` : ""}
      <div class="modal-actions">
        <button class="btn" data-steps="${a.id}">▶ Korak po korak</button>
        <button class="btn-ghost" data-tried="${a.id}" data-in-modal>${isTried(a.id) ? "✓ Isprobali smo" : "Označi: isprobali smo"}</button>
        <button class="btn-link" data-note-for="${a.id}">Zabeleži zapažanje</button>
      </div>`);
  }

  // ---------- Ruter ----------
  const PAGES = {
    plan: ["Moj program", pagePlan],
    aktivnosti: ["Aktivnosti", pageAktivnosti],
    zapazanja: ["Naša zapažanja", pageZapazanja],
    podrska: [`Podrška ${P.defektolog.ime.split(" ")[0].replace(/a$/, "e")}`, pagePodrska]
  };

  function render(keepScroll) {
    const key = (location.hash.slice(1) || "plan").split("/")[0];
    const [title, fn] = PAGES[key] || PAGES.plan;
    const y = window.scrollY;
    content.innerHTML = fn();
    $("#crumb").textContent = title;
    document.querySelectorAll(".nav a, .bottom-nav a").forEach(a => a.classList.toggle("active", a.dataset.page === (PAGES[key] ? key : "plan")));
    $("#sidebar").classList.remove("open");
    window.scrollTo(0, keepScroll ? y : 0);
  }

  // ---------- Događaji ----------
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-open],[data-tried],[data-week],[data-filter],[data-tab],[data-action],[data-close],[data-del-note],[data-del-review],[data-note-for],[data-steps],[data-step],[data-timer],[data-quick]");
    if (!t) return;

    if (t.dataset.close !== undefined) return closeModal();
    if (t.dataset.open) return openActivity(t.dataset.open);
    if (t.dataset.steps) return openSteps(t.dataset.steps);
    if (t.dataset.step && run) {
      run.i = Math.max(0, run.i + Number(t.dataset.step));
      return renderSteps();
    }
    if (t.dataset.timer) return startTimer(Number(t.dataset.timer));
    if (t.dataset.quick && run) return quickNote(t.dataset.quick);

    if (t.dataset.tried) {
      const id = t.dataset.tried;
      state.tried = isTried(id) ? state.tried.filter(x => x !== id) : [...state.tried, id];
      save();
      if (t.dataset.inModal !== undefined) {
        t.textContent = isTried(id) ? "✓ Isprobali smo" : "Označi: isprobali smo";
      }
      render(true);
      return;
    }
    if (t.dataset.week) { state.week = +t.dataset.week; save(); return render(true); }
    if (t.dataset.filter) {
      state.filter = t.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(c => c.classList.toggle("active", c === t));
      $("#cards").innerHTML = activityCards();
      return;
    }
    if (t.dataset.tab) { state.notesTab = t.dataset.tab; return render(true); }
    if (t.dataset.delNote && confirm("Obrisati ovo zapažanje?")) {
      state.notes = state.notes.filter(n => n.id !== t.dataset.delNote); save(); return render(true);
    }
    if (t.dataset.delReview && confirm("Obrisati ovaj osvrt?")) {
      state.reviews = state.reviews.filter(n => n.id !== t.dataset.delReview); save(); return render(true);
    }
    if (t.dataset.noteFor) {
      closeModal();
      state.notesTab = "dnevna";
      if (location.hash === "#zapazanja") render(false); else location.hash = "zapazanja";
      setTimeout(() => { const s = $("#n-akt"); if (s) s.value = t.dataset.noteFor; }, 0);
      return;
    }

    switch (t.dataset.action) {
      case "print": window.print(); break;
      case "another": state.pickOffset++; render(true); break;
      case "timer-toggle": toggleTimer(); break;
      case "report": openReport(); break;
      case "backup": downloadBackup(); break;
      case "restore": $("#restore-input").click(); break;
      case "procena":
        e.preventDefault();
        openModal(`<p class="eyebrow" style="margin-top:10px">Polazište vašeg programa</p><h2>Procena i ciljevi</h2>
          <p style="font-size:13px">${esc(P.procena.polaziste)}</p>
          <h4>Ciljevi za ovaj mesec</h4><ol>${P.procena.ciljevi.map(c => `<li>${esc(c)}</li>`).join("")}</ol>`);
        break;
      case "rutine":
        e.preventDefault();
        openModal(`<p class="eyebrow" style="margin-top:10px">Podrška kroz dan</p><h2>${P.rutine.length} poznatih rutina</h2>
          <div class="routines" style="grid-template-columns:1fr">${P.rutine.map(r => `<div class="routine"><strong>${esc(r.naziv)}</strong><span>${esc(r.savet)}</span></div>`).join("")}</div>`);
        break;
      case "copy": {
        const text = $("#pitanja").value.trim();
        if (!text) return toast("Prvo upišite pitanja.");
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
          .then(() => toast("Pitanja su kopirana."))
          .catch(() => { $("#pitanja").select(); document.execCommand("copy"); toast("Pitanja su kopirana."); });
        break;
      }
      case "add-notes": {
        const ta = $("#pitanja");
        const recent = state.notes.slice(-5).map(n => {
          const a = actById(n.aktivnost);
          const isk = P.iskustva.find(i => i.id === n.iskustvo);
          return `• ${fmtDate(n.datum)} – ${a ? a.naziv : ""}${isk ? " (" + isk.naziv + ")" : ""}${n.zapamti ? ": " + n.zapamti : ""}`;
        });
        if (!recent.length) return toast("Još nema sačuvanih zapažanja.");
        ta.value = (ta.value.trim() ? ta.value.trim() + "\n\n" : "") + "Poslednja zapažanja:\n" + recent.join("\n");
        store.set("pitanja", ta.value);
        toast("Zapažanja su dodata.");
        break;
      }
      case "download": downloadNotes(); break;
    }
  });

  document.addEventListener("input", e => {
    if (e.target.id === "search") { state.search = e.target.value; $("#cards").innerHTML = activityCards(); }
    if (e.target.id === "pitanja") store.set("pitanja", e.target.value);
  });

  document.addEventListener("change", e => {
    if (e.target.id === "restore-input" && e.target.files[0]) restoreBackup(e.target.files[0]);
  });

  document.addEventListener("submit", e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.id = Date.now().toString(36);
    if (e.target.id === "note-form") {
      state.notes.push(data);
      if (data.probali !== "ne" && !isTried(data.aktivnost)) state.tried.push(data.aktivnost);
      toast("Zapažanje je sačuvano.");
    } else if (e.target.id === "review-form") {
      if (!data.dobro && !data.tesko && !data.dalje) return toast("Upišite bar jednu misao.");
      state.reviews.push(data);
      toast("Osvrt je sačuvan.");
    }
    save();
    render(true);
  });

  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  $("#menu-btn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  function downloadNotes() {
    const lines = [`Kućni defektolog – beleške (${fmtDate(todayISO())})`, ""];
    lines.push("DNEVNA ZAPAŽANJA", "");
    state.notes.forEach(n => {
      const a = actById(n.aktivnost);
      const isk = P.iskustva.find(i => i.id === n.iskustvo);
      lines.push(`${fmtDate(n.datum)}${n.vreme ? " " + n.vreme : ""} – ${a ? a.naziv : ""}`);
      if (isk) lines.push(`  Iskustvo: ${isk.naziv}`);
      if (n.pre || n.posle) lines.push(`  Budnost: ${n.pre || "–"} → ${n.posle || "–"}`);
      if (n.detalji) lines.push(`  Detalji: ${n.detalji}`);
      if (n.zapamti) lines.push(`  Zapamtiti: ${n.zapamti}`);
      lines.push("");
    });
    lines.push("NEDELJNI OSVRTI", "");
    state.reviews.forEach(r => {
      lines.push(`${r.nedelja}. nedelja (${fmtDate(r.datum)})`);
      if (r.dobro) lines.push(`  Dobro: ${r.dobro}`);
      if (r.tesko) lines.push(`  Teško: ${r.tesko}`);
      if (r.dalje) lines.push(`  Sledeće: ${r.dalje}`);
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `zapazanja-${todayISO()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- Start ----------
  const d = P.defektolog;
  $("#side-initials").textContent = d.inicijali;
  $("#side-name").textContent = d.ime;
  $("#side-role").textContent = d.kratko;
  $("#nav-podrska").textContent = PAGES.podrska[0];
  window.addEventListener("hashchange", () => { closeModal(); render(false); });
  render(false);

  // Rad bez interneta i instalacija na telefon (samo u objavljenoj verziji)
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
})();
