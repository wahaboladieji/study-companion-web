"use server";

import { getCurrentUser } from "@/services/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function completeOnboardingAction(_prevState: unknown, _formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?mode=signin");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionTier: "FREE",
    },
  });

  redirect("/dashboard?celebrate=1");
}
