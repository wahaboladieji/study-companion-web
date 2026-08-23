import { prisma } from "@/lib/prisma";

export type PlanBenefitRow = {
  label: string;
  freeValue: string;
  premiumValue: string;
};

export type UpgradeDialogData = {
  free: { name: string };
  premium: {
    id: string;
    name: string;
    monthlyPriceMinor: number;
    yearlyPriceMinor: number | null;
    currency: string;
    benefits: PlanBenefitRow[];
  } | null;
};

export function formatStorageMb(mb: number): string {
  if (mb >= 1024 * 1024) {
    const gb = (mb / 1024 / 1024).toFixed(mb % (1024 * 1024) === 0 ? 0 : 1);
    return `${gb} TB`;
  }
  if (mb >= 1024) {
    const gb = (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1);
    return `${gb} GB`;
  }
  return `${mb} MB`;
}

export type CheckoutPlan = {
  id: string;
  name: string;
  courseLimit: number;
  uploadLimit: number;
  aiGenerationLimit: number;
  chatMessageLimit: number;
  storageLimit: number;
  storageLabel: string;
  monthlyPriceMinor: number;
  yearlyPriceMinor: number | null;
  currency: string;
};

type PlanRow = {
  id: string;
  name: string;
  courseLimit: number;
  uploadLimit: number;
  aiGenerationLimit: number;
  chatMessageLimit: number;
  storageLimit: number;
  monthlyPrice: number;
  yearlyPrice: number | null;
  currency: string;
};

export function serializePlanForCheckout(plan: PlanRow): CheckoutPlan {
  return {
    id: plan.id,
    name: plan.name,
    courseLimit: plan.courseLimit,
    uploadLimit: plan.uploadLimit,
    aiGenerationLimit: plan.aiGenerationLimit,
    chatMessageLimit: plan.chatMessageLimit,
    storageLimit: plan.storageLimit,
    storageLabel: formatStorageMb(plan.storageLimit),
    monthlyPriceMinor: plan.monthlyPrice,
    yearlyPriceMinor: plan.yearlyPrice,
    currency: plan.currency,
  };
}

export async function listActivePlans() {
  return prisma.plan.findMany({
    where: { active: true },
    orderBy: [{ monthlyPrice: "asc" }, { name: "asc" }],
  });
}

export async function getActivePlanById(planId: string) {
  return prisma.plan.findUnique({
    where: { id: planId, active: true },
  });
}

export async function getUpgradeDialogData(): Promise<UpgradeDialogData> {
  const [freePlan, premiumPlan] = await Promise.all([
    prisma.plan.findFirst({ where: { name: "FREE", active: true } }),
    prisma.plan.findFirst({ where: { name: "PREMIUM", active: true } }),
  ]);

  if (!premiumPlan) {
    return {
      free: { name: freePlan?.name ?? "FREE" },
      premium: null,
    };
  }

  const freeValues = {
    courses: freePlan?.courseLimit ?? "N/A",
    uploads: freePlan?.uploadLimit ?? "N/A",
    generations: freePlan?.aiGenerationLimit ?? "N/A",
    chat: freePlan?.chatMessageLimit ?? "N/A",
    storage: freePlan ? formatStorageMb(freePlan.storageLimit) : "N/A",
  };

  return {
    free: { name: freePlan?.name ?? "FREE" },
    premium: {
      id: premiumPlan.id,
      name: premiumPlan.name,
      monthlyPriceMinor: premiumPlan.monthlyPrice,
      yearlyPriceMinor: premiumPlan.yearlyPrice,
      currency: premiumPlan.currency,
      benefits: [
        {
          label: "Courses",
          freeValue: String(freeValues.courses),
          premiumValue: String(premiumPlan.courseLimit),
        },
        {
          label: "Uploads per course",
          freeValue: String(freeValues.uploads),
          premiumValue: String(premiumPlan.uploadLimit),
        },
        {
          label: "AI generations per month",
          freeValue: String(freeValues.generations),
          premiumValue: String(premiumPlan.aiGenerationLimit),
        },
        {
          label: "Chat messages per month",
          freeValue: String(freeValues.chat),
          premiumValue: String(premiumPlan.chatMessageLimit),
        },
        {
          label: "Storage",
          freeValue: String(freeValues.storage),
          premiumValue: formatStorageMb(premiumPlan.storageLimit),
        },
      ],
    },
  };
}
