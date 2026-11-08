"""Jana muzik latar ringkas (bebas hak cipta) — lo-fi ceria, 96 BPM."""
import sys
import wave

import numpy as np

SR = 44100
BPM = 96
BEAT = 60 / BPM
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 32.0
OUT = sys.argv[2] if len(sys.argv) > 2 else "muzik.wav"

n = int(SR * DUR)
mix = np.zeros(n)


def note_freq(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, start_s):
    i = int(start_s * SR)
    if i >= n:
        return
    end = min(n, i + len(sig))
    mix[i:end] += sig[: end - i]


def env(length, a=0.01, r=0.3):
    t = np.arange(int(length * SR)) / SR
    e = np.minimum(1, t / a) * np.exp(-t / r)
    return t, e


# Progression: Cmaj7 - Am7 - Fmaj7 - G (setiap satu 1 bar = 4 beat)
chords = [
    [48, 52, 55, 59],
    [45, 48, 52, 55],
    [41, 45, 48, 52],
    [43, 47, 50, 55],
]
bar = 4 * BEAT
nbars = int(DUR / bar) + 1

for b in range(nbars):
    ch = chords[b % 4]
    t0 = b * bar
    # Pad lembut
    t = np.arange(int(bar * SR)) / SR
    pad = np.zeros_like(t)
    for m in ch:
        f = note_freq(m + 12)
        pad += np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t + 0.5)
    e = np.minimum(1, t / 0.4) * np.minimum(1, (bar - t) / 0.3)
    add(0.035 * pad * e, t0)
    # Bass
    tb, eb = env(BEAT * 1.8, 0.005, 0.5)
    fb = note_freq(ch[0] - 12)
    bass = np.sin(2 * np.pi * fb * tb) + 0.4 * np.sin(2 * np.pi * 2 * fb * tb)
    add(0.16 * bass * eb, t0)
    add(0.12 * bass * eb, t0 + 2.5 * BEAT)
    # Arpeggio pluck (1/8 note)
    pattern = [0, 1, 2, 3, 2, 1, 2, 3]
    for k, p in enumerate(pattern):
        tp, ep = env(0.45, 0.003, 0.16)
        f = note_freq(ch[p] + 24)
        pl = np.sin(2 * np.pi * f * tp) + 0.25 * np.sin(2 * np.pi * 3 * f * tp)
        add(0.05 * pl * ep, t0 + k * BEAT / 2)
    # Dram (mula dari bar ke-2)
    if b >= 1:
        for k in range(4):
            tk, ek = env(0.35, 0.001, 0.09)
            kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-tk * 30)) * tk)
            if k in (0, 2):
                add(0.32 * kick * ek, t0 + k * BEAT)
            else:  # snare / clap
                ts, es = env(0.2, 0.001, 0.05)
                add(0.09 * np.random.randn(len(ts)) * es, t0 + k * BEAT)
        for k in range(8):  # hi-hat
            th, eh = env(0.06, 0.001, 0.015)
            hh = np.random.randn(len(th))
            hh = np.diff(hh, prepend=0)
            add(0.03 * hh * eh, t0 + k * BEAT / 2)

# Fade in/out & normalise
t = np.arange(n) / SR
fade = np.minimum(1, t / 1.0) * np.minimum(1, (DUR - t) / 2.5)
mix *= fade
mix = np.tanh(mix * 1.3)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.85

# Stereo dengan sedikit kelewatan
left = mix
right = np.concatenate([np.zeros(300), mix[:-300]])
stereo = (np.stack([left, right], axis=1) * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo.tobytes())
print("muzik:", OUT, f"{DUR:.1f}s")
