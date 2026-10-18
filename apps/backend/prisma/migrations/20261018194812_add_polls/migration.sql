-- CreateEnum
CREATE TYPE "poll_results_visibility" AS ENUM ('immediately', 'after_vote');

-- CreateEnum
CREATE TYPE "poll_suggestions" AS ENUM ('not_allowed', 'published', 'author_approves');

-- CreateEnum
CREATE TYPE "poll_option_status" AS ENUM ('published', 'pending');

-- CreateTable
CREATE TABLE "poll" (
    "quackId" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3),
    "resultsVisibility" "poll_results_visibility" NOT NULL DEFAULT 'immediately',
    "suggestions" "poll_suggestions" NOT NULL DEFAULT 'not_allowed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_pkey" PRIMARY KEY ("quackId")
);

-- CreateTable
CREATE TABLE "poll_option" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "text" VARCHAR(80) NOT NULL,
    "normalizedText" VARCHAR(80) NOT NULL,
    "status" "poll_option_status" NOT NULL DEFAULT 'published',
    "position" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_vote" (
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_vote_pkey" PRIMARY KEY ("pollId","userId")
);

-- CreateIndex
CREATE INDEX "poll_option_createdById_idx" ON "poll_option"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "poll_option_pollId_normalizedText_key" ON "poll_option"("pollId", "normalizedText");

-- CreateIndex
CREATE INDEX "poll_vote_optionId_idx" ON "poll_vote"("optionId");

-- CreateIndex
CREATE INDEX "poll_vote_userId_idx" ON "poll_vote"("userId");

-- AddForeignKey
ALTER TABLE "poll" ADD CONSTRAINT "poll_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "poll"("quackId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "poll"("quackId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "poll_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;
