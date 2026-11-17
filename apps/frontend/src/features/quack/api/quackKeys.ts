export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  list: (search: string, isMine = false) => [...quackKeys.lists(), { search, isMine }] as const,
  replies: (quackId: string) => [...quackKeys.all(), "replies", quackId] as const,
}
