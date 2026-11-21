# MAIN Summit hackathon (team MAIN 08)
See [CLAUDE.md](./CLAUDE.md) for the schedule, how we work, and the git and security rules.

centrix Fix is the repair-matching prototype for the reltix track, “Plug a Partner into centrix.” See the [README](./README.md) for setup and the [system design](./docs/system-design.md) for the repair flow. The stack is Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui, SWR polling, OpenAI, ElevenLabs Agents with Twilio, Upstash Redis on Vercel, and Vitest.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
