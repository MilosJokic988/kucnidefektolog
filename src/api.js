/* Komunikacija sa Supabase-om (baza + prijava) i AI funkcijom.
   Bez dodatnih biblioteka – čist fetch prema Supabase REST API-ju. */

import { SUPABASE_URL, SUPABASE_KEY, AI_ENDPOINT } from "./config.js";
import { store } from "./util.js";

export const configured = Boolean(SUPABASE_URL && SUPABASE_KEY);
const isJwtKey = SUPABASE_KEY.startsWith("eyJ");

const ERRORS = {
  pogresan_kod: "Kod porodice nije ispravan ili više nije aktivan.",
  niste_prijavljeni: "Niste prijavljeni.",
  nije_dozvoljeno: "Nemate pristup ovim podacima.",
  nema_programa: "Program nije pronađen.",
  slika_prevelika: "Slika je prevelika.",
  prazna_poruka: "Poruka je prazna.",
  "Invalid login credentials": "Pogrešan mejl ili šifra.",
  "Email not confirmed": "Mejl adresa nije potvrđena.",
};

export class ApiError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status; }
}

function friendly(msg) {
  for (const k in ERRORS) if (String(msg).includes(k)) return ERRORS[k];
  return msg;
}

/* ---------------------------------------------------------------- SESIJA */

let session = store.get("session", null);
const saveSession = s => { session = s; s ? store.set("session", s) : store.del("session"); };

export const getSession = () => session;

function sessionFrom(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    email: data.user && data.user.email,
  };
}

async function authFetch(path, body, token) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body || {}),
    });
  } catch { throw new ApiError("Nema internet veze.", "offline", 0); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(friendly(data.error_description || data.msg || data.message || data.error || "Greška pri prijavi."), data.error_code || data.code, r.status);
  return data;
}

export async function signIn(email, password) {
  const data = await authFetch("token?grant_type=password", { email, password });
  saveSession(sessionFrom(data));
  return session;
}

export async function signOut() {
  const t = session && session.access_token;
  saveSession(null);
  if (t) { try { await authFetch("logout", {}, t); } catch {} }
}

export async function requestPasswordReset(email) {
  const redirect = location.origin + location.pathname;
  await authFetch(`recover?redirect_to=${encodeURIComponent(redirect)}`, { email });
}

/* Link iz mejla za novu šifru: #access_token=...&type=recovery */
export function takeRecoveryFromUrl() {
  const h = location.hash;
  if (!/access_token=/.test(h) || !/type=recovery/.test(h)) return false;
  const params = new URLSearchParams(h.slice(h.indexOf("access_token=")));
  const token = params.get("access_token");
  if (!token) return false;
  saveSession({ access_token: token, refresh_token: params.get("refresh_token"), expires_at: Number(params.get("expires_at")) || Math.floor(Date.now() / 1000) + 3600, email: "" , recovery: true });
  history.replaceState(null, "", location.pathname + "#/admin/nova-sifra");
  return true;
}

export async function updatePassword(password) {
  await ensureFresh();
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ password }),
    });
  } catch { throw new ApiError("Nema internet veze.", "offline", 0); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(friendly(data.msg || data.message || "Šifra nije promenjena."), data.error_code, r.status);
  if (session) { session.recovery = false; session.email = data.email || session.email; saveSession(session); }
}

async function ensureFresh() {
  if (!session) throw new ApiError("Niste prijavljeni.", "auth", 401);
  if (session.expires_at - Date.now() / 1000 > 90) return;
  if (!session.refresh_token) { saveSession(null); throw new ApiError("Sesija je istekla. Prijavite se ponovo.", "auth", 401); }
  try {
    const data = await authFetch("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
    saveSession(sessionFrom(data));
  } catch (e) {
    if (e.code !== "offline") saveSession(null);
    throw e.code === "offline" ? e : new ApiError("Sesija je istekla. Prijavite se ponovo.", "auth", 401);
  }
}

/* ---------------------------------------------------------------- RPC */

async function rpc(name, p = {}, asUser = false) {
  if (!configured) throw new ApiError("Aplikacija još nije povezana sa bazom (Supabase).", "config", 0);
  const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
  if (asUser) { await ensureFresh(); headers.Authorization = `Bearer ${session.access_token}`; }
  else if (isJwtKey) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify({ p }) });
  } catch { throw new ApiError("Nema internet veze. Pokušajte ponovo.", "offline", 0); }
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const msg = (data && (data.message || data.msg)) || "Greška na serveru.";
    if (r.status === 401 && asUser) saveSession(null);
    throw new ApiError(friendly(msg), (data && data.code) || r.status, r.status);
  }
  return data;
}

/* ---------------------------------------------------------------- PORODICA */

export const family = {
  get: code => rpc("family_get", { code }),
  consent: code => rpc("family_consent", { code }),
  addObservation: (code, observation) => rpc("family_add_observation", { code, observation }),
  deleteObservation: (code, id) => rpc("family_delete_observation", { code, id }),
  setTried: (code, activity_code, value) => rpc("family_set_tried", { code, activity_code, value }),
  addReview: (code, review) => rpc("family_add_review", { code, review }),
  deleteReview: (code, id) => rpc("family_delete_review", { code, id }),
  sendMessage: (code, body) => rpc("family_send_message", { code, body }),
  readMessages: code => rpc("family_read_messages", { code }),
  images: (code, ids) => rpc("family_get_images", { code, ids }),
};

/* ---------------------------------------------------------------- DEFEKTOLOG */

export const admin = {
  overview: () => rpc("admin_overview", {}, true),
  family: (id, mark_seen = true) => rpc("admin_family", { id, mark_seen }, true),
  saveFamily: f => rpc("admin_save_family", f, true),
  regenerateCode: id => rpc("admin_regenerate_code", { id }, true),
  deleteFamily: id => rpc("admin_delete_family", { id }, true),
  deleteTestFamilies: () => rpc("admin_delete_test_families", {}, true),
  saveProgram: p => rpc("admin_save_program", p, true),
  publishProgram: (id, start_date) => rpc("admin_publish_program", { id, start_date }, true),
  setProgramStatus: (id, status) => rpc("admin_set_program_status", { id, status }, true),
  deleteProgram: id => rpc("admin_delete_program", { id }, true),
  addImage: img => rpc("admin_add_image", img, true),
  images: ids => rpc("admin_get_images", { ids }, true),
  reply: (family_id, body) => rpc("admin_reply", { family_id, body }, true),
};

/* ---------------------------------------------------------------- AI */

export async function aiStatus() {
  try { const r = await fetch(AI_ENDPOINT, { method: "GET" }); if (!r.ok) return { configured: false }; return await r.json(); }
  catch { return { configured: false }; }
}

export async function ai(task, text, items) {
  await ensureFresh();
  let r;
  try {
    r = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ task, text, items }),
    });
  } catch { throw new ApiError("Nema internet veze.", "offline", 0); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data.error || (r.status === 404 ? "AI funkcija nije pronađena. Radi tek kada je aplikacija postavljena na Vercel." : r.status === 504 ? "Obrada je trajala predugo." : "Greška pri obradi dokumenta.");
    throw new ApiError(msg, "ai", r.status);
  }
  return data.result;
}
