# Record the centrix Fix pitch

Run the commands from the repository root. The recorder accepts loopback origins only. Use a dedicated local Next.js instance because the recorder resets its demo data before each take. Keep the repository free of local environment files and pass any live credentials to the server process through your shell.

## One-time setup

Use Node.js, Playwright 1.65.x, and Homebrew FFmpeg at `/opt/homebrew/bin/ffmpeg`. The scripts use a resolvable Playwright installation or the npm exec cache. Install locally if neither is available.

```sh
npm install --prefix scripts/video
npx --prefix scripts/video playwright install chromium --only-shell
```

To keep the browser binaries inside the workspace, export `PLAYWRIGHT_BROWSERS_PATH="$PWD/scripts/video/node_modules/.cache/ms-playwright"` before the browser install and in the shell that runs the scripts.

If the macOS workspace reports `MachPortRendezvousServer` permission denied when starting Chromium, run the scripts with `VIDEO_SINGLE_PROCESS=1`.

## Dry run with a simulated call

Make sure there are no local environment files, including `.env.local`. Without model credentials the app deliberately sends unclarified reports to a person. Start the loopback model fixture in its own terminal so the three scripted inputs get deterministic triage responses. Next.js still runs the matching formula, booking, payment, ratings, and voice simulation.

```sh
node scripts/video/dry-triage.mjs
```

In the server terminal, run the production build with voice, Redis, and notifications disabled in the shell.

```sh
(
  unset ELEVENLABS_API_KEY ELEVENLABS_AGENT_ID ELEVENLABS_PHONE_NUMBER_ID
  unset UPSTASH_REDIS_REST_URL KV_REST_API_URL N8N_WEBHOOK_URL NEXT_PUBLIC_USE_MOCKS
  export OPENAI_API_KEY=local-pitch-fixture
  export OPENAI_BASE_URL=http://127.0.0.1:3156/v1
  npm run build && npx next start -H 127.0.0.1 -p 3155
)
```

In a separate terminal, record the five scenes and render the three cards.

```sh
node scripts/video/record.mjs
node scripts/video/cards.mjs
```

The in-memory server records the simulated call and generates slots in the same response. The terminal prints both call banners and the recording shows the slots as soon as they are available.

## Real take with a teammate on the phone

Restart the dedicated local server with the approved OpenAI and ElevenLabs credentials in its process environment. Leave `OPENAI_BASE_URL` unset for the normal OpenAI endpoint. Set `VOICE_TEST_TO_NUMBER` to the consenting teammate’s verified number and set `VOICE_WEBHOOK_SECRET` for the agent’s `submit_slots` tool. The tool must reach `/api/agent/voice-result` on that same local server through your existing webhook forwarding setup. Use the same port and keep the recorder’s `BASE_URL` on loopback. [Voice configuration](../../docs/voice-agent.md) · [Locksmith dialogue](../../docs/pitch-video.md)

```sh
npm run build && npx next start -H 127.0.0.1 -p 3155
```

In the recorder terminal, use a separate output folder.

```sh
PAUSE_BEFORE_CALL=1 OUT_DIR=scripts/video/out/real node scripts/video/record.mjs
OUT_DIR=scripts/video/out/real node scripts/video/cards.mjs
```

At `Press Enter to start the locksmith scene`, get the phone and separate audio recorder ready, then press Enter. When the phone rings, answer on speaker and offer times as the locksmith. The recorder waits up to four minutes for the times to appear and then books the first one. Playwright captures video only. Record the speakerphone audio separately and sync it with the call markers in the edit.

## Outputs

- `raw.webm` and `raw.mp4` contain the 1920×1080 take. The MP4 is H.264 at 30 fps.
- `markers.json` gives scene boundaries and event timestamps in seconds from browser page creation. Use it to trim startup, waiting, and the optional operator pause.
- `card-title.png`, `card-connector.png`, and `card-end.png` are 1920×1080 stills.
- `failure.png` shows the browser when a recording step failed, when the page was available.

The default output folder is `scripts/video/out/`. Set `OUT_DIR` to keep separate takes. Set `BASE_URL` if the local server is on a different port.

## Final edit (`assemble.py`)
Needs ffmpeg and Python with Pillow. Put the inputs in `scripts/video/out/edit/` (or set the env vars):
- `ipad-call.mov` (`IPAD_CLIP`): camera clip of the phone call; `IPAD_OFFSET` = seconds into the clip where the call audio starts
- `call.mp3`: the ElevenLabs conversation audio (only used for alignment/fallback)
- `vo/eric_*.mp3`: voice-over lines (see docs/pitch-video.md)
- `RAW` (default `out/real-dark2/raw.mp4`) and `CARDS` (default `out/dark/`)

```sh
python3 scripts/video/assemble.py   # writes out/edit/centrix-fix-pitch.mp4 (<= 2:30)
```

Re-shoot of the app only (no phone conversation needed): `REAL_TAKE=1 INJECT_SLOTS=1 VOICE_WEBHOOK_SECRET=… BASE_URL=https://centrix-fix.vercel.app node scripts/video/record.mjs` replays a recorded call result through the voice-result webhook.
