# Team MAIN 08: setup in 5 minutes (Antoni, Arman, Timo, Valentin)

Read [CLAUDE.md](CLAUDE.md) for how we work. This page is just what you need to start.

## 1. Get the repo
```bash
git clone https://github.com/P1astus/OPENAI-HACKATHON-BOBS-67-TEAM.git main-hackathon && cd main-hackathon
cp .env.example .env.local      # then paste the keys the team shares (or leave blank for now)
```
Install dependencies and start the dev server at http://localhost:3000.

```bash
npm install
npm run dev
```

Run the checks before merging.

```bash
npm run typecheck && npm run lint && npm run build
```

## 2. Who edits what
See the [Friday task split](docs/task-split.md) for the kickoff assignments. Antoni Potrykowski (P1astus) handled UI and deployment, Arman Kataria (armaNKataria) backend and triage, Timo Aavila (Tropimatico) voice, and Valentin Nagel (valoi2) data, connector spec and pitch.
Need something changed in a file you don't own? Message the owner. Don't edit it yourself.

## 3. Safe Git workflow
```bash
git checkout main && git pull
git checkout -b feat/<your-area>            # your own branch
# ...work, then commit small and often:
git add <your files> && git commit -m "feat: short description"
git pull --rebase origin main              # always pull before you push
# run the project's checks (type check, lint, build): they must pass
git push -u origin feat/<your-area>        # then open a Pull Request into main
```
- Anyone can merge a PR into `main` once one other teammate has reviewed it. Don't push to `main` directly and never force-push.
- **Never commit `.env.local` or any key.** It is git-ignored; check `git status` before every commit. Don't paste keys into chat screenshots either.
- Conflict? Stop and ask. It means two people touched one file.

## 4. Deploy
The [live app](https://centrix-fix.vercel.app) was deployed from the Vercel CLI. From a checkout linked to the team’s Vercel project, run `vercel --prod` to deploy production. Configure the server variables from [`.env.example`](.env.example) in the Vercel project settings and use Upstash Redis for shared state. [Vercel CLI deploy reference](https://vercel.com/docs/cli/deploy)

## 5. Key times
Fri 09:00 check-in, Ad Fundum · 09:10 Meeting Area F · 11:00 challenge reveal · 13:30 sprint in room 0.001, Grote Gracht 80–82 · **Sat 10:30 submission deadline** · 11:00 re-check-in, Sint Janskerk · 15:00 Grand Finale pitches.
