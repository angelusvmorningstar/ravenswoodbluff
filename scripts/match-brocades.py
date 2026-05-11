#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""One-shot: match script-named source brocades to the 28 trimmed colour brocades
by sampling a representative central colour from each PNG and finding the
nearest neighbour in RGB space.
"""
import sys
from pathlib import Path
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

ROOT       = Path(__file__).resolve().parent.parent
SOURCES    = ROOT.parent / 'Clocktower' / 'Backgrounds' / 'Assets'
DEPLOYED   = ROOT / 'public' / 'backgrounds'

# Scripts the user wants matched (the 11 with existing JSONs + the 7 missing
# rosters — full set of 18 since we have all 18 source brocades anyway).
WANTED = [
    'Clamour of Rooks', 'Court of Miracles', 'Double Trouble',
    'Dread of Winter', 'Fool Moon', 'Gentle Night', 'Hunger Games',
    'Knights & Crosses', 'Lemming Jeopardy', 'Monstrous Regiment',
    'Murder go Round', 'Pride & Gloom', 'Purple Reign', 'Ring of Proses',
    'Sugar & Spice', 'The Iron Curtain', 'The Widening Gyre',
    'Unbroken Slumber',
]

# 28 deployed brocade ids (excluding non-brocade files like night-sheet, parchment, back).
DEPLOYED_IDS = [
    'navy-blue', 'deep-indigo', 'steel-blue', 'royal-blue', 'cerulean',
    'deep-violet', 'purple', 'violet', 'dark-plum',
    'teal', 'deep-teal', 'jade', 'forest-green', 'emerald',
    'crimson', 'burgundy', 'wine', 'rust',
    'coral', 'warm-peach', 'dusty-rose', 'rose-pink', 'dusty-pink', 'lilac',
    'antique-gold', 'burnt-amber', 'warm-grey',
]

def central_average(path: Path):
    """Average RGB over the central 50% of the image, ignoring fully-transparent
    pixels. Brocades have ornate edges; the centre tends to be the dominant
    base colour."""
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    box = (w // 4, h // 4, 3 * w // 4, 3 * h // 4)
    crop = img.crop(box)
    pixels = crop.getdata()
    r_sum = g_sum = b_sum = count = 0
    for r, g, b, a in pixels:
        if a < 128:
            continue
        r_sum += r; g_sum += g; b_sum += b; count += 1
    if count == 0:
        return None
    return (r_sum // count, g_sum // count, b_sum // count)

def dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b))

def main():
    deployed = {}
    for did in DEPLOYED_IDS:
        path = DEPLOYED / f'{did}.png'
        if not path.exists():
            print(f'WARN missing deployed: {path}', file=sys.stderr)
            continue
        deployed[did] = central_average(path)

    print(f'{"Script":<22} {"Source RGB":<18} {"Best match":<16} {"Match RGB":<18} {"d":>6}')
    print('-' * 86)
    for name in WANTED:
        src = SOURCES / f'{name} Brocade.png'
        if not src.exists():
            print(f'{name:<22} (source missing)')
            continue
        s_rgb = central_average(src)
        best = min(deployed.items(), key=lambda kv: dist(s_rgb, kv[1]))
        bid, b_rgb = best
        d = int(dist(s_rgb, b_rgb) ** 0.5)
        print(f'{name:<22} rgb{s_rgb!s:<15} {bid:<16} rgb{b_rgb!s:<15} {d:>6}')

if __name__ == '__main__':
    main()
