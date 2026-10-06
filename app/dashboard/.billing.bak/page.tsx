import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth";
import {
  getActivePlanById,
  listActivePlans,
  serializePlanForCheckout,
} from "@/services/plans";
import { CheckoutForm } from "@/components/dashboard/checkout-form";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?mode=signin");
  }
  if (!user.onboarded) {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const planId = typeof params.planId === "string" ? params.planId : null;
  const interval = params.interval === "yearly" ? "yearly" : "monthly";
  const txRef = typeof params.tx_ref === "string" ? params.tx_ref : null;
  const returnStatus = typeof params.status === "string" ? params.status : null;

  let plan = planId ? await getActivePlanById(planId) : null;
  if (!plan) {
    const plans = await listActivePlans();
    plan =
      plans.find((p) => p.name.toUpperCase() === "PREMIUM") ??
      plans.find((p) => p.monthlyPrice > 0) ??
      null;
  }

  return (
    <CheckoutForm
      plan={plan ? serializePlanForCheckout(plan) : null}
      initialInterval={interval}
      txRef={txRef}
      returnStatus={returnStatus}
    />
  );
}
