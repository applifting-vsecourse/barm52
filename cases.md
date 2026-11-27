# Quack likes

Signed-in users can like their own or someone else's quacks, including replies. The feed stays private. Each item shows a count and whether the current user liked it. A deleted placeholder has no like control. The list of people who liked an item is outside this scope.

## Rules

| Case | Given                                  | When                                     | Then                                                                                        |
| ---- | -------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| U1   | An active quack or reply has two likes | The app builds the viewer's like summary | The count is two for both viewers, and only the viewer who liked it sees `likedByMe: true`. |
| U2   | A quack is a deleted placeholder       | The app builds the viewer's like summary | The summary is `null`.                                                                      |

## API behaviour

Authenticated clients use `PUT /api/quacks/:id/like` to like and `DELETE /api/quacks/:id/like` to unlike. Both return HTTP 200 with `{ count, likedByMe }` when the quack or reply exists and is active. The session supplies the user ID. Feed, search, Mine and reply responses carry the summary in `likes`.

| Case | Given                                                      | When                                                               | Then                                                                                                  |
| ---- | ---------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| I1   | A signed-in reader and a quack without likes               | The reader creates or loads a quack                                | The summary is `{ count: 0, likedByMe: false }`.                                                      |
| I2   | An author and a reader                                     | Each likes the author's quack                                      | Both likes count, each sees their own state, and the feed, search and Mine show the same count.       |
| I3   | One reader and a quack                                     | The reader sends two likes concurrently and repeats an unlike      | One like is stored, then none. The other reader's like survives.                                      |
| I4   | An existing quack and a signed-out visitor                 | The visitor tries to read the feed, like or unlike                 | Each request returns 401.                                                                             |
| I5   | An authenticated reader                                    | The reader likes or unlikes an unknown ID or a deleted placeholder | Each request returns 404. The placeholder's `likes` is `null`.                                        |
| I6   | A quack has a reply                                        | Someone likes and unlikes the reply                                | The reply returns its own state and the parent stays at zero.                                         |
| I7   | A liked quack has replies and another liked quack has none | The author deletes both quacks                                     | The placeholder keeps its replies with its like count reset to zero. Neither quack retains like rows. |
| I8   | A reader and an author both liked the author's quack       | The reader's user row is deleted                                   | The author's like remains and the stored count falls to one.                                          |

## End-to-end flows

| Case | Given                                       | When                                                     | Then                                                                                                                          |
| ---- | ------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| E1   | An author opens their new quack in the feed | They like it, reload and unlike it                       | The button shows `0 likes`, then `1 like` and pressed, then the same state after reload, and finally `0 likes` and unpressed. |
| E2   | The author opens a quack's reply thread     | They like the reply and reopen the thread after a reload | The reply shows `1 like` and pressed. The parent still shows `0 likes` and unpressed.                                         |
| E3   | A quack with a liked reply was deleted      | The reader opens the placeholder's thread                | The placeholder has no like control. The reply still has its like.                                                            |
