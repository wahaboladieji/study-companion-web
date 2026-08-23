/*
  Warnings:

  - Added the required column `interval` to the `PaymentTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "interval" TEXT NOT NULL;
