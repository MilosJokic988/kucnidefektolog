/* Vercel serverska funkcija: pretvara tekst programa (Word/PDF) u
   strukturu aplikacije pomoću Claude API-ja.

   Potrebne promenljive okruženja (Vercel → Settings → Environment Variables):
     ANTHROPIC_API_KEY      – ključ sa console.anthropic.com
     VITE_SUPABASE_URL      – adresa Supabase projekta
     VITE_SUPABASE_ANON_KEY – javni (anon/publishable) ključ Supabase-a
   Opciono:
     ANTHROPIC_MODEL        – podrazumevano claude-sonnet-5-5

   Funkciju može da pozove samo prijavljen defektolog (proverava se Supabase sesija). */

export const config = { maxDuration: 300 };

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const MAX_TEXT = 400000; // ~ 100 strana

/* ------------------------------------------------------------------ PROMPT */

const SYSTEM = `Ti si asistent defektologa Dragane Vasilijević („Kućni defektolog“). Dobijaš tekst njenog programa podrške porodici (izvučen iz Word ili PDF dokumenta) i pretvaraš ga u strukturisane podatke za aplikaciju koju koriste roditelji.

PRAVILA
1. Verno prenosi sadržaj. Ne izmišljaj aktivnosti, korake, ciljeve ni savete kojih nema u dokumentu. Zadrži Draganine formulacije; dozvoljeno je samo blago skraćivanje tamo gde je to izričito traženo.
2. Piši na srpskom, latinicom, istim stilom kao dokument (ekavica/ijekavica kako je u dokumentu).
3. Preskoči: sadržaj (TOC), zaglavlja i podnožja strana, prazne obrasce i tabele za popunjavanje (linije ____), upitnik za roditelje i razvojnu anamnezu (podaci o trudnoći, porođaju, razvoju po godinama, kontakt podaci).
4. Nikada ne prenosi lične podatke: prezimena, telefone, adrese, mejlove, datume rođenja. Dete/decu zovi samo imenom kako se pojavljuje u tekstu.
5. Ako tekst sadrži interne beleške autora koje nisu namenjene roditeljima (npr. „Po meni, ovu oblast treba drugačije postaviti…“, komentari o pisanju dokumenta), izostavi ih.
6. Oznake [[SLIKA n]] označavaju ilustracije iz dokumenta na tom mestu. Koristi ih samo za polje imageNumbers.
7. Duža tekstualna polja smeju koristiti jednostavan markdown: pasusi odvojeni praznim redom, liste sa "- ", podebljano sa **tekst**. Kratka polja (naslovi, stavke lista) bez markdown-a.
8. Ako neki podatak ne postoji u dokumentu, vrati prazan string ili praznu listu – ne izmišljaj.`;

const str = (description) => ({ type: "string", description });
const strList = (description) => ({ type: "array", items: { type: "string" }, description });
const int = (description) => ({ type: "integer", description });
const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const list = (items, description) => ({ type: "array", items, description });

const TASKS = {
  index: {
    maxTokens: 12000,
    instruction: `ZADATAK: Napravi pregled (kostur) programa.
- title: kratak naslov programa za roditelje (npr. „Prvi mesec – telo i budnost“ ili naslov iz dokumenta).
- childNames: ime deteta, ili imena dece ako ih je više („Vasa i Mia“).
- durationWeeks: trajanje programa u nedeljama (iz dokumenta; ako nije navedeno, 4).
- intro: 2–3 tople rečenice dobrodošlice za roditelje koje sažimaju šta program obuhvata – samo na osnovu dokumenta.
- areas: funkcionalne oblasti / tematske celine programa redom (id: "1", "2", …; intro: 1–3 rečenice opisa oblasti iz dokumenta).
- weeks: plan po nedeljama, ako postoji. Za „1–2. nedelja“ fromWeek=1, toWeek=2. title je kratak naziv nedelje (npr. „Telo i budnost“), focus glavni fokus, summary šta se radi. Ako dokument nema plan po nedeljama, rasporedi oblasti ravnomerno po nedeljama prateći redosled u dokumentu.
- activities: SVE aktivnosti/igre/vežbe programa koje imaju sopstveni opis (cilj, korake ili način izvođenja), redom kako se pojavljuju. Ne uključuj rutine (jutarnja rutina, kupanje…) – one idu posebno. code: oznaka iz dokumenta (npr. "1.3", "12"); ako je nema, numeriši redom ("1", "2", …). title: naziv aktivnosti bez reči „Aktivnost“ i bez broja. areaId: id oblasti kojoj pripada. weeks: brojevi nedelja u kojima se aktivnost radi (prema planu po nedeljama). startsWith: prvih 6–10 reči naslova aktivnosti doslovno kako stoji u tekstu, da bi se aktivnost mogla pronaći.`,
    schema: obj({
      title: str("Naslov programa"),
      childNames: str("Ime/imena dece"),
      durationWeeks: int("Broj nedelja"),
      intro: str("Dobrodošlica za roditelje"),
      areas: list(obj({ id: str("id oblasti"), title: str("naziv oblasti"), intro: str("kratak opis") }), "Oblasti"),
      weeks: list(obj({ label: str("npr. 1. nedelja"), fromWeek: int("od"), toWeek: int("do"), title: str("kratak naziv"), focus: str("glavni fokus"), summary: str("šta radimo") }), "Nedelje"),
      activities: list(obj({ code: str("oznaka"), title: str("naziv"), areaId: str("id oblasti"), weeks: { type: "array", items: { type: "integer" } }, startsWith: str("početak naslova u tekstu") }), "Aktivnosti"),
    }),
  },

  assessment: {
    maxTokens: 20000,
    instruction: `ZADATAK: Prenesi DEFEKTOLOŠKU PROCENU i CILJEVE RAZVOJA.
- assessment.intro: uvodni deo procene (važna napomena, opšti opis) – verno, u pasusima.
- assessment.areas: svaka oblast funkcionisanja iz procene: title, text (opis funkcionisanja, verno, pasusi), strengths (očuvane sposobnosti / snage), needs (potrebe za podrškom), parentTracks (šta roditelj prati u toj oblasti).
- assessment.conclusion: zaključak procene, verno.
- assessment.keyPoints: ključne tačke ako su istaknute u dokumentu (inače prazno).
- assessment.summary: 2–4 rečenice sažetka procene za roditelje, isključivo na osnovu teksta.
- goals: ciljevi razvoja po oblastima ako postoje (area, goal = funkcionalni cilj, outcomes = očekivani ishodi). Ako nema posebnog poglavlja o ciljevima, vrati praznu listu.`,
    schema: obj({
      assessment: obj({
        summary: str("kratak sažetak"),
        intro: str("uvod, markdown"),
        areas: list(obj({ title: str("oblast"), text: str("opis, markdown"), strengths: strList("snage"), needs: strList("potrebe"), parentTracks: strList("šta roditelj prati") }), "oblasti procene"),
        conclusion: str("zaključak, markdown"),
        keyPoints: strList("ključne tačke"),
      }),
      goals: list(obj({ area: str("oblast"), goal: str("funkcionalni cilj"), outcomes: strList("ishodi") }), "ciljevi"),
    }),
  },

  activities: {
    maxTokens: 24000,
    instruction: `ZADATAK: Prenesi detaljno SAMO aktivnosti sa sledećim oznakama (i nijednu drugu): {{CODES}}
Za svaku aktivnost:
- code i title tačno kao u spisku iznad.
- goal: cilj aktivnosti (verno).
- materials: potreban materijal (stavke), ako je naveden.
- frequency: koliko često / kada se radi / ko učestvuje, ako je navedeno.
- steps: koraci izvođenja redom, svaki korak jedna stavka, verno (bez rednog broja na početku).
- levels: nivoi ili varijante ako postoje (name: npr. „Nivo 1“ ili „Varijanta“, text: opis).
- adapt: kako prilagoditi igru, ako postoji.
- parentTracks: šta roditelj/mama prati (stavke).
- develops: šta se razvija (kratko, jedan red).
- note: važna napomena / upozorenje, ako postoji.
- imageNumbers: brojevi iz oznaka [[SLIKA n]] koji ilustruju baš ovu aktivnost (slika se obično nalazi neposredno posle ili pre opisa aktivnosti; jedna slika može pripadati i više aktivnosti ako prikazuje više igara). Ako nema slike, prazna lista.`,
    schema: obj({
      activities: list(obj({
        code: str("oznaka"), title: str("naziv"), goal: str("cilj"), materials: strList("materijal"), frequency: str("učestalost"),
        steps: strList("koraci"), levels: list(obj({ name: str("naziv nivoa"), text: str("opis") }), "nivoi"),
        adapt: str("prilagođavanje"), parentTracks: strList("šta roditelj prati"), develops: str("šta razvijamo"), note: str("napomena"),
        imageNumbers: { type: "array", items: { type: "integer" } },
      }), "aktivnosti"),
    }),
  },

  routines: {
    maxTokens: 20000,
    instruction: `ZADATAK: Prenesi sve OSTALO što je važno roditeljima, a nije procena, ciljevi ni pojedinačne aktivnosti.
- principles: pravila/strategije za roditelje ako postoje (title, text).
- routines: svakodnevne rutine (jutarnja rutina, obrok, kupanje, park, odlazak na spavanje…): title, focus (šta se razvija, kratko), text (kako to izgleda u svakodnevnom životu, pasusi; uključi i razvojne prilike iz tabela kao listu), activityTitles (nazivi aktivnosti iz programa koje se koriste), parentTracks (šta se prati), note (napomena).
- sections: ostala korisna poglavlja za roditelje (npr. objašnjenje budnosti i zona, vrste pažnje i kako ih prepoznati, priče za emocije, praćenje napretka i indikatori, znaci za prekid aktivnosti, završne preporuke, napredak dece i polazne tačke). title + body (markdown, verno, pregledno). Ne ponavljaj procenu, ciljeve ni aktivnosti.
- encouragements: poruke ohrabrenja za porodicu (svaka posebna stavka).
- motto: završni moto ako postoji.
- closingMessage: završna poruka roditeljima ako postoji (markdown).`,
    schema: obj({
      principles: list(obj({ title: str("strategija"), text: str("kako se primenjuje") }), "pravila"),
      routines: list(obj({ title: str("rutina"), focus: str("fokus"), text: str("opis, markdown"), activityTitles: strList("aktivnosti"), parentTracks: strList("šta se prati"), note: str("napomena") }), "rutine"),
      sections: list(obj({ title: str("naslov"), body: str("sadržaj, markdown") }), "ostala poglavlja"),
      encouragements: strList("poruke ohrabrenja"),
      motto: str("moto"),
      closingMessage: str("završna poruka"),
    }),
  },
};

/* ------------------------------------------------------------------ HANDLER */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, configured: Boolean(process.env.ANTHROPIC_API_KEY && SUPABASE_URL && SUPABASE_KEY), model: MODEL });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Dozvoljen je samo POST." });

  try {
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "Nije podešen ANTHROPIC_API_KEY na Vercel-u." });
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: "Nisu podešeni Supabase ključevi na Vercel-u." });

    // 1) samo prijavljeni defektolog
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Niste prijavljeni." });
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: auth } });
    if (!userRes.ok) return res.status(401).json({ error: "Sesija je istekla. Prijavite se ponovo." });

    // 2) ulaz
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const task = TASKS[body.task];
    if (!task) return res.status(400).json({ error: "Nepoznat zadatak." });
    const text = String(body.text || "");
    if (text.length < 200) return res.status(400).json({ error: "Dokument je prazan ili nije pročitan." });
    if (text.length > MAX_TEXT) return res.status(400).json({ error: "Dokument je predugačak. Podelite ga na manje delove." });

    let instruction = task.instruction;
    if (body.task === "activities") {
      const codes = (Array.isArray(body.items) ? body.items : []).slice(0, 12)
        .map(a => `"${String(a.code).slice(0, 20)}" – ${String(a.title).slice(0, 200)} (počinje sa: „${String(a.startsWith || "").slice(0, 200)}“)`);
      if (!codes.length) return res.status(400).json({ error: "Nije naveden spisak aktivnosti." });
      instruction = instruction.replace("{{CODES}}", "\n" + codes.join("\n"));
    }

    // 3) Claude API (dokument se kešira između poziva istog uvoza)
    const payload = {
      model: MODEL,
      max_tokens: task.maxTokens,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `<dokument>\n${text}\n</dokument>`, cache_control: { type: "ephemeral" } },
          { type: "text", text: instruction },
        ],
      }],
      output_config: { format: { type: "json_schema", schema: task.schema } },
    };
    const data = await callClaude(payload);
    if (data.stop_reason === "max_tokens") {
      return res.status(502).json({ error: "Odgovor je bio predugačak. Pokušajte ponovo ili podelite dokument." });
    }
    if (data.stop_reason === "refusal") return res.status(502).json({ error: "AI je odbio obradu ovog dokumenta." });
    const block = (data.content || []).find(b => b.type === "text");
    if (!block) return res.status(502).json({ error: "AI nije vratio odgovor." });
    let result;
    try { result = JSON.parse(block.text); } catch { return res.status(502).json({ error: "AI je vratio neispravan odgovor. Pokušajte ponovo." }); }
    return res.status(200).json({ result, usage: data.usage || null });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return res.status(status).json({ error: err.publicMessage || "Greška na serveru. Pokušajte ponovo." });
  }
}

async function callClaude(payload, attempt = 1) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (r.ok) return r.json();
  let detail = {};
  try { detail = await r.json(); } catch {}
  const code = detail && detail.error && detail.error.details && detail.error.details.error_code;
  if ((r.status === 429 || r.status === 529 || r.status >= 500) && attempt < 4 && code !== "enforced_spend_limit_reached") {
    const wait = Math.min(Number(r.headers.get("retry-after")) || attempt * 4, 20);
    await new Promise(ok => setTimeout(ok, wait * 1000));
    return callClaude(payload, attempt + 1);
  }
  const err = new Error("Claude API: " + r.status);
  err.status = r.status === 401 ? 500 : 502;
  err.publicMessage =
    r.status === 401 ? "ANTHROPIC_API_KEY nije ispravan." :
    code === "enforced_spend_limit_reached" ? "Dostignut je mesečni limit potrošnje na Anthropic nalogu." :
    r.status === 400 ? "AI nije prihvatio zahtev: " + ((detail.error && detail.error.message) || "neispravan zahtev") :
    "AI servis je trenutno zauzet. Pokušajte ponovo za minut.";
  throw err;
}
