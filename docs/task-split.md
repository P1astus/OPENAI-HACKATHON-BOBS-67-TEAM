# Task split

Who builds what for the repair matching app. Product: [system-design.md](./system-design.md). Screens: [ui-plan.md](./ui-plan.md).

Antoni does all UI because only Antoni has the Vercel / v0 connection.

## Who does what

Prompts: Antoni → `docs/prompts/antoni-ui.md` · armaNKataria → `docs/prompts/armankataria-backend.md` · Tropimatico → `docs/prompts/tropimatico-voice.md` · valoi2 → `docs/prompts/valoi2-data-spec-pitch.md`.

| Person | Area | Owns these files |
|---|---|---|
| **Antoni** | **All UI and deploy.** Project setup, Vercel deploy and preview links, shared pieces (status pills, rating meter, contact card), and all four screens (tenant, owner, partner, admin) generated with v0, then wired to the API | `app/tenant/`, `app/owner/`, `app/partner/`, `app/admin/`, `components/` |
| **armaNKataria** | **Backend and AI.** Data model (`types.ts`), API routes, saving state, the matching and rating formulas, and the AI that reads the tenant's message (trade, urgency, confidence, emergency, unsure → human) | `types.ts`, `lib/`, `app/api/` |
| **Tropimatico** | **Voice call and messages.** ElevenLabs voice agent that calls a non-partner company and agrees on dates, set up mostly in ElevenLabs' own dashboard rather than in code. Optionally n8n email/SMS updates. armaNKataria connects it to the API | ElevenLabs agent config, `docs/voice-agent.md`, n8n workflow |
| **valoi2** | **Data, spec and pitch.** Writes the made-up data (about 15 companies with reviews, apartments, tenants, the heater story) in armaNKataria's format, the connector spec (15% of the score), and the pitch slides and script | `data/*.json`, `docs/connector-spec.md`, pitch |

## Order, so nobody waits
1. **First 30 minutes, Antoni:** setup commit on `main` (Next.js + Tailwind + shadcn) and the first Vercel deploy. Everyone branches from it.
2. **Next hour, in parallel:**
   - **Antoni:** generates the four screens in v0 from `ui-plan.md` with fake data.
   - **armaNKataria:** pushes `types.ts` and empty API routes first, so Antoni and valoi2 know the data shape. Then the AI and the formulas.
   - **Tropimatico:** builds the ElevenLabs agent and practises the call with a teammate's phone.
   - **valoi2:** writes the data JSON as soon as `types.ts` lands, then the connector spec.
3. **About 19:00:** Antoni swaps fake data for the real API, and the heater story runs end to end.
4. **Friday evening:** live URL works, then the voice call gets plugged in.
5. **Saturday 07:30:** feature freeze (see CLAUDE.md).

## Rules
- **Only Antoni changes UI files.** Report screen problems to Antoni; don't edit them yourself.
- **Only armaNKataria changes `types.ts` and the API.** Need a new field? Ask armaNKataria.
- Screens only talk to `app/api/`, never read `data/` directly.
- The connector spec is written from the real API, not from guesses.
- Every push gets a Vercel preview link: anyone can open it in a browser to check screens.
- One branch per area (`feat/<area>`), PRs into `main`, as in CLAUDE.md.
