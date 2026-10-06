-- CreateEnum
CREATE TYPE "mood" AS ENUM ('happy', 'sad', 'angry', 'silly');

-- AlterTable
ALTER TABLE "quack" ADD COLUMN     "mood" "mood";
