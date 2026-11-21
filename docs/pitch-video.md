# Pitch video (final, 2:28)

The hand-in video for BuilderBase → Hand in → **Pitch Video** (limit 2:30). Final file: `centrix-fix-pitch.mp4`, 1080p, 2:27.8. It is not in the repo (size); the team has it.

## What the video shows

| # | Time | Picture | Sound |
|---|---|---|---|
| 1 | 0:00 | Title card (dark): "centrix Fix · Something breaks. One sentence. Fixed." | Voice-over 1 |
| 2 | 0:09 | `/demo` with all four views: tenant, partner, owner, reltix operations | Voice-over 2 |
| 3 | 0:18 | Lena reports "The heating is cold in every room since this morning." → AI triage → WarmHaus (partner, calendar) → she picks a time and confirms consent → all screens update | Voice-over 3 |
| 4 | 0:32 | Lena reports "The balcony door doesn't close properly anymore, the handle is loose." → matched to **Hauswerk Aachen, a partner that books by phone** → "calling Hauswerk Aachen for times" | Voice-over 4 |
| 5 | 0:40 | **Real phone call, uncut** (iPad camera): the ElevenLabs voice agent calls the partner, describes the job (no tenant data), the partner offers Monday 9:00 and 14:00, the agent confirms. Label: "Real phone call · AI voice agent ↔ Hauswerk Aachen, a centrix partner that books by phone" + subtitles | Original call audio |
| 6 | 1:33 | The two times from the call appear in Lena's app; she books one | Voice-over 5 |
| 7 | 1:40 | Partner clicks the green **Mark as done** (€95) → paid from the owner's wallet → Lena rates 9/10 → the partner's score updates | Voice-over 6a (at "done"), 6b (at the rating) |
| 8 | 1:55 | Unclear request ("Something in the hallway seems wrong") → owner types "Called Lena: the hallway radiator is ice cold." → re-triaged → WarmHaus matched | Voice-over 7 |
| 9 | 2:08 | Slide "One connector, three levels": phone only · calendar · full API, consent first | Voice-over 8 |
| 10 | 2:19 | End card: "Owners pay a subscription. Companies pay nothing." · centrix-fix.vercel.app · team | Voice-over 9 |

## Voice-over (ElevenLabs, voice "Eric")

1. "When something breaks in a rented flat, the tenant writes one sentence. centrix Fix finds the right repair company, books it, pays it and gets it rated."
2. "Today a broken heater means calls, emails and chasing. We put the tenant, the repair company, the owner and reltix on one live screen."
3. "Lena types one sentence. Our AI reads it, then a formula, not the AI, picks the company: reviews, price and distance, partners first. One tap books it, and only then does WarmHaus see her contact."
4. "Not every partner runs an online calendar. For partners who work by phone, our voice agent calls them and books the job itself."
5. "It never shares Lena's details before she confirms. The times it agreed land straight in Lena's app. One tap: booked."
6. a) "Job done: one click, and it's paid from the owner's centrix wallet, with no commission." b) "Lena rates it, and the company's score updates."
7. "And when our AI can't tell what's wrong, it says so instead of guessing. The owner calls Lena, types one sentence, and the system takes over again: re-reads it, matches the right company, offers Lena times."
8. "Any company can plug in the same way: with just a phone number, with a calendar, or with a full API. Personal data only flows after the tenant agrees. That's our connector spec."
9. "Owners pay a subscription; companies pay nothing. centrix Fix: from 'something's broken' to 'fixed and rated', without a single form."

## How it was made

1. **App recording:** `scripts/video/record.mjs` (Playwright) clicks through `/demo` in dark mode at 1920×1080 with a visible cursor and writes `raw.mp4` + `markers.json` (scene and event times). For the final take the phone call had already been recorded, so the robot replayed that call's result (`INJECT_SLOTS=1`, the same `voice-result` webhook the agent uses, with the two times from the real call).
2. **Phone call:** a real call from the live app to a teammate's phone (ElevenLabs agent + Twilio), filmed with an iPad. The call is used uncut with the iPad's own audio; subtitles were placed by detecting speech in that audio.
3. **Voice-over:** ElevenLabs text-to-speech, voice "Eric", lines above.
4. **Slides:** `scripts/video/cards.mjs` renders the title, connector and end cards (dark theme).
5. **Edit:** `scripts/video/assemble.py` (ffmpeg + Pillow) cuts the scenes to the voice-over, speeds up waiting (max 2×), inserts the call clip with subtitles and concatenates everything to ≤ 2:30.

See `scripts/video/README.md` for the commands.

## Honest notes
- The phone call is real (live app → ElevenLabs → Twilio → a real phone). In the demo, calls are routed to a team member's phone, who plays the partner company.
- Partner calendars are simulated in the demo data.
