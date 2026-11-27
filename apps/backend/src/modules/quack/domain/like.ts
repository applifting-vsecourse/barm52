export type LikeSummary = {
  count: number;
  likedByMe: boolean;
};

export const toLikeSummary: (
  deleted: boolean,
  count: number,
  likedByMe: boolean,
) => LikeSummary | null = () => {
  throw new Error('not implemented');
};
