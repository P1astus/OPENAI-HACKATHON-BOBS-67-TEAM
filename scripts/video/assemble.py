#!/usr/bin/env python3
"""Assemble the centrix Fix pitch video (<= 2:30) from the robot take, iPad call clip,
clean ElevenLabs call audio, ElevenLabs voice-over and the rendered cards."""
import json, os, subprocess, textwrap
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
# Inputs (override with env vars). See scripts/video/README.md.
S = os.environ.get("VIDEO_WORK", os.path.join(HERE, "out", "edit"))
RAW = os.environ.get("RAW", os.path.join(HERE, "out", "real-dark2", "raw.mp4"))
CARDS = os.environ.get("CARDS", os.path.join(HERE, "out", "dark"))
IPAD = os.environ.get("IPAD_CLIP", os.path.join(S, "ipad-call.mov"))
CALL = f"{S}/call.mp3"
VO = f"{S}/vo"
OUT = f"{S}/build"
os.makedirs(OUT, exist_ok=True)
IPAD_OFFSET = float(os.environ.get("IPAD_OFFSET", "8.24"))  # call audio t=0 == iPad clip t (audio cross-correlation)
FONT = "/System/Library/Fonts/SFNS.ttf"
MAXSPEED = 2.0

def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).decode())

def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)

V = "-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30".split()
A = "-c:a aac -b:a 192k -ar 48000 -ac 2".split()

def caption_png(name, lines, who=None, pos="bottom"):
    """Transparent 1920x1080 PNG with a rounded dark caption box."""
    img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, 44)
    fb = ImageFont.truetype(FONT, 34)
    wrapped = []
    for l in lines:
        wrapped += textwrap.wrap(l, 62)
    lh = 58
    h = lh * len(wrapped) + (50 if who else 0) + 48
    w = 1500
    x0, y0 = (1920 - w) // 2, (1080 - h - 70) if pos == "bottom" else 60
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=28, fill=(0, 0, 0, 175))
    y = y0 + 24
    if who:
        d.text((x0 + 40, y), who, font=fb, fill=(140, 190, 255, 255))
        y += 50
    for l in wrapped:
        d.text((x0 + 40, y), l, font=f, fill=(255, 255, 255, 255))
        y += lh
    p = f"{OUT}/cap_{name}.png"
    img.save(p)
    return p

def card(name, png, vo, pad=0.6, lead=0.3):
    d = dur(vo) + pad + lead
    out = f"{OUT}/{name}.mp4"
    run(["-loop", "1", "-t", f"{d}", "-i", png, "-i", vo,
         "-filter_complex", f"[0:v]scale=1920:1080,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st={d-0.4}:d=0.4[v];[1:a]adelay={int(lead*1000)}|{int(lead*1000)},apad[a]",
         "-map", "[v]", "-map", "[a]", "-t", f"{d}", *V, *A, out])
    return out

def screen(name, start, end, vo, pad=0.6, lead=0.2, caption=None, freeze=False):
    """Cut raw[start:end], fit to voice-over length (speed up, or freeze-pad if shorter)."""
    length = end - start
    target = max(dur(vo) + pad + lead, length / MAXSPEED)
    out = f"{OUT}/{name}.mp4"
    if length > target:
        vf = f"setpts=PTS/{length/target:.4f}"
    else:
        vf = f"tpad=stop_mode=clone:stop_duration={target-length+0.1:.2f}"
    inputs = ["-ss", f"{start}", "-t", f"{length}", "-i", RAW, "-i", vo]
    fc = f"[0:v]{vf},scale=1920:1080,fps=30[v0];[1:a]adelay={int(lead*1000)}|{int(lead*1000)},apad[a]"
    if caption:
        inputs += ["-loop", "1", "-i", caption_png(name, [caption], pos="top")]
        fc += f";[v0][2:v]overlay=0:0:enable='between(t,0.5,{target-0.3:.2f})'[v]"
    else:
        fc = fc.replace("[v0]", "[v]")
    run([*inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-t", f"{target}", *V, *A, out])
    return out

def ipad_call(name, i0, i1, subs):
    """One continuous iPad clip [i0,i1] with its own audio; subs in call time (+IPAD_OFFSET)."""
    out = f"{OUT}/{name}.mp4"
    length = i1 - i0
    inputs = ["-ss", f"{i0}", "-t", f"{length}", "-i", IPAD]
    fc = "[0:v]scale=1920:1080,fps=30[b0]"
    last = "b0"
    inputs += ["-loop", "1", "-i", caption_png(f"{name}_tag", ["Real phone call · AI voice agent ↔ Hauswerk Aachen, a centrix partner that books by phone"], pos="top")]
    fc += f";[{last}][1:v]overlay=0:0:enable='lt(t,7)'[t0]"
    last = "t0"
    for i, (t0, t1, who, text) in enumerate(subs):
        a, b = t0, t1
        inputs += ["-loop", "1", "-i", caption_png(f"{name}_{i}", [text], who=who)]
        fc += f";[{last}][{2+i}:v]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[s{i}]"
        last = f"s{i}"
    fc += ";[0:a]highpass=f=90,volume=1.8,apad[a]"
    run([*inputs, "-filter_complex", fc, "-map", f"[{last}]", "-map", "[a]", "-t", f"{length}", *V, *A, out])
    return out

def call_segment(name, c0, c1, subs):
    """iPad video aligned to clean call audio, with burned-in subtitles. subs: [(t0,t1,who,text)] in call time."""
    out = f"{OUT}/{name}.mp4"
    length = c1 - c0
    inputs = ["-ss", f"{IPAD_OFFSET + c0}", "-t", f"{length}", "-i", IPAD, "-ss", f"{c0}", "-t", f"{length}", "-i", CALL]
    fc = "[0:v]scale=1920:1080,fps=30[b0]"
    last = "b0"
    tag = caption_png(f"{name}_tag", ["Real phone call · AI voice agent ↔ Hauswerk Aachen (not a centrix partner)"], pos="top")
    inputs += ["-loop", "1", "-i", tag]
    fc += f";[{last}][2:v]overlay=0:0:enable='lt(t,{min(length,6)})'[t0]"
    last = "t0"
    for i, (t0, t1, who, text) in enumerate(subs):
        inputs += ["-loop", "1", "-i", caption_png(f"{name}_{i}", [text], who=who)]
        fc += f";[{last}][{3+i}:v]overlay=0:0:enable='between(t,{t0-c0:.2f},{t1-c0:.2f})'[s{i}]"
        last = f"s{i}"
    fc += f";[1:a]volume=1.6,apad[a]"
    run([*inputs, "-filter_complex", fc, "-map", f"[{last}]", "-map", "[a]", "-t", f"{length}", *V, *A, out])
    return out

parts = []
parts.append(card("p01_title", f"{CARDS}/card-title.png", f"{VO}/eric_0.mp3"))
parts.append(screen("p02_overview", 1.7, 13.6, f"{VO}/eric_1.mp3"))
parts.append(screen("p03_heating", 17.2, 35.7, f"{VO}/eric_2.mp3"))
parts.append(screen("p04_door", 45.5, 58.0, f"{VO}/eric_3.mp3"))
parts.append(ipad_call("p05_call", 7.2, IPAD_OFFSET + 51.2, [
    (2.8, 9.95, "AI voice agent", "Hello, this is the booking assistant from reltix property management. Am I speaking with Hauswerk Aachen? Do you have a minute to book a repair job?"),
    (10.8, 12.9, "Hauswerk Aachen", "Yes."),
    (13.25, 20.2, "AI voice agent", "Thank you. I'm calling about a repair at Musterstraße 12, 52062 Aachen."),
    (20.2, 25.4, "AI voice agent", "The balcony door there no longer closes properly, and its handle is loose."),
    (25.4, 31.6, "AI voice agent", "When could someone from your team come by in the next three working days, between eight and seventeen?"),
    (32.95, 38.6, "Hauswerk Aachen", "Monday at nine in the morning, and Monday at two in the afternoon."),
    (40.4, 50.1, "AI voice agent", "Just to confirm: that's Monday, the 23rd of November at nine in the morning, and Monday at two in the afternoon. Is that correct?"),
    (50.5, 52.2, "Hauswerk Aachen", "Yes."),
]))
parts.append(screen("p07_slots", 63.0, 72.5, f"{VO}/eric_4.mp3"))
parts.append(screen("p08_done", 76.4, 105.3, f"{VO}/eric_5_synced.mp3", pad=0, lead=0))
parts.append(screen("p09_clarify", 105.35, 127.4, f"{VO}/eric_6.mp3"))
parts.append(card("p10_connector", f"{CARDS}/card-connector.png", f"{VO}/eric_7.mp3"))
parts.append(card("p11_end", f"{CARDS}/card-end.png", f"{VO}/eric_8.mp3", pad=0.4))

with open(f"{OUT}/list.txt", "w") as fh:
    for p in parts:
        fh.write(f"file '{p}'\n")
final = f"{S}/centrix-fix-pitch.mp4"
run(["-f", "concat", "-safe", "0", "-i", f"{OUT}/list.txt", *V, *A, "-movflags", "+faststart", final])
total = dur(final)
print(json.dumps({p.split('/')[-1]: round(dur(p), 2) for p in parts}, indent=1))
print("FINAL", final, round(total, 2), "s")
