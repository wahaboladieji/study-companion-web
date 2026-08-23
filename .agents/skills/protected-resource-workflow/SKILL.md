---
name: protected-resource-workflow
description: Use when adding or changing an authenticated route, server action, API handler, or service that reads or changes user-owned Courses, Files, Study Notes, Flashcards, Chat Sessions, Chat Messages, Usage Events, Plans, or Subscriptions. Trigger words include authenticated route, protected API, server action, ownership check, authorization, course access, file access, user data, subscription access, and resource mutation.
---

# Protected Resource Workflow

This skill teaches the safe order for reading or changing user-owned data.

The governing laws are in:

- `.agents/rules/security.md`
- `.agents/rules/coding-standards.md`
- `.agents/rules/database-schema.md`
- `.agents/rules/money-and-billing.md`

## Procedure

1. Identify the protected resource.
   - Name the model being accessed.
   - Identify the authenticated owner.
   - Identify whether the operation reads, creates, updates, or deletes data.

2. Authenticate the request.
   - Resolve the server-side session.
   - Reject unauthenticated requests before reading user-owned data.
   - Never trust a user ID sent by the client.

3. Validate all request input.
   - Validate route parameters.
   - Validate query parameters.
   - Validate request bodies.
   - Reject malformed values before database access.

4. Verify ownership in the database query.
   - Query by both the resource ID and the authenticated user ID.
   - Follow ownership through the Course when the model does not contain `userId`.
   - Return a safe not-found or forbidden response when ownership fails.

5. Check feature-specific rules.
   - Check plan limits before plan-limited actions.
   - Check processing state before AI actions.
   - Check deletion confirmation before destructive actions.
   - Check Course ownership before file, notes, flashcard, or chat access.

6. Execute the operation through a server-side service.
   - Keep database access out of UI components.
   - Keep business logic out of route handlers.
   - Use a transaction when multiple database writes must succeed together.

7. Sanitize the response.
   - Return only fields required by the client.
   - Never return storage keys, password hashes, provider secrets, or internal errors.
   - Do not expose another user's identifiers.

8. Record required events.
   - Record successful usage only when the action completed.
   - Log unexpected failures without private content.
   - Do not log uploaded text, passwords, tokens, or chat contents.

9. Return a clear result.
   - Return a stable success shape.
   - Return safe validation, authentication, authorization, or conflict errors.
   - Never leak stack traces.

## Code Skeleton

```ts
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireSession } from "@/features/auth/server/require-session";

const inputSchema = z.object({
  courseId: z.string().min(1),
  resourceId: z.string().min(1),
});

export async function updateOwnedResource(rawInput: unknown) {
  const session = await requireSession();
  const input = inputSchema.parse(rawInput);

  const resource = await prisma.resource.findFirst({
    where: {
      id: input.resourceId,
      course: {
        id: input.courseId,
        userId: session.user.id,
      },
    },
  });

  if (!resource) {
    return {
      ok: false as const,
      error: "RESOURCE_NOT_FOUND",
    };
  }

  const updated = await prisma.resource.update({
    where: { id: resource.id },
    data: {
      // Validated update fields only.
    },
    select: {
      id: true,
      updatedAt: true,
    },
  });

  return {
    ok: true as const,
    data: updated,
  };
}
```

## Common Traps

- Querying a resource by ID without filtering by owner.
- Accepting userId from the browser.
- Importing Prisma into a client component.
- Performing business logic directly inside an API handler.
- Returning the complete database record.
- Logging private document or chat content.
- Recording usage before the action succeeds.
- Returning different authorization behavior that reveals whether another user's resource exists.
- Assuming authentication automatically proves ownership.

## Verify Before Done

- [ ] The route authenticates the user on the server.
- [ ] All client input is validated.
- [ ] The database query includes ownership.
- [ ] No user ID is trusted from the client.
- [ ] Business logic runs in a server-side service.
- [ ] The response exposes only required fields.
- [ ] Errors do not expose internal details.
- [ ] Usage is recorded only after success.
- [ ] Sensitive content is not logged.
- [ ] The code builds with no TypeScript errors.

Write tests for:

- Unauthenticated access.
- Valid owner access.
- Access to another user's resource.
- Invalid request input.
- Missing resource.
- Successful read or mutation.
- Failed mutation without usage recording.