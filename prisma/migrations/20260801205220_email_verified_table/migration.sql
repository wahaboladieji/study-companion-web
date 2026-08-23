-- AlterTable
ALTER TABLE "User" DROP COLUMN "verificationCode",
DROP COLUMN "verificationCodeExpiresAt";

-- CreateTable
CREATE TABLE "EmailVerified" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerified_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerified_userId_key" ON "EmailVerified"("userId");

-- CreateIndex
CREATE INDEX "EmailVerified_codeExpiresAt_idx" ON "EmailVerified"("codeExpiresAt");

-- CreateIndex
CREATE INDEX "EmailVerified_userId_idx" ON "EmailVerified"("userId");

-- AddForeignKey
ALTER TABLE "EmailVerified" ADD CONSTRAINT "EmailVerified_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
