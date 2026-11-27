export type LikeSummary = {
  count: number;
  likedByMe: boolean;
};

export function toLikeSummary(
  deleted: boolean,
  count: number,
  likedByMe: boolean,
): LikeSummary | null {
  return deleted ? null : { count, likedByMe };
}
