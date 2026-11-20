---
name: pivot
description: One-Prompt Challenge Pivot for MAIN 08. Re-targets the app to the hackathon challenge text (pass it as the argument or paste it after invoking). Edits only the files listed in CLAUDE.md section 7, keeps all exports and signatures, then runs /preflight checks. Use right after the challenge reveal.
disable-model-invocation: true
argument-hint: <paste the challenge text>
---

# /pivot: One-Prompt Challenge Pivot

Challenge text: $ARGUMENTS
(If empty, ask the user to paste it and stop.)

Read CLAUDE.md section 7 and the current `src/lib/domain/presets.ts` and `calculators.ts` first. Then do the following. Do not stop to ask unless the challenge text is ambiguous about who the user is or what the KPI is.

## Hard rules
- Edit ONLY: `src/lib/domain/presets.ts`, `src/lib/domain/calculators.ts`, `src/app/page.tsx`, `src/components/CommandBar.tsx`, `src/components/DeliverablePanel.tsx` (wording only), `n8n/**`, and `src/types/agent.ts` (additive optional fields only).
- Keep every export name and signature (`SYSTEM_PROMPT`, `SYNTHESIS_INSTRUCTIONS`, `PRESETS`, `DemoScenario`, `genericDemoScenario`, `pickDemoScenario`, `calculateBusinessRoi`, `verifyAndGroundOutput`).
- No `any`, no TODO or stub code, no secrets, no new dependencies. Numbers come from `calculators.ts`, never from LLM text.
- Do not touch `src/lib/integrations/openai.ts`, `elevenlabs.ts`, `api/**` unless a calculator argument name changed (then only the matching `TOOLS` JSON schema in `openai.ts`, announced to the team and the agent-core owner first).

## Steps
1. **Extract** (write it in 5 lines before editing): the user persona, the core problem, the 3 KPIs that matter, what the real action is (the n8n side effect), and the success criteria the jury will score. Map them to the four jury criteria in CLAUDE.md section 3.
2. **`presets.ts`**: rewrite `SYSTEM_PROMPT` + `SYNTHESIS_INSTRUCTIONS`. Replace the 3 `PRESETS` with 3 realistic scenarios for this challenge: `context`, `keywords`, and a full `demo` block (plan, ROI inputs, constraints, recommendations, risks+mitigations, summary, voice script, n8n payload). Rewrite `genericDemoScenario`. Keep demo numbers plausible and consistent with the calculator output.
3. **`calculators.ts`**: adapt `calculateBusinessRoi` and `verifyAndGroundOutput` to the challenge KPIs. If an argument name changes, update the `TOOLS` schema in `integrations/openai.ts` and the demo `roi` inputs in `presets.ts`.
4. **`types/agent.ts`**: only if the challenge needs extra fields (optional, additive).
5. **UI wording**: `page.tsx`, `CommandBar.tsx`, `DeliverablePanel.tsx` titles, labels, KPI wording only.
6. **`n8n/`**: extend the workflow for the challenge's real action; keep `N8N_WEBHOOK_URL` payload keys in sync with the preset `payload`. Export the JSON.
7. **Verify**: run the `/preflight` steps (tsc, lint, build, secrets, Stage Demo smoke test). Fix failures in files you are allowed to edit.
8. **Report** in under 10 lines: what the 3 scenarios are, the KPI mapping, files changed, preflight result, and anything the owners (Antoni/Marlene/Timo/Diana) must follow up on. Do not commit or push unless asked.

Then tell the user to rehearse Stage Demo first (works offline), then Live.
