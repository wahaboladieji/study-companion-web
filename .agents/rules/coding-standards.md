---
trigger: always_on
---

# Coding Standards

These rules govern how code is written throughout the project.

Breaking any rule in this document means the implementation has failed, even if the application compiles and works.

The goal is long-term maintainability.

---

# 1. Keep Responsibilities Separate

UI components must only render UI.

Never place business logic inside:

- React Components
- Pages
- Layouts

Business logic belongs inside application services.

---

# 2. Never Access Prisma from the UI

React components must never import Prisma.

Pages must never import Prisma.

Database access must happen through server-side services only.

---

# 3. Never Duplicate Business Logic

If business logic already exists, reuse it.

Never copy and paste logic between features.

Extract reusable logic into services.

---

# 4. Never Duplicate AI Logic

Prompt construction.

Context retrieval.

Embedding generation.

Response generation.

These must each exist in one place only.

Never duplicate them across multiple files.

---

# 5. Keep Functions Focused

Each function should perform one responsibility.

If a function solves multiple unrelated problems, split it.

---

# 6. Handle Errors Explicitly

Never silently ignore errors.

Never use empty catch blocks.

Return meaningful errors.

Log unexpected failures.

---

# 7. Never Use `any`

Use proper TypeScript types.

If a type is unknown, define it.

Avoid bypassing the type system.

---

# 8. Validate Inputs

Never trust client input.

Validate:

- API requests
- Form submissions
- URL parameters
- Uploaded metadata

before processing.

---

# 9. Keep Side Effects Isolated

Database writes.

File uploads.

AI requests.

Payment calls.

These should happen inside dedicated services.

Never inside UI components.

---

# 10. Do Not Mix Feature Logic

Authentication logic must stay inside authentication.

Billing logic must stay inside billing.

Upload logic must stay inside uploads.

AI logic must stay inside AI.

Do not merge unrelated concerns.

---

# 11. Prefer Composition

Reuse existing components.

Reuse existing services.

Avoid copy-paste implementations.

---

# 12. Every New Feature Must Be Testable

Write code that can be tested independently.

Avoid hidden dependencies.

Avoid global mutable state.

---

# 13. Preserve the Locked Architecture

Do not modify the project architecture.

Do not introduce new frameworks.

Do not replace existing libraries without explicit instruction.

Follow AGENTS.md at all times.