# Team MAIN 08: setup in 5 minutes (Antoni, Marlene, Timo, Diana)

Read `CLAUDE.md` for how we work. This page is just what you need to start.

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
We have no fixed split yet. At kickoff (Fri 13:30) we agree on who owns which files or areas and write it down in the team chat. One owner per file, so nobody collides.
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

## 4. Deploy (whoever the team picks, before Sat 10:30)
The `main` branch auto-deploys to Vercel production, and pull requests get preview URLs. Set the environment variables in the Vercel project settings. The submission needs a live URL, so merge a working version by Friday evening.

## 5. Key times
Fri 09:00 check-in, Ad Fundum · 09:10 Meeting Area F · 11:00 challenge reveal · 13:30 sprint in room 0.001, Grote Gracht 80–82 · **Sat 10:30 submission deadline** · 11:00 re-check-in, Sint Janskerk · 15:00 Grand Finale pitches.
