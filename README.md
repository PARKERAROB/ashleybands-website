# Bands of AHS Website

Vercel-ready public website for the Ashley High School Band program.

## Local Setup

```bash
npm install
npm run content:build
npm run dev
```

The content build is self-contained (PKA retired 2026-06-01; this README's old "reads from
a sibling `../PKA` folder" instruction was stale — no such folder exists). Source markdown
lives in `content/sources/` (e.g. `marching-band-2026.md`): edit the SOURCE, run
`npm run content:build`, never hand-edit the generated outputs:

- `content/site-data.json`
- `public/chatbot-knowledge.txt`

## Environment Variables

For the chatbot:

- `ANTHROPIC_API_KEY`

Optional question logging:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Boundary

This site is public by default. Do not publish student-specific details, internal PKA notes, financial balances, accommodation details, private decisions, or family-specific information.
