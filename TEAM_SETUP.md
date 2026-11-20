# Team MAIN 08: setup in 5 minutes (Antoni, Marlene, Timo, Diana)

Read `CLAUDE.md` for how we work. This page is just what you need to start.

## 1. Get the repo
```bash
git clone <REPO_URL> main-hackathon && cd main-hackathon
cp .env.example .env.local      # then paste the keys the team shares (or leave blank for now)
```
There is no app code yet. We decide what to build and which tools to use after the challenge reveal (Fri 11:00). Once the stack is chosen, the install and run commands for it go here.

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
Submission needs a live URL, so deploy a working version early (Fri evening) and redeploy as it improves. The exact commands depend on the stack; with Next.js on Vercel it is `npx vercel --prod`, plus the env vars in the Vercel project settings.

## 5. Key times
Fri 09:00 check-in, Ad Fundum · 09:10 Meeting Area F · 11:00 challenge reveal · 13:30 sprint in room 0.001, Grote Gracht 80–82 · **Sat 10:30 submission deadline** · 11:00 re-check-in, Sint Janskerk · 15:00 Grand Finale pitches.
