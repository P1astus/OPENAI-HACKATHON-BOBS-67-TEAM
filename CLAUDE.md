# MAIN 08: hackathon playbook

Context for Claude Code and teammates. Read fully before changing anything.

**Status (Fri Nov 20, afternoon):** the challenge is revealed: we're in the **reltix track, "Plug a Partner into centrix"** (section 3a). Our product is decided: **repair matching**. Something breaks in an apartment, we find the best company to fix it, book it with the tenant, bill the owner and rate the company afterwards. The full design is in [docs/system-design.md](docs/system-design.md); read it before building. The tech stack is not chosen yet and there is no app code.

Repo: https://github.com/P1astus/OPENAI-HACKATHON-BOBS-67-TEAM

## 1. Event & schedule: MAIN Summit & AI Hackathon 2026 (Maastricht, "Where every field meets AI")
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

## 2. Team
Antoni Potrykowski, Marlene Heydenreich, Timo Aavila, Diana Piskareva. GitHub: P1astus (Antoni, repo owner), armaNKataria, Tropimatico, valoi2; who does what is in [docs/task-split.md](docs/task-split.md). Four equal members, no team lead. Decisions are made together; roles are agreed at kickoff (section 4) and can change.

## 3. Sponsors & what the jury rewards
Credits: **OpenAI** (models, tool calling, structured outputs), **ElevenLabs** (voice), **n8n Cloud Pro** (real actions via webhooks). Using all three is optional; use each only where it makes the product better.
Jury = OpenAI engineers + VCs + enterprise executives. Judging criteria published by OpenAI for its own events: technical implementation, design and user experience, potential impact, quality of the idea. What we aim for:
1. **A demo that runs end to end.** The biggest score difference in what judges report. A working narrow demo beats an ambitious one on slides.
2. **One clear sentence** that says what it is and for whom, said first.
3. **A real agent**, not a chat wrapper: multi-step work, explicit tool calls, self-checking, steps visible on screen.
4. **Business value in numbers** that come from deterministic code, never from model text (hours saved, EUR saved, confidence), plus risks and honest limits.
5. **Human in control and grounded answers**: ask for confirmation when unsure; say "I can't tell" rather than guess.
6. **A specific user and workflow**, not "AI for everyone".

## 3a. Our track: reltix "Plug a Partner into centrix"
reltix manages properties and builds **centrix**, the platform where its property managers and AI agents work. The task: pick one service partner and plug it into centrix, so that a moment in a property's life ends in a finished result (signed contract, completed repair) with zero forms for the resident.

Our solution has to:
1. **Detect the moment**: when and for whom the service is needed.
2. **Hand over context**: prefill what the partner needs from centrix.
3. **Hold the conversation** in a fitting channel. At least one channel must reach the resident directly.
4. **Close the loop**: keep everyone updated, then link the result (appointment, invoice) back to the property.

What we hand in:
- **A working demo of one flow:** event → resident reached → partner gets the job → result shows on the unit.
- **A partner connector spec:** what any partner must provide to plug in.

There is no reltix data or API. We make our own JSON data and state our assumptions.

reltix judging (this decides the track prize):

| Criterion | Weight |
|---|---|
| Demo works end to end | 30% |
| User experience for resident, partner and property manager | 25% |
| Feasibility and realism (data, consent, privacy, partner side) | 20% |
| Connector spec generic enough for the next partner | 15% |
| Clear reason for this partner and this moment | 10% |

## 4. How we work
**Kickoff (Fri 13:30, first 30–60 min, before any code).** Write down in one place:
- The problem and the specific user, in one sentence each.
- Our one-sentence pitch ("this is a tool that does X for Y").
- The demo path: one short flow, 2 minutes or less, that we build everything toward.
- The tech stack, chosen for the fastest route to a live URL (for example Next.js + Vercel). Set it up in one commit on `main`, then branch from it.
- Who owns what (one owner per file or area, to avoid conflicts), and who prepares the pitch in parallel.
- Must-have vs nice-to-have. Nice-to-haves go on the "what's next" slide, not into code.

**Build.**
- Get one end-to-end path running by early evening, then improve it. Do not extend it.
- Test with realistic inputs every hour or so. Pick the scenarios that work reliably and demo only those.
- Mock only things outside the core. Never fake the core product.
- Team planning talk around 19:00: who sleeps when, who works on what, when we regroup. Stagger sleep; before sleeping, leave notes on what is done and blocked.
- Deploy a working version to a live URL on Friday evening, then redeploy as it improves.
- Stuck for 20 minutes: say so in the team chat.

**Finish (proposed times, adjust together).**
- Sat ~07:30: feature freeze. Only fixes after this.
- Sat 07:30–10:00: end-to-end test, record a 60-second screen capture of a good run as a backup, rehearse the pitch out loud with a timer, check the live URL from a clean browser.
- Submit by ~10:00, with 30 minutes of margin before 10:30.

**Pitch.**
- One person works on the pitch from early on, not at the end; everyone still speaks a little.
- Open with the one sentence. Problem, demo, result in numbers, honest limits, "what's next".
- Practise on people who resemble the jury (mentors, sponsor staff) and fix what they point out.
- Prepare an honest answer to "what breaks first?".
- Backups in order: live demo, recorded run, offline demo mode if the product has one.

## 5. Git workflow
- One branch per person or area, named `feat/<area>`. Small, frequent commits.
- Pull latest `main` before starting and before pushing. Never push to `main` directly; never force-push.
- Anyone can merge a PR into `main` once one other teammate has reviewed it. `main` must always work.
- Need a change in a file someone else owns? Ask them; don't edit it.
- A conflict means two people touched one file: stop and ask.

## 6. Engineering & security rules
- Secrets only via environment variables on the server. Never prefix keys with `NEXT_PUBLIC_`, never log or print key values, never commit `.env.local`. Check `git status` before every commit.
- Validate anything external (model output, request bodies) before using it.
- Numbers shown to users (money, hours, scores) come from deterministic code, not model text.
- Every external call needs a timeout and a fallback so one failing service cannot crash the demo.
- Keep it simple. Our company list, apartments and reviews live in seed JSON files (or one small store if serverless state gets lost). No real database server and no login.
- Before every merge these must pass: `npm run typecheck && npm run lint && npm run build`.
- If we use a framework that changed recently (for example Next.js), check its bundled or official docs before using unfamiliar APIs.

## 7. Current code
- [docs/system-design.md](docs/system-design.md): the agreed design (flow, matching formula, rating and promotion rules, business model, demo path). Change it only after the team agrees, and update it when a decision changes.
- [docs/ui-plan.md](docs/ui-plan.md): the UI spec for the four views (tenant, partner, owner, admin), Apple-style look, stack (Next.js + Tailwind + shadcn/ui, v0 + Vercel) and build order.
- [docs/task-split.md](docs/task-split.md): who builds what, file ownership and order of work.
- [docs/contract.md](docs/contract.md): data shapes and API every area builds against (owner: armaNKataria).
- [docs/prompts/](docs/prompts/): detailed task prompt per person.
- No app code yet. Next step: choose the stack, set it up in one commit, then everyone branches from it.

The old starter app (agent loop, dashboard, n8n workflow, `/pivot` and `/preflight` skills) and its project setup were deleted. They are still in git history (commits `4652e83` and `1fdf803`) if a piece is ever useful, but we do not build on them.
