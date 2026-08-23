import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const plans = [
  {
    name: "FREE",
    courseLimit: 3,
    uploadLimit: 5,
    aiGenerationLimit: 10,
    chatMessageLimit: 50,
    storageLimit: 50,
    monthlyPrice: 0,
    yearlyPrice: null,
    currency: "NGN",
    active: true,
  },
  {
    name: "PREMIUM",
    courseLimit: 20,
    uploadLimit: 100,
    aiGenerationLimit: 50,
    chatMessageLimit: 200,
    storageLimit: 5120,
    monthlyPrice: 500000,
    yearlyPrice: 4800000,
    currency: "NGN",
    active: true,
  },
];

for (const plan of plans) {
  const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
  if (existing) {
    await prisma.plan.update({
      where: { id: existing.id },
      data: {
        courseLimit: plan.courseLimit,
        uploadLimit: plan.uploadLimit,
        aiGenerationLimit: plan.aiGenerationLimit,
        chatMessageLimit: plan.chatMessageLimit,
        storageLimit: plan.storageLimit,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
        active: plan.active,
      },
    });
    console.log(`Updated plan: ${plan.name}`);
  } else {
    await prisma.plan.create({ data: plan });
    console.log(`Created plan: ${plan.name}`);
  }
}

await pool.end();
