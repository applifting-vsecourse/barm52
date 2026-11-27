BEGIN;

ALTER TABLE "quack" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT "quack_like_count_nonnegative" CHECK ("likeCount" >= 0);

CREATE TABLE "quack_like" (
    "quackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "quack_like_pkey" PRIMARY KEY ("quackId", "userId"),
    CONSTRAINT "quack_like_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quack_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "quack_like_userId_idx" ON "quack_like"("userId");

-- Row triggers also see cascades from user deletion and ignore duplicate
-- inserts that use ON CONFLICT DO NOTHING.
CREATE FUNCTION update_quack_like_count() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE "quack" SET "likeCount" = "likeCount" + 1 WHERE "id" = NEW."quackId";
    ELSE
        UPDATE "quack" SET "likeCount" = "likeCount" - 1 WHERE "id" = OLD."quackId";
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER quack_like_count_changed
AFTER INSERT OR DELETE ON "quack_like"
FOR EACH ROW EXECUTE FUNCTION update_quack_like_count();

COMMIT;
