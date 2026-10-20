/* Kućni defektolog – ulazna tačka: rute, okvir stranice i događaji.

   #/                   ulaz za porodice (kod) ili program porodice
   #/p/KOD              lični link porodice
   #/plan, #/aktivnosti, #/zapazanja, #/podrska, #/procena
   #/admin…             deo za defektologa
   #/pregled/<strana>   pregled programa „kao roditelj“ (iz editora)            */

import "./style.css";
import { configured, takeRecoveryFromUrl, getSession, signOut } from "./api.js";
import { PROFILE } from "./config.js";
import { $, esc, toast, closeModal, modalOpen, ICON, BRAND_MARK, store, formCode } from "./util.js";
import * as fam from "./family.js";
import * as adm from "./admin.js";
import * as editor from "./editor.js";

const content = $("#content");
const FAMILY_PAGES = ["plan", "aktivnosti", "zapazanja", "podrska", "procena"];
let route = null;
let previewReturn = "#/admin";

$("#brand-mark").innerHTML = BRAND_MARK;

/* ---------------------------------------------------------------- RUTA */

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const parts = raw.split(/[/?]/).filter(Boolean);
  if (parts[0] === "admin") return { app: "admin", ...adm.parse(parts) };
  if (parts[0] === "pregled") return { app: "preview", page: FAMILY_PAGES.includes(parts[1]) ? parts[1] : "plan" };
  if (parts[0] === "p" && parts[1]) return { app: "link", code: parts[1] };
  if (FAMILY_PAGES.includes(parts[0])) return { app: "family", page: parts[0] };
  return { app: "family", page: "plan" };
}

/* ---------------------------------------------------------------- OKVIR */

function setShell(kind, active) {
  const nav = kind === "admin" ? adm.NAV : fam.NAV;
  const base = kind === "preview" ? "#/pregled/" : "#/";
  const unread = kind === "family" ? fam.unreadCount() : 0;
  const link = n => (kind === "admin" ? "#/admin" : base + n.page);
  $("#nav").innerHTML = nav.map(n => `<a href="${link(n)}" class="${n.page === active ? "active" : ""}">${n.icon}<span>${esc(n.label)}</span>${n.page === "podrska" && unread ? `<i class="dot">${unread}</i>` : ""}</a>`).join("")
    + (kind === "admin" && adm.loggedIn() ? `<a href="#/admin" data-action="logout" class="nav-logout">${ICON.logout}<span>Odjava</span></a>` : "");
  $("#bottom-nav").innerHTML = kind === "admin" ? "" : nav.map(n => `<a href="${link(n)}" class="${n.page === active ? "active" : ""}">${n.icon}<span>${esc(n.short)}</span>${n.page === "podrska" && unread ? `<i class="dot">${unread}</i>` : ""}</a>`).join("");
  document.body.classList.toggle("has-bottom-nav", kind !== "admin" && kind !== "welcome");
  document.body.classList.toggle("is-admin", kind === "admin");
  $("#side-label").textContent = kind === "admin" ? "Defektolog" : kind === "welcome" ? "" : "Vaš porodični prostor";
  $("#brand").href = kind === "admin" ? "#/admin" : "#/";
  const s = getSession();
  $("#side-foot").innerHTML = kind === "admin"
    ? (adm.loggedIn() ? `<div class="person"><span class="avatar">${esc(PROFILE.inicijali)}</span><div><strong>${esc(PROFILE.ime)}</strong><small>${esc((s && s.email) || "")}</small></div></div>` : "")
    : `<div class="person"><span class="avatar">${esc(PROFILE.inicijali)}</span><div><strong>${esc(PROFILE.ime)}</strong><small>${esc(PROFILE.kratko)}</small></div></div>
       ${kind === "family" ? `<a class="workspace" href="#/podrska">Pišite ${esc(PROFILE.imeDativ)} <span>↗</span></a>` : ""}`;
  $("#sidebar").classList.toggle("hidden-nav", kind === "welcome");
}

function setCrumb(text) {
  $("#crumbs").innerHTML = `Program podrške porodici <span>/</span> <strong>${esc(text)}</strong>`;
  document.title = text ? `${text} · Kućni defektolog` : "Kućni defektolog";
}

/* ---------------------------------------------------------------- EKRANI */

function welcomeScreen(error = "") {
  return `
    <section class="welcome-card">
      <div class="welcome-mark">${BRAND_MARK}</div>
      <p class="eyebrow">Kućni defektolog · ${esc(PROFILE.ime)}</p>
      <h1>Dobro došli u vaš porodični prostor.</h1>
      <p class="lead">Upišite kod porodice koji ste dobili od ${esc(PROFILE.imeGenitiv)}, ili otvorite lični link iz poruke.</p>
      <form id="code-form" class="code-form">
        <input class="input code-input" name="code" id="code-input" placeholder="npr. K7MQ-4XPA" autocomplete="off" autocapitalize="characters" spellcheck="false" required>
        <button class="btn btn-lg" type="submit">Uđi</button>
      </form>
      ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
      <a class="btn-link admin-link" href="#/admin">Prijava za defektologa →</a>
    </section>`;
}

function notConfiguredScreen() {
  return `
    <section class="welcome-card">
      <p class="eyebrow">Podešavanje</p>
      <h1>Aplikacija još nije povezana sa bazom.</h1>
      <p class="lead">Dodajte <code>VITE_SUPABASE_URL</code> i <code>VITE_SUPABASE_ANON_KEY</code> (lokalno u fajl <code>.env</code>, a na Vercel-u u Settings → Environment Variables) i ponovo pokrenite aplikaciju. Uputstvo je u fajlu README.md.</p>
    </section>`;
}

function errorScreen(msg) {
  return `<section class="welcome-card"><h1>Nešto nije u redu.</h1><p class="lead">${esc(msg)}</p><button class="btn" data-action="retry">Pokušaj ponovo</button></section>`;
}

/* ---------------------------------------------------------------- RENDER */

async function render(keepScroll = false) {
  route = parseHash();
  const y = window.scrollY;
  $("#sidebar").classList.remove("open");

  if (!configured) { setShell("welcome"); setCrumb(""); content.innerHTML = notConfiguredScreen(); return; }

  try {
    if (route.app === "link") {
      const code = formCode(route.code).replace("-", "");
      store.set("code", code);
      history.replaceState(null, "", location.pathname + "#/plan");
      return render();
    }

    if (route.app === "admin") {
      setShell("admin", "admin");
      if (!keepScroll) content.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
      await adm.load(route);
      setShell("admin", "admin");
      setCrumb(adm.crumb(route));
      content.innerHTML = adm.render(route);
      adm.afterRender(content, route);
    } else if (route.app === "preview") {
      if (!fam.isPreview()) { location.hash = previewReturn; return; }
      setShell("preview", route.page);
      setCrumb("Pregled: " + fam.crumb(route.page));
      content.innerHTML = fam.render(route.page);
      fam.afterRender(content);
    } else {
      if (fam.isPreview()) fam.exitPreview();
      const code = store.get("code", null);
      if (!code) { setShell("welcome"); setCrumb(""); content.innerHTML = welcomeScreen(); return; }
      if (!fam.hasData()) {
        content.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
        try { await fam.load(code); }
        catch (e) {
          if (e.code === "P0002" || /kod/i.test(e.message)) { store.del("code"); setShell("welcome"); setCrumb(""); content.innerHTML = welcomeScreen(e.message); return; }
          throw e;
        }
      }
      setShell("family", route.page === "procena" ? "plan" : route.page);
      setCrumb(fam.crumb(route.page));
      content.innerHTML = fam.render(route.page);
      fam.afterRender(content);
      fam.onPageShown(route.page);
      setShell("family", route.page === "procena" ? "plan" : route.page);
    }
  } catch (e) {
    content.innerHTML = errorScreen(e.message || "Greška.");
  }
  window.scrollTo(0, keepScroll ? y : 0);
}

const rerender = (keep = true) => render(keep);

/* Pregled iz editora */
const ctx = {
  preview(program, family) {
    previewReturn = location.hash || "#/admin";
    fam.setPreview(program, family, editor.imgFetcher);
    location.hash = "#/pregled/plan";
  },
};

/* ---------------------------------------------------------------- DOGAĐAJI */

const appOf = () => (route && route.app === "admin" ? "admin" : "family");

document.addEventListener("click", e => {
  const t = e.target.closest("[data-close],[data-action],[data-open],[data-steps],[data-step],[data-timer],[data-quick],[data-group],[data-filter],[data-tab],[data-tried],[data-del-note],[data-del-review],[data-note-for],[data-zoom],[data-scroll],[data-ed],[data-atab]");
  if (!t) return;
  if (t.dataset.close !== undefined) { closeModal(); return; }
  if (t.dataset.action === "retry") { render(); return; }
  if (t.dataset.action === "logout") { e.preventDefault(); signOut().then(() => { location.hash = "#/admin"; render(); }); return; }
  if (t.dataset.action === "exit-preview") { fam.exitPreview(); location.hash = previewReturn; return; }
  if (appOf() === "admin") adm.onClick(e, t, rerender, ctx);
  else fam.onClick(e, t, rerender);
});

document.addEventListener("input", e => {
  if (appOf() === "admin") adm.onInput(e); else fam.onInput(e);
});

document.addEventListener("change", e => {
  if (appOf() === "admin") adm.onChange(e, rerender);
});

document.addEventListener("submit", e => {
  e.preventDefault();
  if (e.target.id === "code-form") {
    const code = formCode(new FormData(e.target).get("code")).replace("-", "");
    if (code.length < 8) { toast("Kod ima 8 znakova, npr. K7MQ-4XPA."); return; }
    store.set("code", code);
    render();
    return;
  }
  if (appOf() === "admin") adm.onSubmit(e, rerender); else fam.onSubmit(e, rerender);
});

document.addEventListener("dragover", e => { if (e.target.closest("#dropzone")) { e.preventDefault(); e.target.closest("#dropzone").classList.add("over"); } });
document.addEventListener("dragleave", e => { const z = e.target.closest("#dropzone"); if (z) z.classList.remove("over"); });
document.addEventListener("drop", e => { if (e.target.closest("#dropzone")) { e.preventDefault(); adm.onDrop(e, rerender); } });

document.addEventListener("keydown", e => { if (e.key === "Escape" && modalOpen()) closeModal(); });
$("#menu-btn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

window.addEventListener("hashchange", () => { fam.stopAll(); if (modalOpen()) closeModal(); adm.beforeLeave(); render(false); });
window.addEventListener("beforeunload", () => adm.beforeLeave());

/* Osveži podatke porodice kada se aplikacija ponovo otvori (npr. stigla poruka). */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !route || route.app !== "family" || !fam.hasData() || modalOpen()) return;
  const code = store.get("code", null);
  if (code && await fam.load(code, { quiet: true })) render(true);
});

/* ---------------------------------------------------------------- START */

takeRecoveryFromUrl();
render();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
