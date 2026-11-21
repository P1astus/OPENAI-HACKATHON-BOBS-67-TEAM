# Record the centrix Fix pitch

Run the commands from the repository root. Use a dedicated local Next.js instance because the recorder resets its target demo data before each take. The recorder defaults to a loopback origin. `REAL_TAKE=1` permits a remote origin. Keep the repository free of local environment files and pass any live credentials to the server process through your shell.

## One-time setup

Use Node.js, Playwright 1.65.1 from the recorder package, and Homebrew FFmpeg at `/opt/homebrew/bin/ffmpeg`. The scripts use a resolvable Playwright installation or the npm exec cache. Install locally if neither is available.

```sh
npm install --prefix scripts/video
npx --prefix scripts/video playwright install chromium --only-shell
```

To keep the browser binaries inside the workspace, export `PLAYWRIGHT_BROWSERS_PATH="$PWD/scripts/video/node_modules/.cache/ms-playwright"` before the browser install and in the shell that runs the scripts.

If the macOS workspace reports `MachPortRendezvousServer` permission denied when starting Chromium, run the scripts with `VIDEO_SINGLE_PROCESS=1`.

## Dry run with a simulated call

Make sure there are no local environment files, including `.env.local`. Without model credentials the app deliberately sends unclarified reports to a person. The loopback model fixture (`dry-triage.mjs`) returns fixed triage results for the recorder's three reports (heating, balcony door, hallway clarification), so a local dry run needs no OpenAI key.

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

In a separate terminal, start the recorder and render the three cards.

```sh
node scripts/video/record.mjs
node scripts/video/cards.mjs
```

With real OpenAI triage and the three ElevenLabs variables unset, the in-memory server records the simulated call and returns its slots in the report response. This also lets you record the full app walkthrough without placing a call.

## Real take with a teammate on the phone

Restart the dedicated local server with the approved OpenAI and ElevenLabs credentials in its process environment. Leave `OPENAI_BASE_URL` unset for the normal OpenAI endpoint. Set `VOICE_TEST_TO_NUMBER` to the consenting teammate’s verified number and set `VOICE_WEBHOOK_SECRET` for the agent’s `submit_slots` tool. The tool must reach `/api/agent/voice-result` on that same local server through your existing webhook forwarding setup. Use the same port and keep the recorder’s `BASE_URL` on loopback. [Voice configuration](../../docs/voice-agent.md) · [Final call scene](../../docs/pitch-video.md#what-the-video-shows)

```sh
npm run build && npx next start -H 127.0.0.1 -p 3155
```

In the recorder terminal, use a separate output folder.

```sh
PAUSE_BEFORE_CALL=1 OUT_DIR=scripts/video/out/real node scripts/video/record.mjs
OUT_DIR=scripts/video/out/real node scripts/video/cards.mjs
```

At `Press Enter to start the locksmith scene` (the recorder’s older label for the balcony-door scene), get the phone and separate audio recorder ready, then press Enter. When the phone rings, answer on speaker as Hauswerk Aachen and offer times. The recorder waits up to four minutes for the times to appear and then books the first one. Playwright captures video only. Record the speakerphone audio separately and sync it with the call markers in the edit.

## Outputs

- `raw.webm` and `raw.mp4` contain the 1920×1080 take. The MP4 is H.264 at 30 fps.
- `markers.json` gives scene boundaries and event timestamps in seconds from browser page creation. Use it to trim startup, waiting, and the optional operator pause.
- `card-title.png`, `card-connector.png`, and `card-end.png` are 1920×1080 stills.
- `failure.png` shows the browser when a recording step failed, when the page was available.

The default output folder is `scripts/video/out/`. Set `OUT_DIR` to keep separate takes. Set `BASE_URL` if the local server is on a different port.

## Final edit (`assemble.py`)
The editor needs `ffmpeg` and `ffprobe` on PATH, Python with Pillow, and the macOS system font at `/System/Library/Fonts/SFNS.ttf`. Edit timings are fixed to the final take. Put the inputs in `scripts/video/out/edit/` or set `VIDEO_WORK` to your input directory.
- `ipad-call.mov` (`IPAD_CLIP`): camera clip of the phone call; `IPAD_OFFSET` = seconds into the clip where the call audio starts
- `vo/eric_0.mp3` through `vo/eric_8.mp3`, with `eric_5_synced.mp3` in place of `eric_5.mp3`. See the [pitch transcript](../../docs/pitch-video.md#voice-over-elevenlabs-voice-eric).
- `RAW` defaults to `scripts/video/out/real-dark2/raw.mp4` and `CARDS` defaults to `scripts/video/out/dark/`. Set these variables to use other take and card paths.

```sh
python3 scripts/video/assemble.py   # writes scripts/video/out/edit/centrix-fix-pitch.mp4 by default
```

The final take used `INJECT_SLOTS=1` to replay the recorded call through the voice-result webhook. This mode requires an explicit `BASE_URL`, a matching `VOICE_WEBHOOK_SECRET`, and a matched phone ticket still waiting for slots. The recorder uses fixed 23 November 2026 timestamps for the replay. They must be future times at recording for the callback to accept them.
