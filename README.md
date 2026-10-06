# AI Study Companion

> An AI-powered study platform that transforms students' course materials—including PDFs, slides, documents, and lecture images—into comprehensive study notes, smart flashcards, and grounded interactive AI tutoring.

---

## Preview

![AI Study Companion Dashboard](./public/screenshot.png)

---

## Live Link & Builds

- **Live Application**: [https://study-companion-web.vercel.app](https://study-companion-web.vercel.app) *(Deployment in progress)* 
- **GitHub Repository**: [https://github.com/wahaboladieji/study-companion-web](https://github.com/wahaboladieji/study-companion-web)
- **Local Production Build**:
  ```bash
  npm run build
  npm run start
  ```

---

## The Problem It Solves

University and college students accumulate hundreds of fragmented files every semester—dense PDFs, PowerPoint slide decks, handwritten notes, textbook chapters, and whiteboard photos. 

- **Organization Overhead**: Students spend hours sorting, extracting, and summarizing materials before they can begin studying.
- **Generic AI Limitations**: General-purpose AI chatbots (like ChatGPT) lack persistent course organization, require tedious copy-pasting of large files, hallucinate when outside context, and cannot cite specific lecture slides or textbook pages.
- **Fragmented Workflows**: Note-taking, flashcard creation, and tutoring usually happen across 3–4 disconnected apps.

### How AI Study Companion Solves This:
1. **Course-Centric Organization**: Organizes all study materials and generated outputs under dedicated Courses.
2. **Multi-Format Ingestion & OCR**: Seamlessly handles PDF, DOCX, PPTX, JPG, JPEG, and PNG files with automated OCR for lecture slides and diagrams.
3. **Grounded AI Tutoring**: Course Chat answers questions strictly using retrieved course materials and includes direct source citations—refusing to invent or hallucinate answers when information is missing.
4. **On-Demand Study Aids**: Generates structured, editable AI Study Notes and interactive Flashcards at the student's request, saving hours of manual study prep.
5. **Built-in Quotas & Regional Billing**: Offers a generous free tier alongside flexible premium upgrades powered by Flutterwave for emerging markets.

---

## Tech Stack

### Core Framework & Runtime
- **Next.js 16 (App Router)**: Server Components, Server Actions, Route Handlers, and streaming.
- **React 19 & TypeScript 5**: Type-safe component architecture and state management.
- **Node.js**: Asynchronous backend execution and file stream handling.

### Database & ORM
- **PostgreSQL**: Relational database for courses, files, chunks, notes, flashcards, usage, and subscriptions.
- **Prisma ORM 7**: Type-safe database queries, migrations, and connection pooling via `@prisma/adapter-pg` and `pg`.

### AI & Language Models
- **DeepSeek API (`deepseek-chat`)**: High-performance reasoning for study note synthesis and grounded course chat.
- **Google Gemini API (`gemini-3.6-flash`)**: Multi-modal vision model for OCR on lecture slides, scanned PDFs, and image documents.
- **Vercel AI SDK (`ai`)**: Standardized model orchestration and provider abstraction layer.

### Storage & Caching
- **Object Storage**: S3-compatible cloud storage (Cloudflare R2 / AWS S3) via `@aws-sdk/client-s3`, with an automated fallback to local filesystem storage (`.storage/`) during development.
- **Cache**: Unified caching layer with Redis (`ioredis`) support and automatic fallback to an in-memory cache adapter.

### Payments & Security
- **Flutterwave API v3**: Payment initialization, checkout redirects, transaction verification, and secure webhook signature hashing.
- **Authentication & Security**: Jose (`jose`) JWT HTTP-only cookies, bcrypt password hashing, CSRF token verification, and strict per-user authorization checks.

### UI & Styling
- **Tailwind CSS v4**: Utility-first CSS using a custom design token system (`tokens.css`).
- **Icons & Animations**: Lucide Icons (`lucide-react`), Reicon Icons (`reicon-react`), and Lottie animations (`lottie-web`).

---

## How to Run It Locally

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20.x or higher)
- [PostgreSQL](https://www.postgresql.org/) (running locally or a hosted instance such as Supabase / Neon)
- [Git](https://git-scm.com/)

### 2. Clone the Repository
```bash
git clone https://github.com/wahaboladieji/study-companion-web.git
cd study-companion-web
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```

Open `.env` and fill in the required variables:
```env
# Database connection
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_study_companion?schema=public"

# App & Auth secrets
NEXT_PUBLIC_APP_URL="http://localhost:3000"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"

# AI Provider API Keys
DEEPSEEK_API_KEY="your-deepseek-api-key"
GEMINI_API_KEY="your-gemini-api-key"

# Optional: Email (SMTP), Flutterwave, Object Storage, and Redis
```

### 5. Setup Database Schema
Generate Prisma client artifacts and synchronize schema with your database:
```bash
npx prisma generate
npx prisma db push
```

### 6. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Architecture Summary

AI Study Companion adheres to a clean, decoupled architecture where presentation, business logic, data persistence, and AI providers are strictly separated:

```
┌─────────────────────────────────────────────────────────────┐
│                       Presentation                          │
│   Next.js App Router (app/), React Server & Client Components│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Server Actions & API Routes                 │
│      CSRF Guard • User Auth Guard • Input Validation (Zod)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Application Services                   │
│   • course.ts         • document-processor.ts  • upload.ts   │
│   • billing.ts        • flutterwave.ts         • usage.ts    │
│   • rate-limit.ts     • background-jobs.ts     • email.ts    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│       Data & Storage         │ │       AI Abstraction        │
│ • PostgreSQL (via Prisma)    │ │ • DeepSeek (Text / Chat)    │
│ • Object Storage (R2/S3/Disk)│ │ • Gemini (Vision / OCR)     │
│ • Unified Cache (Redis/Mem)  │ │ • Text Cleaner & Chunking   │
└──────────────────────────────┘ └─────────────────────────────┘
```

- **Separation of Concerns**: UI components never import Prisma or make database calls directly; all operations flow through validated server actions and dedicated service modules.
- **Asynchronous Document Pipeline**: File uploads are accepted immediately. Extraction, OCR, cleaning, and semantic chunking run through a PostgreSQL-backed background job queue (`BackgroundJob` model).
- **Strict Ownership Filtering**: Every query filters by `userId` and resource ID to enforce object-level security.

---

## Key Decisions

1. **Grounded AI with Refusal over Hallucination**: Rather than allowing the LLM to make assumptions when course materials are incomplete, the system prompt strictly constrains answers to uploaded content chunks and mandates clear refusals when facts are absent.
2. **On-Demand Generation over Auto-Triggering**: Uploading a document stores and processes text chunks, but does not trigger expensive LLM note or flashcard generation until explicitly requested by the student, drastically reducing unnecessary API costs.
3. **Provider-Agnostic Multi-LLM Strategy**: DeepSeek was selected for its cost-effective reasoning in text generation, while Google Gemini was selected for its multimodal vision capabilities (OCR on complex slide decks and diagrams). Both are wrapped behind unified interfaces.
4. **PostgreSQL-Backed Background Queue**: Instead of adding Redis-dependent workers (e.g., BullMQ) or external task orchestrators in the MVP, jobs are queued and claimed directly in PostgreSQL, minimizing infrastructure complexity.
5. **Local-First Storage Driver with Production S3 Support**: Developers can work completely offline without AWS/Cloudflare accounts using the local `.storage/` fallback driver, while production automatically enforces Cloudflare R2 / AWS S3.
6. **Flutterwave Integration**: Selected as the primary payment processor to provide frictionless local checkout (card, USSD, bank transfer) in Nigerian Naira (NGN) for African students.

---

## What You Would Do Next

- [ ] **Spaced Repetition Review Engine**: Implement the SuperMemo-2 (SM-2) algorithm for smart flashcard scheduling based on mastery statuses (`New`, `Reviewing`, `Mastered`).
- [ ] **Hybrid Vector Search with pgvector**: Upgrade chunk retrieval from text-based search to dense embeddings with `pgvector` for deeper semantic understanding and cross-document querying.
- [ ] **Interactive Practice Quizzes**: Allow students to generate mock multiple-choice and short-answer exams directly from their lecture notes with instant AI grading.
- [ ] **Cross-Document Semester Synthesis**: Enable students to generate unified exam study guides that synthesize concepts across all uploaded files in a course.
- [ ] **Collaborative Study Rooms**: Permit students to share course spaces with study groups while keeping personal progress and flashcard mastery private.
- [ ] **Offline PWA & Audio Flashcards**: Add Progressive Web App capabilities for offline review and text-to-speech audio playback for studying on the go.
