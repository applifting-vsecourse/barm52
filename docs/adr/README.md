# Architecture Decision Records

One file per decision that was hard to make and would be hard to undo. An ADR is never rewritten: a new one replaces it, and the old one stays as history. Read the ones that touch your change before changing the data model or the structure of the app.

| #                                                  | Title                                                    | Status   | In one sentence                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| [0001](0001-delete-wipes-content-keeps-replies.md) | Deleting a quack wipes its content and keeps its replies | Accepted | A quack with replies stays as an empty placeholder (`deletedAt`); anything else is deleted for good. |
