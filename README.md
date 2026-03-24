# Content Engine V2

A content automation platform for Peter Schliesmann's portfolio sites. It discovers stories from RSS feeds, Reddit, and NewsAPI — scores them with Claude AI, generates SEO-optimized blog drafts, queues them for review, and publishes approved posts to target GitHub repos via the GitHub Contents API.

## What This Does

1. **Discovery** — Pulls stories from RSS feeds, Reddit hot posts, and NewsAPI queries for each content pillar
2. **Scoring** — Batches stories through Claude to score relevance against pillar description, keywords, and audience (0–100)
3. **Research** — Uses Claude with web_search to gather facts, statistics, and context for high-scoring stories
4. **Drafting** — Generates 800–1500 word SEO-optimized blog posts in markdown with a Claude API call
5. **Content Check** — Automatically flags em dashes, semicolons, and banned words in generated drafts
6. **Review Queue** — All drafts land in the dashboard for human approval before publishing
7. **Publishing** — Commits approved posts to GitHub: TSX format for Scantient, JSON format for MyBizGrade

## Sites Configured

| Site | Domain | Format | Repo |
|------|--------|--------|------|
| Scantient | scantient.com | TSX | pschlie1/scantient |
| MyBizGrade | mybizgrade.com | JSON | pschlie1/grademybiz |

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | Your Turso DB URL (e.g. `libsql://my-db.turso.io`) |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope (for publishing) |
| `NEWSAPI_API_KEY` | NewsAPI key (optional — discovery skips if missing) |
| `INNGEST_EVENT_KEY` | Inngest event key |
| `INNGEST_SIGNING_KEY` | Inngest signing key |

### 2. Turso Database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create content-engine-v2

# Get URL and token
turso db show content-engine-v2 --url
turso db tokens create content-engine-v2
```

Add both values to `.env.local`.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Migration

Creates all tables:

```bash
npm run migrate
```

### 5. Seed Database

Inserts Scantient and MyBizGrade site configs with their content pillars:

```bash
npm run seed
```

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Inngest Dev Server (for pipeline scheduling)

In a separate terminal:

```bash
npm run inngest:dev
```

This starts the Inngest dev UI at [http://localhost:8288](http://localhost:8288) where you can trigger functions manually.

## Triggering the Pipeline

### Via Dashboard

Click "Run Pipeline" on the dashboard or pipeline page.

### Via API

```bash
# Run for all sites
curl -X POST http://localhost:3000/api/v1/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{}'

# Run for a specific site
curl -X POST http://localhost:3000/api/v1/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"site_id": "01HXYZ..."}'

# Run for a specific pillar
curl -X POST http://localhost:3000/api/v1/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"pillar_id": "01HXYZ..."}'
```

### Via Inngest (scheduled)

The daily pipeline runs automatically at **4 AM UTC** via Inngest cron. Requires a deployed Inngest account.

## Running Tests

```bash
npm run test:run
```

Tests cover: content-check (banned words, em dashes, semicolons), scoring (prompt construction), discovery (dedup, error handling, rate limiting), drafting (slug generation), and publishing (GitHub API, retries, markdown-to-JSX conversion).

## Publishing Formats

### JSON (MyBizGrade)

Commits a `.json` file to the configured `json_output_path` directory:

```json
{
  "id": "post-slug",
  "title": "Post Title",
  "slug": "post-slug",
  "meta_description": "Under 160 chars",
  "body_markdown": "Full markdown content",
  "tags": ["tag1", "tag2"],
  "published_at": "2026-03-24T00:00:00.000Z",
  "site": "mybizgrade.com"
}
```

### TSX (Scantient)

Generates a Next.js App Router page component at `{tsx_output_path}/{slug}/page.tsx`:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Post Title',
  description: 'Under 160 chars',
  openGraph: { ... },
}

export default function BlogPost() {
  return (
    <article>
      <h1>Post Title</h1>
      <h2>Section</h2>
      <p>Content...</p>
    </article>
  )
}
```

Body markdown is converted to safe JSX — no raw markdown or HTML injection.

## What Peter Needs Before Going Live

1. **Turso account** — [turso.tech](https://turso.tech) (free tier available)
2. **Inngest account** — [inngest.com](https://inngest.com) (free tier for low-volume)
3. **GitHub PAT** with `repo` write access (for publishing to scantient and grademybiz repos)
4. **Anthropic API key** with Claude access
5. **NewsAPI key** (optional, $50/mo for standard) — or skip and use RSS + Reddit only
6. **Vercel deployment** — set all env vars in Vercel project settings

## Tech Stack

- **Next.js 14** (App Router) + TypeScript strict mode
- **Turso / LibSQL** — SQLite-compatible DB that works on Vercel edge
- **Anthropic Claude** (claude-sonnet-4-6) — scoring, research, drafting
- **Inngest** — pipeline scheduling and retries
- **shadcn/ui** + Tailwind CSS
- **Vitest** — unit tests
