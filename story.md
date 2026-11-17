# Odpovědi na quacky

Status: **implementováno, bez otevřených rozhodnutí.** Navazuje na mazání a moderaci (`story-moderation.md`).

## Zadání

> People discuss under quacks by posting a new quack that starts with '@name …', and nobody can tell what anyone is replying to. I want people to reply to a quack and see the replies under it. Replies belong to the people who wrote them: if an author deletes a quack that already has replies, the replies must not disappear with it. At the same time, when someone deletes their quack, its content has to really disappear from the app.

## Příběh

**Jako** přihlášený uživatel Quackeru
**chci** odpovědět přímo na quack a vidět odpovědi pod ním,
**abych** věděl, kdo na co reaguje, a nemusel psát nový quack začínající „@jméno“.

## Upřesňující otázky

1. **Co se stane, když autor smaže quack, na který už někdo odpověděl?**
   Quack zůstane jako zástupné místo „This quack was deleted.“: text, nálada a anketa se smažou, odpovědi zůstanou pod ním. Quack bez odpovědí se smaže úplně, jako dosud.
2. **Jak uložit odpověď?**
   Jako quack s odkazem na rodiče (`parentId`).
3. **Kde se odpovědi zobrazí?**
   Jen pod svým quackem, sbalené za „N replies“. Ve feedu jsou jen hlavní quacky.
4. **Odpovídat i na odpovědi?**
   Ne, jen jedna úroveň.
5. **Co odpověď obsahuje, a kam patří ve Mine a ve vyhledávání?**
   Jen text (bez nálady a ankety). Záložka Mine a vyhledávání pracují s hlavními quacky. Smazaná odpověď zmizí úplně, a když tím zástupnému místu nezbude žádná odpověď, zmizí i ono.

## Akceptační kritéria

Texty v uvozovkách jsou texty rozhraní (aplikace je anglicky).

**Odpovídání**

1. Pod každým hlavním quackem je tlačítko „Reply“, nebo „1 reply“ / „N replies“, když už odpovědi má. Po kliknutí se rozbalí odpovědi (od nejstarší) a formulář „Your reply“ s tlačítkem „Send reply“.
2. Odeslaná odpověď se objeví pod quackem a počet odpovědí se zvýší. Prázdná odpověď nebo odpověď delší než 280 znaků se neodešle a pod polem je důvod.
3. Odpovědi nejsou ve feedu jako samostatné quacky.
4. Na odpověď odpovědět nejde (`400`). Na smazaný quack odpovědět nejde (`404`).
5. Autor odpovědi je vždy přihlášený uživatel ze session.

**Mazání**

6. Smazání quacku bez odpovědí ho odstraní úplně (jako dosud).
7. Smazání quacku s odpověďmi ponechá ve feedu „This quack was deleted.“ bez textu, autora, nálady a ankety. Odpovědi pod ním zůstanou a jdou dál číst.
8. Text smazaného quacku není nikde: ani ve feedu, ani v odpovědích, ani ve vyhledávání (ani podle jména autora). Je smazaný i z databáze.
9. Odpověď smaže její autor nebo admin (stejné pravidlo jako u quacku). Smazaná odpověď zmizí úplně.
10. Zástupné místo nejde smazat znovu ani na něj odpovědět (`404`).

## Rozhodnutí

| Rozhodnutí                                                                                     | Zamítnutá možnost a proč                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smazaný quack s odpověďmi zůstane jako zástupné místo (`deletedAt`), obsah se vymaže. ADR 0001 | **Hard delete s kaskádou**: odpovědi by zmizely, zadání to zakazuje. **Hard delete, odpovědi s `parentId = null`**: odpovědi ztratí kontext a vypadají jako samostatné quacky. **Vždy soft delete**: v DB by se hromadily prázdné řádky a každý dotaz by je musel filtrovat. |
| Odpověď = `Quack` s `parentId` (self-relace)                                                   | **Samostatná tabulka `Reply`**: zdvojila by mazání, moderaci, autora a API.                                                                                                                                                                                                  |
| Odpovědi jen pod quackem, ve feedu jen hlavní quacky                                           | **Odpovědi i ve feedu**: feed by se plnil duplicitami.                                                                                                                                                                                                                       |
| Jedna úroveň odpovědí                                                                          | **Libovolná hloubka**: víc UI a dotazů, zadání ji nechce. Model s `parentId` ji později umožní bez migrace.                                                                                                                                                                  |
| Počet odpovědí se počítá při čtení (`_count`), neukládá se                                     | **Uložený čítač**: druhá kopie, kterou by šlo zapomenout aktualizovat; při dnešním objemu zbytečný.                                                                                                                                                                          |
| Cizí klíč `parentId` s `onDelete: Restrict`                                                    | **`Cascade`**: smazání rodiče by tiše smazalo cizí odpovědi. **`SetNull`**: osiřelé odpovědi (viz výše). Restrict nechá databázi hlídat pravidlo z ADR.                                                                                                                      |

**Otevřená rozhodnutí: žádná.**

## Schéma

```prisma
model Quack {
  // … beze změny …
  parent    Quack?    @relation("QuackReplies", fields: [parentId], references: [id], onDelete: Restrict)
  parentId  String?
  replies   Quack[]   @relation("QuackReplies")
  deletedAt DateTime?

  @@index([parentId])
}
```

Migrace `20261117120000_add_quack_replies`: dva nullable sloupce, index a cizí klíč.

## Kontrola návrhu

1. **Jde všechno, co uživatel vidí, přečíst jednoduchými dotazy?** Ano:
   - feed: `quack where parentId is null and (deletedAt is null or exists reply)` + `_count.replies`;
   - odpovědi: `quack where parentId = :id order by createdAt`;
   - hledání a Mine: totéž co feed, ale jen `deletedAt is null`.
2. **Je něco uložené dvakrát?** Ne. Počet odpovědí se počítá při čtení, autor i rodič jsou jen odkazy.
3. **Co se stane se souvisejícími řádky při smazání quacku?**
   - Bez odpovědí: řádek se smaže a anketa, odpovědi v ní a hlasy kaskádou s ním.
   - S odpověďmi: řádek zůstane s prázdným textem, bez nálady a s `deletedAt`, anketa se smaže a odpovědi zůstanou.
   - Smazaná poslední odpověď smaže i prázdné zástupné místo.
   - Databáze (`Restrict`) odmítne smazat quack, který odpovědi ještě má.
4. **Projde migrace na produkci s daty?** Ano. Jen přidává nullable sloupce, index a cizí klíč; existující quacky zůstanou hlavní a nesmazané, nic se nepřepisuje.
