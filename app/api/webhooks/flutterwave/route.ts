import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTransaction } from "@/services/flutterwave";

// Flutterwave sends the secret hash in the "verif-hash" header
function verifyWebhookSignature(req: NextRequest): boolean {
  const hash = req.headers.get("verif-hash");
  const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
  if (!hash || !secret) return false;
  return hash === secret;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const txRef = body?.data?.tx_ref as string | undefined;

  let transactionId = null;
  let userId = null;

  if (txRef) {
    const tx = await prisma.paymentTransaction.findUnique({
      where: { providerReference: txRef },
    });
    if (tx) {
      transactionId = tx.id;
      userId = tx.userId;
    }
  }

  if (!verifyWebhookSignature(req)) {
    if (transactionId) {
      await prisma.paymentLog.create({
        data: {
          userId,
          transactionId,
          event: "WEBHOOK_SIGNATURE_FAILED",
          message: "Invalid verif-hash signature",
          rawPayload: body,
        },
      });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (transactionId) {
    await prisma.paymentLog.create({
      data: {
        userId,
        transactionId,
        event: "WEBHOOK_RECEIVED",
        message: "Valid webhook received",
        rawPayload: body,
      },
    });
  }

  const event = body?.event as string | undefined;

  if (event !== "charge.completed" || !txRef || !transactionId) {
    return NextResponse.json({ received: true });
  }

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction || transaction.status === "SUCCESSFUL") {
    return NextResponse.json({ received: true });
  }

  let verified;
  try {
    verified = await verifyTransaction(txRef);
  } catch {
    await prisma.paymentLog.create({
      data: {
        userId,
        transactionId,
        event: "WEBHOOK_VERIFICATION_FAILED",
        message: "Failed to verify transaction via Flutterwave API",
      },
    });
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }

  if (verified.status !== "successful") {
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: "FAILED" },
    });
    await prisma.paymentLog.create({
      data: {
        userId,
        transactionId,
        event: "WEBHOOK_STATUS_FAILED",
        message: `Payment status was ${verified.status}`,
      },
    });
    return NextResponse.json({ received: true });
  }

  if (
    verified.amountMinor !== transaction.amountMinor ||
    verified.currency !== transaction.currency
  ) {
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: "FAILED" },
    });
    await prisma.paymentLog.create({
      data: {
        userId,
        transactionId,
        event: "WEBHOOK_AMOUNT_MISMATCH",
        message: `Expected ${transaction.amountMinor} ${transaction.currency}, got ${verified.amountMinor} ${verified.currency}`,
      },
    });
    return NextResponse.json({ received: true });
  }

  // Payment provider confirmed success and amounts match
  await prisma.paymentLog.create({
    data: {
      userId,
      transactionId,
      event: "CALLBACK_VERIFIED",
      message: `Flutterwave confirmed payment successful (${verified.amountMinor} ${verified.currency})`,
    },
  });

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  if (transaction.interval === "yearly") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  await prisma.$transaction(async (tx) => {
    const latest = await tx.paymentTransaction.findUnique({
      where: { providerReference: txRef },
    });
    if (latest?.status === "SUCCESSFUL") return;

    await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "SUCCESSFUL",
        providerTransactionId: verified.transactionId,
      },
    });

    const activeSub = await tx.subscription.findFirst({
      where: { userId: transaction.userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    let remainingMs = 0;
    if (activeSub && activeSub.currentPeriodEnd && activeSub.currentPeriodEnd > new Date()) {
      remainingMs = activeSub.currentPeriodEnd.getTime() - Date.now();
    }

    await tx.subscription.updateMany({
      where: { userId: transaction.userId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });

    const periodStart = new Date();
    const baseEnd = new Date(periodStart);
    if (transaction.interval === "yearly") {
      baseEnd.setFullYear(baseEnd.getFullYear() + 1);
    } else {
      baseEnd.setMonth(baseEnd.getMonth() + 1);
    }

    const periodEnd = new Date(baseEnd.getTime() + remainingMs);

    await tx.subscription.create({
      data: {
        userId: transaction.userId,
        planId: transaction.planId,
        provider: "FLUTTERWAVE",
        status: "ACTIVE",
        providerSubscriptionId: verified.transactionId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });

    await tx.user.update({
      where: { id: transaction.userId },
      data: { subscriptionTier: "PREMIUM" },
    });

    const rolloverDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    await tx.paymentLog.create({
      data: {
        userId: transaction.userId,
        transactionId: transaction.id,
        event: "SUBSCRIPTION_FULFILLED",
        message: rolloverDays > 0
          ? `Subscription activated via webhook with ${rolloverDays} rollover days added from previous active plan`
          : "Subscription created and user upgraded to PREMIUM via webhook",
      },
    });
  });

  return NextResponse.json({ received: true });
}
