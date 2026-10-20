/* Zajedničke pomoćne funkcije: tekst, datumi, ikonice, ilustracije, modal, poruke. */

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = (s = "") => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Jednostavan i bezbedan markdown: pasusi, liste, **podebljano**, ### naslovi. */
export function md(text = "") {
  const lines = esc(String(text || "")).replace(/\r/g, "").split("\n");
  const out = [];
  let list = null;
  let para = [];
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if (!line) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^#{1,4}\s+(.*)$/))) { flushPara(); flushList(); out.push(`<h4>${inline(m[1])}</h4>`); continue; }
    if ((m = line.match(/^(?:[-•*✓✔]|&gt;)\s+(.*)$/))) { flushPara(); if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; } list.items.push(m[1]); continue; }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return out.join("");
}

/* ---------- Datumi ---------- */
export const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayISO = () => isoOf(new Date());
export const fmtDate = iso => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${+d}.${+m}.${y}.`; };
export const DANI = ["nedelja", "ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota"];
export const MESECI = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];
export const longToday = () => { const d = new Date(); return `${DANI[d.getDay()]}, ${d.getDate()}. ${MESECI[d.getMonth()]}`; };
export const parseISO = iso => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
export function relTime(ts) {
  if (!ts) return "nikad";
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "upravo sada";
  if (diff < 3600) return `pre ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `pre ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  if (d === 1) return "juče";
  if (d < 7) return `pre ${d} dana`;
  return fmtDate(isoOf(new Date(ts)));
}
export const lastDays = n => { const out = []; const d = new Date(); for (let k = n - 1; k >= 0; k--) out.push(isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() - k))); return out; };

/* ---------- Poruke i modal ---------- */
export function toast(msg, kind = "") {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "toast show " + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = "toast"), kind === "error" ? 4500 : 2400);
}

let onModalClose = null;
export function openModal(html, extraClass = "", onClose = null) {
  const card = $("#modal-card");
  card.className = "modal-card " + extraClass;
  card.innerHTML = `<button class="modal-close" data-close aria-label="Zatvori">×</button>` + html;
  $("#modal").hidden = false;
  document.body.style.overflow = "hidden";
  onModalClose = onClose;
}
export function closeModal() {
  if ($("#modal").hidden) return;
  $("#modal").hidden = true;
  document.body.style.overflow = "";
  const cb = onModalClose;
  onModalClose = null;
  if (cb) cb();
}
export const modalOpen = () => !$("#modal").hidden;

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}

export function download(name, content, type = "text/plain;charset=utf-8") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const formCode = c => { const s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return s.length === 8 ? s.slice(0, 4) + "-" + s.slice(4) : s; };

/* ---------- Ikonice ---------- */
export const ICON = {
  leaf: `<svg class="ico" viewBox="0 0 24 24"><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/></svg>`,
  home: `<svg class="ico" viewBox="0 0 24 24"><path d="M4 11 12 4.5l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/></svg>`,
  note: `<svg class="ico" viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/></svg>`,
  heart: `<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>`,
  info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7a8279" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>`,
  print: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><rect x="7" y="13" width="10" height="7"/></svg>`,
  copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>`,
  download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>`,
  upload: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V5M7 9l5-5 5 5M5 20h14"/></svg>`,
  calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>`,
  send: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12 20 4l-6 16-3-7z"/></svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.8 0 4.8 1.6 5.5 4.6"/></svg>`,
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>`,
  edit: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`,
  link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>`,
  logout: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/></svg>`,
  eye: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  chat: `<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>`,
  book: `<svg viewBox="0 0 24 24"><path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1V19c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6.5V20"/></svg>`,
  grid: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><rect x="14" y="14" width="6" height="6" rx="1.2"/></svg>`,
  doc: `<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/></svg>`,
  people: `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.8 0 4.8 1.6 5.5 4.6"/></svg>`,
};

/* ---------- Ilustracije po oblastima ---------- */
const ART_LIST = [
  `<svg viewBox="0 0 100 80"><g stroke="#4f6b55" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M30 8l4 5M50 6v6M70 8l-4 5"/><path d="M22 24c10-4 20-3 28 2v40c-8-5-18-6-28-2z" fill="#fbf8ef"/><path d="M78 24c-10-4-20-3-28 2v40c8-5 18-6 28-2z" fill="#fbf8ef"/><path d="M27 31c7-2 13-1 18 2M27 37c7-2 13-1 18 2M56 33c5-3 11-4 17-2M56 39c5-3 11-4 17-2"/></g><path d="M30 56l6-10 6 10z" fill="#7d9a7b"/><circle cx="64" cy="51" r="6" fill="#d5a24c"/><ellipse cx="50" cy="74" rx="26" ry="3" fill="#7d9a7b" opacity=".25"/></svg>`,
  `<svg viewBox="0 0 100 80"><path d="M14 18l2-6 2 6 6 2-6 2-2 6-2-6-6-2z" fill="#d5a24c"/><path d="M38 22l38-8v38" stroke="#5f7d61" stroke-width="5" fill="none"/><path d="M38 22v42" stroke="#5f7d61" stroke-width="5"/><path d="M38 30l38-8" stroke="#5f7d61" stroke-width="5"/><ellipse cx="31" cy="64" rx="9" ry="7" fill="#5f7d61"/><ellipse cx="69" cy="54" rx="9" ry="7" fill="#5f7d61"/><path d="M84 46c3 3 3 9 0 12M89 43c5 5 5 13 0 18" stroke="#d5a24c" stroke-width="1.6" fill="none"/><ellipse cx="50" cy="76" rx="26" ry="3" fill="#7d9a7b" opacity=".25"/></svg>`,
  `<svg viewBox="0 0 100 80"><path d="M27 15l4 4 4-5 4 5 4-4-1 7H28z" fill="#d5a24c"/><circle cx="35" cy="31" r="10" fill="#f6e9c9"/><circle cx="31.5" cy="30" r="1" fill="#3a463f"/><circle cx="38.5" cy="30" r="1" fill="#3a463f"/><path d="M32 34q3 2 6 0" stroke="#3a463f" stroke-width="1" fill="none"/><rect x="24" y="42" width="22" height="30" rx="11" fill="#6f8a6c"/><circle cx="63" cy="37" r="9" fill="#f6e9c9"/><circle cx="60" cy="36" r="1" fill="#3a463f"/><circle cx="66" cy="36" r="1" fill="#3a463f"/><path d="M60 40q3 2 6 0" stroke="#3a463f" stroke-width="1" fill="none"/><rect x="53" y="47" width="20" height="25" rx="10" fill="#c98b6b"/><rect x="54" y="12" width="13" height="8" rx="4" fill="#fff"/><circle cx="57.5" cy="16" r=".9" fill="#7a8279"/><circle cx="60.5" cy="16" r=".9" fill="#7a8279"/><circle cx="63.5" cy="16" r=".9" fill="#7a8279"/><ellipse cx="49" cy="75" rx="28" ry="3" fill="#7d9a7b" opacity=".25"/></svg>`,
  `<svg viewBox="0 0 100 80"><circle cx="50" cy="40" r="22" fill="#e9b45c"/><g stroke="#e9b45c" stroke-width="3" stroke-linecap="round"><path d="M50 8v6M50 66v6M18 40h6M76 40h6M27 17l4 4M69 59l4 4M27 63l4-4M69 21l4-4"/></g><path d="M41 40q9 8 18 0" stroke="#7a5a2e" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="43" cy="34" r="1.6" fill="#7a5a2e"/><circle cx="57" cy="34" r="1.6" fill="#7a5a2e"/><ellipse cx="50" cy="76" rx="24" ry="3" fill="#7d9a7b" opacity=".25"/></svg>`,
  `<svg viewBox="0 0 100 80"><path d="M50 66s-22-13-22-29a12 12 0 0 1 22-7 12 12 0 0 1 22 7c0 16-22 29-22 29z" fill="#d99a86"/><path d="M38 34a6 6 0 0 1 8-5" stroke="#fbe6dd" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M20 20l1.6-4.5 1.6 4.5 4.5 1.6-4.5 1.6-1.6 4.5-1.6-4.5-4.5-1.6z" fill="#d5a24c"/><ellipse cx="50" cy="76" rx="22" ry="3" fill="#7d9a7b" opacity=".25"/></svg>`,
];
const BG_LIST = ["bg-0", "bg-1", "bg-2", "bg-3", "bg-4"];
export const areaIndex = (content, areaId) => {
  const i = (content.areas || []).findIndex(a => String(a.id) === String(areaId));
  return i < 0 ? 0 : i;
};
export const artAt = i => ART_LIST[i % ART_LIST.length];
export const bgAt = i => BG_LIST[i % BG_LIST.length];

export const HERO_ART = `<svg viewBox="0 0 260 200" fill="none"><circle cx="160" cy="88" r="78" fill="#2f5d51"/><path d="M40 55l3-9 3 9 9 3-9 3-3 9-3-9-9-3z" fill="#d5a24c"/><circle cx="78" cy="30" r="3" fill="#7d9a7b"/><path d="M200 20l-6 6M215 50h-8M205 78l-5-5" stroke="#9fb39b" stroke-width="2" stroke-linecap="round"/><path d="M8 180q120-14 244 0" stroke="#9fb39b" stroke-width="1.5"/><rect x="135" y="92" width="26" height="80" rx="4" fill="#a7bd98"/><path d="M148 92V45" stroke="#7d9a7b" stroke-width="3"/><path d="M148 60c-12 0-22-10-20-24 12 0 20 10 20 24z" fill="#8fae86"/><path d="M148 72c12-2 22-14 18-28-12 2-20 14-18 28z" fill="#cfe0c0"/><path d="M140 172c0 8 16 8 16 0" fill="#c98b6b"/><circle cx="187" cy="105" r="16" fill="#c98b6b"/><path d="M180 105l5 5 9-10" stroke="#f3efe4" stroke-width="2.5" stroke-linecap="round"/><rect x="30" y="150" width="90" height="16" rx="3" fill="#c98b6b"/><path d="M38 150v16M44 150v16" stroke="#f3e2d6" stroke-width="1.5"/><rect x="25" y="133" width="88" height="17" rx="3" fill="#a7bd98"/><path d="M33 133v17M39 133v17" stroke="#e3ecd9" stroke-width="1.5"/><path d="M45 132c10-6 18-6 25-2 7-4 15-4 25 2v-12c-10-6-18-6-25-2-7-4-15-4-25 2z" fill="#f6f2e8"/></svg>`;

export const BRAND_MARK = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M12 16.5s-2.6-1.6-2.6-3.3a1.4 1.4 0 0 1 2.6-.7 1.4 1.4 0 0 1 2.6.7c0 1.7-2.6 3.3-2.6 3.3z" fill="#e8b4a0" stroke="#e8b4a0"/></svg>`;

/* Zvuk i vibracija za tajmer */
export function ring() {
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

export const store = {
  get(key, fallback) { try { const v = localStorage.getItem("kd_" + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem("kd_" + key, JSON.stringify(value)); } catch {} },
  del(key) { try { localStorage.removeItem("kd_" + key); } catch {} },
};
