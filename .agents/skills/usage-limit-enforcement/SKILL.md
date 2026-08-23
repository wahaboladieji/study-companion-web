---
name: usage-limit-enforcement
description: Use when adding or changing plan limits, Course limits, upload limits, storage limits, AI generation limits, Chat limits, quota checks, UsageEvent creation, remaining allowance, or rejection of plan-limited actions. Trigger words include usage limit, quota, plan allowance, free plan, premium plan, storage limit, generation limit, chat limit, UsageEvent, limit reached, and billing period.
---

# Usage Limit Enforcement

This skill teaches the server-side check, execute, and record-success workflow.

The governing laws are in:

- `.agents/rules/money-and-billing.md`
- `.agents/rules/database-schema.md`
- `.agents/rules/security.md`
- `.agents/rules/coding-standards.md`

## Procedure

1. Identify the limited action.
   - Course creation.
   - File upload count.
   - Storage consumption.
   - Study Notes generation.
   - Flashcard generation.
   - Chat message use.

2. Identify the authoritative plan field.
   - Load the active Plan from PostgreSQL.
   - Do not use frontend values or hardcoded limits.
   - Treat inactive or expired subscriptions according to the user's current effective plan.

3. Define the billing period.
   - Use the server-side billing period.
   - Do not accept a billing period from the client.
   - Use the same period calculation for checks and usage records.

4. Calculate current usage on the server.
   - Query immutable UsageEvents or authoritative resource counts.
   - Do not trust displayed remaining quota.
   - Exclude failed operations.

5. Calculate the requested quantity.
   - Use one unit for one generation or Chat message where defined.
   - Use actual byte size for storage.
   - Never accept a client-supplied quantity.

6. Reject before expensive work.
   - Compare current usage plus requested quantity with the plan limit.
   - Stop before storage, AI provider, or payment work when the limit is exceeded.
   - Return a clear limit code.

7. Execute the action.
   - Perform the protected operation.
   - Keep usage unrecorded while the operation can still fail.

8. Record successful usage.
   - Create an append-only UsageEvent after success.
   - Use a database transaction when usage and the successful database result must remain consistent.
   - Do not record failed operations.

9. Handle concurrency.
   - Prevent two simultaneous requests from both passing the same remaining allowance.
   - Use a transaction, lock, reservation, or another PostgreSQL-safe method already approved by the architecture.
   - Do not solve concurrency in the frontend.

10. Return remaining allowance.
    - Calculate it on the server.
    - Treat frontend display as informational only.
    - The backend remains authoritative.

## Code Skeleton

```ts
type LimitType =
  | "COURSE"
  | "UPLOAD"
  | "STORAGE"
  | "GENERATION"
  | "CHAT";

export async function assertUsageAllowed(input: {
  userId: string;
  type: LimitType;
  requestedQuantity: number;
}) {
  const plan = await loadEffectivePlan(input.userId);
  const billingPeriod = getCurrentBillingPeriod();

  const used = await calculateUsage({
    userId: input.userId,
    type: input.type,
    billingPeriod,
  });

  const limit = getPlanLimit(plan, input.type);

  if (used + input.requestedQuantity > limit) {
    throw new UsageLimitError(input.type);
  }

  return {
    plan,
    billingPeriod,
    used,
    limit,
  };
}
export async function runLimitedGeneration(input: {
  userId: string;
  courseId: string;
}) {
  const allowance = await assertUsageAllowed({
    userId: input.userId,
    type: "GENERATION",
    requestedQuantity: 1,
  });

  const result = await performGeneration();

  await prisma.usageEvent.create({
    data: {
      userId: input.userId,
      courseId: input.courseId,
      eventType: "STUDY_NOTES_GENERATED",
      quantity: 1,
      billingPeriod: allowance.billingPeriod,
    },
  });

  return result;
}
Common Traps
Hardcoding free or premium limits.
Checking only in the frontend.
Trusting a quantity sent by the browser.
Recording usage before the action succeeds.
Charging quota for failed OCR or AI.
Using different billing-period calculations.
Ignoring simultaneous requests.
Updating old UsageEvents instead of appending a new one.
Automatically deleting data after downgrade.
Counting upload bytes before storage succeeds.
Verify Before Done
 The action maps to one approved plan field.
 Plan values come from PostgreSQL.
 Current usage is calculated on the server.
 Requested quantity is calculated on the server.
 The check runs before expensive work.
 Failed operations do not create usage.
 Successful usage creates an append-only event.
 Billing-period logic is consistent.
 Concurrent requests cannot exceed the limit.
 Existing user data survives downgrade or expiry.
 The client is not the source of truth.

Write tests for:

Usage below limit.
Usage exactly reaching limit.
Usage exceeding limit.
Failed action without UsageEvent.
Successful action with UsageEvent.
Simultaneous final-allowance requests.
Expired subscription using the effective fallback plan.
Storage byte accounting.
Plan change without historical usage corruption.