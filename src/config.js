/* Podešavanja aplikacije koja se retko menjaju. */

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT || "/api/ai";

export const PROFILE = {
  ime: "Dragana Vasilijević",
  imeKratko: "Dragana",
  imeDativ: "Dragani",     // "pošaljite Dragani"
  imeGenitiv: "Dragane",   // "Podrška Dragane"
  imeAkuzativ: "Draganu",  // "pitanja za Draganu"
  inicijali: "DV",
  titula: "Master defektolog – somatoped",
  uloga: "Kućni defektolog",
  kratko: "Defektolog · podrška porodici",
  opis: "Podršku povezujemo sa interesovanjima deteta, njegovim razvojnim potrebama i svakodnevicom vaše porodice.",
  citat: "Postepeno. U svom ritmu. Ka uspehu.",
  foto: "/dragana.jpg",
  avatar: "/dragana-avatar.jpg",
  // Pozdrav koji porodica vidi na početku programa (dok ga ne zatvori)
  dobrodoslica: "Drago mi je što ste tu. Ovde je sve što smo zajedno isplanirali za vaše dete. Ne morate uraditi sve – dovoljno je malo, ali redovno. Svaki dan vas čeka kratak plan, a kad god vam nešto nije jasno ili imate dan kada ništa ne ide, pišite mi. Tu sam.",
};

// Rečenice kad porodica uradi ceo „Plan za danas“
export const BRAVO = [
  "Bravo! Danas ste uradili sve – i za dete i za vas to je mnogo. 🌱",
  "Ceo plan za danas je gotov. Ponosni budite na sebe. ☀",
  "Uspeli ste! Mali koraci, svaki dan – baš tako se raste. 🌿",
  "Sve tri stvari danas. To je pravi porodični ritam. 💛",
];

export const ISKUSTVA = [
  { id: "prijalo", naziv: "Prijalo je", ikona: "☀", boja: "#7d9a7b" },
  { id: "prilagodjavanje", naziv: "Uz prilagođavanje", ikona: "◌", boja: "#d5a24c" },
  { id: "pauza", naziv: "Bila je potrebna pauza", ikona: "☁", boja: "#c98b6b" },
  { id: "istrazujemo", naziv: "Još istražujemo", ikona: "✧", boja: "#a9b4c2" },
];

export const BUDNOST = ["", "Pospano, usporeno", "Mirno i dostupno", "Uzbuđeno, nemirno", "Preopterećeno"];

export const SAGLASNOST = `Ovaj program je napravljen samo za vašu porodicu. Zapažanja, nedeljni osvrti i poruke koje ovde upišete čuvaju se bezbedno na serveru u Evropskoj uniji i vidi ih samo ${PROFILE.ime}, kako bi pratila napredak i prilagođavala program. Vaš lični kod ne delite sa drugima. Podatke možete u svakom trenutku obrisati ili zatražiti njihovo brisanje.`;

export const PODRAZUMEVANI_SAVETI = [
  "Ne morate uraditi sve. Jedna dobra, kratka interakcija može biti sasvim dovoljna za taj dan.",
  "Detetov odgovor je informacija. Ako nešto ne prija, prilagođavanje nije neuspeh – to je praćenje deteta.",
  "Napredak se često vidi u malim stvarima: dužem pogledu, lakšem prelazu, jednom novom pokretu ili trenutku zajedničkog smeha.",
  "Roditelj ne mora da bude terapeut ceo dan. Najvrednije je da podrška može da stane u stvarni život porodice.",
  "Ponavljanje je učenje. Poznata aktivnost nije „premalo“ ako detetu pomaže da bude regulisano, povezano i dostupno.",
  "Odmor roditelja je deo plana podrške. Kada ste iscrpljeni, birajte najjednostavniju verziju aktivnosti ili je tog dana preskočite.",
];

export const CESTA_PITANJA = [
  { p: "Da li treba uraditi sve aktivnosti?", o: "Ne. Program je ponuda, a ne obaveza. Izaberite ono što tog dana ima smisla – i jedna aktivnost je dovoljna." },
  { p: `Da li ${PROFILE.imeKratko} vidi moje beleške?`, o: `Da. Zapažanja, nedeljni osvrti i poruke koje sačuvate stižu ${PROFILE.imeDativ}, da bi mogla da prati napredak i prilagodi program. Niko drugi ih ne vidi.` },
  { p: "Šta ako promenim telefon?", o: "Otvorite isti link ili upišite svoj kod porodice – sve vaše beleške su sačuvane i ponovo će se pojaviti." },
  { p: "Kako da instaliram aplikaciju na telefon?", o: "Android (Chrome): meni ⋮ → Instaliraj aplikaciju. iPhone (Safari): dugme za deljenje → Dodaj na početni ekran. Pri prvom otvaranju sa početnog ekrana upišite kod porodice." },
];
