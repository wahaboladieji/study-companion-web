---
trigger: always_on
---

# Uploads and Storage Rules

These rules govern file uploads, object storage, document processing, OCR, extracted content, and storage lifecycle for AI Study Companion.

The Product Requirements Document (PRD), `AGENTS.md`, and the other rule files remain the source of truth.

Breaking any rule in this document means the implementation has failed, even if the application builds and appears to work.

---

# 1. Locked Storage Architecture

Store uploaded files in object storage (Cloudflare R2, with AWS S3 as the alternative).

Store metadata in PostgreSQL using Prisma.

Never store uploaded file contents inside PostgreSQL.

Never replace object storage with local filesystem storage in production.

Never introduce another storage architecture unless the PRD changes.

---

# 2. Supported Upload Types

Only allow the following file types:

- PDF
- DOCX
- PPTX
- JPG
- JPEG
- PNG

Reject every other file type.

Do not silently convert unsupported file types.

Do not support TXT files unless the PRD changes.

---

# 3. Every File Must Belong to a Course

Every uploaded file must belong to exactly one Course.

Never create uploads outside a Course.

Never allow orphaned files.

Deleting a Course must remove all associated files and metadata according to the database rules.

---

# 4. Validate Every Upload

Validate every upload before storing it.

At minimum validate:

- Supported file type
- File size (maximum 20MB per file, as resolved in PRD Section 14)
- Upload integrity
- Empty file detection
- Corrupted file detection

Never trust:

- File extension
- Browser MIME type
- Client validation

Validation must happen on the server.

---

# 5. Generate a Unique Storage Key

Every uploaded file must receive a unique storage key.

Never use the original filename as the storage identifier.

Original filenames are metadata only.

Storage keys must remain stable after upload.

---

# 6. Duplicate Uploads

Duplicate filenames are allowed.

Never use filenames as unique identifiers.

If another file with the same filename already exists inside the Course:

- Warn the user.
- Allow the upload.
- Store it as a separate file.

---

# 7. File Lifecycle

Every uploaded file must follow this lifecycle:

```
UPLOADED

↓

PROCESSING

↓

READY
```

If processing fails:

```
FAILED
```

Do not invent additional lifecycle states unless the PRD changes.

Use enums instead of free-text values.

---

# 8. Processing Must Be Asynchronous

The upload request must not perform heavy processing.

Heavy work includes:

- OCR
- Text extraction
- Cleaning extracted text
- Chunk creation
- Embedding generation
- AI generation

These must execute as background jobs.

The upload request should return as soon as the file has been accepted and stored.

---

# 9. OCR Rules

Apply OCR only when required.

Examples:

- JPG
- JPEG
- PNG
- Scanned PDFs

Do not perform OCR on digital documents that already contain extractable text.

Avoid duplicate OCR work.

---

# 10. Text Extraction

Extracted text must be stored separately from the uploaded file.

Never overwrite the original uploaded file.

Keep extracted content linked to its source file.

If extraction fails:

- Preserve the uploaded file.
- Record the failure.
- Allow retry.

---

# 11. Chunking Rules

Split extracted content into chunks before embedding.

Every chunk must maintain a reference to:

- Source file
- Page number where available
- Chunk index

Never create chunks without source linkage.

Chunk boundaries should preserve semantic meaning where practical.

---

# 12. Embedding Rules

Embeddings are generated lazily.

Generate embeddings only when Course Chat is used for the first time.

Do not generate embeddings automatically after upload.

Cache embeddings after successful generation.

Do not regenerate existing embeddings unless:

- Source content changed
- Embedding model changed
- Explicit regeneration is requested

---

# 13. AI Generation Rules

Uploading a file must never automatically generate:

- Study Notes
- Flashcards

Students explicitly request AI generation.

Only process the uploaded content after the request.

---

# 14. Large Document Handling

Large documents must be processed in chunks.

Never attempt to send an entire oversized document to the LLM in one request.

If document size exceeds model context:

1. Process chunks.
2. Generate intermediate summaries where required.
3. Combine results.

---

# 15. Object Storage Rules

Only object storage stores uploaded files.

Never expose:

- Bucket names
- Internal object paths
- Storage credentials

Access uploaded files through:

- Authorized backend endpoints
- Signed URLs where appropriate

Never expose unrestricted public URLs.

---

# 16. File Metadata

Every uploaded file must record:

- Original filename
- File type
- File size
- Storage key
- Upload timestamp
- Processing status
- Retry count
- Processing error when applicable

Do not infer metadata later if it can be stored during upload.

---

# 17. Retry Rules

Retry processing only for recoverable failures.

Examples:

- Temporary OCR failure
- Temporary AI provider failure
- Temporary storage timeout

Do not retry:

- Unsupported file types
- Empty files
- Permanently corrupted files

Track retry count.

Stop retrying after the configured maximum.

---

# 18. Deletion Rules

Deleting a file must:

- Remove the object from storage.
- Remove extracted content.
- Remove content chunks.
- Remove embeddings.
- Remove AI-generated outputs that depend exclusively on that file when required by the current architecture.

Do not leave orphaned storage objects.

Do not leave orphaned database records.

---

# 19. Storage Accounting

Storage usage is calculated on the server.

Never trust values supplied by the client.

When uploading:

Increase storage usage after successful storage.

When deleting:

Decrease storage usage after successful deletion.

Failed uploads must not consume storage quota.

---

# 20. Privacy Rules

Uploaded files belong only to the owning user.

Never expose another user's uploads.

Never index uploaded content globally.

Never mix Course content between users.

Every retrieval must verify ownership.

---

# 21. File Access

Before serving a file:

Verify:

- Authentication
- Authorization
- Ownership

Never allow direct anonymous access to private study materials.

---

# 22. Background Jobs

Use PostgreSQL-backed background jobs.

Supported job types include:

- OCR
- Text extraction
- Chunk creation
- Embedding generation
- Cleanup
- AI generation

Background jobs must be idempotent where possible.

Failed jobs must record:

- Failure reason
- Retry count
- Timestamp

---

# 23. Cleanup Rules

Clean up temporary processing files.

Do not delete:

- Original uploaded files
- Extracted content
- Embeddings

unless required by an explicit deletion request or maintenance task.

Temporary artifacts must never accumulate indefinitely.

---

# 24. Storage Security

Never expose storage credentials.

Never embed storage secrets in frontend code.

Never trust uploaded filenames for security decisions.

Sanitize filenames before displaying them.

Never use filenames to build filesystem paths.

---

# 25. Performance Rules

Avoid downloading the same file repeatedly during processing.

Reuse extracted content whenever possible.

Reuse cached embeddings.

Avoid duplicate AI processing for unchanged files.

Process uploads efficiently without blocking user interaction.

---

# 26. Failure Handling

If upload fails:

- Do not create database metadata.
- Do not consume storage quota.

If processing fails:

- Preserve the uploaded file.
- Record the failure.
- Allow retry.

If storage deletion fails:

- Record the failure.
- Retry through background processing.

Never silently discard failures.

---

# 27. User Experience Rules

Users must always know the current upload state.

Display clear statuses such as:

- Uploading
- Processing
- Ready
- Failed

Do not leave users waiting without feedback.

If processing fails:

Provide a meaningful error and a retry action where applicable.

---

# 28. Task Completion Checklist

Before completing any upload or storage task, verify:

- [ ] Only supported file types are accepted.
- [ ] Server-side validation exists.
- [ ] Files belong to exactly one Course.
- [ ] Files are stored in object storage.
- [ ] Metadata is stored in PostgreSQL.
- [ ] Heavy processing runs in background jobs.
- [ ] OCR runs only when required.
- [ ] Embeddings are generated lazily.
- [ ] AI generation is user initiated.
- [ ] Large documents are chunked.
- [ ] Duplicate filenames are handled correctly.
- [ ] Storage usage is updated correctly.
- [ ] Deleted files remove dependent data.
- [ ] Storage credentials are never exposed.
- [ ] Ownership is verified before file access.
- [ ] Processing failures are recoverable where appropriate.

---

# 29. When Unsure

Do not invent new upload workflows.

Do not introduce new supported file types.

Do not change the storage architecture.

Do not generate AI content automatically.

Do not bypass validation.

Do not expose object storage details.

Choose the simplest implementation that satisfies the PRD.

If uncertainty affects:

- User files
- Object storage
- Data deletion
- OCR
- AI processing
- Storage quotas
- File ownership
- Background jobs

stop and request clarification before continuing.