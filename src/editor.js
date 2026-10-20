/* Uređivanje programa (nacrta ili objavljenog) – sve što je AI preneo
   Dragana može da proveri i ispravi pre objave. */

import { admin } from "./api.js";
import { esc, toast, ICON, fmtDate, todayISO, $, $$ } from "./util.js";
import { normalizeContent } from "./program.js";
import { compressImage } from "./extract.js";
import { hydrateImages, rememberImage } from "./images.js";

const E = { program: null, family: null, tab: "osnovno", saving: false, dirty: false, timer: null, open: new Set() };

export function setProgram(program, family) {
  E.program = { ...program, content: normalizeContent(program.content) };
  E.family = family;
  E.dirty = false;
  E.open = new Set();
}
export const current = () => E.program;
export const isDirty = () => E.dirty;
export const imgFetcher = ids => admin.images(ids);

/* ---------------------------------------------------------------- polja */

const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
function set(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

function field(path, label, type = "text", hint = "") {
  const v = get(E.program.content, path);
  const id = "f-" + path.replace(/\./g, "-");
  let input;
  if (type === "textarea" || type === "md") input = `<textarea class="input" id="${id}" data-path="${path}" data-type="text" rows="${type === "md" ? 6 : 3}">${esc(v || "")}</textarea>`;
  else if (type === "lines") input = `<textarea class="input" id="${id}" data-path="${path}" data-type="lines" rows="${Math.min(12, Math.max(3, (v || []).length + 1))}">${esc((v || []).join("\n"))}</textarea>`;
  else if (type === "number") input = `<input class="input" id="${id}" type="number" min="1" max="52" data-path="${path}" data-type="number" value="${esc(v)}">`;
  else if (type === "weeks") input = `<input class="input" id="${id}" data-path="${path}" data-type="weeks" value="${esc((v || []).join(", "))}" placeholder="npr. 1, 2">`;
  else input = `<input class="input" id="${id}" data-path="${path}" data-type="text" value="${esc(v || "")}">`;
  return `<div class="field"><label for="${id}">${esc(label)}${hint ? ` <small>${esc(hint)}</small>` : ""}</label>${input}</div>`;
}

const listTools = (path, i, len) => `
  <span class="ed-tools">
    <button type="button" class="icon-btn" data-ed="up" data-path="${path}" data-i="${i}" ${i === 0 ? "disabled" : ""} title="Gore">↑</button>
    <button type="button" class="icon-btn" data-ed="down" data-path="${path}" data-i="${i}" ${i === len - 1 ? "disabled" : ""} title="Dole">↓</button>
    <button type="button" class="icon-btn danger" data-ed="remove" data-path="${path}" data-i="${i}" title="Obriši">${ICON.trash}</button>
  </span>`;

const TEMPLATES = {
  areas: () => ({ id: String(Date.now() % 1000), title: "Nova oblast", intro: "" }),
  weeks: () => { const n = (E.program.content.weeks.at(-1)?.toWeek || 0) + 1; return { label: `${n}. nedelja`, fromWeek: n, toWeek: n, title: "", focus: "", summary: "" }; },
  activities: () => ({ code: String(E.program.content.activities.length + 1), title: "Nova aktivnost", areaId: E.program.content.areas[0]?.id || "", weeks: [], goal: "", materials: [], frequency: "", steps: [], levels: [], adapt: "", parentTracks: [], develops: "", note: "", imageIds: [], video: "" }),
  "assessment.areas": () => ({ title: "Nova oblast procene", text: "", strengths: [], needs: [], parentTracks: [] }),
  goals: () => ({ area: "", goal: "", outcomes: [] }),
  principles: () => ({ title: "", text: "" }),
  routines: () => ({ title: "Nova rutina", focus: "", text: "", activityTitles: [], parentTracks: [], note: "" }),
  sections: () => ({ title: "Novo poglavlje", body: "" }),
};

/* ---------------------------------------------------------------- render */

export function render() {
  const p = E.program;
  const c = p.content;
  const tabs = [
    ["osnovno", "Osnovno"], ["nedelje", `Nedelje (${(c.weeks.length || c.durationWeeks)})`], ["aktivnosti", `Aktivnosti (${c.activities.length})`],
    ["procena", "Procena i ciljevi"], ["rutine", "Rutine i vodič"],
  ];
  const status = { draft: "Nacrt – roditelji ga još ne vide", active: "Objavljen – roditelji ga vide", archived: "Arhiviran (prethodni program)" }[p.status] || "";
  return `
    <div class="page-head">
      <a class="btn-link" href="#/admin/p/${E.family.id}">← ${esc(E.family.name)}</a>
      <h1 style="margin-top:12px">${esc(c.title || p.title || "Program")}</h1>
      <p class="lead"><span class="status-dot ${p.status}"></span>${status}${p.source_name ? ` · iz fajla „${esc(p.source_name)}“` : ""}</p>
    </div>
    <div class="editor-bar">
      <span class="save-state" id="save-state">${E.dirty ? "Nesačuvane izmene…" : "Sve izmene su sačuvane"}</span>
      <span class="spacer"></span>
      <button class="btn-ghost" data-ed="preview">${ICON.eye} Pregled kao roditelj</button>
      ${p.status !== "active" ? `<button class="btn" data-ed="publish">Objavi porodici</button>` : `<button class="btn-ghost" data-ed="startdate">${ICON.calendar} Početak: ${p.start_date ? fmtDate(p.start_date) : "—"}</button>`}
    </div>
    <div class="chips tabs">${tabs.map(([k, l]) => `<button class="chip ${E.tab === k ? "active" : ""}" data-ed="tab" data-tab-id="${k}">${esc(l)}</button>`).join("")}</div>
    <div class="editor" id="editor">${renderTab()}</div>`;
}

function renderTab() {
  const c = E.program.content;
  if (E.tab === "osnovno") {
    return `
      <div class="panel">
        ${field("title", "Naslov programa (vide ga roditelji)")}
        <div class="two">${field("childNames", "Ime deteta / dece")}${field("durationWeeks", "Trajanje (nedelja)", "number")}</div>
        ${field("intro", "Dobrodošlica na početnoj strani", "textarea")}
        ${field("motto", "Moto")}
      </div>
      <h3 class="ed-h">Oblasti programa</h3>
      ${c.areas.map((a, i) => `
        <div class="panel ed-item">
          <div class="ed-item-head"><b>${esc(a.title || "Oblast")}</b>${listTools("areas", i, c.areas.length)}</div>
          <div class="two">${field(`areas.${i}.title`, "Naziv oblasti")}${field(`areas.${i}.id`, "Oznaka", "text", "povezuje aktivnosti")}</div>
          ${field(`areas.${i}.intro`, "Kratak opis", "textarea")}
        </div>`).join("")}
      <button class="btn-ghost" data-ed="add" data-path="areas">${ICON.plus} Dodaj oblast</button>`;
  }
  if (E.tab === "nedelje") {
    return `
      <p class="muted">Kojim aktivnostima pripada koja nedelja podešava se u kartici „Aktivnosti“ (polje „Nedelje“).</p>
      ${c.weeks.map((w, i) => `
        <div class="panel ed-item">
          <div class="ed-item-head"><b>${esc(w.label)}</b>${listTools("weeks", i, c.weeks.length)}</div>
          <div class="three">${field(`weeks.${i}.label`, "Oznaka")}${field(`weeks.${i}.fromWeek`, "Od nedelje", "number")}${field(`weeks.${i}.toWeek`, "Do nedelje", "number")}</div>
          <div class="two">${field(`weeks.${i}.title`, "Kratak naziv")}${field(`weeks.${i}.focus`, "Glavni fokus")}</div>
          ${field(`weeks.${i}.summary`, "Šta radimo", "textarea")}
        </div>`).join("")}
      <button class="btn-ghost" data-ed="add" data-path="weeks">${ICON.plus} Dodaj nedelju</button>`;
  }
  if (E.tab === "aktivnosti") {
    return `
      <p class="muted">Kliknite na aktivnost da je otvorite. Koraci, stavke „Šta pratimo“ i materijal pišu se jedan po redu.</p>
      ${c.activities.map((a, i) => `
        <details class="panel ed-item ed-act" data-open-key="act-${i}" ${E.open.has("act-" + i) ? "open" : ""}>
          <summary>
            <span class="ed-act-sum">${a.imageIds[0] ? `<span class="ed-thumb img-wrap"><img data-img="${esc(a.imageIds[0])}" alt=""></span>` : `<span class="ed-thumb empty"></span>`}
            <span><small>${esc(a.code)} · ${esc((c.areas.find(x => x.id === a.areaId) || {}).title || "bez oblasti")} · nedelje: ${esc(a.weeks.join(", ") || "—")}</small><b>${esc(a.title)}</b>
            ${!a.steps.length ? `<em class="warn">nema koraka</em>` : ""}</span></span>
            ${listTools("activities", i, c.activities.length)}
          </summary>
          <div class="ed-body">
            <div class="three">${field(`activities.${i}.code`, "Oznaka")}${areaSelect(i)}${field(`activities.${i}.weeks`, "Nedelje", "weeks")}</div>
            ${field(`activities.${i}.title`, "Naziv")}
            ${field(`activities.${i}.goal`, "Cilj aktivnosti", "textarea")}
            <div class="two">${field(`activities.${i}.materials`, "Potrebno", "lines", "jedno po redu")}${field(`activities.${i}.frequency`, "Kada / koliko često", "textarea")}</div>
            ${field(`activities.${i}.steps`, "Koraci", "lines", "jedan korak po redu")}
            ${field(`activities.${i}.parentTracks`, "Šta roditelj prati", "lines", "jedno po redu")}
            <div class="two">${field(`activities.${i}.develops`, "Šta razvijamo", "textarea")}${field(`activities.${i}.note`, "Važna napomena", "textarea")}</div>
            ${field(`activities.${i}.adapt`, "Kako prilagoditi", "textarea")}
            ${a.levels.length ? `<div class="field"><label>Nivoi</label>${a.levels.map(l => `<p class="muted"><b>${esc(l.name)}:</b> ${esc(l.text)}</p>`).join("")}</div>` : ""}
            ${field(`activities.${i}.video`, "Link ka video-prikazu", "text", "opciono, npr. YouTube")}
            <div class="field"><label>Ilustracije</label>
              <div class="ed-images">
                ${a.imageIds.map((id, k) => `<span class="ed-img img-wrap"><img data-img="${esc(id)}" alt=""><button type="button" data-ed="img-remove" data-i="${i}" data-k="${k}" title="Ukloni">×</button></span>`).join("")}
                <label class="ed-img add">${ICON.plus}<input type="file" accept="image/*" data-ed-upload="${i}" hidden></label>
              </div>
            </div>
          </div>
        </details>`).join("")}
      <button class="btn-ghost" data-ed="add" data-path="activities">${ICON.plus} Dodaj aktivnost</button>`;
  }
  if (E.tab === "procena") {
    const as = c.assessment;
    return `
      <div class="panel">
        ${field("assessment.summary", "Kratak sažetak za roditelje", "textarea")}
        ${field("assessment.intro", "Uvod / važna napomena", "md")}
      </div>
      <h3 class="ed-h">Oblasti procene</h3>
      ${as.areas.map((a, i) => `
        <details class="panel ed-item" data-open-key="as-${i}" ${E.open.has("as-" + i) ? "open" : ""}>
          <summary><b>${esc(a.title || "Oblast")}</b>${listTools("assessment.areas", i, as.areas.length)}</summary>
          <div class="ed-body">
            ${field(`assessment.areas.${i}.title`, "Naziv")}
            ${field(`assessment.areas.${i}.text`, "Opis funkcionisanja", "md")}
            <div class="three">${field(`assessment.areas.${i}.strengths`, "Očuvane sposobnosti", "lines")}${field(`assessment.areas.${i}.needs`, "Potrebe za podrškom", "lines")}${field(`assessment.areas.${i}.parentTracks`, "Šta roditelj prati", "lines")}</div>
          </div>
        </details>`).join("")}
      <button class="btn-ghost" data-ed="add" data-path="assessment.areas">${ICON.plus} Dodaj oblast procene</button>
      <div class="panel" style="margin-top:18px">
        ${field("assessment.keyPoints", "Ključne tačke", "lines")}
        ${field("assessment.conclusion", "Zaključak procene", "md")}
      </div>
      <h3 class="ed-h">Ciljevi razvoja</h3>
      ${c.goals.map((g, i) => `
        <div class="panel ed-item">
          <div class="ed-item-head"><b>${esc(g.area || "Cilj")}</b>${listTools("goals", i, c.goals.length)}</div>
          ${field(`goals.${i}.area`, "Oblast")}${field(`goals.${i}.goal`, "Funkcionalni cilj", "textarea")}${field(`goals.${i}.outcomes`, "Ishodi", "lines")}
        </div>`).join("")}
      <button class="btn-ghost" data-ed="add" data-path="goals">${ICON.plus} Dodaj cilj</button>`;
  }
  // rutine i vodič
  return `
    <h3 class="ed-h">Pravila za roditelje</h3>
    ${c.principles.map((x, i) => `
      <div class="panel ed-item"><div class="ed-item-head"><b>${esc(x.title || "Pravilo")}</b>${listTools("principles", i, c.principles.length)}</div>
      <div class="two">${field(`principles.${i}.title`, "Strategija")}${field(`principles.${i}.text`, "Kako je primenjujemo", "textarea")}</div></div>`).join("")}
    <button class="btn-ghost" data-ed="add" data-path="principles">${ICON.plus} Dodaj pravilo</button>
    <h3 class="ed-h">Rutine – podrška kroz dan</h3>
    ${c.routines.map((r, i) => `
      <details class="panel ed-item" data-open-key="rt-${i}" ${E.open.has("rt-" + i) ? "open" : ""}>
        <summary><b>${esc(r.title || "Rutina")}</b>${listTools("routines", i, c.routines.length)}</summary>
        <div class="ed-body">
          <div class="two">${field(`routines.${i}.title`, "Naziv")}${field(`routines.${i}.focus`, "Fokus")}</div>
          ${field(`routines.${i}.text`, "Kako to izgleda u svakodnevici", "md")}
          <div class="two">${field(`routines.${i}.activityTitles`, "Koristimo aktivnosti", "lines")}${field(`routines.${i}.parentTracks`, "Šta pratimo", "lines")}</div>
          ${field(`routines.${i}.note`, "Napomena", "textarea")}
        </div>
      </details>`).join("")}
    <button class="btn-ghost" data-ed="add" data-path="routines">${ICON.plus} Dodaj rutinu</button>
    <h3 class="ed-h">Vodič za roditelje (ostala poglavlja)</h3>
    ${c.sections.map((x, i) => `
      <details class="panel ed-item" data-open-key="sc-${i}" ${E.open.has("sc-" + i) ? "open" : ""}>
        <summary><b>${esc(x.title || "Poglavlje")}</b>${listTools("sections", i, c.sections.length)}</summary>
        <div class="ed-body">${field(`sections.${i}.title`, "Naslov")}${field(`sections.${i}.body`, "Sadržaj", "md")}</div>
      </details>`).join("")}
    <button class="btn-ghost" data-ed="add" data-path="sections">${ICON.plus} Dodaj poglavlje</button>
    <div class="panel" style="margin-top:18px">
      ${field("encouragements", "Poruke ohrabrenja", "lines", "jedna po redu")}
      ${field("closingMessage", "Završna poruka roditeljima", "md")}
    </div>`;
}

function areaSelect(i) {
  const c = E.program.content;
  const v = c.activities[i].areaId;
  return `<div class="field"><label>Oblast</label><select class="input" data-path="activities.${i}.areaId" data-type="text">
    ${c.areas.map(a => `<option value="${esc(a.id)}" ${a.id === v ? "selected" : ""}>${esc(a.title)}</option>`).join("")}
    <option value="" ${!v ? "selected" : ""}>— bez oblasti —</option></select></div>`;
}

export function afterRender(root) {
  hydrateImages(root, imgFetcher);
  $$("details[data-open-key]", root).forEach(d => d.addEventListener("toggle", () => { d.open ? E.open.add(d.dataset.openKey) : E.open.delete(d.dataset.openKey); }));
}

/* ---------------------------------------------------------------- izmene */

function markDirty() {
  E.dirty = true;
  const s = $("#save-state");
  if (s) s.textContent = "Nesačuvane izmene…";
  clearTimeout(E.timer);
  E.timer = setTimeout(save, 1200);
}

export async function save() {
  clearTimeout(E.timer);
  if (!E.dirty || E.saving) return;
  E.saving = true;
  const s = $("#save-state");
  try {
    if (s) s.textContent = "Čuvam…";
    const c = E.program.content;
    await admin.saveProgram({ id: E.program.id, title: c.title, content: c });
    E.dirty = false;
    if (s) s.textContent = "Sve izmene su sačuvane";
  } catch (e) {
    if (s) s.textContent = "Nije sačuvano – " + e.message;
    toast("Izmene nisu sačuvane: " + e.message, "error");
  } finally {
    E.saving = false;
    if (E.dirty) E.timer = setTimeout(save, 2000);
  }
}

export function onInput(e) {
  const el = e.target;
  if (!el.dataset.path) return false;
  let v = el.value;
  if (el.dataset.type === "lines") v = v.split("\n").map(x => x.trim()).filter(Boolean);
  else if (el.dataset.type === "number") v = Math.max(1, parseInt(v, 10) || 1);
  else if (el.dataset.type === "weeks") v = v.split(/[,\s]+/).map(Number).filter(n => n > 0);
  set(E.program.content, el.dataset.path, v);
  markDirty();
  return true;
}

export async function onChange(e, rerender) {
  const el = e.target;
  if (el.dataset.edUpload !== undefined && el.files[0]) {
    const i = Number(el.dataset.edUpload);
    try {
      toast("Čuvam sliku…");
      const c = await compressImage(el.files[0]);
      const r = await admin.addImage({ program_id: E.program.id, data: c.dataUrl, mime: c.mime, width: c.width, height: c.height });
      rememberImage(r.id, c.dataUrl);
      E.program.content.activities[i].imageIds.push(r.id);
      markDirty();
      rerender();
    } catch (err) { toast("Slika nije sačuvana: " + err.message, "error"); }
    return true;
  }
  if (el.tagName === "SELECT" && el.dataset.path) { onInput(e); return true; }
  return false;
}

/* Vraća: "preview" | "publish" | "startdate" | null (sve ostalo obradi sam) */
export function onClick(t, rerender) {
  const act = t.dataset.ed;
  if (!act) return null;
  const c = E.program.content;
  if (act === "tab") { E.tab = t.dataset.tabId; rerender(); return "handled"; }
  if (act === "preview" || act === "publish" || act === "startdate") return act;
  const path = t.dataset.path;
  if (act === "add") {
    const list = get(c, path);
    list.push(TEMPLATES[path]());
    if (path === "activities") E.open.add("act-" + (list.length - 1));
    markDirty(); rerender(); return "handled";
  }
  const i = Number(t.dataset.i);
  if (act === "remove") {
    const list = get(c, path);
    const name = list[i] && (list[i].title || list[i].label || list[i].area || "stavku");
    if (!confirm(`Obrisati „${name}“?`)) return "handled";
    list.splice(i, 1);
    E.open.clear();
    markDirty(); rerender(); return "handled";
  }
  if (act === "up" || act === "down") {
    const list = get(c, path);
    const j = act === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return "handled";
    [list[i], list[j]] = [list[j], list[i]];
    E.open.clear();
    markDirty(); rerender(); return "handled";
  }
  if (act === "img-remove") {
    c.activities[Number(t.dataset.i)].imageIds.splice(Number(t.dataset.k), 1);
    markDirty(); rerender(); return "handled";
  }
  return null;
}

export function today() { return todayISO(); }
