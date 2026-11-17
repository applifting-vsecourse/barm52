# Moderace: admin smaže jakýkoli quack

Status: **implementováno, bez otevřených rozhodnutí.** Navazuje na story „Delete + Mine“ (autor smaže svůj quack, záložky All / Mine).

## Zadání

> Someone started posting nasty quacks. Their author won't delete them and right now we can't do anything about it. We need a moderator who can delete anything. Nothing more for now.

## Příběh

**Jako** moderátor Quackeru (uživatel s rolí `admin`)
**chci** smazat jakýkoli quack, i cizí,
**abych** mohl odstranit nevhodný obsah, který jeho autor sám smazat nechce.

Cíl je jediný: zlobivý quack jde odstranit. Nic navíc oproti tomuto dokumentu se nedělá („Nothing more for now“).

## Slovník

- **Moderátor**: uživatel s rolí `admin`. Role už existuje (enum `UserRole` v `schema.prisma`) a BetterAuth ji dává do session (`user.role`). Nová role se nezavádí.
- **Autor**: uživatel, který quack napsal (`quack.userId`).
- **Běžný uživatel**: kdokoli s rolí `user`, i když má v názvu „Admin“ (např. „Pond Admin“ ze seedu).

## Akceptační kritéria

Texty v uvozovkách jsou texty rozhraní (aplikace je anglicky).

**Mazání moderátorem**

1. Admin vidí akci „Delete quack“ u **každého** quacku ve feedu, nejen u svých.
2. Před smazáním se aplikace zeptá stejným potvrzovacím dialogem jako autora („Delete this quack?“, Cancel / Delete). Cancel nic nesmaže.
3. Po potvrzení quack zmizí z feedu adminovi i všem ostatním, včetně autora. Spolu s ním zmizí jeho anketa, odpovědi a hlasy.
4. Admin smaže cizí quack i přímým voláním API: `DELETE /api/quacks/:id` → `204`.

**Nic se nemění pro ostatní**

5. Autor dál maže své quacky (`204`).
6. Běžný uživatel cizí quack nesmaže ani přes API → `403`. Tlačítko u cizích quacků nevidí.
7. Nepřihlášený → `401`.
8. Role se bere jen ze session. Nic v požadavku (`?role=admin`, `userId`, tělo) ji nezmění. Jméno „Pond Admin“ adminem nedělá → `403`.
9. Neexistující quack → `404`.

**Kde je kontrola**

10. Rozhodnutí „smí mazat“ je jedna podmínka v backend service, `QuacksService.deleteQuack`: `if (!isOwner && !isAdmin) throw new ForbiddenException()`. UI tlačítko jen skrývá a server kontroluje vždy.

## Upřesňující otázky

Story se doptávala, dokud nezůstalo žádné otevřené rozhodnutí.

1. **Kdo je moderátor? Zavádíme novou roli?**
   Existující role `admin`. Žádná nová role, „Nothing more for now“.
2. **Co přesně admin uvidí a jak bude mazat?**
   Tlačítko Delete u každého quacku a stejný potvrzovací dialog jako autor. Žádný nový endpoint ani stránka.
3. **Mazat natrvalo, nebo jen skrýt? Důvod, log, upozornění autora?**
   Natrvalo, včetně ankety a hlasů. Žádný důvod, log ani upozornění, to bude případně později.

## Rozhodnutí

| Rozhodnutí                                                                                  | Proč                                                                | Kdo      |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| Moderátor = existující role `admin`, žádná nová role `moderator`                            | „Nothing more for now“; role i účet `admin@example.com` už existují | zadání   |
| Stejný endpoint `DELETE /api/quacks/:id` a stejný potvrzovací dialog                        | je to tatáž akce, jen pro víc lidí                                  | uživatel |
| Kontrola vlastník-nebo-admin v service: `if (!isOwner && !isAdmin)`, ne v guardu `@Roles`   | vlastnictví potřebuje data (autora quacku), ta má service           | zadání   |
| Role ze session (`@User()` → `user.role`), nikdy z požadavku                                | role si nikdo nepřidělí sám (`input: false`)                        | zadání   |
| Route předá `isAdmin={user?.role === "admin"}`, feed ukáže Delete při `isMine \|\| isAdmin` | features se navzájem neimportují                                    | zadání   |
| Trvalé smazání včetně ankety a hlasů; bez soft delete, důvodu, logu a upozornění autora     | „Nothing more for now“                                              | uživatel |
| Záložka Mine u admina ukazuje jen jeho vlastní quacky                                       | Mine znamená „moje“, ne „co smím mazat“                             | uživatel |
| Mimo rozsah: role `moderator`, stránka Stats, blokování, nahlašování, e-maily               | nejsou v zadání                                                     | uživatel |

**Otevřená rozhodnutí: žádná.**

## Ověření

- **E2E** (`apps/frontend/e2e/moderation.spec.ts`): autor vytvoří quack, admin ho v UI smaže a quack zmizí i pro autora. Admin vidí Delete u každého quacku. „Pond Admin“ dostane `403`. Běžný uživatel dostane `403` (`quacks.spec.ts`: „a regular user can't delete someone else's quack“).
- **Test selže, když se kontrola vypne** (ověřeno ručně):
  - podmínka odstraněná úplně → testy běžného uživatele a „Pond Admina“ padají s `Expected: 403, Received: 204`;
  - z podmínky vypadne `isAdmin` → test admina padá (quack po pokusu o smazání pořád existuje).
- **Backend**: service (admin smaže cizí, ostatní dostanou `ForbiddenException`) a HTTP spec (`204` admin, `403` s `?role=admin`, `401`, `404`).
