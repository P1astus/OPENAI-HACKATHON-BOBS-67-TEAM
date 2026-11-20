# Team MAIN 08: setup in 5 minutes (Marlene, Timo, Diana)

Read `CLAUDE.md` for the full context. This page is just what you need to start coding.

## 1. Get running
```bash
git clone <REPO_URL> main-hackathon && cd main-hackathon
cp .env.example .env.local      # then paste the keys Antoni shares (or leave blank for Stage Demo Mode)
npm install && npm run dev      # open http://localhost:3000
```
No keys? It still works: the app starts in **Stage Demo Mode**, with simulated agent run, browser voice and simulated n8n.
You need Node 20+.

## 2. Who edits what (one owner per file, so nobody collides)
| Branch | Owner | You may edit | Never touch |
|---|---|---|---|
| `feat/agent-core` | Antoni | `src/lib/integrations/openai.ts`, `elevenlabs.ts`, `src/app/api/{agent,tts,health}/`, `src/types/agent.ts` | domain, components, n8n |
| `feat/domain-presets` | Marlene | `src/lib/domain/presets.ts`, `calculators.ts` | everything else |
| `feat/ui-dashboard` | Timo | `src/components/**`, `src/app/page.tsx`, `globals.css`, `src/lib/stream.ts`, `history.ts` | lib/integrations, lib/domain, api |
| `feat/n8n-workflows` | Diana | `n8n/**`, `src/lib/integrations/n8n.ts`, `src/app/api/workflow/` | everything else |

Need something changed in a file you don't own? Message the owner. Never edit it yourself.

## 3. Safe Git workflow
```bash
git checkout main && git pull
git checkout -b feat/domain-presets        # your branch from the table
# ...work, then commit small and often:
git add <your files> && git commit -m "feat(domain): add logistics preset"
git pull --rebase origin main              # always pull before you push
npx tsc --noEmit && npm run build          # must pass
git push -u origin feat/domain-presets     # then open a Pull Request into main
```
- Antoni merges PRs into `main`. Don't push to `main` directly and never force-push.
- **Never commit `.env.local` or any key.** It is git-ignored; check `git status` before every commit. Don't paste keys into chat screenshots either.
- Conflict? Stop and ask. It means two people touched one file.

## 4. Deploy (Antoni, before Sat 10:30)
```bash
npx vercel --prod
```
Add the five env vars in the Vercel project settings (or `npx vercel env add NAME production`), then redeploy. Submission needs the live URL, so deploy a working version early (Fri evening) and re-deploy as you improve it.

## 5. Key times
Fri 09:00 check-in, Ad Fundum · 09:10 Meeting Area F · 11:00 challenge reveal · 13:30 sprint in room 0.001, Grote Gracht 80–82 · **Sat 10:30 submission deadline** · 11:00 re-check-in, Sint Janskerk · 15:00 Grand Finale pitches.
