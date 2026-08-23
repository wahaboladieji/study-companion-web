import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth?mode=signin");
  }

  if (user.onboarded) {
    redirect("/dashboard");
  }

  return <OnboardingWizard />;
}
