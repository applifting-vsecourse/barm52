# 0002 · Store quack likes and maintain a count in PostgreSQL

**Status** Accepted · 2026-11-28

## Context

The feed and reply threads show a count and the signed-in viewer's like state. A viewer can like an item once and take the like back. Replies use the same `Quack` table as top-level items. ADR 0001 requires clearing a deleted quack's dependent data when its row stays as a placeholder.

## Decision

- Store each like as one `QuackLike` row with a composite primary key on `(quackId, userId)`. Foreign keys cascade when the user or quack is deleted. An index on `userId` supports that cascade.
- Add `Quack.likeCount` with a default of zero for new and existing quacks. PostgreSQL triggers increment and decrement it in the transaction that inserts or deletes a like, including deletes cascaded from a user. The like rows are the source of truth.
- Make `PUT` and `DELETE` idempotent. The mutation locks the target quack row before checking `deletedAt` and changing the like. The placeholder delete updates the same row and clears likes in one transaction. This prevents a like from being added between the cleanup and the deletion.
- Read the stored count and the viewer's matching like on the same database snapshot. A deleted placeholder has no summary. Likes on replies use the same rules and rows as likes on top-level quacks.

## Options considered

- **Like table with a live count.** This has one source of data and fewer write operations. The database must aggregate like rows whenever it builds a feed or thread. We chose to store the count so these reads don't scale with the number of likes on each item.
- **Like table with a stored count.** This keeps the uniqueness rule and viewer lookup and makes the count cheap to read. Each mutation writes the quack row as well. PostgreSQL keeps the two writes atomic and updates the count on cascaded user deletion.
- **Count on the quack alone.** This is compact, but it cannot tell which user liked the quack or prevent duplicate likes across concurrent requests.

## Consequences

- Both the foreign keys and the PostgreSQL trigger are part of the migration. Any future import or maintenance operation that bypasses the triggers must rebuild the counts from the like rows.
- Like writes on a popular quack contend for that quack's row. We can return to counts from the like table without migrating user choices if that becomes a write bottleneck.
- Existing quacks and replies start at zero without rewriting their content. Adding a list of likers later can use the same rows.
