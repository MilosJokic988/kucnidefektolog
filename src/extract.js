/* Čitanje Word (.docx) i PDF dokumenata u pregledaču.
   Rezultat: { text, images: [{ n, blob, width, height }] }
   U tekstu se na mestu svake slike nalazi oznaka [[SLIKA n]], da AI zna
   uz koju aktivnost slika ide. Ništa se ne šalje na internet u ovom koraku. */

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MIN_IMAGE_SIDE = 160; // manje slike su ikonice/ukrasi

export async function extractDocument(file, onProgress = () => {}) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".docx")) return extractDocx(file, onProgress);
  if (name.endsWith(".pdf")) return extractPdf(file, onProgress);
  if (name.endsWith(".doc")) throw new Error("Stari .doc format nije podržan. U Word-u izaberite Save As → .docx ili PDF.");
  throw new Error("Podržani su samo Word (.docx) i PDF fajlovi.");
}

/* ------------------------------------------------------------------ ZIP */

async function readZip(buffer) {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Fajl nije ispravan Word dokument.");
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const entries = {};
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const csize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const local = view.getUint32(ptr + 42, true);
    const name = dec.decode(new Uint8Array(buffer, ptr + 46, nameLen));
    entries[name] = { method, csize, local };
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  async function get(name) {
    const e = entries[name];
    if (!e) return null;
    const lNameLen = view.getUint16(e.local + 26, true);
    const lExtraLen = view.getUint16(e.local + 28, true);
    const start = e.local + 30 + lNameLen + lExtraLen;
    const raw = new Uint8Array(buffer, start, e.csize);
    if (e.method === 0) return raw.slice();
    if (e.method !== 8) throw new Error("Nepoznata kompresija u dokumentu.");
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return { entries, get, text: async n => { const b = await get(n); return b ? new TextDecoder().decode(b) : null; } };
}

/* ------------------------------------------------------------------ DOCX */

async function extractDocx(file, onProgress) {
  onProgress("Otvaram Word dokument…");
  const zip = await readZip(await file.arrayBuffer());
  const xml = await zip.text("word/document.xml");
  if (!xml) throw new Error("U fajlu nije pronađen sadržaj Word dokumenta.");
  const parse = s => new DOMParser().parseFromString(s, "application/xml");
  const doc = parse(xml);

  // relacije: rId -> media putanja
  const rels = {};
  const relXml = await zip.text("word/_rels/document.xml.rels");
  if (relXml) {
    for (const r of parse(relXml).getElementsByTagName("Relationship")) {
      rels[r.getAttribute("Id")] = r.getAttribute("Target");
    }
  }

  // stilovi naslova
  const headingLevel = {};
  const stylesXml = await zip.text("word/styles.xml");
  if (stylesXml) {
    for (const st of parse(stylesXml).getElementsByTagNameNS(W, "style")) {
      const id = st.getAttributeNS(W, "styleId");
      const nm = st.getElementsByTagNameNS(W, "name")[0];
      const name = (nm && nm.getAttributeNS(W, "val") || "").toLowerCase();
      let m = name.match(/^(heading|naslov)\s*(\d)/) || (id || "").toLowerCase().match(/^(heading|naslov)(\d)/);
      if (m) headingLevel[id] = Math.min(+m[2], 4);
      else if (name === "title" || name === "naslov") headingLevel[id] = 1;
    }
  }

  const imageOrder = []; // rId redom pojavljivanja
  const imageIndex = {};
  const out = [];

  const imageMarker = rid => {
    if (!rid || !rels[rid] || !/media\//.test(rels[rid])) return "";
    if (!(rid in imageIndex)) { imageOrder.push(rid); imageIndex[rid] = imageOrder.length; }
    return `[[SLIKA ${imageIndex[rid]}]]`;
  };

  function runText(node) {
    let s = "";
    for (const ch of node.childNodes) {
      if (ch.nodeType !== 1) continue;
      const ln = ch.localName;
      if (ln === "t") s += ch.textContent;
      else if (ln === "tab") s += " ";
      else if (ln === "br" || ln === "cr") s += "\n";
      else if (ln === "noBreakHyphen") s += "-";
      else if (ln === "blip") s += "\n" + imageMarker(ch.getAttributeNS(R, "embed")) + "\n";
      else if (ln === "imagedata") s += "\n" + imageMarker(ch.getAttributeNS(R, "id")) + "\n";
      else if (ln === "txbxContent") s += "\n" + blockText(ch, true) + "\n";
      else if (ln === "instrText" || ln === "delText" || ln === "rPr" || ln === "pPr") continue;
      else s += runText(ch);
    }
    return s;
  }

  function paragraph(p) {
    const pPr = p.getElementsByTagNameNS(W, "pPr")[0];
    let prefix = "";
    if (pPr && pPr.parentNode === p) {
      const ps = pPr.getElementsByTagNameNS(W, "pStyle")[0];
      const lvl = ps && headingLevel[ps.getAttributeNS(W, "val")];
      if (lvl) prefix = "#".repeat(lvl) + " ";
      else if (pPr.getElementsByTagNameNS(W, "numPr")[0]) prefix = "- ";
    }
    const text = runText(p).replace(/[  ]+/g, " ").replace(/ *\n */g, "\n").trim();
    if (!text) return "";
    return text.split("\n").map((line, i) => (i === 0 && !line.startsWith("[[") ? prefix + line : line)).join("\n");
  }

  function table(tbl) {
    const rows = [];
    for (const tr of tbl.childNodes) {
      if (tr.localName !== "tr") continue;
      const cells = [];
      for (const tc of tr.childNodes) {
        if (tc.localName !== "tc") continue;
        cells.push(blockText(tc, true).replace(/\n+/g, " / ").trim());
      }
      const nonEmpty = cells.filter(Boolean);
      if (nonEmpty.length) rows.push("| " + nonEmpty.join(" | ") + " |");
    }
    return rows.join("\n");
  }

  function blockText(container, inner = false) {
    const parts = [];
    for (const el of container.childNodes) {
      if (el.nodeType !== 1) continue;
      const ln = el.localName;
      if (ln === "p") parts.push(paragraph(el));
      else if (ln === "tbl") parts.push(table(el));
      else if (ln === "sdt") {
        const c = el.getElementsByTagNameNS(W, "sdtContent")[0];
        if (c) parts.push(blockText(c, inner));
      } else if (ln === "customXml" || ln === "smartTag") parts.push(blockText(el, inner));
    }
    return parts.filter(Boolean).join(inner ? "\n" : "\n\n");
  }

  const body = doc.getElementsByTagNameNS(W, "body")[0];
  onProgress("Čitam tekst…");
  out.push(blockText(body));
  let text = out.join("\n\n");

  // slike
  onProgress(`Pripremam slike (${imageOrder.length})…`);
  const images = [];
  const keep = new Set();
  for (let i = 0; i < imageOrder.length; i++) {
    const path = "word/" + rels[imageOrder[i]].replace(/^\.?\//, "").replace(/^word\//, "");
    const bytes = await zip.get(path);
    if (!bytes) continue;
    const ext = path.split(".").pop().toLowerCase();
    const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" }[ext];
    if (!mime) continue; // emf/wmf i sl. pregledač ne ume da prikaže
    const blob = new Blob([bytes], { type: mime });
    const size = await imageSize(blob);
    if (!size || Math.min(size.width, size.height) < MIN_IMAGE_SIDE) continue;
    images.push({ n: i + 1, blob, ...size });
    keep.add(i + 1);
  }
  text = text.replace(/\[\[SLIKA (\d+)\]\]/g, (m, n) => (keep.has(+n) ? m : ""));
  return { text: cleanText(text), images, kind: "docx" };
}

async function imageSize(blob) {
  try {
    const bmp = await createImageBitmap(blob);
    const s = { width: bmp.width, height: bmp.height };
    bmp.close && bmp.close();
    return s;
  } catch { return null; }
}

/* ------------------------------------------------------------------ PDF */

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    const base = (import.meta.env && import.meta.env.BASE_URL) || "/";
    pdfjsPromise = import(/* @vite-ignore */ base + "vendor/pdfjs/pdf.min.mjs").then(m => {
      m.GlobalWorkerOptions.workerSrc = base + "vendor/pdfjs/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

async function extractPdf(file, onProgress) {
  onProgress("Otvaram PDF…");
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  const pdf = await task.promise;
  const pages = [];
  const images = [];
  const seenImages = new Map();
  const byHash = new Map();
  let n = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress(`Čitam stranu ${i} od ${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(textFromItems(content.items));

    // slike na strani (ista slika na više strana dobija isti broj)
    const markers = new Set();
    try {
      const ops = await page.getOperatorList();
      for (let k = 0; k < ops.fnArray.length; k++) {
        const fn = ops.fnArray[k];
        if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintImageXObjectRepeat) continue;
        const objId = ops.argsArray[k][0];
        const cacheKey = objId.startsWith("g_") ? objId : i + ":" + objId;
        let num = seenImages.get(cacheKey);
        if (num === undefined) {
          num = null;
          const img = await getPdfObj(page, objId);
          if (img && Math.min(img.width, img.height) >= MIN_IMAGE_SIDE) {
            const blob = await pdfImageToBlob(img);
            if (blob) {
              const hash = await sha256(blob);
              if (byHash.has(hash)) num = byHash.get(hash);
              else {
                n++;
                num = n;
                byHash.set(hash, n);
                images.push({ n, blob, width: img.width, height: img.height });
              }
            }
          }
          seenImages.set(cacheKey, num);
        }
        if (num) markers.add(`[[SLIKA ${num}]]`);
      }
    } catch (e) { /* strana bez slika ili nepodržan format slike */ }
    if (markers.size) pages[pages.length - 1] += "\n" + [...markers].join("\n");
    page.cleanup();
  }

  const text = removeRepeatedLines(pages).join("\n\n");
  await task.destroy();
  return { text: cleanText(text), images, kind: "pdf" };
}

async function sha256(blob) {
  const buf = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

function getPdfObj(page, id) {
  return new Promise(resolve => {
    const objs = id.startsWith("g_") ? page.commonObjs : page.objs;
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 4000);
    try {
      objs.get(id, data => { if (!done) { done = true; clearTimeout(t); resolve(data); } });
    } catch { clearTimeout(t); resolve(null); }
  });
}

async function pdfImageToBlob(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
  } else if (img.data) {
    const rgba = new Uint8ClampedArray(img.width * img.height * 4);
    const src = img.data;
    const pixels = img.width * img.height;
    if (src.length === pixels * 4) rgba.set(src);
    else if (src.length === pixels * 3) {
      for (let p = 0, q = 0; p < pixels; p++) { rgba[q++] = src[p * 3]; rgba[q++] = src[p * 3 + 1]; rgba[q++] = src[p * 3 + 2]; rgba[q++] = 255; }
    } else if (src.length === pixels) {
      for (let p = 0, q = 0; p < pixels; p++) { rgba[q++] = src[p]; rgba[q++] = src[p]; rgba[q++] = src[p]; rgba[q++] = 255; }
    } else return null;
    ctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
  } else return null;
  return new Promise(res => canvas.toBlob(res, "image/png"));
}

function textFromItems(items) {
  const lines = [];
  let line = "";
  let lastY = null;
  for (const it of items) {
    if (!("str" in it)) continue;
    const y = it.transform ? Math.round(it.transform[5]) : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && line.trim()) {
      lines.push(line.trimEnd());
      line = "";
    }
    line += it.str;
    if (it.hasEOL) { lines.push(line.trimEnd()); line = ""; lastY = null; continue; }
    lastY = y;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.map(l => l.replace(/\s{3,}/g, "   ")).join("\n");
}

function removeRepeatedLines(pages) {
  if (pages.length < 4) return pages;
  const counts = new Map();
  const key = s => s.trim().replace(/\d+/g, "#");
  for (const p of pages) {
    for (const l of new Set(p.split("\n").map(s => key(s)).filter(Boolean))) counts.set(l, (counts.get(l) || 0) + 1);
  }
  const limit = Math.max(3, pages.length * 0.5);
  const isPageNo = l => /^(\d{1,3}|strana \d+|\d+ ?\/ ?\d+)$/i.test(l);
  return pages.map(p => p.split("\n").filter(l => {
    const t = l.trim();
    if (t.startsWith("[[SLIKA")) return true;
    return t && !isPageNo(t) && !(counts.get(key(t)) >= limit && t.length < 80);
  }).join("\n"));
}

/* ------------------------------------------------------------------ ČIŠĆENJE */

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* Uklanja lične podatke koji nisu potrebni za program (prezimena, telefoni,
   mejlovi, adrese, datumi rođenja) pre slanja AI-ju. Ime deteta ostaje. */
export function redactPersonalData(text) {
  const surnames = new Set();
  const rowKey = /^\|\s*(ime i prezime[^|]*|ime roditelja[^|]*|roditelj(?:i|a)?(?:\s*\/\s*staratelj[a-zšđčćž]*)?\s*|staratelj[a-zšđčćž]*\s*|adresa[^|]*|grad[^|]*|država[^|]*|drzava[^|]*|mesto stanovanja[^|]*|telefon[^|]*|kontakt[^|]*|e-?mail[^|]*|mejl[^|]*|datum rođenja[^|]*|datum rodjenja[^|]*|jmbg[^|]*)\|\s*([^|\n]*)\|?.*$/gim;
  text = text.replace(rowKey, (m, key, value) => {
    if (/ime|roditelj|staratelj/i.test(key)) {
      value.split(/\s+i\s+|,|\//).forEach(person => {
        const words = person.trim().split(/\s+/).filter(w => /^[A-ZŠĐČĆŽ][a-zšđčćž]+$/.test(w));
        words.slice(1).forEach(w => surnames.add(w));
      });
      const first = value.trim().split(/\s+/)[0] || "";
      return `| ${key.trim()} | ${/deteta|dete$/i.test(key.trim()) ? first : "[uklonjeno]"} |`;
    }
    return `| ${key.trim()} | [uklonjeno] |`;
  });
  const colonKey = /^(ime i prezime(?: deteta)?|ime deteta|ime roditelja|roditelj(?:i)?|roditelj\/staratelj|mesto stanovanja|adresa|grad|telefon|kontakt|e-?mail)\s*:\s*(.+)$/gim;
  text = text.replace(colonKey, (m, key, value) => {
    if (/ime|roditelj|staratelj/i.test(key)) {
      value.split(/\s+i\s+|,|\//).forEach(person => {
        person.trim().split(/\s+/).filter(w => /^[A-ZŠĐČĆŽ][a-zšđčćž]+$/.test(w)).slice(1).forEach(w => surnames.add(w));
      });
      return /roditelj|staratelj/i.test(key) ? `${key}: [uklonjeno]` : `${key}: ${value.trim().split(/\s+/)[0] || ""}`;
    }
    return `${key}: [uklonjeno]`;
  });
  for (const sname of surnames) {
    if (sname.length < 3) continue;
    const stem = sname.length > 5 ? sname.slice(0, -1) : sname;
    text = text.replace(new RegExp(`(?<!\\p{L})${stem}\\p{L}{0,3}(?!\\p{L})`, "gu"), "[prezime]");
  }
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[mejl uklonjen]")
    .replace(/(?<![\w./])(\+|00)\d[\d\s()/-]{7,}\d/g, "[telefon uklonjen]")
    .replace(/(?<![\w./])\b0\d{1,2}[\s/-]?\d{3,4}[\s-]?\d{3,4}\b/g, "[telefon uklonjen]")
    .replace(/\b\d{13}\b/g, "[JMBG uklonjen]")
    .replace(/(datum rođenja|datum rodjenja|rođen[a]?)([^\n]{0,8}?)(\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\.?)/gi, "$1$2[datum uklonjen]");
}

/* Smanjuje sliku pre čuvanja (max 1100 px, JPEG ~ 80%). */
export async function compressImage(blob, maxSide = 1100, quality = 0.82) {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close && bmp.close();
  const out = await new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
  const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(out); });
  return { dataUrl, width: w, height: h, mime: "image/jpeg" };
}
