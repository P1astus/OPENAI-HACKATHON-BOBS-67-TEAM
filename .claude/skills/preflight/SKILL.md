---
name: preflight
description: Pre-merge / pre-deploy gate for MAIN 08. Runs tsc, lint, build, a secrets check, then smoke-tests /api/agent in Stage Demo mode. Use before every merge, push to main, or Vercel deploy.
disable-model-invocation: true
allowed-tools: Bash
---

# /preflight

Run every step from the repo root. Stop at the first failure, show the real error output, and do not claim success without it. Do not fix files you don't own (CLAUDE.md section 5): report them to the owner.

## 1. Static gates
```bash
npx tsc --noEmit && npm run lint && npm run build
```

## 2. Secrets check (never commit keys)
```bash
git status --short                       # .env.local must NOT appear as tracked/staged
git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$'   # must print nothing
git diff --cached -U0 | grep -nE 'sk-[A-Za-z0-9_-]{20,}|ELEVENLABS_API_KEY=.+|OPENAI_API_KEY=.+|N8N_WEBHOOK_URL=https?://' ; test $? -eq 1
grep -rn "NEXT_PUBLIC_" src | grep -iE 'key|secret|token'                # must print nothing
```
Any hit is a failure: unstage it and tell the team. Never print key values.

## 3. Smoke test /api/agent in Stage Demo mode (works with no keys, offline)
Start the production build on a spare port, run the smoke script, always kill the server:
```bash
npx next start -p 3107 > "${TMPDIR:-/tmp}/preflight-server.log" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 30); do curl -sf localhost:3107/api/health >/dev/null && break; sleep 1; done
node .claude/skills/preflight/smoke.mjs http://localhost:3107; RC=$?
kill $SERVER_PID 2>/dev/null
exit $RC
```
If port 3107 is busy, pick another. The script checks: `/api/health` returns booleans only; the SSE stream has planner / tool_call / verifier steps; the final `deliverable` has finite ROI numbers, recommendations, risks and an n8n action; `done.mode === "demo"`; no `error` event.

## 4. Report
One short block: tsc / lint / build / secrets / smoke = PASS or FAIL, plus the ROI line the smoke script printed. On any FAIL, give the first error and the file's owner from CLAUDE.md section 5.

Live-mode check (optional, needs keys in `.env.local`): `npm run dev`, tick Live in the UI, run a preset, and confirm the badge shows `live`, not a failover to demo.
