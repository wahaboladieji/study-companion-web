---
trigger: glob
---

# Money and Billing Rules

These rules govern every part of pricing, subscriptions, usage limits, and payment processing for AI Study Companion.

The Product Requirements Document (PRD), `AGENTS.md`, and the other rule files remain the source of truth.

Breaking any rule in this document means the implementation has failed, even if the application builds and appears to work.

---

# 1. Locked Billing Choices

The payment provider is locked.

Use:

- Flutterwave

Never replace Flutterwave with:

- Paystack
- Stripe
- LemonSqueezy
- Paddle
- PayPal
- Any other payment provider

Do not introduce multiple payment providers.

Do not build an abstraction layer for multiple payment providers.

The PRD has resolved the payment provider open question in favor of Flutterwave.

---

# 2. Business Model

The application uses a freemium subscription model.

Only implement plans defined by the database.

Do not hardcode pricing inside the application.

Do not hardcode feature limits.

Read pricing and limits from the database.

---

# 3. Money Storage

Store every monetary amount using the smallest currency unit as an integer.

Never use:

- float
- double
- decimal for application logic

Examples:

NGN 5,000

Store as:

500000 kobo

Do not perform money calculations using floating-point arithmetic.

---

# 4. Pricing Source of Truth

The database is the only source of truth for:

- Monthly price
- Upload limits
- AI generation limits
- Chat limits
- Storage limits
- Course limits

Never duplicate pricing values inside:

- frontend
- API routes
- React components
- environment variables

---

# 5. Subscription Ownership

Every subscription belongs to exactly one User.

A User may have only one active subscription at a time.

Never create multiple active subscriptions for the same user.

---

# 6. Plan Changes

Changing plans must not corrupt usage records.

When upgrading:

- Preserve existing usage.
- Apply the new limits immediately unless business rules change.

When downgrading:

- Never delete user data automatically.
- Prevent creation of new resources that exceed the new limits.
- Allow access to existing data.

---

# 7. Trial Handling

Do not implement free trials unless explicitly added to the PRD.

Do not invent promotional pricing.

Do not invent coupons.

Do not invent discounts.

---

# 8. Usage Tracking

Every billable action must create a UsageEvent.

At minimum track:

- Course created
- File uploaded
- Study Notes generated
- Flashcards generated
- Chat message sent
- Storage consumed

Never trust usage values supplied by the client.

Calculate usage on the server.

Usage events are append-only.

Do not edit historical usage events during normal application operation.

---

# 9. Usage Limits

Always enforce limits on the server.

Never rely on frontend validation.

Before performing a billable action:

- Read the user's active plan.
- Calculate current usage.
- Compare against plan limits.

If the limit has been reached:

- Reject the action.
- Return a clear error.
- Do not partially execute the action.

---

# 10. AI Generation Billing

Study Notes generation counts toward AI usage.

Flashcard generation counts toward AI usage.

Chat messages count toward AI usage.

Do not charge for:

- Uploading files
- OCR processing
- Text extraction
- Background processing

unless the PRD changes.

---

# 11. Failed Operations

Never consume usage for failed operations.

Examples:

- OCR failed
- AI generation failed
- Upload validation failed
- Payment verification failed

Only successful operations may consume usage.

If usage was recorded before failure, roll it back inside the same transaction where possible.

---

# 12. Payment Verification

Never trust the client after payment.

Never activate a subscription because the frontend claims payment succeeded.

Always verify payment with Flutterwave.

Subscription activation must occur only after successful server-side verification.

---

# 13. Webhooks

Treat Flutterwave webhooks as the source of truth for payment events.

Always verify webhook authenticity before processing.

Never process:

- unsigned
- invalid
- duplicated
- replayed

webhook events.

Store the provider transaction reference.

Ignore duplicate webhook deliveries safely.

Webhook handlers must be idempotent.

---

# 14. Idempotency

Payment operations must be idempotent.

Repeated payment callbacks must never:

- activate multiple subscriptions
- duplicate UsageEvents
- create duplicate invoices
- create duplicate transactions

Use provider references to detect duplicates.

---

# 15. Subscription Status

Subscription status must come from verified payment events.

Never allow the frontend to change subscription status.

Allowed statuses should include:

- ACTIVE
- INACTIVE
- PAST_DUE
- CANCELLED
- EXPIRED

Use constrained enums.

Do not use arbitrary strings.

---

# 16. Expired Subscriptions

When a subscription expires:

Do not delete:

- Courses
- Files
- Study Notes
- Flashcards
- Chat history

Instead:

Restrict premium actions according to the user's new plan.

Users must always retain access to their existing study data.

---

# 17. Storage Limits

Storage usage is calculated on the server.

Never trust values supplied by the browser.

Deleting a file must update storage usage.

Failed uploads must not increase storage usage.

---

# 18. Refunds

Do not implement refunds unless required by the PRD.

If refunds are added later:

- Keep payment history.
- Never delete payment records.
- Record refund events separately.

Do not overwrite the original transaction.

---

# 19. Transaction Records

Every successful payment must create a transaction record.

Store at minimum:

- User
- Plan
- Amount
- Currency
- Provider
- Provider transaction reference
- Payment status
- Created timestamp

Do not store sensitive payment credentials.

Do not store full card numbers.

Do not store CVV values.

---

# 20. Security

Never expose:

- Flutterwave secret keys
- Webhook secrets
- Internal transaction identifiers

Secrets belong only on the server.

Never call Flutterwave secret endpoints directly from the client.

---

# 21. Currency Handling

Use one currency implementation per transaction.

Do not mix currencies during calculations.

Store the currency alongside every payment.

Never assume every payment uses NGN.

Always use the provider-reported currency.

---

# 22. Billing Calculations

Perform all billing calculations on the server.

Never calculate subscription eligibility on the client.

Never calculate remaining quota on the client as the source of truth.

The frontend may display estimates only.

The backend always makes the final decision.

---

# 23. Failure Recovery

Payment failures must never leave the system in a partially updated state.

If payment verification fails:

- Do not activate the subscription.
- Do not update the user's plan.
- Do not consume usage.
- Log the failure.

Use database transactions whenever multiple billing records are updated together.

---

# 24. Auditability

Every billing-related state change must be traceable.

Maintain immutable records for:

- Payments
- Usage events
- Plan changes
- Subscription activations
- Subscription cancellations

Never silently overwrite billing history.

Never delete historical billing records.

---

# 25. Task Completion Checklist

Before completing any billing-related task, verify:

- [ ] Flutterwave is the only payment provider.
- [ ] Money is stored as integers in the smallest currency unit.
- [ ] Pricing comes from the database.
- [ ] Usage is calculated on the server.
- [ ] Usage limits are enforced on the server.
- [ ] Failed operations do not consume usage.
- [ ] Payments are verified server-side.
- [ ] Webhooks are verified.
- [ ] Webhook processing is idempotent.
- [ ] Subscription status cannot be changed from the client.
- [ ] Existing user data is preserved after subscription expiry.
- [ ] No secrets are exposed.
- [ ] Billing calculations happen on the backend.
- [ ] Billing history remains immutable.

---

# 26. When Unsure

Do not guess when implementing billing.

Do not invent pricing.

Do not invent subscription logic.

Do not invent plan limits.

Do not activate subscriptions without verified payment.

Do not consume usage unless the action completed successfully.

If uncertainty affects:

- money
- subscriptions
- payment verification
- usage limits
- billing history
- transaction integrity

stop and request clarification before continuing.