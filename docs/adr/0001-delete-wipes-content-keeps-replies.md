# 0001 · Deleting a quack wipes its content and keeps its replies

Status: Accepted · 2026-11-17

## Context

Quacks can now have replies (`Quack.parentId`). Product wants two things from a delete that pull against each other:

- Replies belong to the people who wrote them, so deleting a quack must not delete the replies under it.
- What the author deleted must really disappear from the app: from the feed, the replies and the search.

Until now every delete was a real `DELETE` that cascaded to the poll and its votes. The same delete serves authors and moderators (admins).

## Decision

A quack **with replies** keeps its row as a placeholder: text emptied, mood and poll removed, and `deletedAt` set. The UI shows "This quack was deleted." with no author. A quack **without replies** is deleted for good, as before.

When the last reply under a placeholder is deleted, the placeholder goes too. The foreign key `parentId` is `onDelete: Restrict`, so the database refuses to drop a quack that still has replies.

## Options considered

- **Hard delete with cascade.** Rejected: the replies would disappear, which product rules out.
- **Hard delete, replies set to `parentId = null`.** Rejected: the replies lose what they answered and turn into stray top-level quacks.
- **Always soft delete (`deletedAt` on every delete).** Rejected: every deleted quack stays in the table as an empty row that every query has to filter, even when nothing depends on it. Wiping the content is still needed either way.
- **Soft delete that keeps the text but hides it.** Rejected: the content would still be in the database, and "really disappear" means gone, not hidden.

## Consequences

- Every read of quacks has to reckon with `deletedAt`. The feed lists a placeholder only while it has replies. Search and Mine never return a deleted quack, not even by its author's name. A placeholder can't be deleted again or replied to (404).
- The delete is no longer one `DELETE` but a decision in `QuackRepository.deleteQuack`, done in one transaction. Moderation (admins) goes through the same path, so a moderated quack with replies also leaves a placeholder.
- Something new that hangs off a quack (likes, attachments…) must be removed when the content is wiped, the way the poll is.
- Replies are deleted for good; they have no replies of their own (one level). Allowing deeper threads later would make replies placeholders too, under this same rule.
