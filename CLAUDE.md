# MAIN Summit hackathon (team MAIN 08) — Autonomous AI Operations & Decision Engine

Stateless Next.js (App Router) + TypeScript + Tailwind v4. OpenAI tool-calling agent → ROI + verifier → n8n webhook (auto or human-approved) → ElevenLabs voice briefing. No DB, no auth.

Rules: keep it simple (one working demo beats many half features) · commit often · never commit API keys (`.env.local` is git-ignored; `.env.example` is the template).

## Commands
```bash
npm install
cp .env.example .env.local   # fill keys; with no OPENAI_API_KEY the app auto-starts in Stage Demo Mode
npm run dev                  # http://localhost:3000
npx tsc --noEmit && npm run lint && npm run build   # must all pass before pushing
```
Env: `OPENAI_API_KEY`, `OPENAI_MODEL` (gpt-4o), `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `N8N_WEBHOOK_URL`. Missing keys never break the demo: OpenAI → demo simulation, ElevenLabs → browser speechSynthesis, n8n → "simulated".

## Architecture map
| Path | Role |
|---|---|
| `src/types/agent.ts` | Data contracts: `TraceStep`, `BusinessImpact`, `AgentDeliverable` (+ Zod schemas, SSE event types) |
| `src/lib/openai.ts` | Agent brain: system prompt, 3 tools (`calculate_business_roi`, `verify_and_ground_output`, `prepare_or_execute_n8n_workflow`), live tool loop, json_object synthesis + Zod, Stage Demo simulation (350ms/step), live→demo failover |
| `src/lib/presets.ts` | 3 preset scenarios + all canned demo data (`DemoScenario`), prompt→scenario routing |
| `src/lib/n8n.ts`, `elevenlabs.ts` | Native-fetch bridges (6s n8n timeout; TTS returns null → fallback) |
| `src/app/api/{agent,tts,workflow,health}/route.ts` | SSE agent stream, TTS (`{fallback:true}` or audio/mpeg), n8n approve-and-dispatch, key status |
| `src/lib/stream.ts`, `history.ts` | Client SSE parser; localStorage "last 5 runs" |
| `src/app/page.tsx` | State + orchestration (modes, run, history, approval) |
| `src/components/*` | `CommandBar`, `ArchitectureModal`, `LauncherPanel`, `DeliverablePanel`, `N8nActionCard`, `VoiceBriefingPlayer`, `TracePanel` |

Key design choices: numbers (hours, €, confidence) come from deterministic tools, never from the LLM; the demo path runs the same real tools on canned inputs, so Stage Demo and Live produce identical-looking traces.

## Parallel-work boundaries (4 people, no merge conflicts)
| Owner | Touches | Avoid |
|---|---|---|
| **Backend / Agent** | `src/lib/openai.ts`, `src/lib/n8n.ts`, `src/lib/elevenlabs.ts`, `src/app/api/**` | `page.tsx`, `components/**` |
| **Presets / Domain** | `src/lib/presets.ts` (context text, demo numbers, voice scripts), n8n workflow in the n8n UI | everything else |
| **UI / Pitch** | `src/components/**`, `src/app/page.tsx`, `globals.css`, slides/demo script | `lib/openai.ts`, `api/**` |
| **Contracts (shared, change = announce first)** | `src/types/agent.ts` | edit only with all owners' OK; adding optional fields is safe |

Workflow: short-lived branches per owner (`backend/…`, `domain/…`, `ui/…`), rebase on `main` before merging, commit small and often, never force-push `main`.

## One-Prompt Challenge Pivot (right after the 11:00 AM reveal)
Paste the challenge text into Claude Code with: *"Pivot this app to the challenge below. Modify ONLY these 4 files, keep every export name and function signature, then run `npx tsc --noEmit && npm run build`."*

1. **`src/types/agent.ts`** — rename/extend the domain fields if the challenge needs them (e.g. add optional fields to `AgentDeliverable`/`BusinessImpact`; keep existing ones so the UI still compiles). Update the Zod schemas to match.
2. **`src/lib/openai.ts`** — rewrite `SYSTEM_PROMPT` and `SYNTHESIS_INSTRUCTIONS` for the challenge domain; adjust the ROI formula (`calculateBusinessRoi`), verifier checks (`verifyAndGroundOutput`) and tool descriptions/payload shape to the new KPIs.
3. **`src/lib/presets.ts`** — replace the 3 `PRESETS` (context + `demo` block: plan, ROI inputs, constraints, recommendations, risks, summary, voice script, n8n payload) with challenge-realistic scenarios; update `keywords` and `genericDemoScenario`.
4. **`src/app/page.tsx`** — update titles/labels/KPI wording as needed (KPI cards live in `DeliverablePanel`, command-bar title in `CommandBar`; touch them only if the wording must change).

Then: point `N8N_WEBHOOK_URL` at the team's n8n webhook, rehearse the Stage Demo path first (works offline), then Live. Fallback rule on stage: if anything flaky → toggle **Stage Demo**.
