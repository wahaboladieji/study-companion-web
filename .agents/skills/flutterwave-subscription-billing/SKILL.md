---
name: flutterwave-subscription-billing
description: Use when implementing or changing Flutterwave checkout, payment initialization, transaction verification, webhook handling, webhook signature verification, subscription activation, renewal, cancellation, expiry, plan change, payment records, or billing audit history. Trigger words include Flutterwave, checkout, payment, webhook, transaction reference, subscription, renewal, cancel plan, verify payment, and paid plan.
---

# Flutterwave Subscription Billing

This skill teaches the safe Flutterwave subscription workflow.

The governing laws are in:

- `.agents/rules/money-and-billing.md`
- `.agents/rules/security.md`
- `.agents/rules/database-schema.md`
- `.agents/rules/git-conventions.md`

## Procedure

1. Load the selected Plan.
   - Read price, currency, and limits from PostgreSQL.
   - Do not trust price or plan details from the client.
   - Reject inactive Plans.

2. Authenticate the student.
   - Resolve the server-side session.
   - Associate every billing action with the authenticated User.

3. Create a unique transaction reference.
   - Generate it on the server.
   - Make it unique and traceable.
   - Never reuse a completed reference.

4. Store a pending transaction.
   - Save User, Plan, integer minor amount, currency, provider, reference, and status.
   - Do not activate the subscription yet.

5. Initialize Flutterwave checkout from the backend.
   - Send server-authoritative amount and currency.
   - Keep secret credentials on the server.
   - Return only safe checkout information to the client.

6. Handle browser return as untrusted.
   - Do not activate a Plan because the browser reports success.
   - Use the return only to begin server-side verification.

7. Verify the transaction with Flutterwave.
   - Match provider reference.
   - Match expected amount.
   - Match expected currency.
   - Match successful provider status.
   - Reject any mismatch.

8. Process verified payment idempotently.
   - Detect an already-processed provider transaction.
   - Do not create duplicate payments or active subscriptions.
   - Use a database transaction for billing state changes.

9. Activate or update the Subscription.
   - Keep only one active Subscription per User.
   - Link the verified Plan.
   - Set provider identifiers and verified period dates.
   - Preserve previous transaction history.

10. Handle webhooks.
    - Verify Flutterwave webhook authenticity.
    - Reject invalid signatures.
    - Store a provider event identifier or deduplication key.
    - Process repeated webhook delivery safely.

11. Handle subscription state changes.
    - Update status only from verified server-side provider events or approved internal expiry logic.
    - Do not delete Courses, Files, Notes, Flashcards, or Chat history after cancellation or expiry.
    - Apply the user's effective Plan limits.

12. Handle failure.
    - Keep failed payments as auditable records.
    - Do not activate the Subscription.
    - Do not expose provider secrets or raw sensitive payloads.

13. Reconcile uncertain states.
    - Reverify pending transactions when the provider callback was missed.
    - Do not guess payment success.
    - Keep database and provider state traceable.

## Code Skeleton

```ts
export async function createFlutterwaveCheckout(input: {
  planId: string;
}) {
  const session = await requireSession();

  const plan = await prisma.plan.findFirst({
    where: {
      id: input.planId,
      isActive: true,
    },
  });

  if (!plan) {
    throw new NotFoundError("PLAN_NOT_FOUND");
  }

  const reference = createTransactionReference();

  const transaction = await prisma.paymentTransaction.create({
    data: {
      userId: session.user.id,
      planId: plan.id,
      amountMinor: plan.priceMonthlyMinor,
      currency: plan.currency,
      provider: "FLUTTERWAVE",
      providerReference: reference,
      status: "PENDING",
    },
  });

  const checkout = await flutterwave.initialize({
    txRef: reference,
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    customerEmail: session.user.email,
  });

  return {
    checkoutUrl: checkout.url,
    transactionId: transaction.id,
  };
}
export async function verifyAndActivateSubscription(reference: string) {
  const transaction = await loadPendingTransaction(reference);
  const verified = await flutterwave.verify(reference);

  assertVerifiedPaymentMatches({
    expectedAmountMinor: transaction.amountMinor,
    expectedCurrency: transaction.currency,
    verified,
  });

  await prisma.$transaction(async (tx) => {
    const existing = await tx.paymentTransaction.findUnique({
      where: { providerReference: reference },
    });

    if (existing?.status === "SUCCESSFUL") {
      return;
    }

    await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "SUCCESSFUL",
        providerTransactionId: verified.transactionId,
      },
    });

    await tx.subscription.updateMany({
      where: {
        userId: transaction.userId,
        status: "ACTIVE",
      },
      data: {
        status: "CANCELLED",
      },
    });

    await tx.subscription.create({
      data: {
        userId: transaction.userId,
        planId: transaction.planId,
        provider: "FLUTTERWAVE",
        status: "ACTIVE",
        providerSubscriptionId: verified.subscriptionId,
        currentPeriodStart: verified.periodStart,
        currentPeriodEnd: verified.periodEnd,
      },
    });
  });
}
```

## Common Traps

- Trusting the amount sent by the frontend.
- Activating after the browser redirects.
- Failing to compare amount and currency during verification.
- Processing duplicate webhooks twice.
- Creating multiple active subscriptions.
- Using floating-point money.
- Storing Flutterwave secret keys in client code.
- Logging full provider payloads.
- Deleting user data after cancellation.
- Replacing Flutterwave with another provider.
- Inventing trials, coupons, refunds, or discounts.

## Verify Before Done

- [ ] Flutterwave is the only provider.
- [ ] Plan price and currency come from PostgreSQL.
- [ ] Money uses integer minor units.
- [ ] The transaction reference is server generated.
- [ ] A pending transaction exists before checkout.
- [ ] Browser success is never trusted.
- [ ] Server verification checks status, amount, and currency.
- [ ] Webhook authenticity is verified.
- [ ] Webhook and callback processing are idempotent.
- [ ] Only one active Subscription can remain.
- [ ] Billing history is preserved.
- [ ] Expiry does not delete study data.
- [ ] Secrets remain server-side.
- [ ] Failed payments do not activate a Plan.

Write tests for:

- Inactive Plan.
- Client price tampering.
- Successful verification.
- Amount mismatch.
- Currency mismatch.
- Failed provider status.
- Duplicate verification callback.
- Duplicate webhook.
- Invalid webhook signature.
- Existing active subscription replacement.
- Subscription expiry without data deletion.
- Provider timeout and later reconciliation.