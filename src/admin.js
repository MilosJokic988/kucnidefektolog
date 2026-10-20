/* Draganin deo: prijava, porodice, pregled napretka, programi, poruke. */

import { admin as api, getSession, signIn, signOut, requestPasswordReset, updatePassword, aiStatus } from "./api.js";
import { PROFILE, ISKUSTVA } from "./config.js";
import { $, esc, toast, openModal, closeModal, fmtDate, todayISO, relTime, ICON, copyText, formCode, md } from "./util.js";
import { normalizeContent, currentWeek } from "./program.js";
import { progressView, reportHtml, openReportWindow } from "./family.js";
import * as editor from "./editor.js";
import { importProgram, importPackage, createEmptyProgram } from "./importer.js";

const A = {
  overview: null, showArchived: false, family: null, familyId: null, tab: "pregled",
  importing: null, aiConfigured: null,
};

export const NAV = [
  { page: "admin", label: "Porodice", short: "Porodice", icon: ICON.people },
];

export const loggedIn = () => {
  const s = getSession();
  return Boolean(s && s.access_token && !s.recovery);
};

/* ================================================================ RUTE
   #/admin                        – porodice
   #/admin/p/<id>                 – porodica
   #/admin/p/<id>/novi            – novi program iz fajla
   #/admin/p/<id>/program/<pid>   – uređivanje programa
   #/admin/nova-sifra             – nova šifra (link iz mejla)            */

export function parse(parts) {
  if (parts[1] === "nova-sifra") return { view: "password" };
  if (parts[1] === "p" && parts[2]) {
    if (parts[3] === "novi") return { view: "import", id: parts[2] };
    if (parts[3] === "program" && parts[4]) return { view: "editor", id: parts[2], pid: parts[4] };
    return { view: "family", id: parts[2] };
  }
  return { view: "list" };
}

export async function load(route) {
  if (route.view === "password") return;
  if (!loggedIn()) return;
  if (route.view === "list") {
    A.overview = await api.overview();
  } else {
    if (A.familyId !== route.id || !A.family || route.view === "family") {
      A.family = await api.family(route.id, route.view === "family");
      A.familyId = route.id;
      A.family.program && (A.family.program.content = normalizeContent(A.family.program.content));
    }
    if (route.view === "editor") {
      const prog = A.family.history.find(h => h.id === route.pid);
      if (!prog) throw new Error("Program nije pronađen.");
      if (!prog.content && !(A.family.program && A.family.program.id === prog.id)) throw new Error("Sadržaj prethodnog programa nije dostupan. U Supabase SQL Editoru ponovo pokrenite fajl supabase/schema.sql.");
      if (!editor.current() || editor.current().id !== prog.id) {
        const full = A.family.program && A.family.program.id === prog.id ? { ...prog, content: A.family.program.content } : prog;
        editor.setProgram(full, A.family.family);
      }
    }
    if (route.view === "import" && A.aiConfigured === null) {
      A.aiConfigured = Boolean((await aiStatus()).configured);
    }
  }
}

export function crumb(route) {
  if (route.view === "list" || !A.family) return "Porodice";
  if (route.view === "editor") return "Uređivanje programa";
  if (route.view === "import") return "Novi program";
  return A.family.family.name;
}

export function render(route) {
  if (route.view === "password") return passwordScreen();
  if (!loggedIn()) return loginScreen();
  if (route.view === "list") return listView();
  if (route.view === "import") return importView();
  if (route.view === "editor") return editor.render();
  return familyView();
}

export function afterRender(root, route) {
  if (route.view === "editor") editor.afterRender(root);
  if (route.view === "family" && A.tab === "poruke") { const c = $("#chat"); if (c) c.scrollTop = c.scrollHeight; }
}

/* ================================================================ PRIJAVA */

function loginScreen() {
  return `
    <section class="welcome-card narrow">
      <p class="eyebrow">Za defektologa</p>
      <h1>Prijava</h1>
      <p class="lead">Prijavite se da vidite porodice, zapažanja i programe.</p>
      <form id="login-form" class="panel">
        <div class="field"><label for="l-email">Mejl</label><input class="input" id="l-email" name="email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="l-pass">Šifra</label><input class="input" id="l-pass" name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-lg" type="submit">Prijavi se</button>
        <button class="btn-link" type="button" data-action="reset" style="margin-top:14px">Zaboravili ste šifru?</button>
      </form>
      <a class="btn-link" href="#/">← Ulaz za porodice</a>
    </section>`;
}

function passwordScreen() {
  return `
    <section class="welcome-card narrow">
      <p class="eyebrow">Nova šifra</p>
      <h1>Postavite novu šifru</h1>
      <form id="password-form" class="panel">
        <div class="field"><label for="p1">Nova šifra</label><input class="input" id="p1" name="p1" type="password" minlength="8" autocomplete="new-password" required></div>
        <div class="field"><label for="p2">Ponovite šifru</label><input class="input" id="p2" name="p2" type="password" minlength="8" autocomplete="new-password" required></div>
        <button class="btn btn-lg" type="submit">Sačuvaj šifru</button>
      </form>
    </section>`;
}

/* ================================================================ PORODICE */

function attention(f) {
  if (f.archived) return "";
  if (!f.program) return `<span class="flag">Nema objavljen program</span>`;
  const last = f.last_obs_at || f.last_seen_at;
  if (!last) return `<span class="flag">Još nisu otvorili aplikaciju</span>`;
  const days = (Date.now() - new Date(last)) / 864e5;
  if (days > 4) return `<span class="flag">Tiho ${Math.floor(days)} dana</span>`;
  return "";
}

function listView() {
  const all = A.overview || [];
  const list = all.filter(f => A.showArchived || !f.archived);
  const active = all.filter(f => !f.archived);
  const tests = all.filter(f => f.is_test);
  const sum = k => active.reduce((s, f) => s + Number(f[k] || 0), 0);
  return `
    <div class="page-head row-between">
      <div>
        <p class="eyebrow">Dobro došli, ${esc(PROFILE.imeKratko)}</p>
        <h1>Vaše porodice.</h1>
        <p class="lead">Ko je u kojoj nedelji, šta su zabeležili i kome treba podrška.</p>
      </div>
      <button class="btn" data-action="new-family">${ICON.plus} Nova porodica</button>
    </div>
    <div class="stat-row">
      <div class="stat"><b>${active.length}</b><span>aktivnih<br>porodica</span></div>
      <div class="stat"><b>${sum("obs_7d")}</b><span>zapažanja<br>u poslednjih 7 dana</span></div>
      <div class="stat"><b>${sum("new_obs") + sum("unread")}</b><span>novih zapažanja<br>i poruka</span></div>
    </div>
    ${list.length ? `<div class="fam-list">${list.map(f => {
      const weekInfo = f.program ? (() => { const w = currentWeek({ start_date: f.program.start_date, content: { durationWeeks: f.program.weeks } }); return `${w}. od ${f.program.weeks} ned.`; })() : "";
      return `
      <a class="fam-card ${f.archived ? "archived" : ""}" href="#/admin/p/${f.id}">
        <span class="avatar">${esc((f.name.replace(/^porodica\s+/i, "")[0] || "?").toUpperCase())}</span>
        <span class="fam-main">
          <b>${esc(f.name)} ${f.is_test ? `<em class="badge-test">TEST</em>` : ""}${f.archived ? `<em class="badge-test">arhiva</em>` : ""}</b>
          <small>${f.program ? `${esc(f.program.title)} · ${weekInfo}` : f.drafts ? "Nacrt programa čeka objavu" : "Bez programa"}</small>
          <small class="muted">Poslednja aktivnost: ${relTime(f.last_obs_at || f.last_seen_at)} · isprobano ${f.tried}${f.program ? "/" + f.program.activities : ""}</small>
        </span>
        <span class="fam-badges">
          ${f.new_obs ? `<span class="pill-new">${f.new_obs} ${f.new_obs === 1 ? "novo zapažanje" : "nova zapažanja"}</span>` : ""}
          ${f.unread ? `<span class="pill-msg">${ICON.send} ${f.unread}</span>` : ""}
          ${attention(f)}
        </span>
      </a>`;
    }).join("")}</div>` : `
      <div class="empty-notes"><h3>Još nema porodica.</h3><p>Kliknite „Nova porodica“, a zatim ubacite Word ili PDF program.</p></div>`}
    <div class="row-between list-foot">
      <label class="check"><input type="checkbox" data-action="toggle-archived" ${A.showArchived ? "checked" : ""}> Prikaži arhivirane</label>
      ${tests.length ? `<button class="btn-link danger" data-action="delete-tests">${ICON.trash} Obriši sve test porodice (${tests.length})</button>` : ""}
    </div>`;
}

function newFamilyModal() {
  openModal(`
    <h2>Nova porodica</h2>
    <form id="family-form" class="modal-form">
      <div class="field"><label>Naziv porodice <small>(vidi ga i porodica)</small></label><input class="input" name="name" placeholder="npr. Porodica Tino" required></div>
      <div class="field"><label>Ime deteta / dece <small>(samo ime, bez prezimena)</small></label><input class="input" name="children" placeholder="npr. Tino"></div>
      <label class="check"><input type="checkbox" name="is_test"> Test porodica (za isprobavanje – lako se briše)</label>
      <div class="modal-actions"><button class="btn" type="submit">Napravi porodicu</button></div>
    </form>`);
  setTimeout(() => $("#family-form input[name=name]").focus(), 50);
}

/* ================================================================ PORODICA */

function shareText(f) {
  const link = familyLink(f);
  return `Zdravo! Ovo je vaš program podrške u aplikaciji Kućni defektolog:\n${link}\n\nAko aplikaciju otvorite sa početnog ekrana telefona, upišite kod: ${formCode(f.code)}\n\n${PROFILE.ime}`;
}
const familyLink = f => `${location.origin}${location.pathname}#/p/${formCode(f.code)}`;

function familyView() {
  const d = A.family;
  const f = d.family;
  const tabs = [["pregled", "Pregled"], ["program", "Program"], ["poruke", `Poruke${d.messages.length ? ` (${d.messages.length})` : ""}`], ["podesavanja", "Pristup i podešavanja"]];
  return `
    <div class="page-head">
      <a class="btn-link" href="#/admin">← Sve porodice</a>
      <div class="row-between" style="margin-top:12px">
        <div>
          <h1>${esc(f.name)} ${f.is_test ? `<em class="badge-test">TEST</em>` : ""}</h1>
          <p class="lead">${f.children ? esc(f.children) + " · " : ""}${d.program ? esc(d.program.title) + ` · ${currentWeek(d.program)}. od ${d.program.content.durationWeeks} nedelja` : "Bez objavljenog programa"} · poslednja poseta ${relTime(f.last_seen_at)}</p>
        </div>
        <button class="btn-ghost" data-action="share">${ICON.link} Pošalji link porodici</button>
      </div>
    </div>
    <div class="chips tabs">${tabs.map(([k, l]) => `<button class="chip ${A.tab === k ? "active" : ""}" data-atab="${k}">${esc(l)}</button>`).join("")}</div>
    ${{ pregled: tabPregled, program: tabProgram, poruke: tabPoruke, podesavanja: tabPodesavanja }[A.tab]()}`;
}

function tabPregled() {
  const d = A.family;
  const c = d.program ? d.program.content : null;
  const seen = d.owner_seen_at;
  const recent = d.observations.slice().reverse().slice(0, 30);
  const isk = id => ISKUSTVA.find(i => i.id === id);
  return `
    ${progressView(d, c, { showReport: false })}
    <div class="row-between" style="margin:26px 0 14px;align-items:center">
      <h2 class="section-title">Poslednja zapažanja</h2>
      <button class="btn-ghost" data-action="report">${ICON.print} Izveštaj (PDF)</button>
    </div>
    ${recent.length ? recent.map(n => {
      const e = isk(n.experience);
      return `
      <div class="note ${seen && n.created_at > seen ? "is-new" : ""}">
        <div class="meta"><span>${fmtDate(n.obs_date)}${n.obs_time ? " · " + esc(n.obs_time) : ""}${n.tried === "ne" ? " · nisu probali" : n.tried === "delimicno" ? " · delimično" : ""}</span>${seen && n.created_at > seen ? `<span class="pill-new">novo</span>` : ""}</div>
        <strong>${esc(n.activity_title || "Aktivnost")}</strong>
        ${e ? `<span class="badge" style="--c:${e.boja}">${e.ikona} ${esc(e.naziv)}</span>` : ""}
        ${n.alert_before || n.alert_after ? `<p>Budnost: ${esc(n.alert_before || "–")} → ${esc(n.alert_after || "–")}</p>` : ""}
        ${n.details ? `<p>${esc(n.details)}</p>` : ""}
        ${n.remember ? `<p><b>Zapamtiti:</b> ${esc(n.remember)}</p>` : ""}
      </div>`;
    }).join("") : `<p class="muted">Porodica još nije sačuvala zapažanja.</p>`}
    ${d.reviews.length ? `<h2 class="section-title" style="margin:26px 0 14px">Nedeljni osvrti</h2>${d.reviews.slice().reverse().map(r => `
      <div class="note"><div class="meta"><span>${r.week}. nedelja · ${fmtDate(r.review_date)}</span></div>
      ${r.good ? `<p><b>Dobro:</b> ${esc(r.good)}</p>` : ""}${r.hard ? `<p><b>Teško:</b> ${esc(r.hard)}</p>` : ""}${r.next_steps ? `<p><b>Sledeće:</b> ${esc(r.next_steps)}</p>` : ""}</div>`).join("")}` : ""}`;
}

function tabProgram() {
  const d = A.family;
  const f = d.family;
  const progs = d.history;
  const active = progs.find(p => p.status === "active");
  const drafts = progs.filter(p => p.status === "draft");
  const archived = progs.filter(p => p.status === "archived");
  const card = (p, actions) => `
    <div class="panel prog-card">
      <div>
        <p class="eyebrow"><span class="status-dot ${p.status}"></span>${{ active: "Objavljen", draft: "Nacrt", archived: "Prethodni" }[p.status]}</p>
        <h3>${esc(p.title || "Program")}</h3>
        <small class="muted">${p.status === "active" && p.start_date ? `Početak ${fmtDate(p.start_date)} · ` : ""}${p.source_name ? `fajl „${esc(p.source_name)}“ · ` : ""}napravljen ${fmtDate(String(p.created_at).slice(0, 10))}</small>
      </div>
      <div class="prog-actions">${actions}</div>
    </div>`;
  return `
    <a class="upload-cta" href="#/admin/p/${f.id}/novi">${ICON.upload}<div><strong>Novi program</strong><small>Ubacite gotov program ili počnite od praznog. Prethodni program ostaje sačuvan u istoriji.</small></div><span>→</span></a>
    ${active ? card(active, `
      <a class="btn" href="#/admin/p/${f.id}/program/${active.id}">${ICON.edit} Uredi</a>
      <button class="btn-ghost" data-action="preview" data-pid="${active.id}">${ICON.eye} Pregled</button>`) : `<p class="muted" style="margin:18px 0">Porodica još nema objavljen program.</p>`}
    ${drafts.length ? `<h3 class="ed-h">Nacrti</h3>${drafts.map(p => card(p, `
      <a class="btn" href="#/admin/p/${f.id}/program/${p.id}">${ICON.edit} Pregledaj i uredi</a>
      <button class="btn-ghost" data-action="publish" data-pid="${p.id}">Objavi</button>
      <button class="icon-btn danger" data-action="delete-program" data-pid="${p.id}" title="Obriši nacrt">${ICON.trash}</button>`)).join("")}` : ""}
    ${archived.length ? `<h3 class="ed-h">Prethodni programi</h3>${archived.map(p => card(p, `
      <a class="btn" href="#/admin/p/${f.id}/program/${p.id}">${ICON.eye} Otvori</a>
      <button class="btn-ghost" data-action="preview" data-pid="${p.id}">Pregled kao roditelj</button>
      <button class="btn-ghost" data-action="republish" data-pid="${p.id}">Vrati kao aktivan</button>`)).join("")}` : ""}`;
}

function tabPoruke() {
  const d = A.family;
  return `
    <div class="panel chat-panel wide">
      <div class="chat" id="chat">
        ${d.messages.length ? d.messages.map(m => `
          <div class="msg ${m.sender === "owner" ? "me" : "her"}">
            <p>${esc(m.body).replace(/\n/g, "<br>")}</p>
            <small>${m.sender === "family" ? esc(d.family.name) + " · " : "Vi · "}${relTime(m.created_at)}</small>
          </div>`).join("") : `<p class="muted chat-empty">Još nema poruka sa ovom porodicom.</p>`}
      </div>
      <form id="reply-form" class="msg-form">
        <textarea class="input" name="body" rows="3" placeholder="Odgovor porodici…"></textarea>
        <button class="btn" type="submit">${ICON.send} Pošalji</button>
      </form>
    </div>`;
}

function tabPodesavanja() {
  const f = A.family.family;
  return `
    <div class="panel">
      <h2>Pristup za porodicu</h2>
      <div class="code-box">
        <div><small>Kod porodice</small><b>${esc(formCode(f.code))}</b></div>
        <button class="btn-ghost" data-action="copy-link">${ICON.copy} Kopiraj link</button>
        <button class="btn-ghost" data-action="share">${ICON.send} Pošalji poruku sa linkom</button>
      </div>
      <p class="muted" style="margin-top:12px">Link: <span class="mono">${esc(familyLink(f))}</span></p>
      <button class="btn-link" data-action="regen" style="margin-top:8px">Napravi novi kod (stari prestaje da radi)</button>
    </div>
    <form id="family-edit" class="panel" style="margin-top:18px">
      <h2>Podaci</h2>
      <div class="two">
        <div class="field"><label>Naziv porodice</label><input class="input" name="name" value="${esc(f.name)}" required></div>
        <div class="field"><label>Ime deteta / dece</label><input class="input" name="children" value="${esc(f.children)}"></div>
      </div>
      <div class="field"><label>Privatne beleške <small>(vidite samo vi)</small></label><textarea class="input" name="notes" rows="4">${esc(f.notes || "")}</textarea></div>
      <label class="check"><input type="checkbox" name="is_test" ${f.is_test ? "checked" : ""}> Test porodica</label>
      <label class="check"><input type="checkbox" name="archived" ${f.archived ? "checked" : ""}> Arhivirana (program završen – link prestaje da radi)</label>
      <div class="modal-actions"><button class="btn" type="submit">Sačuvaj</button></div>
    </form>
    <div class="panel danger-zone" style="margin-top:18px">
      <h2>Brisanje</h2>
      <p class="muted">Briše porodicu i sve njene programe, zapažanja, poruke i slike. Ne može se vratiti.</p>
      <button class="btn-danger" data-action="delete-family">${ICON.trash} Obriši porodicu</button>
    </div>`;
}

/* ================================================================ NOVI PROGRAM */

function importView() {
  const f = A.family.family;
  if (A.importing) {
    const st = A.importing;
    const pct = st.total ? Math.round((st.done / st.total) * 100) : null;
    return `
      <div class="page-head"><p class="eyebrow">${esc(f.name)}</p><h1>Pravim program…</h1>
      <p class="lead">Ne zatvarajte ovu stranu.</p></div>
      <div class="panel import-progress">
        <div class="spinner"></div>
        <p id="import-label">${esc(st.label)}</p>
        <div class="bar"><i id="import-bar" style="width:${pct ?? 8}%"></i></div>
        <small class="muted">Fajl: ${esc(st.file)}</small>
      </div>`;
  }
  const ai = A.aiConfigured;
  return `
    <div class="page-head">
      <a class="btn-link" href="#/admin/p/${f.id}">← ${esc(f.name)}</a>
      <h1 style="margin-top:12px">Novi program</h1>
      <p class="lead">Ubacite gotov program (.json)${ai === false ? "" : " ili Word / PDF fajl"}, ili počnite od praznog programa. Program se prvo čuva kao nacrt – porodica ga vidi tek kad kliknete „Objavi“.</p>
    </div>
    ${ai === false ? `<div class="notice">${ICON.info} Automatsko čitanje Word/PDF fajlova (AI) nije uključeno. Ubacite gotov program (.json) ili napravite prazan program.</div>` : ""}
    <label class="dropzone" id="dropzone">
      ${ICON.upload}
      <strong>Prevucite fajl ovde ili kliknite da izaberete</strong>
      <small>${ai === false ? "Gotov program (.json)" : "Gotov program (.json), Word (.docx) ili PDF"}</small>
      <input type="file" id="import-file" accept=".json,application/json${ai === false ? "" : ",.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"}" hidden>
    </label>
    <div class="or-row"><span>ili</span></div>
    <button class="btn-ghost btn-lg" data-action="new-empty">${ICON.edit} Napravi prazan program i unesi ga ručno</button>
    <div class="panel tips-panel">
      <h3>Dobro je znati</h3>
      <ul class="clean-list">
        <li>Program se prvo čuva kao <b>nacrt</b> – porodica ga ne vidi dok ne kliknete „Objavi“.</li>
        <li>Pre objave sve možete proveriti i ispraviti, i dodati ili ukloniti ilustracije.</li>
        <li>Kada objavite novi program, prethodni prelazi u istoriju, a sva zapažanja ostaju.</li>
      </ul>
    </div>`;
}

async function runImport(file, rerender) {
  const f = A.family.family;
  A.importing = { label: "Počinjem…", file: file.name, done: 0, total: 0 };
  rerender();
  try {
    const run = /\.json$/i.test(file.name) ? importPackage : importProgram;
    if (run === importProgram && A.aiConfigured === false) throw new Error("Automatsko čitanje Word/PDF fajlova nije uključeno. Ubacite gotov program (.json).");
    const res = await run(file, f.id, st => {
      Object.assign(A.importing, st);
      const l = $("#import-label"), b = $("#import-bar");
      if (l) l.textContent = st.label;
      if (b && st.total) b.style.width = Math.max(8, Math.round((st.done / st.total) * 100)) + "%";
    });
    A.importing = null;
    A.family = null; A.familyId = null;
    if (res.warnings.length) {
      setTimeout(() => openModal(`<h2>Program je napravljen</h2><p class="modal-p">Pregledajte ga pre objave. Napomene:</p><ul>${res.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul><div class="modal-actions"><button class="btn" data-close>U redu</button></div>`), 300);
    } else toast("Program je napravljen. Pregledajte ga i objavite.");
    location.hash = `#/admin/p/${f.id}/program/${res.programId}`;
  } catch (e) {
    A.importing = null;
    rerender();
    openModal(`<h2>Uvoz nije uspeo</h2><p class="modal-p">${esc(e.message)}</p><div class="modal-actions"><button class="btn" data-close>U redu</button></div>`);
  }
}

/* ================================================================ AKCIJE */

async function reloadFamily() {
  A.family = await api.family(A.familyId, false);
  if (A.family.program) A.family.program.content = normalizeContent(A.family.program.content);
}

function publishModal(pid) {
  const hasActive = A.family.history.some(p => p.status === "active" && p.id !== pid);
  openModal(`
    <h2>Objavi program porodici</h2>
    <p class="modal-p">${hasActive ? "Trenutni program prelazi u istoriju (zapažanja ostaju). " : ""}Porodica će odmah videti novi program.</p>
    <form id="publish-form" class="modal-form" data-pid="${pid}">
      <div class="field"><label>Datum početka programa <small>(od njega se računa nedelja)</small></label><input class="input" type="date" name="start_date" value="${todayISO()}" required></div>
      <div class="modal-actions"><button class="btn" type="submit">Objavi</button><button class="btn-link" type="button" data-close>Odustani</button></div>
    </form>`);
}

export async function onClick(e, t, rerender, ctx) {
  try {
    if (t.closest("summary") && t.dataset.ed) e.preventDefault();
    if (t.dataset.ed) {
      const r = editor.onClick(t, rerender);
      if (r === "preview") { await editor.save(); return ctx.preview(editor.current(), A.family.family); }
      if (r === "publish") { await editor.save(); return publishModal(editor.current().id); }
      if (r === "startdate") {
        openModal(`<h2>Datum početka</h2><form id="startdate-form" class="modal-form"><div class="field"><label>Od ovog datuma se računa trenutna nedelja</label><input class="input" type="date" name="start_date" value="${editor.current().start_date || todayISO()}" required></div><div class="modal-actions"><button class="btn" type="submit">Sačuvaj</button></div></form>`);
      }
      return;
    }
    if (t.dataset.atab) { A.tab = t.dataset.atab; return rerender(); }
    const f = A.family && A.family.family;
    switch (t.dataset.action) {
      case "new-family": return newFamilyModal();
      case "new-empty": {
        const r = await createEmptyProgram(f.id, f.children || "");
        A.family = null; A.familyId = null;
        toast("Prazan program je napravljen. Popunite ga i objavite.");
        location.hash = `#/admin/p/${f.id}/program/${r.programId}`;
        return;
      }
      case "toggle-archived": A.showArchived = t.checked; return rerender();
      case "delete-tests": {
        const n = (A.overview || []).filter(x => x.is_test).length;
        if (!confirm(`Obrisati ${n} test porodica i sve njihove podatke? Ovo se ne može vratiti.`)) return;
        const r = await api.deleteTestFamilies();
        toast(`Obrisano: ${r.deleted}`);
        A.overview = await api.overview();
        return rerender();
      }
      case "reset": {
        const email = $("#l-email").value.trim();
        if (!email) return toast("Upišite mejl, pa kliknite ponovo.");
        await requestPasswordReset(email);
        return toast("Poslat je mejl sa linkom za novu šifru.");
      }
      case "logout": await signOut(); location.hash = "#/admin"; return rerender();
      case "share": {
        const text = shareText(f);
        if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* odustao */ } }
        if (await copyText(text)) toast("Poruka sa linkom i kodom je kopirana – nalepite je u Viber.");
        return;
      }
      case "copy-link": if (await copyText(familyLink(f))) toast("Link je kopiran."); return;
      case "regen": {
        if (!confirm("Napraviti novi kod? Stari link i kod prestaju da rade, pa porodici morate poslati novi.")) return;
        const r = await api.regenerateCode(f.id);
        f.code = r.code;
        toast("Novi kod: " + formCode(r.code));
        return rerender();
      }
      case "delete-family": {
        const name = prompt(`Za potvrdu upišite naziv porodice: ${f.name}`);
        if (name === null) return;
        if (name.trim() !== f.name.trim()) return toast("Naziv se ne poklapa – ništa nije obrisano.");
        await api.deleteFamily(f.id);
        A.family = null; A.familyId = null;
        toast("Porodica je obrisana.");
        location.hash = "#/admin";
        return;
      }
      case "report": return openReportWindow(reportHtml(A.family, A.family.program && A.family.program.content, f.name, A.family.program && A.family.program.title));
      case "preview": {
        const p = A.family.history.find(x => x.id === t.dataset.pid);
        const full = A.family.program && A.family.program.id === p.id ? { ...p, content: A.family.program.content } : p;
        if (!full.content) return toast("Sadržaj prethodnog programa nije dostupan. U Supabase SQL Editoru ponovo pokrenite fajl supabase/schema.sql.");
        return ctx.preview(full, f);
      }
      case "publish": return publishModal(t.dataset.pid);
      case "republish": {
        if (!confirm("Vratiti ovaj program kao aktivan? Trenutni prelazi u istoriju.")) return;
        await api.publishProgram(t.dataset.pid, null);
        await reloadFamily();
        toast("Program je ponovo aktivan.");
        return rerender();
      }
      case "delete-program": {
        if (!confirm("Obrisati ovaj nacrt?")) return;
        await api.deleteProgram(t.dataset.pid);
        await reloadFamily();
        return rerender();
      }
    }
  } catch (err) {
    toast(err.message || "Greška.", "error");
    if (err.status === 401) { location.hash = "#/admin"; rerender(); }
  }
}

export function onInput(e) { return editor.onInput(e); }

export async function onChange(e, rerender) {
  if (e.target.id === "import-file" && e.target.files[0]) return runImport(e.target.files[0], rerender);
  if (e.target.dataset.action === "toggle-archived") return;
  return editor.onChange(e, rerender);
}

export function onDrop(e, rerender) {
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if (file) runImport(file, rerender);
}

export async function onSubmit(e, rerender) {
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const btn = form.querySelector("button[type=submit]");
  if (btn) btn.disabled = true;
  try {
    if (form.id === "login-form") {
      await signIn(data.email.trim(), data.password);
      toast("Dobro došli!");
      return rerender();
    }
    if (form.id === "password-form") {
      if (data.p1 !== data.p2) return toast("Šifre se ne poklapaju.");
      await updatePassword(data.p1);
      toast("Šifra je promenjena.");
      location.hash = "#/admin";
      return;
    }
    if (form.id === "family-form") {
      const r = await api.saveFamily({ name: data.name, children: data.children || "", is_test: Boolean(data.is_test) });
      closeModal();
      toast("Porodica je napravljena. Sada ubacite program.");
      A.tab = "program";
      location.hash = `#/admin/p/${r.id}/novi`;
      return;
    }
    if (form.id === "family-edit") {
      await api.saveFamily({ id: A.family.family.id, name: data.name, children: data.children || "", notes: data.notes || "", is_test: Boolean(data.is_test), archived: Boolean(data.archived) });
      await reloadFamily();
      toast("Sačuvano.");
      return rerender();
    }
    if (form.id === "reply-form") {
      const body = (data.body || "").trim();
      if (!body) return;
      const m = await api.reply(A.family.family.id, body);
      A.family.messages.push(m);
      return rerender();
    }
    if (form.id === "publish-form") {
      await api.publishProgram(form.dataset.pid, data.start_date);
      closeModal();
      await reloadFamily();
      toast("Program je objavljen. Porodica ga već vidi.");
      A.tab = "program";
      location.hash = `#/admin/p/${A.family.family.id}`;
      return rerender();
    }
    if (form.id === "startdate-form") {
      await api.saveProgram({ id: editor.current().id, start_date: data.start_date });
      editor.current().start_date = data.start_date;
      closeModal();
      toast("Datum početka je sačuvan.");
      return rerender();
    }
  } catch (err) {
    toast(err.message || "Greška.", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

export function beforeLeave() {
  if (editor.isDirty()) editor.save();
}

export const familyName = () => (A.family ? A.family.family.name : "");
