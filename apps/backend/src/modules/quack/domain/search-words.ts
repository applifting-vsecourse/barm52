// A search is a list of words. The feed shows authors as @username, so every
// leading `@` is dropped from a word, and a word that was only `@` signs is not
// a word. No words left means there is nothing to search for. The frontend
// mirrors this when it decides whether a search is active.
export const searchWords = (query: string | undefined): string[] =>
  (query ?? '')
    .split(/\s+/)
    .map((word) => word.replace(/^@+/, ''))
    .filter((word) => word !== '');
