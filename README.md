# Kućni defektolog

Aplikacija za program podrške porodici, sa dva dela:

- **Porodice (roditelji)** otvaraju svoj lični link ili upisuju kod. Vide svoj program po nedeljama, aktivnosti sa ilustracijama i korake, mogu da rade „korak po korak“ uz tajmer, beleže zapažanja i pišu Dragani.
- **Dragana (defektolog)** se prijavljuje mejlom i šifrom. Vidi sve porodice i njihova zapažanja i poruke. Novi program pravi tako što ubaci **Word ili PDF** fajl. AI ga pretvori u aplikaciju, a ona ga pregleda, po potrebi ispravi i objavi.

Tehnički: Vite (bez dodatnih biblioteka), Supabase (baza i prijava), Vercel (hosting i AI funkcija), Claude API (čitanje programa).

---

## 1. Postavljanje (radi se samo jednom, oko 20 minuta)

### A) Supabase – baza podataka
1. Otvorite **supabase.com** i napravite besplatan nalog.
2. Kliknite **New project**:
   - Name: `kucni-defektolog`
   - Database password: izmislite jaku šifru i sačuvajte je
   - Region: **Central EU (Frankfurt)**, da podaci ostanu u EU
3. Kada se projekat napravi, otvorite levo **SQL Editor → New query**. Nalepite **ceo** sadržaj fajla `supabase/schema.sql` i kliknite **Run**. Treba da piše „Success“.
4. **Nalog za Draganu:** levo **Authentication → Users → Add user → Create new user**. Upišite njen mejl i šifru i uključite **Auto Confirm User**.
5. **Zabranite registraciju drugima:** **Authentication → Sign In / Providers**, isključite **Allow new users to sign up** i kliknite Save.
6. **Adresa sajta** (za „zaboravljenu šifru“): **Authentication → URL Configuration → Site URL** postavite na `https://kucnidefektolog.vercel.app` (vašu adresu).
7. **Ključevi:** **Project Settings → API Keys** (ili „Data API“). Prepišite:
   - **Project URL** (npr. `https://abcd1234.supabase.co`)
   - **anon / publishable** ključ. To je javni ključ i sme da bude u aplikaciji. **Nikad ne koristite `service_role` / secret ključ.**

### B) Anthropic – AI koji čita programe
1. Otvorite **console.anthropic.com** i napravite nalog.
2. **Billing:** dopunite kredit (npr. 10 $) i **postavite mesečni limit potrošnje** (npr. 10 $), da ne bude iznenađenja.
3. **API Keys → Create Key.** Kopirajte ključ (počinje sa `sk-ant-`). Ovaj ključ je **tajan**.

### C) Vercel – podešavanje
1. Na Vercel-u otvorite projekat, pa **Settings → Environment Variables** i dodajte:

   | Ime | Vrednost |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL iz Supabase-a |
   | `VITE_SUPABASE_ANON_KEY` | anon / publishable ključ |
   | `ANTHROPIC_API_KEY` | ključ sa console.anthropic.com |

2. **Deployments →** kod poslednjeg deploy-a **⋯ → Redeploy**, da bi se ključevi učitali.
3. Proverite da je **GitHub repozitorijum privatan** (GitHub → Settings → Danger Zone → Change visibility).

### D) Lokalno pokretanje (opciono)
1. Kopirajte `.env.example` u `.env` i upišite Supabase URL i ključ.
2. U terminalu ukucajte `npm install`, pa `npm run dev`.
3. Uvoz Word/PDF fajla (AI) radi samo na Vercel-u, jer AI funkcija tamo živi. Sve ostalo radi i lokalno.

---

## 2. Kako se koristi

### Dragana
1. Otvori `…vercel.app/#/admin` i prijavi se. Link „Prijava za defektologa“ postoji i na početnoj strani.
2. **Nova porodica**: upiše naziv (npr. „Porodica Tino“) i samo ime deteta.
3. Prevuče **Word ili PDF** program. Za 1–3 minuta dobija **nacrt**: procenu, nedelje, aktivnosti sa koracima i ilustracijama, rutine i vodič.
4. Pregleda nacrt (kartice Osnovno / Nedelje / Aktivnosti / Procena / Rutine) i ispravi šta treba. Sve se čuva samo od sebe.
5. **Pregled kao roditelj**, pa **Objavi porodici** i izabere datum početka.
6. **Pošalji link porodici**: kopira se poruka sa linkom i kodom, koju nalepi u Viber.
7. Na listi porodica odmah vidi ko je u kojoj nedelji, nova zapažanja, nepročitane poruke i ko je „tih“ već nekoliko dana.
8. **Novi mesec:** u porodici otvori **Program → Novi program iz Word ili PDF fajla**. Stari program ide u istoriju, a zapažanja ostaju.

### Roditelji
- Otvore link iz poruke i jednom potvrde saglasnost.
- Instalacija na telefon: Android (Chrome) **⋮ → Instaliraj aplikaciju**, iPhone (Safari) **Deli → Dodaj na početni ekran**. Kad je prvi put otvore sa početnog ekrana, upišu **kod porodice**.

---

## 3. Testiranje i „čisto“ objavljivanje
- Kad pravite porodicu za probu, uključite **„Test porodica“**.
- Na listi porodica, dugme **„Obriši sve test porodice“** briše njih i **sve** njihove programe, zapažanja, poruke i slike.
- Kad krenete uživo, obrišite test porodice i u bazi ostaju samo prave.
- Aplikacija je **sakrivena od Google pretrage** (`noindex` i `robots.txt`). Porodice i njihovi podaci se nikad ne pojavljuju na internetu.
- Za potpuno brisanje svega (npr. pre pravog starta) u Supabase **SQL Editor** pokrenite: `delete from families;`

---

## 4. Troškovi (okvirno)
- **Supabase i Vercel:** besplatni planovi su dovoljni za desetine porodica. Supabase pauzira besplatan projekat posle 7 dana **bez ikakvog korišćenja**. Dok porodice koriste aplikaciju, to se ne dešava.
- **AI uvoz programa:** oko **0,20–0,50 $ po programu** (model Claude Sonnet 5.5). Za 10 porodica mesečno to je oko 2–5 $. Model se menja promenljivom `ANTHROPIC_MODEL` (npr. `claude-haiku-5-5` je višestruko jeftiniji, ali manje precizan).

---

## 5. Privatnost i bezbednost
- Porodice nemaju korisnička imena ni šifre. Pristupaju **ličnim kodom** od 8 znakova koji nije moguće pogoditi. Svaka porodica vidi **samo svoje** podatke. Dragana može da napravi novi kod, posle čega stari prestaje da radi.
- Tabelama u bazi niko ne pristupa direktno. Sve ide kroz proverene funkcije (`supabase/schema.sql`).
- Pre slanja AI-ju, aplikacija iz teksta **briše prezimena, telefone, mejlove, adrese i datume rođenja**. Upitnik i anamneza se ne prenose u aplikaciju.
- Podaci (zapažanja, poruke) su u Supabase bazi u EU. Roditelji pri prvom ulasku potvrđuju saglasnost (tekst je u `src/config.js`, `SAGLASNOST`). Uskladite ga sa ugovorom ili saglasnošću koju Dragana već ima sa porodicama.
- `ANTHROPIC_API_KEY` je samo na Vercel-u i nikad u kodu.

---

## 6. Šta je gde

| Fajl | Šta sadrži |
|---|---|
| `src/config.js` | Draganini podaci, tekst saglasnosti, česta pitanja, poruke ohrabrenja |
| `src/family.js` | Deo za roditelje |
| `src/admin.js`, `src/editor.js` | Deo za Draganu i uređivanje programa |
| `src/extract.js` | Čitanje Word/PDF fajlova (tekst + ilustracije) u pregledaču |
| `src/importer.js` | Tok uvoza: čitanje → AI → nacrt u bazi |
| `api/ai.js` | Vercel funkcija koja razgovara sa Claude API-jem (uputstva za AI su ovde) |
| `supabase/schema.sql` | Baza: tabele, bezbednost, funkcije |
| `src/style.css` | Izgled |
| `public/` | Ikonice, manifest za telefon, rad bez interneta, pdf.js |

---

## 7. Kad nešto ne radi
- **„Aplikacija još nije povezana sa bazom“**: nisu upisani `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` na Vercel-u, ili nije urađen Redeploy posle upisa.
- **„Pogrešan mejl ili šifra“**: proverite korisnika u Supabase → Authentication → Users (mora biti potvrđen).
- **Uvoz javlja da AI nije podešen**: dodajte `ANTHROPIC_API_KEY` na Vercel i uradite Redeploy.
- **„Dostignut je mesečni limit potrošnje“**: povećajte limit ili dopunite kredit na console.anthropic.com.
- **Skeniran PDF** (tekst je slika) ne može da se pročita. Pošaljite Word ili PDF sačuvan iz Word-a.
- **Supabase projekat pauziran**: otvorite supabase.com i kliknite **Restore project**.
