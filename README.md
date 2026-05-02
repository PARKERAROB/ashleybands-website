# Bands of AHS Website

Vercel-ready public website for the Ashley High School Band program.

## Local Setup

```bash
npm install
npm run content:build
npm run dev
```

The content builder reads curated public-facing source files from the sibling `../PKA` folder by default and writes:

- `content/site-data.json`
- `public/chatbot-knowledge.txt`

Override the source folder with:

```bash
PKA_ROOT=/path/to/PKA npm run content:build
```

## Environment Variables

For the chatbot:

- `ANTHROPIC_API_KEY`

Optional question logging:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Boundary

This site is public by default. Do not publish student-specific details, internal PKA notes, financial balances, accommodation details, private decisions, or family-specific information.
