---
trigger: glob
---

# Database Schema Rules

These rules govern the PostgreSQL database and Prisma schema for AI Study Companion.

The Product Requirements Document and `AGENTS.md` remain the source of truth.

Breaking any rule in this file means the task has failed, even if the application builds and appears to work.

---

# 1. Locked Database Choices

Use PostgreSQL as the only application database.

Use Prisma as the only ORM.

Do not replace PostgreSQL.

Do not replace Prisma.

Do not introduce:

- MongoDB
- MySQL
- SQLite
- Firebase
- DynamoDB
- Drizzle
- Sequelize
- TypeORM
- A separate vector database

Store embeddings in PostgreSQL.

---

# 2. MVP Schema Scope

Only create database models required by the current MVP.

The allowed core models are:

- User
- Course
- File
- ExtractedContent
- ContentChunk
- Embedding
- StudyNote
- Flashcard
- ChatSession
- ChatMessage
- Generation
- UsageEvent
- Plan
- Subscription

Do not create models for excluded features.

Do not add:

- Admin
- Teacher
- Quiz
- QuizQuestion
- PracticeQuestion
- StudyPlan
- Notification
- Collaboration
- SharedCourse
- ProgressDashboard
- VersionHistory
- ChatCitation
- BackgroundJob

unless the PRD is explicitly changed.

---

# 3. Ownership Rules

Every Course must belong to exactly one User.

Every File must belong to exactly one Course.

Every StudyNote must belong to exactly one Course.

Every Flashcard must belong to exactly one Course.

Every ChatSession must belong to exactly one Course.

Every ChatMessage must belong to exactly one ChatSession.

Every ContentChunk must belong to exactly one File.

Every Embedding must belong to exactly one ContentChunk.

Never create orphaned records.

Never allow uploaded files or generated study content to exist outside a Course.

---

# 4. Required User Model Rules

The `User` model must include:

- `id`
- `name`
- `email`
- `passwordHash`, nullable for OAuth-only accounts
- `subscriptionTier` or `planId`
- `createdAt`
- `updatedAt`

The email must be unique.

Do not store plain-text passwords.

Do not add additional application roles.

The only product role is Student.

---

# 5. Required Course Model Rules

The `Course` model must include:

- `id`
- `userId`
- `name`
- `createdAt`
- `updatedAt`

A Course name must not be empty.

A Course must never exist without a valid User.

Update `Course.updatedAt` when any of the following occur:

- A file is uploaded
- A file finishes processing
- Study Notes are generated or edited
- Flashcards are generated or edited
- Chat activity occurs

---

# 6. Required File Model Rules

The `File` model must include:

- `id`
- `courseId`
- `fileName`
- `fileType`
- `fileSize`
- `storageKey`
- `processingStatus`
- `processingError`
- `retryCount`
- `createdAt`
- `updatedAt`

Never store uploaded file bytes in PostgreSQL.

Store only metadata and the object-storage key.

Never expose internal storage keys directly to the client.

Use a constrained enum for `processingStatus`.

Allowed processing states should include:

- UPLOADED
- PROCESSING
- READY
- FAILED

Do not use arbitrary text values for processing states.

Duplicate filenames are allowed.

Never use `fileName` as a unique identifier.

---

# 7. Extracted Content and Chunking Rules

Store extracted text separately from the File metadata.

The `ExtractedContent` model must include:

- `id`
- `fileId`
- `rawText`
- `cleanedText`
- `createdAt`
- `updatedAt`

The `ContentChunk` model must include:

- `id`
- `fileId`
- `text`
- `pageNumber`, nullable
- `chunkIndex`
- `charStart`, nullable
- `charEnd`, nullable
- `createdAt`

Every chunk must preserve a reference to its source File.

Do not store chunks without source linkage.

Use a unique constraint on the combination of:

- `fileId`
- `chunkIndex`

---

# 8. Embedding Rules

Generate embeddings only when Course Chat is first used.

Do not generate embeddings automatically after every upload unless the PRD changes.

The `Embedding` model must include:

- `id`
- `chunkId`
- `provider`
- `model`
- `vector`
- `createdAt`

Each ContentChunk may have at most one active embedding for the same provider and model combination.

Store embeddings in PostgreSQL.

Do not add a separate vector database.

---

# 9. Study Notes Rules

The `StudyNote` model must include:

- `id`
- `courseId`
- `title`
- `content`
- `createdAt`
- `updatedAt`

Study Notes must belong to a Course.

Regenerating Study Notes must not silently overwrite the existing record.

Require explicit application-level confirmation before replacement.

Do not implement version history in the MVP.

---

# 10. Flashcard Rules

The `Flashcard` model must include:

- `id`
- `courseId`
- `question`
- `answer`
- `status`
- `createdAt`
- `updatedAt`

Use a constrained enum for `status`.

Allowed values are:

- NEW
- REVIEWING
- MASTERED

Do not introduce additional progress-tracking fields or dashboards.

---

# 11. Chat Rules

The `ChatSession` model must belong to a Course.

The `ChatMessage` model must belong to a ChatSession.

Source citations can be stored as structured data or within the ChatMessage record. Ensure every citation refers to existing uploaded Course material.

Never create citations that cannot be traced to uploaded Course material.

---

# 12. Generation Tracking Rules

The `Generation` model must include:

- `id`
- `courseId`
- `type`
- `status`
- `outputContent`, nullable until completion
- `errorMessage`, nullable
- `createdAt`
- `updatedAt`

Use constrained enums for:

`type`:

- STUDY_NOTES
- FLASHCARDS
- CHAT_RESPONSE
- EMBEDDINGS

`status`:

- PENDING
- PROCESSING
- COMPLETED
- FAILED

Do not use free-text generation types or statuses.

Record failures.

Never leave failed generations indistinguishable from successful ones.

---

# 13. Usage Tracking Rules

The `UsageEvent` model must include:

- `id`
- `userId`
- `courseId`, nullable when not course-specific
- `eventType`
- `quantity`
- `billingPeriod`
- `createdAt`

Usage events must be append-only.

Do not update or delete usage events during normal application operation.

Use constrained event types.

Track at minimum the billable actions defined in PRD Section 8: course creation, file uploads, AI generations, chat messages, and storage usage.

Never calculate billing or usage limits from client-provided values.

---

# 14. Plan and Subscription Rules

The `Plan` model must include fields that cover the limits defined in PRD Section 8:

- Course limit
- Upload limit
- AI generation limit
- Chat message limit
- Storage limit (in MB)
- Monthly price
- Currency
- Active flag
- Timestamps

The PRD has resolved free and premium tier limits. Store money in the smallest currency unit as an integer.

Never use floating-point or decimal values for plan prices.

The `Subscription` model must include:

- `id`
- `userId`
- `planId`
- `provider`
- `providerCustomerId`, nullable
- `providerSubscriptionId`, nullable
- `status`
- `currentPeriodStart`, nullable
- `currentPeriodEnd`, nullable
- `createdAt`
- `updatedAt`

The payment provider must be Flutterwave.

Do not store Paystack or Stripe identifiers.

Do not trust client-supplied subscription status.

---

# 15. Deletion and Referential Integrity Rules

Require application-level confirmation before deleting a Course.

Deleting a Course must also delete its dependent:

- Files
- ExtractedContent
- ContentChunks
- Embeddings
- StudyNotes
- Flashcards
- ChatSessions
- ChatMessages

Use explicit Prisma relation behavior.

Do not rely on undocumented database defaults.

Do not leave orphaned records after deletion.

Do not implement soft deletion unless the PRD changes.

---

# 16. Index and Constraint Rules

Add indexes for frequently queried foreign keys and status fields.

At minimum, index:

- `Course.userId`
- `File.courseId`
- `File.processingStatus`
- `ContentChunk.fileId`
- `Embedding.chunkId`
- `StudyNote.courseId`
- `Flashcard.courseId`
- `ChatSession.courseId`
- `ChatMessage.sessionId`
- `Generation.courseId`
- `Generation.status`
- `UsageEvent.userId`
- `UsageEvent.billingPeriod`
- `Subscription.userId`

Use unique constraints where business identity requires uniqueness.

Do not add uniqueness constraints to filenames.

---

# 17. Migration Rules

Every schema change must include a Prisma migration.

Do not modify production schema manually.

Do not edit an already-applied migration.

Create a new migration for every schema change.

Review destructive migration warnings before applying them.

Never drop user data without explicit approval.

---

# 18. Data Validation Rules

Validate all enum values.

Validate file sizes as non-negative integers.

Validate usage quantities as non-negative integers.

Validate money amounts as non-negative integers.

Validate required foreign keys before creating records.

Never rely on frontend validation alone.

---

# 19. When Unsure

Do not invent a model.

Do not add fields for future features.

Do not create speculative relations.

Choose the smallest schema that satisfies the current PRD.

If a schema decision affects:

- billing
- user data deletion
- ownership
- privacy
- AI source grounding

stop and request clarification before implementing it.