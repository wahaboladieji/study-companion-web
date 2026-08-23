---
name: prisma-schema-migration
description: Use when changing schema.prisma, adding or removing a Prisma model, field, enum, relation, index, unique constraint, foreign key, cascade rule, pgvector field, migration, or database data shape. Trigger words include Prisma schema, migration, model, enum, relation, index, constraint, database change, schema.prisma, and destructive migration.
---

# Prisma Schema Migration

This skill teaches the safe workflow for changing the PostgreSQL data model.

The governing laws are in:

- `.agents/rules/database-schema.md`
- `.agents/rules/git-conventions.md`
- `.agents/rules/security.md`
- `.agents/rules/money-and-billing.md`

## Procedure

1. Trace the change to an approved requirement.
   - Identify the PRD, `AGENTS.md`, or named rule that requires it.
   - Do not add speculative models or fields.
   - Do not create models for excluded MVP features.

2. Identify affected data.
   - List models, relations, indexes, enums, and services touched.
   - Identify whether existing rows can violate the new shape.
   - Identify billing, ownership, deletion, and privacy impact.

3. Choose a safe migration path.
   - Prefer additive changes.
   - For a new required field on existing data, use a staged migration.
   - Do not drop or rewrite user data without approval.

4. Update `schema.prisma`.
   - Use PostgreSQL and Prisma only.
   - Add explicit relations.
   - Add indexes to foreign keys and common status queries.
   - Use enums for constrained statuses and types.

5. Define referential behavior.
   - State whether deletion cascades, restricts, or sets null.
   - Match Course, File, content, Chat, usage, and subscription ownership rules.
   - Do not rely on undocumented defaults.

6. Validate money fields.
   - Store money as integer minor units.
   - Store currency with monetary records.
   - Do not introduce floating-point prices.

7. Validate embedding storage.
   - Keep embeddings in PostgreSQL.
   - Do not introduce a separate vector database.

8. Generate a new migration.
   - Never edit an already-applied migration.
   - Use the repository's existing package manager and Prisma commands.
   - Give the migration a clear name.

9. Inspect the generated SQL.
   - Look for table drops, column drops, destructive type changes, and unexpected cascades.
   - Stop when SQL could destroy user or billing data.
   - Do not apply an unsafe migration silently.

10. Plan data backfill when needed.
    - Backfill before making a field required.
    - Keep the backfill idempotent.
    - Do not load production private data into local fixtures.

11. Validate the schema and migration.
    - Run Prisma formatting and validation.
    - Apply the migration in a disposable or development database.
    - Regenerate the Prisma client.
    - Run type checks and tests.

12. Commit schema and migration together.
    - Include the lockfile only when dependencies changed.
    - Explain destructive or data-sensitive changes in the review summary.

## Code Skeleton

```prisma
model Course {
  id        String   @id @default(cuid())
  userId    String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  files File[]

  @@index([userId])
}
enum ProcessingStatus {
  UPLOADED
  PROCESSING
  READY
  FAILED
}

model File {
  id               String           @id @default(cuid())
  courseId         String
  fileName         String
  processingStatus ProcessingStatus @default(UPLOADED)

  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@index([courseId])
  @@index([processingStatus])
}
// Staged required-field migration pattern:
//
// 1. Add nullable field.
// 2. Backfill existing records.
// 3. Validate no null values remain.
// 4. Add a later migration that makes the field required.
```

## Common Traps

- Adding a model for a future feature.
- Editing a migration already applied elsewhere.
- Adding a required field without a backfill path.
- Using Float for money.
- Forgetting indexes on foreign keys.
- Using filename as a unique identifier.
- Adding free-text status fields.
- Creating orphanable relations.
- Adding cascade delete without checking its full impact.
- Committing schema.prisma without its migration.
- Trusting generated SQL without reading it.
- Adding a separate vector database.

## Verify Before Done

- [ ] The change traces to an approved requirement.
- [ ] No excluded MVP model was added.
- [ ] Ownership relations are explicit.
- [ ] Referential deletion behavior is explicit.
- [ ] Status and type fields use enums where required.
- [ ] Money uses integer minor units.
- [ ] Required indexes and constraints exist.
- [ ] Existing data has a safe migration path.
- [ ] Generated SQL was inspected.
- [ ] No applied migration was edited.
- [ ] Prisma validation passes.
- [ ] The migration applies in development.
- [ ] Prisma Client regenerates.
- [ ] Type checks pass.
- [ ] Schema and migration are committed together.

Write tests for:

- Required relations.
- Unique constraints.
- Enum restrictions.
- Cascade or restrict behavior.
- Migration against existing sample rows.
- Backfill idempotency.
- Ownership queries using the new relation.
- Billing calculations when money fields changed.