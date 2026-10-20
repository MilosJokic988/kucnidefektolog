/* Uvoz programa iz Word/PDF dokumenta: čitanje → AI → nacrt programa u bazi. */

import { extractDocument, redactPersonalData, compressImage } from "./extract.js";
import { ai, admin } from "./api.js";
import { normalizeContent } from "./program.js";
import { rememberImage } from "./images.js";

const BATCH = 4;
const CONCURRENCY = 4;

async function pool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function withRetry(fn, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (e.status === 401 || e.status === 400) break; }
  }
  throw last;
}

/**
 * @param {File} file
 * @param {string} familyId
 * @param {(step:{label:string, done?:number, total?:number})=>void} onStatus
 * @returns {Promise<{programId:string, warnings:string[]}>}
 */
export async function importProgram(file, familyId, onStatus = () => {}) {
  const warnings = [];

  // 1) čitanje dokumenta
  onStatus({ label: "Čitam dokument…" });
  const doc = await extractDocument(file, msg => onStatus({ label: msg }));
  const text = redactPersonalData(doc.text);
  if (text.length < 500) throw new Error("U dokumentu nije pronađeno dovoljno teksta. Ako je PDF skeniran (slika), sačuvajte ga iz Word-a kao PDF ili pošaljite Word fajl.");

  // 2) kostur programa
  onStatus({ label: "AI čita program i pravi pregled (oko 1 minut)…" });
  const index = await withRetry(() => ai("index", text));
  if (!index.activities || !index.activities.length) warnings.push("AI nije pronašao nijednu aktivnost – proverite dokument.");

  // 3) ostali delovi paralelno
  const batches = [];
  for (let i = 0; i < index.activities.length; i += BATCH) batches.push(index.activities.slice(i, i + BATCH));
  const total = batches.length + 2;
  let done = 0;
  const tick = label => { done++; onStatus({ label, done, total }); };
  onStatus({ label: "Prenosim procenu, aktivnosti i rutine…", done: 0, total });

  const tasks = [
    () => withRetry(() => ai("assessment", text)).then(r => { tick("Procena prenesena"); return r; }).catch(e => { warnings.push("Procena nije prenesena: " + e.message); tick("Procena – greška"); return null; }),
    () => withRetry(() => ai("routines", text)).then(r => { tick("Rutine i vodič preneseni"); return r; }).catch(e => { warnings.push("Rutine i vodič nisu preneseni: " + e.message); tick("Rutine – greška"); return null; }),
    ...batches.map((items, bi) => () => withRetry(() => ai("activities", text, items))
      .then(r => { tick(`Aktivnosti ${bi * BATCH + 1}–${bi * BATCH + items.length}`); return r; })
      .catch(e => { warnings.push(`Aktivnosti ${items.map(a => a.code).join(", ")} nisu potpuno prenesene: ${e.message}`); tick("Aktivnosti – greška"); return null; })),
  ];
  const [assessment, routines, ...actResults] = await pool(tasks, CONCURRENCY);

  // 4) spajanje
  const details = [];
  actResults.forEach(r => r && Array.isArray(r.activities) && details.push(...r.activities));
  const norm = s => String(s || "").toLowerCase().replace(/[^a-zšđčćž0-9]/g, "");
  const activities = index.activities.map(base => {
    const d = details.find(x => String(x.code) === String(base.code)) || details.find(x => norm(x.title) === norm(base.title)) || {};
    return { ...d, code: base.code, title: base.title || d.title, areaId: base.areaId, weeks: base.weeks, imageNumbers: d.imageNumbers || [] };
  });

  const content = normalizeContent({
    title: index.title, childNames: index.childNames, durationWeeks: index.durationWeeks, intro: index.intro,
    areas: index.areas, weeks: index.weeks, activities,
    assessment: assessment && assessment.assessment, goals: assessment && assessment.goals,
    ...(routines || {}),
  });
  // brojevi slika (privremeno) – zamenjuju se pravim ID-jevima posle čuvanja
  content.activities.forEach((a, i) => { a._imageNumbers = (activities[i].imageNumbers || []).map(Number); });

  // 5) nacrt u bazi
  onStatus({ label: "Čuvam nacrt programa…" });
  const saved = await admin.saveProgram({ family_id: familyId, title: content.title || file.name, content: stripTemp(content), source_name: file.name });

  // 6) slike koje pripadaju aktivnostima
  const used = [...new Set(content.activities.flatMap(a => a._imageNumbers))].filter(n => doc.images.some(img => img.n === n));
  const idByNumber = {};
  for (let k = 0; k < used.length; k++) {
    onStatus({ label: `Čuvam ilustracije (${k + 1} od ${used.length})…`, done: k, total: used.length });
    const img = doc.images.find(x => x.n === used[k]);
    try {
      const c = await compressImage(img.blob);
      const r = await admin.addImage({ program_id: saved.id, data: c.dataUrl, mime: c.mime, width: c.width, height: c.height });
      idByNumber[used[k]] = r.id;
      rememberImage(r.id, c.dataUrl);
    } catch (e) {
      warnings.push(`Ilustracija ${used[k]} nije sačuvana.`);
    }
  }
  content.activities.forEach(a => { a.imageIds = a._imageNumbers.map(n => idByNumber[n]).filter(Boolean); });
  await admin.saveProgram({ id: saved.id, content: stripTemp(content) });

  const missingSteps = content.activities.filter(a => !a.steps.length).map(a => a.title);
  if (missingSteps.length) warnings.push(`Bez koraka (proverite): ${missingSteps.slice(0, 5).join(", ")}${missingSteps.length > 5 ? "…" : ""}`);
  onStatus({ label: "Gotovo!", done: 1, total: 1 });
  return { programId: saved.id, warnings, images: { total: doc.images.length, used: Object.keys(idByNumber).length } };
}

function stripTemp(content) {
  return { ...content, activities: content.activities.map(({ _imageNumbers, ...a }) => a) };
}

/* ------------------------------------------------------------------
   Uvoz gotovog programa (.json) – bez AI-ja.
   Format: { format: "kucni-defektolog-program", version: 1, content: {...},
             images: { "<ref>": "data:image/jpeg;base64,..." } }
   Aktivnosti slike navode u polju imageRefs: ["<ref>", ...]. */

export const PACKAGE_FORMAT = "kucni-defektolog-program";

export async function importPackage(file, familyId, onStatus = () => {}) {
  onStatus({ label: "Čitam fajl…" });
  let pkg;
  try { pkg = JSON.parse(await file.text()); } catch { throw new Error("Fajl nije ispravan program (.json)."); }
  if (!pkg || pkg.format !== PACKAGE_FORMAT || !pkg.content) throw new Error("Ovo nije program za aplikaciju Kućni defektolog.");
  const refsByActivity = (pkg.content.activities || []).map(a => (Array.isArray(a.imageRefs) ? a.imageRefs.map(String) : []));
  const content = normalizeContent(pkg.content);

  onStatus({ label: "Čuvam nacrt programa…" });
  const saved = await admin.saveProgram({ family_id: familyId, title: content.title || "Program", content, source_name: file.name });

  const images = pkg.images || {};
  const used = [...new Set(refsByActivity.flat())].filter(r => typeof images[r] === "string" && images[r].startsWith("data:image/"));
  const idByRef = {};
  const warnings = [];
  for (let k = 0; k < used.length; k++) {
    onStatus({ label: `Čuvam ilustracije (${k + 1} od ${used.length})…`, done: k, total: used.length });
    const data = images[used[k]];
    try {
      const r = await admin.addImage({ program_id: saved.id, data, mime: data.slice(5, data.indexOf(";")) || "image/jpeg" });
      idByRef[used[k]] = r.id;
      rememberImage(r.id, data);
    } catch { warnings.push(`Ilustracija ${used[k]} nije sačuvana.`); }
  }
  content.activities.forEach((a, i) => { a.imageIds = (refsByActivity[i] || []).map(r => idByRef[r]).filter(Boolean); });
  await admin.saveProgram({ id: saved.id, content });
  onStatus({ label: "Gotovo!", done: 1, total: 1 });
  return { programId: saved.id, warnings };
}

/* Prazan program za ručni unos. */
export async function createEmptyProgram(familyId, childNames = "") {
  const content = normalizeContent({
    title: "Novi program", childNames, durationWeeks: 4,
    areas: [{ id: "1", title: "Prva oblast", intro: "" }],
    weeks: [1, 2, 3, 4].map(n => ({ label: `${n}. nedelja`, fromWeek: n, toWeek: n, title: "", focus: "", summary: "" })),
    activities: [{ code: "1.1", title: "Prva aktivnost", areaId: "1", weeks: [1], steps: [] }],
  });
  const saved = await admin.saveProgram({ family_id: familyId, title: content.title, content, source_name: "" });
  return { programId: saved.id };
}
