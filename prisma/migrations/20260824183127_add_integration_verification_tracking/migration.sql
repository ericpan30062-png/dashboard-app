-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastVerifiedOk" BOOLEAN;
