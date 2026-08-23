---
trigger: always_on
---

# Git Conventions

These rules govern all Git operations for AI Study Companion.

The PRD, `AGENTS.md`, and the rules inside `.agents/rules/` remain the sources of truth.

Breaking any rule in this file means the task has failed, even if the code builds and the feature works.

---

# 1. Protect Shared Branches

Never commit directly to a protected production branch.

Never push unfinished work directly to:

- `main`
- `master`
- any branch configured as the production branch

Use an isolated task branch unless the repository explicitly uses another approved workflow.

Do not bypass required review checks.

Do not bypass required CI checks.

Do not merge code while required checks are failing.

---

# 2. Isolate Every Task

Keep each task isolated from unrelated work.

A branch or change set must contain only the code needed for the assigned task.

Do not mix:

- feature work
- unrelated refactoring
- dependency upgrades
- formatting across unrelated files
- cleanup not required by the task

If unrelated defects are discovered, record them separately instead of silently fixing them inside the current task.

---

# 3. Preserve Existing Work

Never delete or overwrite another contributor's valid changes.

Never reset, revert, or discard work you did not create unless explicitly instructed.

Never use destructive Git commands without confirming the intended impact.

This includes:

- `git reset --hard`
- `git clean -fd`
- forced branch deletion
- destructive rebases
- forced pushes

---

# 4. Never Rewrite Shared History

Do not force-push shared branches.

Do not rewrite commits that have already been pushed and may be used by another contributor.

Do not amend, squash, or rebase shared history without explicit approval.

Local cleanup is allowed only before the branch has been shared.

---

# 5. Make Atomic Commits

Each commit must represent one coherent change.

Do not combine unrelated changes in the same commit.

A commit must be safe to review and understandable on its own.

Separate changes when they have different purposes, such as:

- schema changes
- application logic
- UI changes
- tests
- documentation
- dependency changes

Do not create partial commits that knowingly leave the repository in a broken state unless explicitly required for an agreed migration sequence.

---

# 6. Write Clear Commit Messages

Every commit message must explain what changed and why.

Use a concise imperative summary.

Good examples:

- `Add course upload processing states`
- `Enforce course ownership in file queries`
- `Add Flutterwave webhook verification`
- `Create Prisma migration for usage events`

Do not use vague messages such as:

- `fix`
- `updates`
- `changes`
- `stuff`
- `final`
- `working now`

The commit message must make the purpose clear without opening the diff.

---

# 7. Keep the Repository Buildable

Do not commit code that knowingly breaks:

- the production build
- TypeScript checks
- linting
- tests
- Prisma schema validation
- database migrations

Before marking a task complete, verify the checks required by `AGENTS.md`.

If the repository is already broken before the task begins, do not conceal that fact. Clearly distinguish pre-existing failures from failures introduced by the task.

---

# 8. Commit Required Migrations

Every Prisma schema change must include its matching Prisma migration unless the task is explicitly limited to a draft schema proposal.

Do not commit a changed Prisma schema without the migration required to apply it.

Do not edit an already-applied migration.

Create a new migration for later changes.

Keep migration files in the same change set as the schema change they implement.

---

# 9. Commit Lockfile Changes

When dependencies change, commit the matching package lockfile.

Do not manually edit the lockfile.

Do not commit a package manifest change without the corresponding lockfile update.

Do not regenerate the lockfile unless dependencies actually changed or the task explicitly requires it.

Use the package manager already established by the repository.

Do not introduce a second package manager.

---

# 10. Never Commit Secrets

Never commit:

- API keys
- database passwords
- OAuth secrets
- Flutterwave secret keys
- webhook secrets
- encryption keys
- private certificates
- production credentials
- `.env` files containing secrets

Use environment variable example files with placeholder values only.

If a secret is discovered in tracked history:

1. Stop using it.
2. Report it immediately.
3. Rotate the secret.
4. Remove it using an approved history-remediation process.

Deleting the secret in a later commit is not enough.

---

# 11. Never Commit Private User Data

Never commit:

- uploaded study materials
- extracted document text from real users
- private chat content
- production database exports
- personally identifiable information
- billing records
- webhook payloads containing real customer data

Use synthetic test fixtures only.

Test data must not contain real user information.

---

# 12. Exclude Local and Generated Files

Do not commit local-only or generated runtime files unless the repository explicitly requires them.

Exclude at minimum:

- `.env`
- local database files
- uploaded files
- temporary OCR files
- local logs
- build output
- cache directories
- coverage output
- editor-specific local settings
- operating system metadata

Do not commit `.next/`, temporary storage directories, or local worker artifacts.

Generated source files may be committed only when the repository intentionally tracks them and the task requires updating them.

---

# 13. Review the Diff Before Committing

Inspect the full staged diff before every commit.

Confirm that the diff contains:

- only intended files
- no secrets
- no user data
- no debugging output
- no accidental deletions
- no unrelated formatting changes
- no generated artifacts that should be ignored

Do not commit changes you have not reviewed.

---

# 14. Do Not Hide Risky Changes

Do not combine destructive or security-sensitive changes with unrelated feature code.

Make high-risk changes easy to identify in review.

Examples include:

- database migrations
- deletion behavior
- authentication changes
- authorization changes
- upload storage changes
- billing logic
- Flutterwave webhook handling
- encryption changes
- AI usage-limit enforcement

Call out these changes clearly in the commit message and task completion summary.

---

# 15. Handle Merge Conflicts Safely

Never resolve a merge conflict by blindly choosing one side.

Understand the intent of both changes.

Preserve all valid behavior.

Do not remove another contributor's logic merely to make the conflict disappear.

If the correct resolution is unclear, stop and request clarification.

After resolving conflicts, rerun the relevant build, type, lint, migration, and test checks.

---

# 16. Reverts Must Be Explicit

Use a clear revert commit when undoing shared work.

Do not silently erase shared history.

A revert must identify:

- what is being reverted
- why it is being reverted
- any data or migration consequences

Do not revert database migrations casually.

Follow `database-schema.md` before reverting schema or migration changes.

---

# 17. Dependency Changes Must Be Intentional

Do not add, remove, or upgrade dependencies as incidental cleanup.

Every dependency change must be required by the task.

Do not perform broad dependency upgrades while implementing an unrelated feature.

Do not replace locked technologies from `AGENTS.md`.

Do not replace:

- Next.js
- TypeScript
- Prisma
- PostgreSQL
- Flutterwave
- Tailwind CSS

through a Git change.

---

# 18. Tag and Release Safety

Do not create production tags or releases unless explicitly instructed.

Do not reuse an existing release tag.

Do not move a published tag to another commit.

A release must point to a reviewed commit that passes all required checks.

Do not label unfinished code as production-ready.

---

# 19. Pull Request Requirements

When a pull request or review summary is required, include:

- what changed
- why it changed
- affected PRD or rule requirements
- migrations included
- environment variables added or changed
- security or billing impact
- tests and checks run
- known limitations
- screenshots for visible UI changes when applicable

Do not claim a check passed unless it was actually run.

Do not hide unfinished work or known failures.

---

# 20. Task Completion Checklist

Before completing any Git-based task, confirm:

- [ ] The change set contains only task-related work
- [ ] No secrets are committed
- [ ] No private user data is committed
- [ ] No local or generated artifacts are committed
- [ ] All Prisma changes include the required migration
- [ ] Dependency changes include the correct lockfile update
- [ ] Commit messages clearly describe intent
- [ ] Shared history was not rewritten
- [ ] Existing contributor work was preserved
- [ ] Merge conflicts were resolved intentionally
- [ ] The project builds successfully
- [ ] TypeScript checks pass
- [ ] Linting passes
- [ ] Relevant tests pass
- [ ] Known failures are disclosed
- [ ] The final diff was reviewed

---

# 21. When Unsure

Do not guess during a destructive Git operation.

Do not discard changes to make the branch clean.

Do not force-push to solve a history problem.

Do not hide unrelated changes inside the task.

Choose the safest reversible action.

If uncertainty affects:

- shared history
- production branches
- migrations
- secrets
- user data
- billing
- another contributor's work

stop and request clarification before continuing.