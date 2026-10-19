/*
  SADRŽAJ PROGRAMA
  ----------------
  Ovde Dragana menja sve tekstove: aktivnosti, korake, nedelje, savete.
  Aplikaciju nije potrebno dirati – dovoljno je izmeniti ovaj fajl i osvežiti stranicu.

  VIDEO: svakoj aktivnosti može da se doda polje  video: "https://youtu.be/..."
  i u opisu aktivnosti će se pojaviti dugme "Pogledaj video-prikaz".

  NAPOMENA: koraci aktivnosti ("koraci" i "pratimo") su NACRT
  i treba da ih Dragana proveri i prepravi.
*/

export const PROGRAM = {
  porodica: "Porodica 1 · Prvi mesec",
  trajanje: "4 nedelje",

  defektolog: {
    ime: "Dragana Vasilijević",
    inicijali: "DV",
    titula: "Master defektolog – somatoped",
    uloga: "Kućni defektolog",
    kratko: "Defektolog · podrška porodici",
    opis: "Podršku povezujemo sa interesovanjima deteta, njegovim razvojnim potrebama i svakodnevicom vaše porodice.",
    citat: "Postepeno. U svom ritmu. Ka uspehu."
  },

  kategorije: {
    regulacija: { naziv: "Regulacija budnosti", ilustracija: "knjiga" },
    paznja: { naziv: "Pažnja i razumevanje", ilustracija: "muzika" },
    pokret: { naziv: "Pokret i koordinacija", ilustracija: "deca" }
  },

  nedelje: [
    {
      broj: 1,
      kratko: "Telo i budnost",
      naslov: "Upoznajemo šta prija telu",
      opis: "Proprioceptivni trening, guranje/nošenje, Palačinka, prirodni mirisi.",
      fokusNaslov: "Regulacija budnosti, proprioceptivna i taktilna obrada",
      fokusTekst: "Regulacija budnosti prati se tokom sve četiri nedelje. Aktivnosti su kratke, predvidive i prilagođene detetovom trenutnom stanju. Cilj nije da se svakog dana uradi sve, već da porodica izabere ono što je u tom trenutku funkcionalno."
    },
    {
      broj: 2,
      kratko: "Pažnja i razumevanje",
      naslov: "Slušamo, čekamo i razumemo",
      opis: "Zvuci oko nas, stani–kreni uz muziku, ritam i jednostavni nalozi.",
      fokusNaslov: "Slušna pažnja, iščekivanje i razumevanje kratkih reči",
      fokusTekst: "Ove nedelje pratimo kako dete reaguje na zvuk, početak i prestanak muzike i kratke reči. Važnije od tačnog odgovora je da primetimo kada je dete uključeno i šta mu pomaže da ostane u igri."
    },
    {
      broj: 3,
      kratko: "Pokret",
      naslov: "Telo u pokretu, zajedno",
      opis: "Imitacija životinja, igre sa loptom, ljuljanje i trambolina.",
      fokusNaslov: "Gruba motorika, ravnoteža i imitacija",
      fokusTekst: "Kroz smešne i predvidive motoričke igre gradimo koordinaciju, oslonac i zajedničku razmenu. Birajte jednu ili dve igre koje dete voli i ponavljajte ih – ponavljanje je učenje."
    },
    {
      broj: 4,
      kratko: "Dnevne rutine",
      naslov: "Podrška kroz dan",
      opis: "Poznate aktivnosti iz prethodnih nedelja uklapamo u svakodnevne rutine.",
      fokusNaslov: "Prenos naučenog u svakodnevicu",
      fokusTekst: "Ne uvodimo ništa novo. Biramo ono što je dobro prošlo i povezujemo to sa buđenjem, oblačenjem, obrocima, kupanjem i odlaskom na spavanje.",
      rutine: true
    }
  ],

  aktivnosti: [
    {
      id: "1.1", nedelja: 1, kategorija: "regulacija",
      naziv: "Proprioceptivni trening celog tela",
      cilj: "Da dete kroz čvrst, predvidiv i prijatan telesni input dobije jasniju informaciju o položaju tela, lakše organizuje budnost i bude dostupnije za kontakt i narednu aktivnost.",
      koraci: [
        "Izaberite mirno mesto i mekanu podlogu (strunjača, ćebe ili krevet).",
        "Najavite igru uvek istim rečima, na primer: „Sad stiskamo telo.“",
        "Čvrstim i ravnomernim pritiskom dlanova pritiskajte ramena, ruke i noge, idući od gore ka dole.",
        "„Sendvič“: dete leži između dva jastuka, a vi lagano pritiskate gornji jastuk.",
        "Pratite lice i telo deteta – ako se izmiče, smanjite pritisak ili stanite.",
        "Završite istim rečima i kratkom mirnom pauzom ili zagrljajem."
      ],
      pratimo: ["Da li se dete smiruje ili traži još?", "Kakav je kontakt posle igre?", "Koliko je dugo ostalo u igri?"]
    },
    {
      id: "1.2", nedelja: 1, kategorija: "regulacija",
      naziv: "Guranje i nošenje težih predmeta - „Brm, brm, vozimo“",
      cilj: "Da kroz „heavy work“ dete dobije jak proprioceptivni input uz grubu motoriku, bilateralnu upotrebu ruku, core i zajedničku igru.",
      koraci: [
        "Pripremite korpu za veš ili kutiju sa nekoliko knjiga, tako da je teža, ali da je dete može pomeriti.",
        "Uz „Brm, brm, vozimo!“ dete gura „auto“ od jedne do druge sobe.",
        "Dajte detetu da nosi nešto teže do cilja (npr. flašu vode do kuhinje), a vi idete pored.",
        "Na kraju zajedno „istovarite teret“ i proslavite."
      ],
      pratimo: ["Da li koristi obe ruke?", "Da li izdrži do cilja?", "Smeh, pogled, traženje ponavljanja."]
    },
    {
      id: "1.3", nedelja: 1, kategorija: "regulacija",
      naziv: "Palačinka",
      cilj: "Da se kroz zabavnu i predvidivu telesnu igru povežu proprioceptivna i taktilna obrada sa združenom pažnjom, iščekivanjem i spontanom komunikacijom.",
      koraci: [
        "Raširite ćebe na pod i najavite: „Pravimo palačinku!“",
        "Dete legne na ivicu ćebeta, glava i ruke ostaju napolju.",
        "Polako ga umotajte – „pečemo palačinku“.",
        "Dodajte „fil“: lagano pritiskajte dlanovima duž tela i imenujte delove („malo džema na nogice“).",
        "Zastanite i sačekajte da dete pogledom, zvukom ili rečju zatraži nastavak.",
        "Polako ga odmotajte i ponovite ako mu prija."
      ],
      pratimo: ["Da li iščekuje nastavak?", "Kako traži još (pogled, glas, reč, pokret)?", "Da li toleriše umotavanje?"]
    },
    {
      id: "1.4", nedelja: 1, kategorija: "regulacija",
      naziv: "Olfaktorna stimulacija kroz prirodne mirise",
      cilj: "Da kroz prirodne mirise pratimo detetovu budnost i reakciju, a istovremeno vežbamo taktilnu obradu, finu motoriku i zajedničku pažnju.",
      koraci: [
        "Pripremite 3–4 prirodna mirisa: koru limuna ili pomorandže, cimet, nanu, lavandu.",
        "Prvo vi pomirišite i izrazom lica pokažite kako miriše.",
        "Ponudite detetu miris na udaljenosti – ne prinosite ga naglo nosu.",
        "Neka dete dodirne, protrlja ili izgnječi list ili koru dok imenujete miris.",
        "Primetite koji mirisi ga smiruju, a koji razbuđuju."
      ],
      pratimo: ["Reakcija na svaki miris (prihvata, okreće glavu, traži još).", "Promena budnosti posle mirisa.", "Da li gleda u vas kad pomiriše?"]
    },
    {
      id: "2.1", nedelja: 2, kategorija: "paznja",
      naziv: "Slušaj i uči",
      cilj: "Razvoj auditivne tolerancije, slušne pažnje, lokalizacije zvuka i povezivanja zvuka sa izvorom, predmetom i značenjem.",
      koraci: [
        "Izaberite 3–4 predmeta koji proizvode zvuk (zvečka, zvonce, kesica, kašika i šerpa).",
        "Pokažite predmet i zvuk zajedno i imenujte ga.",
        "Sakrijte predmet iza sebe ili ispod ćebeta, proizvedite zvuk i sačekajte da dete potraži izvor.",
        "Menjajte stranu: levo, desno, iza, ispred.",
        "Kada pronađe izvor, dajte mu predmet da samo proizvede zvuk."
      ],
      pratimo: ["Da li okreće glavu ka zvuku?", "Koji zvuci mu smetaju?", "Da li povezuje zvuk sa predmetom?"]
    },
    {
      id: "2.2", nedelja: 2, kategorija: "paznja",
      naziv: "Stani - kreni / Dan - noć uz gitaru",
      cilj: "Da kroz omiljenu muziku dete registruje početak i prestanak zvuka, zaustavlja pokret i postepeno povezuje kratku reč sa motoričkim odgovorom.",
      koraci: [
        "Pustite omiljenu pesmu ili svirajte gitaru.",
        "Dok muzika svira, zajedno se krećete – hodate, plešete ili mašete.",
        "Kada muzika stane, i vi stanete u mestu uz „Stani!“.",
        "Varijanta Dan–noć: muzika je dan (krećemo se), tišina je noć (legnemo i „spavamo“).",
        "Postepeno izgovarajte reč („kreni“, „stani“) malo pre pokreta."
      ],
      pratimo: ["Da li primećuje kad muzika stane?", "Da li zaustavlja pokret samo ili uz pomoć?", "Da li reaguje na reč bez muzike?"]
    },
    {
      id: "2.3", nedelja: 2, kategorija: "paznja",
      naziv: "Pratimo ritam - tapšemo i lupkamo nogama",
      cilj: "Da kroz veoma jednostavnu muzičku igru razvijamo auditivnu pažnju, imitaciju, ritam, združenu pažnju i spontani kontakt očima.",
      koraci: [
        "Sedite licem u lice sa detetom.",
        "Tapšite jednostavan, spor ritam (dva puta tap-tap, pauza).",
        "Sačekajte da dete pokuša da ponovi – pomozite rukama ako je potrebno.",
        "Promenite na lupkanje nogama ili po kolenima.",
        "Neka dete bude „vođa“, a vi ponavljate njegov ritam."
      ],
      pratimo: ["Da li imitira?", "Da li gleda u vas tokom pauze?", "Da li uživa kad ga vi imitirate?"]
    },
    {
      id: "2.4", nedelja: 2, kategorija: "paznja",
      naziv: "Razumem i uradim - jednostavni nalozi",
      cilj: "Da dete razume kratke funkcionalne reči i naloge u aktivnostima koje već poznaje, uz postepeno smanjivanje vizuelne i fizičke pomoći.",
      koraci: [
        "Izaberite aktivnost koju dete dobro poznaje (pospremanje igračaka, oblačenje).",
        "Dajte kratak nalog od 1–2 reči: „Daj loptu“, „Sedi“.",
        "Ako je potrebno, pokažite rukom ili pomozite fizički.",
        "Sledeći put dajte samo reč i gest, zatim samo reč.",
        "Svaki uspeh odmah pohvalite ili nagradite nastavkom igre."
      ],
      pratimo: ["Koliko pomoći je bilo potrebno?", "Koje reči razume bez gesta?", "U kojoj situaciji najbolje sarađuje?"]
    },
    {
      id: "3.1", nedelja: 3, kategorija: "pokret",
      naziv: "Pogodi ko sam - životinje u pokretu",
      cilj: "Razvoj grube motorike, core-a, oslonca na ruke, koordinacije i praksije kroz detetovu očuvanu sposobnost imitacije.",
      koraci: [
        "Pokažite sliku ili igračku životinje i imenujte je.",
        "Pokažite kako se kreće: medved hoda na rukama i nogama, žaba skače, zmija puzi.",
        "Pozovite dete da „bude“ ta životinja zajedno sa vama.",
        "Dodajte zvuk životinje dok se krećete.",
        "Zamenite uloge – dete pokazuje, vi pogađate."
      ],
      pratimo: ["Koje pokrete imitira?", "Da li drži oslonac na rukama?", "Da li inicira novu životinju?"]
    },
    {
      id: "3.2", nedelja: 3, kategorija: "pokret",
      naziv: "Senzomotorne vežbe sa obrascem otvaranja-zatvaranja (Moro obrazac)",
      cilj: "Razvoj telesne organizacije, kontrole fleksije i ekstenzije, bilateralne koordinacije i tolerancije na promenu položaja kroz spore, predvidive senzomotorne sekvence.",
      koraci: [
        "Dete leži na leđima na mekanoj podlozi, vi ste pored njega.",
        "Uz reč „zatvori“ zajedno skupite ruke i noge ka stomaku („klupko“).",
        "Uz reč „otvori“ polako raširite ruke i noge („zvezda“).",
        "Ponavljajte sporo, u istom ritmu, uz pesmicu ili brojanje.",
        "Prekinite ako se dete uplaši ili napne – ovu vežbu radite samo onako kako ju je Dragana pokazala."
      ],
      pratimo: ["Da li prati ritam otvori–zatvori?", "Tolerancija na položaj na leđima.", "Da li koristi obe strane tela jednako?"]
    },
    {
      id: "3.3", nedelja: 3, kategorija: "pokret",
      naziv: "Kotrljanje lopte i ubacivanje u kutiju",
      cilj: "Da se kroz jednostavnu igru licem u lice prate budnost, kontakt i interakcija, uz razvoj koordinacije, planiranja pokreta i razumevanja kratkih naloga.",
      koraci: [
        "Sedite na pod licem u lice, raširenih nogu.",
        "Kotrljajte loptu jedno drugom uz „tebi – meni“.",
        "Postavite kutiju sa strane i recite „ubaci“.",
        "Povećajte razdaljinu kada dete uspeva.",
        "Pre kotrljanja sačekajte pogled – tek onda pošaljite loptu."
      ],
      pratimo: ["Da li čeka na red?", "Da li gleda pre nego što dobije loptu?", "Da li razume „ubaci“?"]
    },
    {
      id: "3.4", nedelja: 3, kategorija: "pokret",
      naziv: "Hodanje sa loptom između nogu - „Hodaj kao ja“",
      cilj: "Razvoj imitacije, ravnoteže, koordinacije, core-a i emocionalne razmene kroz smešnu zajedničku motoričku igru.",
      koraci: [
        "Stavite loptu između kolena i pokažite smešan hod.",
        "Recite „Hodaj kao ja!“ i dajte detetu loptu.",
        "Hodajte zajedno do cilja (jastuk, vrata).",
        "Ako lopta ispadne – smejte se zajedno i počnite ponovo."
      ],
      pratimo: ["Ravnoteža i broj koraka.", "Da li imitira hod?", "Zajednički smeh i pogled."]
    },
    {
      id: "3.5", nedelja: 3, kategorija: "pokret",
      naziv: "Vesela lopta",
      cilj: "Razvoj vestibularno-proprioceptivne obrade kroz funkcionalnu igru sa loptom, uz grubu motoriku, posturalnu kontrolu, ravnotežu, bilateralnu koordinaciju, praksiju i razumevanje glagola.",
      koraci: [
        "Koristite veliku loptu za vežbanje; vi stalno pridržavate dete.",
        "Dete sedi na lopti, a vi lagano poskakujete – „hop, hop“.",
        "Polako ljuljajte napred–nazad i levo–desno.",
        "Imenujte radnje: „skači“, „stani“, „ljuljaj“.",
        "Završite spuštanjem na pod i kratkim odmorom."
      ],
      pratimo: ["Da li toleriše kretanje?", "Kako drži telo na lopti?", "Da li razume glagole?"]
    },
    {
      id: "3.6", nedelja: 3, kategorija: "pokret",
      naziv: "Ljuljanje - „Dodirni me dok se ljuljam“ i „Ubaci i uhvati“",
      cilj: "Da se vestibularni input poveže sa propriocepcijom, kontaktom, združenom pažnjom, iščekivanjem i jednostavnom razmenom predmeta.",
      koraci: [
        "Dete se ljulja (ljuljaška ili ćebe koje drže dvoje odraslih).",
        "Stanite ispred i ispružite dlan – „Dodirni me!“ kada se približi.",
        "Dajte mu mekanu igračku da je ubaci u kutiju dok prolazi.",
        "Pre svakog guranja zastanite i sačekajte signal („još“, pogled).",
        "Usporite i završite mirnim ljuljanjem."
      ],
      pratimo: ["Koliko ljuljanja mu prija?", "Da li traži nastavak?", "Da li uspeva da dodirne ili ubaci?"]
    },
    {
      id: "3.7", nedelja: 3, kategorija: "pokret",
      naziv: "Trambolina - „Skačemo i brojimo“",
      cilj: "Da se kroz ritmično skakanje povežu vestibularna/proprioceptivna obrada, ravnoteža, ritam, slušna pažnja, zaustavljanje na signal i kontakt sa mamom.",
      koraci: [
        "Držite dete za ruke dok skače na trambolini (ili na dušeku).",
        "Brojite naglas svaki skok: „jedan, dva, tri…“.",
        "Na „STOP!“ zajedno stanete.",
        "Sačekajte pogled ili reč pre nego što nastavite.",
        "Završite sa nekoliko sporih, mekih skokova i sedanjem."
      ],
      pratimo: ["Da li staje na signal?", "Ritam skakanja.", "Kontakt pogledom u pauzi."]
    }
  ],

  // "Procena i ciljevi" – polazište programa (NACRT, Dragana upisuje za svaku porodicu)
  procena: {
    polaziste: "Ovde Dragana ukratko opisuje šta je primetila na prvom susretu: šta detetu prija, šta mu je teško i šta porodica želi da promeni.",
    ciljevi: [
      "Lakše smirivanje i prelazak sa jedne aktivnosti na drugu.",
      "Duži zajednički pogled i više zajedničke igre.",
      "Razumevanje kratkih reči i naloga u svakodnevici.",
      "Sigurnije kretanje, ravnoteža i koordinacija."
    ]
  },

  // Nedelja 4 – "Podrška kroz dan" (NACRT, Dragana dopunjuje)
  rutine: [
    { naziv: "Buđenje", savet: "Nekoliko minuta „Palačinke“ ili stiskanja pre ustajanja." },
    { naziv: "Oblačenje", savet: "Kratki nalozi: „ruka“, „noga“, „glava“ – uvek istim redom." },
    { naziv: "Umivanje i zubi", savet: "Pesmica ili brojanje da bi trajanje bilo predvidivo." },
    { naziv: "Obroci", savet: "Pre obroka nešto „teško“: da dete odnese tanjire ili flašu do stola." },
    { naziv: "Izlazak iz kuće", savet: "Najavite šta sledi rečju ili slikom." },
    { naziv: "Igra posle vrtića", savet: "Jedna omiljena igra iz programa, kratko." },
    { naziv: "Kupanje", savet: "Imenujte delove tela dok ih brišete peškirom uz čvrst pritisak." },
    { naziv: "Pospremanje igračaka", savet: "„Ubaci u kutiju“ kao u igri sa loptom." },
    { naziv: "Odlazak na spavanje", savet: "Isti mirni redosled svake večeri, prigušeno svetlo, tiha muzika." }
  ],

  saveti: [
    "Ne morate uraditi sve. Jedna dobra, kratka interakcija može biti sasvim dovoljna za taj dan.",
    "Detetov odgovor je informacija. Ako nešto ne prija, prilagođavanje nije neuspeh - to je praćenje deteta.",
    "Napredak se često vidi u malim stvarima: dužem pogledu, lakšem prelazu, jednom novom pokretu ili trenutku zajedničkog smeha.",
    "Roditelj ne mora da bude terapeut ceo dan. Najvrednije je da podrška može da stane u stvarni život porodice.",
    "Ponavljanje je učenje. Poznata aktivnost nije „premalo“ ako detetu pomaže da bude regulisan, povezan i dostupan.",
    "Odmor roditelja je deo plana podrške. Kada je mama iscrpljena, biramo najjednostavniju verziju aktivnosti ili je tog dana preskačemo."
  ],

  cesta_pitanja: [
    { p: "Da li treba uraditi sve aktivnosti?", o: "Ne. Program je ponuda, a ne obaveza. Izaberite ono što tog dana ima smisla – i jedna aktivnost je dovoljna." },
    { p: "Da li Dragana vidi moje beleške?", o: "U ovoj verziji ne. Beleške se čuvaju samo na ovom uređaju, u ovom pregledaču. Možete ih preuzeti ili kopirati i poslati Dragani dogovorenim kanalom." },
    { p: "Gde će biti video-prikaz?", o: "Video-prikazi aktivnosti biće dodati u narednoj verziji, uz svaku aktivnost u delu „Pogledaj korake“." }
  ],

  iskustva: [
    { id: "prijalo", naziv: "Prijalo je", ikona: "☀" },
    { id: "prilagodjavanje", naziv: "Uz prilagođavanje", ikona: "◌" },
    { id: "pauza", naziv: "Bila je potrebna pauza", ikona: "☁" },
    { id: "istrazujemo", naziv: "Još istražujemo", ikona: "✧" }
  ]
};
