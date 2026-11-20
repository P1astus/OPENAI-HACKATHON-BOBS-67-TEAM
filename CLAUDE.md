# MAIN 08 — Autonomous AI Operations & Decision Engine

Project context for Claude Code and teammates. Read fully before changing anything.

## 1. Event & schedule — MAIN Summit & AI Hackathon 2026 (Maastricht, "Where every field meets AI")
Largest student-led AI hackathon in the Netherlands.

| When | What |
|---|---|
| Fri Nov 20, 09:00–09:10 | Mandatory check-in at Ad Fundum (Tongersestraat 53, SBE) + claim sponsor credits |
| Fri 09:10 | Team meets at Meeting Area F, Mensa |
| Fri 11:00–13:00 | Opening Ceremony, OpenAI keynote (Immanuel Schwall, AI Deployment Engineer) + **Official Challenge Reveal** |
| Fri 13:30–18:00 | Core sprint, room **0.001, Grote Gracht 80–82**; continues off-campus overnight |
| **Sat Nov 21, 10:30** | **HARD SUBMISSION DEADLINE**: working prototype + deployed live URL + pitch |
| Sat 11:00–11:45 | Mandatory re-check-in, Sint Janskerk (Vrijthof) |
| Sat 12:00–15:00+ | Main stage keynotes (Microsoft NL, High-Tech Gründerfonds, OpenAI alumnus Michael Aring) |
| Sat 15:00+ | **Grand Finale** live stage pitches (projector at Sint Janskerk) |

## 2. Team MAIN 08
Antoni Potrykowski (Business Engineering), Marlene Heydenreich, Timo Aavila, Diana Piskareva. No team lead: four equal members. Four people, one repo, one night: strict module boundaries (section 5) exist so branches never touch the same file.

## 3. Sponsors & jury criteria
Credits: **OpenAI** (intelligence, tool calling, structured outputs), **ElevenLabs** (TTS voice briefings), **n8n Cloud Pro** (real actions via webhooks).
Jury = OpenAI engineers + VCs + enterprise executives. We win on:
1. **True agentic architecture**: multi-step reasoning, explicit tool calls, self-verification, transparent live trace. Never a chat wrapper.
2. **Cohesive multi-sponsor integration**: OpenAI orchestrates, n8n executes real actions, ElevenLabs briefs executives.
3. **Quantified business ROI**: hours saved/month, annual EUR savings, automation %, confidence score, risks + mitigations on every output.
4. **Bulletproof stage reliability**: stateless (no DB/auth), one-command Vercel deploy, **Stage Demo Mode** (timed SSE simulation when keys are absent or Wi-Fi drops), browser `speechSynthesis` fallback, `localStorage` last-5-runs for instant Q&A switching.

## 4. Architecture
Next.js App Router + TypeScript (strict) + Tailwind v4. Flow: `Input → OpenAI planner & tool loop → ROI & verifier → human gate / n8n webhook → ElevenLabs briefing`, streamed to the UI as SSE `TraceStep` events and a final `AgentDeliverable`.

```
src/
  types/agent.ts              Shared contracts: TraceStep, BusinessImpact, AgentDeliverable + Zod schemas
  lib/domain/                 ALL domain logic (swap on challenge reveal)
    presets.ts                  agent prompts, 3 one-click scenarios, stage-demo data, prompt→scenario routing
    calculators.ts              deterministic ROI formula + verifier checks (the LLM never invents numbers)
  lib/integrations/           Sponsor plumbing (domain-agnostic)
    openai.ts                   tool-calling loop, 3 tools, json_object + Zod synthesis, Stage Demo playback, live→demo failover
    elevenlabs.ts               TTS (eleven_turbo_v2_5) → audio or null (= fallback)
    n8n.ts                      webhook POST, 6s AbortController timeout, simulated on failure/no URL
  lib/stream.ts, history.ts   client SSE parser; localStorage last-5 runs
  app/api/agent|tts|workflow|health/route.ts   SSE agent, TTS, approve-and-dispatch, boolean key status
  app/page.tsx + components/  Command Center UI (CommandBar, LauncherPanel, DeliverablePanel, N8nActionCard, VoiceBriefingPlayer, TracePanel, ArchitectureModal)
n8n/                        exported n8n workflow JSON + import guide
```
Tools: `calculate_business_roi` (→ `domain/calculators.ts`), `verify_and_ground_output` (→ confidence + trade-offs), `prepare_or_execute_n8n_workflow` (auto-dispatch or `pending_approval`).
Commands: `npm run dev` · `npx tsc --noEmit` · `npm run lint` · `npm run build` (all must exit 0 before merging).
Env (`.env.local`, copy from `.env.example`): `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4o`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `N8N_WEBHOOK_URL`. Any missing key degrades gracefully: demo mode / browser voice / simulated dispatch.

## 5. Module ownership (one owner per file → no merge conflicts)
| Branch | Suggested owner | Owns (edit freely) | Do not edit |
|---|---|---|---|
| `feat/agent-core` | Antoni | `src/lib/integrations/openai.ts`, `elevenlabs.ts`, `src/app/api/agent/`, `api/tts/`, `api/health/`, `src/types/agent.ts` | domain/, components/, n8n/ |
| `feat/domain-presets` | Marlene | `src/lib/domain/presets.ts`, `src/lib/domain/calculators.ts` | everything else |
| `feat/ui-dashboard` | Timo | `src/components/**`, `src/app/page.tsx`, `layout.tsx`, `globals.css`, `src/lib/stream.ts`, `history.ts` | lib/integrations/, lib/domain/, api/ |
| `feat/n8n-workflows` | Diana | `n8n/**`, `src/lib/integrations/n8n.ts`, `src/app/api/workflow/` | everything else |

Rules: `src/types/agent.ts` is the contract. Only additive changes (new optional fields), announced in the team chat first, made on `feat/agent-core`. Need a change in someone else's file? Ask the owner; do not edit it. Antoni merges PRs into `main`.

## 6. Engineering & security rules
- TypeScript strict, no `any`; validate everything external (LLM JSON, request bodies) with Zod `.safeParse`. No TODO/stub code on `main`.
- Secrets only via env on the server. Never `NEXT_PUBLIC_` for keys, never log or return key values (`/api/health` returns booleans only), never commit `.env.local`.
- Stay stateless: no DB, no auth, no server-side sessions. Persistence = browser `localStorage` only.
- Numbers (hours, EUR, confidence) come from deterministic code, not LLM text.
- Every integration must fail soft (timeout + fallback) so the stage demo can never hard-crash.
- Before every merge: `npx tsc --noEmit && npm run lint && npm run build`.

## 7. One-Prompt Challenge Pivot (reveal is in the 11:00–13:00 ceremony; be done before the 13:30 sprint)
Paste the challenge text into Claude Code with: *"Pivot this app to the challenge below. Edit only the files listed in CLAUDE.md section 7, keep all exports and signatures, then run `npx tsc --noEmit && npm run lint && npm run build`."*
1. **`src/lib/domain/presets.ts`**: rewrite `SYSTEM_PROMPT` + `SYNTHESIS_INSTRUCTIONS`; replace the 3 `PRESETS` (context + `demo` block: plan, ROI inputs, constraints, recommendations, risks, summary, voice script, n8n payload), their `keywords`, and `genericDemoScenario`.
2. **`src/lib/domain/calculators.ts`**: adapt the ROI formula (`calculateBusinessRoi`) and verifier checks (`verifyAndGroundOutput`) to the challenge KPIs. If argument names change, update the matching tool JSON schemas in `integrations/openai.ts` (`TOOLS`) and the demo inputs in `presets.ts`.
3. **`src/types/agent.ts`**: only if the challenge needs extra fields; add optional fields, keep existing ones.
4. **`src/app/page.tsx`** (+ `components/CommandBar.tsx`, `DeliverablePanel.tsx` if wording must change): titles, labels, KPI wording.
5. **`n8n/`**: extend the workflow for the challenge's real action, export JSON, set `N8N_WEBHOOK_URL`.
Then rehearse Stage Demo first (works offline), then Live. If anything is flaky on stage, toggle **Stage Demo**.
