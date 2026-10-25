# Ankety v quacích

Status: **schváleno, bez otevřených rozhodnutí**. Implementace ani `plan.md` zatím neexistují.

## Příběh

Lidé se ve feedu ptají (např. „Kam půjdeme na oběd?“) a odpovědi pak počítají ručně. Někdo se přepočítá a původní příspěvek zapadne pod odpověďmi.

**Jako** přihlášený uživatel Quackeru
**chci** u quacku položit otázku s několika odpověďmi k výběru, nechat ostatní vybrat jednu a vidět, kolik lidí která odpověď získala,
**abychom** měli správná čísla bez ručního počítání a otázka nezapadla.

Cíl MVP: zjistit, jestli lidé ankety používají. Proto se měří použití (viz „Měření“). Nic navíc oproti tomuto dokumentu se nedělá.

## Rozsah a členění

Dokument má dvě části, které jdou dodat samostatně:

- **Core** (sekce A–F): původní zadání. Vytvoření ankety, zobrazení, hlasování, změna hlasu, viditelné selhání, správnost čísel.
- **Rozšíření** (sekce X1–X3): nastavení, které volí autor ankety: trvání, viditelnost výsledků a návrhy nových odpovědí od ostatních.

Pravidlo pro dodání po částech: anketa vytvořená dřív, než je dodáno dané nastavení, se chová jako s jeho „nejméně omezující“ hodnotou. Tedy: bez konce, výsledky hned, návrhy vypnuty. Výchozí hodnoty ve formuláři (tabulka níže) platí pro nové ankety po dodání příslušného rozšíření.

Texty v uvozovkách (`"…"`) jsou závazné texty rozhraní. Aplikace je dnes anglicky, ankety také. Ostatní popisy jsou chování, nikoli text.

## Slovník

- **Anketa**: volitelná příloha quacku. **Text quacku je otázka.** Quack bez ankety se nemění.
- **Odpověď**: jedna z možností ankety. Je buď _zveřejněná_ (lze pro ni hlasovat), nebo _čekající návrh_ (viz X3).
- **Hlas**: volba jednoho uživatele v jedné anketě. Uživatel má v anketě nejvýše jeden hlas.
- **Autor**: autor quacku s anketou.
- **Skončená anketa**: anketa, jejíž konec podle času serveru nastal (viz X1). Anketa bez konce neskončí nikdy.

## Nastavení ankety (přehled)

| Nastavení                       | Hodnoty                                                               | Výchozí pro nové ankety      | Nejméně omezující hodnota (starší / dosud nedodané) |
| ------------------------------- | --------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------- |
| Trvání (X1)                     | `"1 hour"`, `"1 day"`, `"7 days"`, `"No end"`                         | `"1 day"`                    | `"No end"`                                          |
| Výsledky (X2)                   | `"Show results immediately"`, `"Show results after voting"`           | `"Show results immediately"` | hned                                                |
| Nové odpovědi od ostatních (X3) | `"Not allowed"`, `"Published immediately"`, `"Author approves first"` | `"Not allowed"`              | vypnuto                                             |

Nastavení se volí při vytvoření a poté se **nemění**.

---

# Core

## A. Vytvoření ankety

- **A1**: _Given_ přihlášený uživatel ve formuláři nového quacku, _when_ klikne na `"Add poll"`, _then_ se objeví část pro anketu se dvěma prázdnými poli odpovědí a tlačítkem `"Add option"`. Tlačítko se přitom změní na `"Remove poll"`. Jeho stisk anketu zase odebere (včetně zadaných odpovědí) a quack se odešle bez ní.
- **A2**: Odpovědí je **2 až 10**. `"Add option"` přidá pole až do 10, pak je nedostupné. Každé pole nad minimum 2 jde odebrat tlačítkem s `aria-label` `"Remove option"`.
- **A3**: _Given_ text quacku platný podle stávajících pravidel (1–280 znaků po ořezání mezer) a platné odpovědi, _when_ uživatel odešle formulář, _then_ vznikne jeden quack s anketou, autor je z přihlášení (nikdy z těla požadavku) a pořadí odpovědí je pořadí zadání.
- **A4** (validace, klient **i** server; chyba u klienta pod polem, ne jen jako alert):
  - každá odpověď má po ořezání mezer 1–80 znaků; prázdné pole je chyba `"Fill in or remove this option"`, neignoruje se mlčky;
  - dvě odpovědi se stejným textem po ořezání mezer a bez ohledu na velikost písmen jsou chyba `"Answers must be different"`;
  - méně než 2 nebo více než 10 odpovědí je chyba;
  - server při porušení vrací `400` a **nevznikne nic**, ani quack bez ankety (vytvoření je atomické).
- **A5**: Odesílací tlačítko ukazuje stav pending a je při odesílání zakázané. Selže-li požadavek, zůstane zadaný obsah formuláře zachován a chyba se zobrazí v existujícím alertu formuláře.
- **A6**: Po úspěchu se nový quack s anketou objeví ve feedu nahoře, formulář se vyprázdní včetně části pro anketu a stávající chování „odeslání ukončí hledání“ zůstane.
- **A7**: Mood se u quacku s anketou chová stejně jako dnes (volitelný).
- **A8**: Nepřihlášený požadavek na vytvoření vrací `401`, jako dnes.

## B. Zobrazení ankety ve feedu

- **B1**: Quack s anketou ukazuje anketu **uvnitř své položky feedu** pod textem, bez vlastní karty nebo rámečku (DESIGN.md zakazuje vnořené karty). Stejná položka se používá i ve výsledcích hledání.
- **B2**: Každý řádek odpovědi ukazuje text odpovědi, **počet hlasů**, **procento** a **pruh**. Procento je celé číslo, počítá se `počet / celkem × 100` a zaokrouhluje se obvyklým zaokrouhlením (.5 nahoru). Při celkem 0 hlasech je 0 %. Šířka pruhu je rovna zobrazenému procentu. Součet procent smí být 99–101, **rozhodují počty**.
- **B3**: Pod odpověďmi je celkový počet hlasů: `"0 votes"`, `"1 vote"`, `"N votes"`.
- **B4**: Hlas přihlášeného uživatele je vyznačen ikonou zaškrtnutí **a** textem pro čtečky `"Your vote"`. Samotná barva stav nenese.
- **B5**: Pořadí odpovědí je pevné (pořadí zadání, resp. zveřejnění) a při hlasování se **nemění**, i když se pořadí podle počtů změní.
- **B6**: Hlasy jsou **anonymní**. Odpověď API nikdy neobsahuje, kdo hlasoval pro kterou odpověď. Obsahuje pouze volbu přihlášeného uživatele samotného.
- **B7**: Anketa je ovladatelná klávesnicí, stav „vybráno“ je zpřístupněn čtečkám, ovladače jsou `<button>`, focus ring zůstává viditelný.
- **B8**: Seznam má stále tři stavy (načítání / prázdný / chyba) podle DESIGN.md. Anketa je součást položky a vlastní další stav seznamu nepřidává.

## C. Hlasování a změna hlasu

- **C1** (první hlas): _Given_ otevřená anketa, ve které uživatel nehlasoval, _when_ klikne na odpověď, _then_ je jeho hlas uložen: počet dané odpovědi +1, celkem +1, odpověď je vyznačena.
- **C2** (změna): _Given_ uživatel s hlasem pro odpověď A, _when_ klikne na odpověď B, _then_ se hlas **přesune**: A −1, B +1, celkem beze změny.
- **C3** (stejná odpověď): klik na již zvolenou odpověď nic nemění. Neodešle se změna, počty zůstanou. Přijde-li takový požadavek na server, odpoví úspěchem a nic nezmění (idempotence).
- **C4**: Hlas **nelze stáhnout**. Po prvním hlasu platí vždy právě jedna volba.
- **C5**: Autor smí hlasovat i měnit hlas ve své anketě.
- **C6** (server validuje): hlasování pro neexistující quack, pro quack bez ankety, pro odpověď, která do té ankety nepatří, nebo pro čekající (nezveřejněný) návrh vrací `404` a nic nezmění. Nepřihlášený dostane `401`.

## D. Okamžitost

- **D1**: _Given_ požadavek na hlas ještě nedoběhl (např. server uměle zpožděn), _when_ uživatel klikne, _then_ UI už **ve stejné interakci** ukazuje novou volbu a upravené počty (C1/C2 včetně součtu a procent). Na server se nečeká.
- **D2**: Po úspěšné odpovědi serveru se zobrazené počty nahradí **hodnotami ze serveru**. Zahrnují i hlasy ostatních, které mezitím přišly.
- **D3** (rychlé po sobě jdoucí kliky): _Given_ uživatel klikne na A a ještě před doběhnutím na B, _then_ po doběhnutí všeho je stav na serveru **volba B** (poslední klik vyhrává) a UI zobrazuje totéž jako čerstvě načtená data. UI nikdy neskončí ve stavu, který se liší od serveru. Chyba se zobrazí jen tehdy, když se **poslední** volba uživatele neuložila.

## E. Viditelné selhání

- **E1**: _Given_ selhání požadavku na hlas (síťová chyba, `5xx`, jakákoli `4xx`), _then_ se UI vrátí **přesně** do stavu před posledním klikem (vybraná odpověď i počty) a **u ankety** se zobrazí trvalá chyba (`role="alert"`) s textem `"Your vote wasn't saved. Try again."`.
- **E2**: Chyba zůstane, dokud uživatel v této anketě znovu nehlasuje nebo dokud se hlas neuloží. Samotný toast nestačí, protože zmizí. Opakováním je další klik na odpověď.
- **E3**: Pokud server odmítne hlas, protože anketa skončila, UI přepne anketu do stavu „skončená“ a ukáže `"This poll has ended."` místo obecné chyby (viz X1).
- **E4**: Selhání jedné ankety neovlivní ostatní ankety ve feedu.

## F. Správnost čísel pro všechny

Invarianty, které platí v každém okamžiku a po každé operaci (ověřují se na úrovni dat i API):

- **F1**: Počet u odpovědi = počet uživatelů, jejichž **aktuální** hlas je tato odpověď. Součet počtů = celkový počet hlasů = počet různých hlasujících.
- **F2** (jedna osoba, jeden hlas): databáze to vynucuje (jedinečnost dvojice uživatel + anketa), nejen kód. Dva souběžné požadavky téhož uživatele na různé odpovědi skončí **jedním** hlasem a konzistentními počty.
- **F3** (žádné ztracené hlasy): N různých uživatelů hlasuje souběžně pro tutéž odpověď (test např. N = 20) a výsledek je přesně N.
- **F4** (změna je atomická): změna hlasu je jedna transakce. Čtení během ní nikdy neuvidí uživatele započítaného 0× ani 2×.
- **F5**: Počty vracené v jedné odpovědi (seznam i hlasování) jsou z jednoho konzistentního čtení, takže F1 platí uvnitř každé odpovědi.
- **F6** (čerstvost pro ostatní): počty se ostatním obnoví při návratu na kartu a po jejich vlastní akci (stávající pravidlo refetch při focusu a invalidace po mutaci). **Žádný polling ani push.** Starší zobrazení se tedy opraví při nejbližším refetchi, ale nikdy neukazuje součty, které by neodpovídaly F1 v okamžiku načtení.

---

# Rozšíření

## X1. Trvání ankety

- **X1.1**: Formulář má pole `"Poll length"` s hodnotami `"1 hour"`, `"1 day"` (výchozí), `"7 days"`, `"No end"`. Konec se počítá **na serveru** (čas vytvoření + délka), klient neposílá časové razítko. Pro `"No end"` konec neexistuje.
- **X1.2**: Otevřená anketa s koncem ukazuje zbývající čas relativně (např. `"Ends in 3 hours"`), skončená ukazuje `"Ended"`. Anketa bez konce nic z toho neukazuje.
- **X1.3** (po skončení): hlasování, změna hlasu, návrh nové odpovědi i schválení či zamítnutí návrhu se odmítnou odpovědí `409` s rozlišitelným důvodem `poll_ended` a **nic se nezmění**. UI ukazuje výsledky všem (i při „Show results after voting“, viz X2) a hlas uživatele zůstává vyznačen.
- **X1.4** (hranice): hlas se přijme, pouze pokud je čas serveru při jeho zpracování **před** koncem. Hlas zpracovaný v okamžiku konce nebo později se odmítne. Hlas „ve letu“ při konci rozhodne čas zpracování na serveru a UI se zachová podle E1/E3.
- **X1.5**: UI nemá časovač. Stav „skončená“ se zobrazí z dat serveru při nejbližším refetchi nebo při prvním odmítnutém hlasu (E3).

## X2. Viditelnost výsledků

- **X2.1**: Formulář má pole `"Results"` s hodnotami `"Show results immediately"` (výchozí) a `"Show results after voting"`.
- **X2.2** (hned): počty, procenta, pruhy a celkem vidí každý přihlášený okamžitě, i bez hlasování.
- **X2.3** (až po hlasování): uživatel, který **nehlasoval**, není autor a anketa neskončila, vidí jen texty odpovědí a nápovědu `"Vote to see results"`. **Odpověď API pro něj neobsahuje žádná čísla hlasů, ani součet** (neskrývá je jen UI).
- **X2.4**: Autor vidí výsledky vždy. Po skončení ankety je vidí všichni.
- **X2.5** (první hlas při skrytých výsledcích): výběr se po kliknutí vyznačí **okamžitě** (D1). Čísla nelze předvídat, proto se objeví až s odpovědí serveru. Do té doby se ukazuje stav čekání bez čísel. Při selhání (E1) se anketa vrátí do skrytého stavu bez čísel.
- **X2.6**: Uživatel, který už hlasoval, vidí čísla a jeho další změny se chovají jako v Core (D1–D3 včetně optimistických čísel).

## X3. Návrhy nových odpovědí od ostatních

- **X3.1**: Formulář má pole `"New answers from others"` s hodnotami `"Not allowed"` (výchozí), `"Published immediately"`, `"Author approves first"`.
- **X3.2** (nabídka): není-li `"Not allowed"`, ukazuje otevřená anketa přihlášenému uživateli pole a tlačítko `"Suggest an answer"`, dokud počet **zveřejněných + čekajících** odpovědí je menší než 10. Při `"Not allowed"` nemůže odpověď přidat nikdo, ani autor.
- **X3.3** (validace, klient i server): text 1–80 znaků po ořezání mezer. Duplicita (po ořezání mezer, bez ohledu na velikost písmen) vůči **zveřejněným i čekajícím** odpovědím téže ankety je chyba. Při dosažení stropu 10 je chyba `"This poll already has the maximum number of options"`. Chyby se ukazují pod polem.
- **X3.4** (limit na osobu): neautor může mít v jedné anketě nejvýše **jednu aktivní** (čekající nebo zveřejněnou) vlastní odpověď. Zamítnutí návrhu slot uvolní. **Autor je z limitu na osobu vyňat**, strop 10 ho ale váže.
- **X3.5** (`"Published immediately"`): přijatý návrh je ihned zveřejněná odpověď s 0 hlasy na konci seznamu. Ostatní ji uvidí při nejbližším refetchi.
- **X3.6** (`"Author approves first"`): návrh neautora vznikne jako **čekající**. Vidí ho jen autor (u ankety `"N suggestions awaiting approval"`, každý návrh s tlačítky `"Approve"` a `"Reject"`) a navrhovatel (jeho návrh s označením `"Awaiting approval"`, bez hlasovacího tlačítka a bez čísel). Nikdo jiný ho nevidí a API ho jim nevrací. Návrhy **autora** jsou i v tomto režimu zveřejněné ihned.
- **X3.7** (rozhodnutí autora): `"Approve"` změní návrh na zveřejněnou odpověď s 0 hlasy na konci seznamu. `"Reject"` návrh smaže. Rozhodovat smí jen autor (jiný uživatel dostane `403`). Neexistující nebo už vyřízený návrh vrací `404`.
- **X3.8**: Přijatý návrh **sám nehlasuje** (navrhovatel ani nikdo jiný nedostane automatický hlas).
- **X3.9**: Zveřejněnou odpověď nelze upravit ani smazat (ani autorem). Moderace je mimo MVP.
- **X3.10** (souběh): dva souběžné návrhy téhož textu: právě jeden uspěje, druhý dostane chybu duplicity. Souběžné návrhy při 9 z 10 obsazených: právě jeden uspěje a strop 10 se nikdy nepřekročí. Schválení tedy nikdy neselže na stropu.
- **X3.11**: Po skončení ankety se čekající návrhy nikomu neukazují a nelze je schválit (X1.3).

---

# Průřezové požadavky

## Měření (zda lidé ankety používají)

Stejný záměr a tvar jako dnešní log `quack_search`: jeden řádek přes `Logger`, který produkt čte jako počet **různých uživatelů za den**. Název události a tvar se proto drží stabilní.

- `poll_created user=<id> poll=<quackId> at=<ISO>`: po úspěšném uložení quacku s anketou.
- `poll_vote user=<id> poll=<quackId> at=<ISO>`: po úspěšném uložení hlasu **nebo změny hlasu**. Klik na již zvolenou odpověď (C3) se neloguje.
- `poll_option_suggested user=<id> poll=<quackId> at=<ISO>`: po úspěšném přijetí návrhu od **neautora** (čekajícího i zveřejněného). Odpovědi přidané autorem, schválení a zamítnutí se neloguje.
- Loguje se **až po úspěšném uložení**. Odmítnutý, neplatný nebo selhavší pokus se neloguje.
- Řádek **nikdy neobsahuje** text otázky ani odpovědí.
- Ověřuje se testem jako dnes u hledání (`quacks.search-logging.spec.ts`).

## Kompatibilita existujících endpointů

(Podle CLAUDE.md: rozšíření nesmí změnit, co endpoint dnes přijímá. Porovnáno s `main`.)

- **K1**: `POST /api/quacks` bez pole pro anketu se chová přesně jako dnes (`201`, stejná validace). Odpověď nově obsahuje pole `poll`, které je u quacku bez ankety `null`.
- **K2**: Pole pro anketu v těle je **nové volitelné** pole. Neznámá pole v těle se dál odmítají `400` (`forbidNonWhitelisted` zůstává).
- **K3**: `GET /api/quacks` dnes ignoruje všechny parametry kromě `q`. Musí je ignorovat i nadále (neznámý parametr = `200`, ne `400`). Nový parametr se případně validuje samostatně pipe na `@Query('name', …)`, ne DTO pro celý query string.
- **K4**: Hledání (`q`) se chová beze změny: hledá v textu quacku a ve jménu a uživatelském jménu autora. **Texty odpovědí se nehledají.**
- **K5**: Všechny dnešní testy (`pnpm check-all`) zůstávají zelené.

## Seed (ukázková data)

Po čerstvém seedu (stávající pravidlo: seed se přeskočí, pokud už v DB jsou uživatelé) obsahuje feed aspoň:

- jednu **otevřenou** anketu s výchozím nastavením a hlasy **alespoň tří** různých seedovaných uživatelů,
- jednu **skončenou** anketu (konec v minulosti) s hlasy,
- jednu anketu s `"Author approves first"` a jedním **čekajícím** návrhem.

## UI a design

- Řídit se [`DESIGN.md`](DESIGN.md): pouze tokeny barev, škála mezer, žádné vnořené karty, žádné stíny, hairline ohraničení, sentence case, viditelné `<label>` u všech polí formuláře.
- Chybějící ovládací prvek (např. přepínač) se přidává příkazem `pnpm dlx shadcn@latest add <name>` podle CLAUDE.md. Neručně v adresáři funkce. Následně se odstraní stíny a vrátí import `cn` na `@/lib/utils`.
- Klient i server validují stejná pravidla (80 znaků, 2–10, duplicity).

---

# Mimo rozsah (záměrně ne)

Editace a mazání ankety nebo odpovědí, ruční předčasné ukončení, vícenásobný výběr, stažení hlasu, zobrazení, kdo pro co hlasoval, vyhledávání v textech odpovědí, notifikace (autor se o čekajícím návrhu dozví jen při pohledu do feedu), živé aktualizace (polling/push), moderace zveřejněných odpovědí, změna nastavení po vytvoření, samostatná stránka ankety.

# Protokol rozhodnutí

| Rozhodnutí                                                                               | Kdo                                                                    |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Anketa je příloha quacku, text quacku je otázka, vzhled ve stylu X/Threads               | uživatel                                                               |
| 2–10 odpovědí, max. 80 znaků, bez duplicit                                               | uživatel                                                               |
| Autor volí trvání, viditelnost výsledků, návrhy odpovědí (vypnuto / hned / ke schválení) | uživatel                                                               |
| Jedna volba na osobu, změna = přesun, bez stažení hlasu                                  | produktové rozhodnutí na pověření uživatele, odsouhlaseno rekapitulací |
| Anonymní hlasy, autor smí hlasovat, výchozí hodnoty nastavení                            | produktové rozhodnutí, odsouhlaseno rekapitulací                       |
| Optimistické UI, vrácení a trvalá inline chyba při selhání                               | produktové rozhodnutí, odsouhlaseno rekapitulací                       |
| Čerstvost jen refetchem (focus + po akci), bez pollingu                                  | produktové rozhodnutí, odsouhlaseno rekapitulací                       |
| Zobrazení: počet + % + pruh, celkem, zaokrouhlení na celá čísla                          | produktové rozhodnutí, odsouhlaseno rekapitulací                       |
| Měření třemi log událostmi ve tvaru `quack_search`, jen po úspěchu, bez textů            | produktové rozhodnutí, odsouhlaseno rekapitulací                       |
| Hledání neprohledává texty odpovědí                                                      | produktové rozhodnutí, odsouhlaseno rekapitulací                       |
| Seed: otevřená, skončená a anketa s čekajícím návrhem                                    | produktové rozhodnutí, odsouhlaseno rekapitulací                       |
| `story.md` (dnes `story-polls.md`) v češtině, texty UI anglicky                          | uživatel                                                               |

**Otevřená rozhodnutí: žádná.**
