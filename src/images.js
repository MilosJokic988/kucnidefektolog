/* Učitavanje ilustracija aktivnosti iz baze, uz čuvanje u kešu telefona
   (da rade i bez interneta i da se ne preuzimaju svaki put). */

const mem = new Map();
const CACHE = "kd-slike-v1";
const keyUrl = id => `${location.origin}/__slika/${id}`;

async function fromCache(id) {
  try {
    const c = await caches.open(CACHE);
    const r = await c.match(keyUrl(id));
    return r ? await r.text() : null;
  } catch { return null; }
}
async function toCache(id, data) {
  try { const c = await caches.open(CACHE); await c.put(keyUrl(id), new Response(data, { headers: { "Content-Type": "text/plain" } })); } catch {}
}

export async function getImages(ids, fetcher) {
  const out = {};
  const missing = [];
  for (const id of ids) {
    if (mem.has(id)) { out[id] = mem.get(id); continue; }
    const cached = await fromCache(id);
    if (cached) { mem.set(id, cached); out[id] = cached; } else missing.push(id);
  }
  for (let i = 0; i < missing.length; i += 6) {
    const chunk = missing.slice(i, i + 6);
    try {
      const got = (await fetcher(chunk)) || {};
      for (const [id, data] of Object.entries(got)) { mem.set(id, data); out[id] = data; toCache(id, data); }
    } catch { /* bez interneta: slike se prikažu kasnije */ }
  }
  return out;
}

export function rememberImage(id, data) { mem.set(id, data); toCache(id, data); }

/* Popuni sve <img data-img="id"> u kontejneru. */
export async function hydrateImages(root, fetcher) {
  const els = [...root.querySelectorAll("img[data-img]:not([src])")];
  if (!els.length) return;
  const ids = [...new Set(els.map(e => e.dataset.img))];
  const map = await getImages(ids, fetcher);
  for (const el of els) {
    const d = map[el.dataset.img];
    if (d) { el.src = d; el.classList.add("loaded"); } else el.closest(".img-wrap")?.classList.add("img-missing");
  }
}
