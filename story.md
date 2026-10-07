# Story: Search quacks

**Who:** A signed-in Quacker user who saw a quack last week and remembers a word from it, or who wrote it.
**What:** They type that word or name into a search box on the feed and see only the matching quacks.
**Why:** They can find the quack again without scrolling the whole feed.
**For the PO:** The team can tell whether people use search, measured as distinct users per day who searched. A developer provides that number on request.

## Acceptance criteria (verified in the browser)

Counts assume a fresh seed.

**Search box**

1. On `/quacks`, between the post form and the list, there is a text field with the visible label "Search quacks" and the placeholder "A word or a name". Nothing else is added: no submit button, no new route, no new nav item.
2. Clicking the label focuses the field.
3. The field is present even when the feed has no quacks.
4. The field is not focused when the page opens.
5. The field accepts at most 100 characters. Pasted text longer than that is cut to 100.
6. Pressing Enter in the field does not reload the page or change the list.

**Matching**

7. While the user keeps typing with gaps shorter than 300 ms, the list doesn't update. Once 300 ms pass after the last typed or deleted character, it updates with no further action.
8. A quack matches a word if the word appears in its text, its author's name or its author's @username. `bread` shows 3 quacks: two by The Bread Critic and the Pond Admin "bread situation" quack.
9. A word can match part of a longer word. `crit` shows the 2 Bread Critic quacks.
10. Matching ignores case, including accented letters. After posting a quack containing "Žluťoučký", searching `ŽLUŤOUČKÝ` finds it.
11. With several words, every word must match somewhere, in any order. `duck coffee` and `coffee duck` both show exactly 1 quack, the Caffeinated Duck coffee spill.
12. Every leading `@` is dropped from any word. `@caffeinated` and `@@caffeinated` both show the 3 Caffeinated Duck quacks, and `coffee @duck` behaves like `duck coffee`.
13. A blank query, a whitespace-only query, or one made only of `@` signs shows the full feed and no empty-result line.
14. `%` and `_` are matched literally. `%` alone shows the empty-result line, not every quack.
15. Mood is not searched. `happy` shows the empty-result line.
16. Matches are newest first. Each renders exactly like a feed item, with no extra heading, summary line, highlight, count or match indicator.

**Empty result**

17. When a non-blank search matches nothing, the list area shows the line `No quacks match "xyzzy".`, with the query trimmed and echoed as typed in straight double quotes. The `@`, case and inner spacing are kept.
18. Under that line is an outline button, "Clear search".
19. A long query wraps in that line and causes no horizontal scroll.
20. The post form and search box stay visible in the empty-result state.
21. With no quacks at all, a non-blank search shows the line from AC17. "No quacks yet. Post the first one." appears when there are no quacks and no search is active: the box is empty, only spaces, or only `@` signs.
22. Clicking "Clear search" empties the box at once, without waiting for the 300 ms pause, shows the full feed and puts keyboard focus in the search box.

**Clearing and posting**

23. There is no other clear control. While results show, the user clears by deleting the text.
24. After a successful post, the box empties at once, without waiting for the 300 ms pause, and the full feed shows with the new quack at the top.
25. If the post form is submitted and fails, for example submitted empty, the search stays exactly as typed and the filtered list is untouched.

**Lifecycle**

26. The query is not kept anywhere. The URL doesn't change while typing. Reloading, or leaving `/quacks` and coming back, shows an empty box and the full feed.
27. With the network throttled, while a new search loads the previous list stays visible. The empty-result line doesn't appear until the new results arrive.
28. If the request for the current search fails, including a refetch on tab return, the feed's existing "Couldn't load quacks" alert shows with its message and a Reload button. Reload retries the current search. The typed text stays and no list is shown.
29. A matching quack posted from another account while the tab was in the background appears when the tab is shown again.
30. A signed-in user finds quacks by any author.

**Reaching the server**

31. Typing non-blank text sends that text, trimmed, to the server. The Network tab shows a request to the quacks endpoint carrying it. A blank or whitespace-only box sends no search text.

## Usage logging: mandatory, verified outside the browser

This is not a browser criterion, because the PO's measure isn't visible in the browser. It is still part of the story, and the story isn't done without it.

**Requirements**

- **U1.** For every search from a signed-in user with a non-blank query, the backend writes exactly one log line. "Non-blank" means at least one word remains after trimming, splitting on spaces and dropping every leading `@` from each word.
- **U2.** The line carries a fixed event name, the user id and the time of the search as an ISO-8601 UTC timestamp. For example: `quack_search user=<userId> at=2026-10-08T09:15:00.000Z`. The backend's own log line never contains any part of the query text.
- **U3.** The line is written whether or not anything matches. A lookup that then fails still counts as a search.
- **U4.** No line is written for any of these:
  - a blank, whitespace-only or `@`-only query
  - a request with no query
  - a request rejected for validation, such as over 100 characters
  - a request without a valid session
- **U5.** Each request writes its own line. Nothing is deduplicated, and tab-refocus refetches count.

**Verification (both required)**

- **V1.** An automated backend test in the existing Jest suite, run by `pnpm backend test` and `pnpm check-all`, covers U1 to U5. It asserts that a distinctive query such as `zebra` appears in no logged message, and it fails if the line stops being written. This is the builder's evidence.
- **V2.** A reviewer's check in the backend console of the running app:
  - a search in the browser produces one `quack_search` line with their user id
  - emptying the box produces none
  - returning to the tab while a search shows produces another line

**Counting:** A developer counts distinct `user=` values per day on request, using a plain text search of the logs for `quack_search`. No dashboard, no report, no new UI.

**Preconditions, outside this story**

- The backend logs are kept for the whole test period. The developer who counts checks this before the test starts.
- The story covers only the backend's own log line. Anything in front of the backend that logs URLs, such as a proxy or the platform, may record the query text, because the text travels in the request URL.

## Out of scope

- Date filter, mood filter, sort choice, pagination or "load more".
- Forgiving matching (typos, plurals, stemming), autocomplete, search history, saved searches, keyboard shortcuts, and search in the header or on other pages.
- Highlighting matched words, a result count (visible or hidden), screen-reader announcements of result changes, accent-insensitive matching, and keeping the search in the URL.
- Searching the date shown on each quack. Only the text, name and @username are matched.
- A success threshold, a review date or a removal plan. The story ends at the usage log.
- Analytics tools, dashboards, a PO-facing usage report, and logging the query text in the app.
- Log retention, and what proxies or the platform in front of the backend log.

## Implementation notes (not product decisions)

- Search runs on the server, as a `q` parameter on the existing quacks list endpoint. The server rejects over 100 characters with 400.
- The field and label come from the existing kit, with no shadows. Signed-out behavior is unchanged: redirect to login, and 401 from the API.
