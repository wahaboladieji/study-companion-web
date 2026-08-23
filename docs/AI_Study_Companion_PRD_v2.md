
# AI Study Companion - Product Requirements Document (PRD) v2

## 1. Product Summary

AI Study Companion is a lean AI-powered web application for university and college students.

Students organize learning around **Courses**. Each Course contains uploaded study materials and AI-generated study resources.

The MVP focuses on three core capabilities:

- Generate AI Study Notes
- Generate AI Flashcards
- Chat with Course content

AI responses are grounded only in uploaded Course materials. If relevant information cannot be found, the assistant clearly states that instead of inventing an answer.

---

## 2. Problem Statement

Students accumulate PDFs, lecture slides, handwritten notes, and textbook pages throughout a semester. They spend significant time organizing content before they can study.

General-purpose AI tools summarize individual files but do not provide persistent Course organization, source-grounded answers, and reusable study assets in one workflow.

---

## 3. Goals and Non-Goals

### Goals

- Create, rename, and delete Courses
- Upload PDF, DOCX, PPTX, JPG, JPEG, and PNG files
- Generate AI Study Notes on demand
- Generate AI Flashcards on demand
- Chat with Course content using only uploaded materials
- Allow editing of Study Notes and Flashcards

### Non-Goals (MVP)

- Quizzes
- Practice Questions
- Study Plans
- Progress dashboards
- Notifications
- Sharing
- Collaboration
- Admin dashboard
- Analytics dashboard
- Native mobile applications
- Offline support
- Version history
- Multi-language support

---

## 4. User Persona

### Primary Persona

Undergraduate students taking content-heavy courses such as biology, psychology, business, history, and health sciences.

Goals:

- Organize study materials
- Save study time
- Understand difficult concepts
- Prepare for exams faster

---

## 5. Functional Requirements

### Authentication

- Email/password registration
- Google OAuth
- Login
- Logout
- Password reset

### Courses

- Create Course
- Rename Course
- Delete Course
- Every uploaded file belongs to exactly one Course

### File Uploads

Supported formats:

- PDF
- DOCX
- PPTX
- JPG
- JPEG
- PNG

Requirements:

- Validate supported formats
- Warn about duplicate filenames but allow upload
- Show Uploading → Processing → Ready status

### AI Study Notes

- Generated only when requested
- Editable
- Regeneration requires confirmation before replacing existing notes

### AI Flashcards

- Generated only when requested
- Editable
- Status values:
  - New
  - Reviewing
  - Mastered

### AI Chat

- Answers only from Course materials
- Displays source references
- Clearly states when uploaded content does not contain the requested information

### Search

MVP supports:

- Course name search
- File name search

---

## 6. AI Processing Pipeline

1. Upload file
2. Validate format
3. Store file
4. Extract text
5. Apply OCR only when needed
6. Clean extracted text
7. Create source-linked content chunks
8. Generate Study Notes or Flashcards only on demand
9. Generate embeddings only when Chat is first used
10. Cache embeddings for future conversations

If Course content exceeds the model context limit, process chunk summaries first and merge them into the final output.

---

## 7. Technical Requirements

### Stack

- Next.js
- TypeScript
- Prisma ORM
- PostgreSQL

### Frontend

- Responsive design
- WCAG 2.1 AA
- Tailwind CSS *(ASSUMPTION ADDED)*

### Backend

- Next.js API Routes
- PostgreSQL-backed background job table

### Security

- HTTPS
- Password hashing
- Authorization
- Encryption at rest for database and object storage

---

## 8. Business Model

Freemium pricing.

Track configurable limits for:

- Courses
- Uploads
- AI generations
- Chat messages
- Storage

Premium users receive higher limits and priority processing *(ASSUMPTION ADDED)*.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Hallucinated AI answers | Restrict responses to retrieved Course content |
| OCR failures | Allow regeneration and editing |
| Large Courses | Chunk processing and background jobs |
| High AI costs | On-demand generation and usage limits |
| Copyright & academic integrity | Require upload rights confirmation and position outputs as study aids |

---

## 10. Prisma Data Model

### Core Models

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

---

## 11. Success Metrics

Primary activation:

A new user creates a Course, uploads a file, and generates Study Notes or Flashcards within 24 hours.

Primary retention:

Activated users return to the same Course within 7 days.

Additional metrics:

- Study Note generations
- Flashcard generations
- Free-to-paid conversion
- Average AI cost per active user *(ASSUMPTION ADDED)*

---

## 12. Assumptions

### Confirmed

- English-only MVP
- Courses are the primary organizational unit
- AI generation is user initiated
- Embeddings are generated lazily
- Responsive web application

### ASSUMPTION ADDED

- Tailwind CSS is used
- Non-English uploads display a support warning

---

## 13. Phased Roadmap

### Phase 1

- Authentication
- Courses
- Uploads
- Processing
- Usage tracking

### Phase 2

- Study Notes
- Flashcards
- AI usage limits

### Phase 3

- Course Chat
- Embeddings
- Retrieval

### Phase 4

- Billing
- Paid plans

---

## 14. Open Questions

### Resolved

- **LLM provider:** DeepSeek and Claude, used through a provider abstraction layer.
- **OCR provider:** A vision-capable AI model / frontier vision-capable LLM accessed by API, wrapped behind a provider-agnostic internal interface.
- **Payment provider:** Flutterwave.
- **Object storage provider:** Cloudflare R2, with AWS S3 as the alternative.
- **Maximum upload size:** 20MB per file.
- **Free tier limits:** 3 courses, 10 uploads, 5 AI generations, 20 chat messages, 500MB storage. Price: NGN 0/month.
- **Premium tier limits:** 20 courses, 100 uploads, 50 AI generations, 200 chat messages, 5GB storage. Price: NGN 5,000/month.
- **Currency:** NGN.
- **Initial beta audience:** University students and self-learners, starting in Nigeria and the broader African market. v1 is restricted to users 15 and over, solo use, English only.

### Unresolved

- Which cloud hosting provider?
- Compliance requirements (FERPA, GDPR)?
