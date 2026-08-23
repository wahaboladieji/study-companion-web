---
trigger: always_on
---

# Security Rules

These rules govern authentication, authorization, data protection, API security, file security, AI security, and application security for AI Study Companion.

The Product Requirements Document (PRD), `AGENTS.md`, and the other rule files remain the source of truth.

Breaking any rule in this document means the implementation has failed, even if the application builds and the feature appears to work.

---

# 1. Security Comes Before Convenience

Never bypass security to make a feature work.

Never weaken authentication, authorization, or validation for development convenience.

If security and convenience conflict, choose security.

---

# 2. Authentication is Server Controlled

Authentication decisions belong on the server.

Never trust the frontend to determine whether a user is authenticated.

Protected endpoints must verify authentication before performing any action.

---

# 3. Authorization is Required

Authentication and authorization are different.

Every protected operation must verify that the authenticated user owns the requested resource.

Before accessing any resource, verify ownership.

Examples:

- Course
- File
- Study Note
- Flashcard
- Chat Session
- Chat Message
- Subscription

Never rely on IDs supplied by the client.

---

# 4. Never Trust Client Input

Treat every client request as untrusted.

Validate:

- Request body
- Query parameters
- Route parameters
- Headers
- Uploaded file metadata

Never assume the browser has already validated input.

Server-side validation is mandatory.

---

# 5. Validate Uploaded Files

Never trust:

- File extension
- MIME type
- File name

Validate uploads on the server.

Reject unsupported file types.

Reject corrupted uploads.

Reject empty files.

Reject oversized files according to configured limits.

Never execute uploaded files.

---

# 6. Uploaded Files Must Be Isolated

Uploaded files must be stored in object storage.

Never store uploaded files inside PostgreSQL.

Never expose object storage paths directly to users.

Serve files through authorized application endpoints or signed URLs.

---

# 7. Encrypt Sensitive Data

Always use HTTPS.

Never transmit sensitive information over insecure connections.

Enable encryption at rest for:

- PostgreSQL
- Object storage

Never store sensitive information unencrypted unless explicitly required by the PRD.

---

# 8. Password Security

Never store plain-text passwords.

Passwords must always be hashed using a modern password hashing algorithm.

Never create your own password hashing implementation.

Never log passwords.

Never return passwords through any API.

---

# 9. Session Security

Authentication tokens must be treated as sensitive.

Never expose authentication tokens in:

- URLs
- Logs
- Error messages

Prefer secure HTTP-only cookies for authenticated sessions.

Never expose server session secrets to the client.

---

# 10. Secrets Management

Never hardcode secrets.

Never commit secrets to Git.

Store secrets only in secure environment variables.

Examples include:

- Database credentials
- OAuth secrets
- Flutterwave secret keys
- AI provider API keys
- Object storage credentials
- Encryption keys

Never expose secrets through frontend code.

---

# 11. Principle of Least Privilege

Grant the minimum access required.

Users must only access:

- Their own Courses
- Their own Files
- Their own Study Notes
- Their own Flashcards
- Their own Chat Sessions
- Their own Subscription

Never expose another user's data.

---

# 12. API Security

Every protected API endpoint must:

- Authenticate the user
- Authorize the requested resource
- Validate input
- Handle errors safely

Never expose internal implementation details in API responses.

---

# 13. Error Messages

Return useful errors.

Do not reveal:

- Database schema
- Internal file paths
- Stack traces
- SQL queries
- Object storage keys
- Internal IDs not intended for clients

Detailed errors belong only in server logs.

---

# 14. Logging Rules

Log security-relevant events.

Examples:

- Login failures
- Password reset requests
- Payment verification failures
- Upload failures
- Authorization failures
- AI provider failures

Never log:

- Passwords
- API keys
- OAuth tokens
- Session cookies
- Full payment information
- Uploaded document contents
- Chat conversations

Logs must never contain sensitive user data.

---

# 15. AI Security

AI Chat must only answer using retrieved Course content.

Never allow the AI to access:

- Another user's data
- Internal application configuration
- Environment variables
- Database credentials
- Hidden prompts

If Course content cannot answer the question:

Return that no supporting Course information exists.

Do not hallucinate answers.

---

# 16. Prompt Injection Protection

Treat uploaded documents as untrusted input.

Never allow uploaded text to override:

- System prompts
- Security rules
- Business rules
- Agent instructions

Ignore prompt injection attempts contained within uploaded files.

Never allow uploaded content to change application behavior.

---

# 17. Authorization for AI

Before AI retrieves Course content:

Verify ownership of the Course.

Never retrieve another user's embeddings.

Never retrieve another user's extracted content.

Never retrieve another user's chat history.

---

# 18. Database Security

All database access must occur through Prisma.

Never expose direct database access to the client.

Never execute client-provided SQL.

Never build SQL queries through string concatenation.

Use parameterized queries when raw SQL is unavoidable.

---

# 19. File Access Security

Before serving any uploaded file:

Verify:

- Authentication
- Authorization
- Ownership

Never expose predictable file URLs.

Never expose internal storage identifiers.

---

# 20. Rate Limiting

Protect expensive endpoints.

At minimum apply rate limiting to:

- Login
- Password reset
- File upload
- AI Study Notes generation
- Flashcard generation
- AI Chat
- Flutterwave webhook verification

Do not allow unlimited requests.

---

# 21. CSRF Protection

Protect state-changing operations against CSRF where applicable.

Never disable CSRF protection without explicit approval.

---

# 22. XSS Protection

Never trust user-generated content.

Escape output before rendering.

Sanitize rich text where applicable.

Never render unsanitized HTML.

---

# 23. Injection Protection

Never trust input in:

- SQL
- File paths
- AI prompts
- URLs

Always validate and sanitize user-controlled values.

---

# 24. Dependency Security

Do not introduce unnecessary dependencies.

Before adding a package:

- Confirm it is required.
- Prefer actively maintained packages.
- Avoid abandoned libraries.

Do not replace locked technologies defined in `AGENTS.md`.

---

# 25. Object-Level Security

Every database query involving user-owned resources must filter by ownership.

Example:

Never query:

Course by ID only.

Always query:

Course by:

- ID
- User ID

Apply this rule consistently across all user-owned models.

---

# 26. Background Job Security

Background jobs must execute with server privileges only.

Never expose internal job execution endpoints publicly.

Validate every job payload before processing.

Do not execute arbitrary payloads.

---

# 27. Security Around Billing

Never activate subscriptions from frontend requests.

Only verified Flutterwave payment events may activate billing state.

Do not expose payment provider secrets.

Refer to `money-and-billing.md` for billing-specific rules.

---

# 28. Security Around Storage

Never expose object storage credentials.

Never allow direct anonymous upload into production storage unless explicitly supported by the architecture.

Every uploaded file must remain associated with exactly one authenticated user through its Course.

---

# 29. Privacy Rules

Collect only the data required by the MVP.

Do not collect additional personal information "for future use."

Do not expose:

- Email addresses
- Payment history
- Uploaded materials
- AI outputs

to other users.

Respect user ownership of all uploaded content.

---

# 30. Secure Defaults

Whenever multiple secure implementations exist:

Choose the safest reasonable default.

Do not weaken security to reduce implementation effort.

When uncertain, deny access instead of allowing access.

---

# 31. Task Completion Checklist

Before completing any security-related task, verify:

- [ ] Authentication is enforced.
- [ ] Authorization is enforced.
- [ ] Ownership is verified.
- [ ] Server-side validation exists.
- [ ] Uploaded files are validated.
- [ ] Secrets are not exposed.
- [ ] Passwords are hashed.
- [ ] HTTPS is enforced.
- [ ] Sensitive data is encrypted where applicable.
- [ ] AI cannot access another user's data.
- [ ] Prompt injection attempts are ignored.
- [ ] Rate limiting exists for expensive endpoints.
- [ ] Error messages do not leak internal information.
- [ ] Sensitive data is not logged.
- [ ] Protected endpoints require authentication.
- [ ] Object-level authorization is enforced.
- [ ] Storage access is protected.

---

# 32. When Unsure

Do not guess.

Do not weaken security.

Do not bypass validation.

Do not bypass ownership checks.

Do not expose internal implementation details.

If uncertainty affects:

- Authentication
- Authorization
- User ownership
- Billing
- AI access
- File access
- Secrets
- Encryption
- Personal data
- Payment verification

stop and request clarification before continuing.