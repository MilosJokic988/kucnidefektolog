# Kućni defektolog

Program podrške porodici: plan po nedeljama, aktivnosti sa koracima, dnevnik zapažanja i prostor za pitanja.

## Pokretanje (Vite)

Potreban je **Node.js 20.19 ili noviji** (https://nodejs.org, verzija "LTS"). Proveri u terminalu: `node -v`.

U VS Code-u otvori folder `kucni-defektolog` (File → Open Folder), pa otvori terminal (**Terminal → New Terminal**) i ukucaj:

```bash
npm install      # samo prvi put – skida Vite
npm run dev      # pokreće aplikaciju i otvara je u pregledaču
```

Aplikacija radi na adresi koju ispiše terminal (obično http://localhost:5173). Svaka izmena se odmah vidi.
Zaustavljanje: u terminalu `Ctrl + C`.

Za objavljivanje na internetu: `npm run build` napravi folder `dist/` koji se postavlja na hosting (Netlify, Vercel, GitHub Pages...).

## Šta aplikacija ima

- **Predlog za danas** – na početnoj strani jedna aktivnost iz tekuće nedelje (u 4. nedelji poznate igre), uz „Drugi predlog“.
- **Korak po korak** – koraci jedan po jedan, velikim slovima, sa tajmerom od 3/5/10 min (zvuk i vibracija na kraju). Na kraju jedan klik za „Kako je prošlo?“.
- **Pregled napretka** (Naša zapažanja → Pregled napretka) – kalendar poslednje 4 nedelje, statistika i „Šta najviše prija“.
- **Izveštaj za konsultacije** – pregled poslednjih 30 dana, spreman za štampu ili „Sačuvaj kao PDF“.
- **Rezervna kopija** – preuzimanje svih beleški u fajl i vraćanje na drugom telefonu/računaru.
- **Rad na telefonu** – meni na dnu ekrana; posle objavljivanja može da se doda na početni ekran telefona i radi bez interneta.
- **Video-prikaz** – u `src/data.js` dodaj aktivnosti `video: "https://youtu.be/..."`.

## Instalacija na telefon

Radi tek kada je aplikacija objavljena na internetu (https adresa), ne preko `npm run dev`.
- Android (Chrome): meni ⋮ → **Dodaj na početni ekran / Instaliraj aplikaciju**.
- iPhone (Safari): dugme za deljenje → **Dodaj na početni ekran**.

## Šta je gde

| Fajl | Šta sadrži |
|---|---|
| `src/data.js` | **Sav sadržaj**: nedelje, aktivnosti, koraci, saveti, pitanja, podaci o Dragani. Ovde se menjaju tekstovi. |
| `src/style.css` | Izgled: boje, fontovi, razmaci. Boje su na vrhu fajla. |
| `src/main.js` | Logika aplikacije (stranice, čuvanje beleški, štampa). |
| `index.html` | Okvir stranice i meni. |

## Kako dodati novu aktivnost

U `src/data.js`, u listu `aktivnosti`, kopiraj jedan blok `{ ... },` i promeni:
`id`, `nedelja` (1–4), `kategorija` (`regulacija`, `paznja` ili `pokret`), `naziv`, `cilj`, `koraci` i `pratimo`.

## Važno

- Koraci aktivnosti, tekst „Procena i ciljevi" i rutine su **nacrt**. Dragana treba da ih proveri i prepravi.
- Beleške, isprobane aktivnosti i pitanja čuvaju se **samo u pregledaču** na uređaju roditelja. Ništa se ne šalje na internet.
