# Plán: ankety v quacích

Implementační plán ke [`story.md`](story.md) (Core A–F, rozšíření X1–X3). Story je zdroj pravdy, tento soubor jen popisuje, jak ji splnit.

## Postup a commity

Dodává se po částech, po každé je `pnpm check-all` zelený a commit:

1. **Datový model + migrace** pro celou story najednou. Sloupce rozšíření mají v DB „nejméně omezující“ výchozí hodnoty (bez konce, výsledky hned, návrhy vypnuty).
2. **Core backend**: vytvoření ankety s quackem (atomicky), zobrazení v `GET /api/quacks`, hlasování, logy `poll_created` / `poll_vote`.
3. **Core frontend**: formulář („Add poll“…), zobrazení v položce feedu, optimistické hlasování, vrácení a inline chyba.
4. **X1 trvání**, **X2 viditelnost výsledků**, **X3 návrhy** (backend i frontend, každé zvlášť).
5. **Seed**, DB testy souběhu (`pnpm backend test:db`), README.

## Datový model (Prisma)

- `Poll`: `quackId` (PK i FK, 1:1 s `Quack`, cascade), `endsAt DateTime?`, `resultsVisibility` (`immediately` | `after_vote`, výchozí `immediately`), `suggestions` (`not_allowed` | `published` | `author_approves`, výchozí `not_allowed`), `createdAt`.
- `PollOption`: `id`, `pollId`, `text`, `normalizedText` (trim + lowercase), `status` (`published` | `pending`), `position Int?` (pořadí zveřejnění; u čekajících `null`), `createdById` (FK User), `createdAt`.
  - `@@unique([pollId, normalizedText])`: duplicita vůči zveřejněným i čekajícím vynucená databází (X3.3, X3.10).
- `PollVote`: `pollId`, `userId`, `optionId`, `updatedAt`. `@@unique([pollId, userId])`: jeden hlas na osobu vynucený databází (F2).
- Počty se **nikde neukládají**, vždy `COUNT(*) GROUP BY optionId` z `PollVote`. F1, F3 a F4 tak platí z konstrukce.

## API

Stávající `QuacksController` (kompatibilita K1–K5):

- `POST /api/quacks`: nové volitelné pole `poll` (vnořené DTO, `forbidNonWhitelisted` platí i uvnitř):
  `{ options: string[2..10], length?: '1h'|'1d'|'7d'|'none', results?: 'immediately'|'after_vote', suggestions?: 'not_allowed'|'published'|'author_approves' }`.
  Vynechané nastavení = nejméně omezující hodnota. Formulář posílá všechna nastavení vždy explicitně. Quack a anketa vznikají v jedné transakci, `poll_created` se loguje až po commitu.
- `GET /api/quacks`: každý quack má `poll: PollDto | null`. Query parametry beze změny (jen `q` přes pipe).

Nový `PollsController` na `quacks/:quackId/poll` (guard + ValidationPipe jako u quacků):

- `PUT …/vote` `{ optionId }` → `200 PollDto`. `404` (quack/anketa/odpověď neexistuje, nepatří k anketě, čeká na schválení), `409 { reason: 'poll_ended' }`.
- `POST …/options` `{ text }` → `201 PollDto` (X3). `400` (validace, duplicita, strop, limit na osobu), `403` (`"Not allowed"`), `404`, `409 poll_ended`.
- `POST …/options/:optionId/approve` → `200 PollDto`. `DELETE …/options/:optionId` (reject) → `200 PollDto`. `403` pro neautora, `404` pro neexistující nebo vyřízený návrh, `409 poll_ended`.

`PollDto` se počítá pro konkrétního uživatele:

```
{ endsAt: string|null, ended: boolean, resultsVisibility, suggestions,
  resultsVisible: boolean, totalVotes: number|null, myVoteOptionId: string|null,
  canSuggest: boolean, pendingCount: number|null,
  options: [{ id, text, votes: number|null }],          // jen zveřejněné, podle position
  pendingSuggestions: [{ id, text }] }                  // autor: všechny; navrhovatel: svůj; ostatní: []
```

- Bez práva na výsledky (X2.3) jsou `votes` a `totalVotes` `null`. Čísla se do odpovědi vůbec nedostanou.
- Hlasy jsou anonymní (B6): API vrací jen `myVoteOptionId`, nikdy seznam hlasujících.
- Po skončení: `pendingSuggestions` je `[]` pro všechny (X3.11), `canSuggest` je `false`.

## Souběh a konzistence

- **Hlas**: transakce: načíst anketu a odpověď (404), zkontrolovat konec podle času serveru (`now < endsAt`, jinak 409), přečíst stávající hlas. Pokud je stejný, nic se nemění a nic se neloguje (C3). Jinak `INSERT … ON CONFLICT (poll_id, user_id) DO UPDATE` jedním příkazem: změna je atomická (F4) a dva souběžné požadavky téhož uživatele skončí jedním hlasem (F2).
- **Návrh / schválení / zamítnutí**: transakce se zámkem řádku ankety (`SELECT … FOR UPDATE`). Operace nad jednou anketou se tím serializují, strop 10 a limit na osobu se nedají přeskočit (X3.10). Duplicitu navíc chytí unikátní index (P2002 → 400).
- **Čtení (F5)**: seznam quacků, počty, vlastní hlasy a návrhy se čtou v jedné transakci `REPEATABLE READ`, tedy z jednoho snapshotu. Odpověď hlasování se čte stejně.

## Frontend

- `quackSchemas.ts`: zod `pollSchema`, `quack.poll` nullable.
- `QuackForm`: přepínač `"Add poll"`/`"Remove poll"`, `useFieldArray` pro odpovědi (2–10, `"Add option"`, `aria-label="Remove option"` u polí nad 2), selecty `"Poll length"`, `"Results"`, `"New answers from others"` (existující kit `Select`, viditelné `<label>`). Zod validace shodná se serverem, chyby pod polem.
- `PollView` uvnitř `QuackItem` (bez karty a rámečku): řádek odpovědi = `<button aria-pressed>`, text, počet, %, pruh. Pruh je dekorativní `<div aria-hidden>` s šířkou z procent, tedy jen vizualizace, ne ovládací prvek. Zaškrtnutí + `sr-only` `"Your vote"`, celkem `"N votes"`, `"Ends in …"`/`"Ended"`, `"Vote to see results"`, návrhy.
- **Hlasování (`usePollVote`)**: optimistický překryv nad daty ze serveru. `applyChoice(poll, optionId)` přesune hlas z `poll.myVoteOptionId` na novou volbu. Je idempotentní vůči jakýmkoli datům ze serveru, takže refetch během letu nezpůsobí dvojí započtení. Kliky se posílají **sekvenčně** (fronta na anketu), takže na serveru vždy vyhraje poslední klik (D3). Po každé úspěšné odpovědi se anketa ze serveru zapíše do cache všech seznamů (D2). Po doběhnutí posledního se seznamy invalidují (F6). Selže-li **poslední** volba, překryv zmizí (zobrazí se poslední potvrzený stav ze serveru) a u ankety se objeví `role="alert"` `"Your vote wasn't saved. Try again."`. Při `409 poll_ended` se místo toho ukáže `"This poll has ended."` a anketa se přepne do skončeného stavu.
- Procento: celočíselně `floor((200·počet + celkem) / (2·celkem))` (zaokrouhlení .5 nahoru bez chyb plovoucí čárky), při 0 hlasech 0.

## Testy

- **Backend unit (Jest, `pnpm backend test`)**: DTO validace (2–10, 1–80, duplicity, neznámá pole → 400), výpočet `PollDto` (skryté výsledky, procenta se nepočítají na serveru), služba (404/409/403, idempotence C3, logy jen po úspěchu a bez textů), kompatibilita `POST /api/quacks` bez `poll` a `GET` s neznámými parametry přes skutečný HTTP server (vzor `quacks.search-logging.spec.ts`).
- **Backend DB (`pnpm backend test:db`)**: proti samostatné DB `quacker_test` ve stávajícím kontejneru (dev data zůstávají netknutá). F2 (souběh téhož uživatele), F3 (N = 20 uživatelů souběžně → přesně 20), F4/F1 (počty = hlasující), atomické vytvoření, X1.4 hranice, X3.10 (souběžné duplicity, souběžné návrhy při 9/10).
- **Frontend (Vitest)**: schéma, formulář ankety (přidat/odebrat, validace pod polem, co se posílá), `PollView` (optimistika D1, D2, rychlé kliky D3, vrácení E1/E2, `poll_ended` E3, skryté výsledky X2.5, a11y role/aria), `percent()`.

## Rozhodnutí v rámci implementace (nejsou produktová)

- Tlačítko `"Remove option"` mají pole 3–10. První dvě pole odebrat nejde, protože minimum je 2.
- Duplicita odpovědí ve formuláři se hlásí pod pozdějším z obou polí.
- Při `"Not allowed"` vrací `POST …/options` `403` (story kód neurčuje).
- Hlášku o limitu na osobu (X3.4) story neurčuje: `"You already have an answer in this poll"`.
- Pokud selže poslední volba po předchozím neúspěšném kliku, UI se vrátí do posledního **potvrzeného** stavu ze serveru. Tak platí D3 („UI se nikdy neliší od serveru“).
- Seed se ověřuje na oddělené DB. Dev DB se neresetuje, migrace se na ni jen aplikuje.
