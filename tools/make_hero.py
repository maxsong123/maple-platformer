"""Build the hero atlas source frames from the style-A pose sheet.

Frames written to tools/hero-frames/ as individual 64x56 PNGs:
  hero-idle-0/1, hero-walk-0..7, hero-jump-0, hero-attack-0..2, hero-hurt-0

Walk is an 8-frame cycle (contact, down, passing, up, and the opposite step)
with body bob, cape sway, arm/sword swing, and planted vs. lifted boots.
The sword is redrawn so it stays visible in every frame.

Idle / jump / attack / hurt still come from the four concept poses.
Pack the frames with tools/pack_hero.mjs (free-tex-packer-cli).
"""
from __future__ import annotations
from pathlib import Path
import math
import shutil
import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'art/concepts/hero_pose_sheet.jpg'
FRAME_DIR = ROOT / 'tools/hero-frames'
PREVIEW = ROOT / 'tools/hero-preview.png'
FW, FH = 64, 56
S = 8.0  # downscale factor (~384px -> 48px)
OUTLINE = (34, 22, 18, 255)

BLADE_HI = (238, 244, 250, 255)
BLADE = (190, 200, 212, 255)
BLADE_LO = (120, 130, 146, 255)
GOLD = (232, 180, 60, 255)
GOLD_LO = (160, 108, 30, 255)
GRIP = (98, 58, 30, 255)
PANT = (90, 52, 28, 255)
PANT_LO = (61, 27, 1, 255)

src = Image.open(SRC).convert('RGB')
A = np.array(src).astype(int)
boxes = [(47, 150, 295, 534), (329, 153, 575, 531), (610, 152, 889, 500), (901, 162, 1257, 531)]


def cut(i):
    x0, y0, x1, y1 = boxes[i]
    pad = 4
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
    reg = A[y0:y1, x0:x1]
    wh = (reg.min(axis=2) > 222) & ((reg.max(axis=2) - reg.min(axis=2)) < 22)
    alpha = np.where(wh, 0, 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([reg.astype(np.uint8), alpha]), 'RGBA')
    w = round(im.width / S); h = round(im.height / S)
    col = im.convert('RGB').resize((w, h), Image.BOX)
    al = Image.fromarray(alpha).resize((w, h), Image.BOX)
    a = np.array(al) > 110
    c = np.array(col)
    out = np.zeros((h, w, 4), np.uint8); out[..., :3] = c; out[..., 3] = np.where(a, 255, 0)
    return out, (x0, y0)


def quantize(arr, n=32):
    im = Image.fromarray(arr, 'RGBA')
    rgb = im.convert('RGB').quantize(colors=n, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    o = np.array(rgb); res = arr.copy(); res[..., :3] = o; return res


def boost(arr):
    im = Image.fromarray(arr, 'RGBA')
    rgb = ImageEnhance.Color(im.convert('RGB')).enhance(1.25)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.1)
    r = np.array(rgb); arr = arr.copy(); arr[..., :3] = r; return arr


def outline(arr):
    a = arr[..., 3] > 0
    p = np.pad(a, 1)
    nb = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    edge = nb & ~a
    arr = arr.copy(); arr[edge] = OUTLINE
    return arr


def place(arr, frame, dx=0, dy=0):
    """Paste arr onto frame bottom-centered (feet on bottom-2)."""
    h, w = arr.shape[:2]
    ox = (FW - w) // 2 + dx
    oy = FH - 2 - h + dy
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3]:
                X, Y = ox + x, oy + y
                if 0 <= X < FW and 0 <= Y < FH:
                    frame[Y, X] = arr[y, x]
    return ox, oy


def put_layer(fr, layer, over=False):
    m = (layer[..., 3] > 0) & ((fr[..., 3] == 0) | over)
    fr[m] = layer[m]


def sword(fr, hx, hy, ang, length=13, over=False):
    """Draw a pixel sword whose grip is at (hx, hy), blade pointing at angle (deg, 0=right, 90=down)."""
    dx, dy = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    px, py = -dy, dx
    layer = np.zeros_like(fr)

    def P(x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < FW and 0 <= y < FH:
            layer[y, x] = c

    for t in (-2, -1):
        P(hx + dx * t, hy + dy * t, GRIP)
    P(hx - dx * 3, hy - dy * 3, GOLD)
    for s in (-2, -1, 0, 1, 2):
        P(hx + dx * 1.5 + px * s, hy + dy * 1.5 + py * s, GOLD if abs(s) < 2 else GOLD_LO)
    for i in range(2 * length):
        t = 2.5 + i * 0.5
        P(hx + dx * t, hy + dy * t, BLADE_HI)
        P(hx + dx * t + px * 0.9, hy + dy * t + py * 0.9, BLADE)
    P(hx + dx * (2.5 + length), hy + dy * (2.5 + length), BLADE_HI)
    a = layer[..., 3] > 0
    p = np.pad(a, 1); nb = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    layer[nb & ~a] = OUTLINE
    put_layer(fr, layer, over=over)


def clean(a):
    body = (a[..., 3] > 0) & ~np.all(a == OUTLINE, axis=2)
    p = np.pad(body, 1); nb = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    lone = np.all(a == OUTLINE, axis=2) & ~nb
    a[lone] = 0
    return a


def is_outline(p):
    return p[3] > 0 and tuple(p) == OUTLINE


def is_blade(p):
    if p[3] == 0:
        return False
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    if tuple(p) == OUTLINE:
        return False
    # silver blade / pale highlight (not skin, not boot tan)
    return (r > 160 and g > 160 and b > 140 and (b + 10) >= r - 20)


def erase_sword_pixels(arr, x0=34):
    """Remove the pale blade on the right side so we can redraw it."""
    out = arr.copy()
    h, w = out.shape[:2]
    for y in range(h):
        for x in range(max(0, x0), w):
            if is_blade(out[y, x]):
                out[y, x] = 0
    return clean(out)


def erase_below(arr, y_cut, x0=0, x1=None):
    out = arr.copy()
    h, w = out.shape[:2]
    if x1 is None:
        x1 = w
    out[y_cut:h, x0:x1] = 0
    return clean(out)


def extract_stamp(arr, x0, y0, x1, y1, keep):
    """Crop a region, keeping only pixels where keep(p) is true."""
    stamp = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    src = arr[y0:y1, x0:x1]
    for y in range(src.shape[0]):
        for x in range(src.shape[1]):
            if src[y, x, 3] and keep(src[y, x]):
                stamp[y, x] = src[y, x]
    return stamp, (x0, y0)


def keep_boot(p):
    if p[3] == 0:
        return False
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    if is_blade(p):
        return False
    # outline, brown leather, pale boot highlight; drop green tunic/grass
    if tuple(p) == OUTLINE:
        return True
    if g > r + 8 and g > b + 8:
        return False
    return r + g + b > 20


def blit(fr, stamp, x, y, over=True):
    sh, sw = stamp.shape[:2]
    for sy in range(sh):
        for sx in range(sw):
            if stamp[sy, sx, 3] == 0:
                continue
            X, Y = int(round(x)) + sx, int(round(y)) + sy
            if 0 <= X < FW and 0 <= Y < FH:
                if over or fr[Y, X, 3] == 0 or tuple(fr[Y, X]) == OUTLINE:
                    fr[Y, X] = stamp[sy, sx]


def shift_mask(arr, mask, dx, dy):
    """Move masked pixels by (dx, dy) pixels. Leaves a transparent hole."""
    if dx == 0 and dy == 0:
        return arr
    out = arr.copy()
    moved = np.zeros_like(arr)
    ys, xs = np.where(mask)
    out[ys, xs] = 0
    for y, x in zip(ys, xs):
        X, Y = x + dx, y + dy
        if 0 <= X < arr.shape[1] and 0 <= Y < arr.shape[0]:
            moved[Y, X] = arr[y, x]
    # only write moved pixels into empty (or originally-masked) spots
    empty = out[..., 3] == 0
    out[empty] = moved[empty]
    # if destination was occupied, prefer the moved cape/head (over)
    dest = moved[..., 3] > 0
    out[dest] = moved[dest]
    return clean(out)


def cape_mask(arr):
    """Left-side green cloak, below the hair, not the front tunic."""
    h, w = arr.shape[:2]
    m = np.zeros((h, w), bool)
    # hair ends ~row 26 of the placed 64x56 frame; cape lives on the left
    for y in range(28, 50):
        for x in range(0, 28):
            p = arr[y, x]
            if p[3] == 0:
                continue
            r, g, b = int(p[0]), int(p[1]), int(p[2])
            if tuple(p) == OUTLINE or (g >= r and g >= b - 4 and g > 25):
                m[y, x] = True
    return m


def head_mask(arr):
    """Hair + face, roughly the top of the sprite."""
    h, w = arr.shape[:2]
    m = np.zeros((h, w), bool)
    # stop before the shoulders/tunic collar (~row 27-29)
    for y in range(0, 28):
        for x in range(0, w):
            if arr[y, x, 3]:
                m[y, x] = True
    return m


def draw_leg(fr, foot_x, sole_y, lifted, front, hem_y=46):
    """Simple pant-leg connector from the tunic hem down to the boot stamp top."""
    # boot top sits about 6-7 px above the sole for a planted foot
    top = sole_y - (7 if not lifted else 5)
    mid_x = foot_x
    for y in range(min(hem_y, top), sole_y - 2):
        t = (y - hem_y) / max(1, (sole_y - 2 - hem_y))
        width = 2 if front else 1
        col = PANT if (y + mid_x) % 3 else PANT_LO
        for dx in range(-width, width + 1):
            x = int(round(mid_x + dx))
            if 0 <= x < FW and 0 <= y < FH and (fr[y, x, 3] == 0 or tuple(fr[y, x]) == OUTLINE):
                fr[y, x] = col if abs(dx) < width else OUTLINE
        # outline sides
        for dx in (-width - 1, width + 1):
            x = int(round(mid_x + dx))
            if 0 <= x < FW and 0 <= y < FH and fr[y, x, 3] == 0:
                fr[y, x] = OUTLINE


# ── cut & tidy the four concept poses ──────────────────────────────────
poses = []
for i in range(4):
    arr, org = cut(i)
    arr = outline(quantize(boost(arr)))
    poses.append((arr, org))

# pose 0: erase the muddy downscaled sword (redraw later)
p0 = poses[0][0].copy()
p0[35:, 23:] = 0
p0[..., 3] = np.where(p0[..., 3] > 0, 255, 0)
p0 = clean(p0)
poses[0] = (p0, poses[0][1])


def hand_local(i, hx, hy):
    org = poses[i][1]
    return ((hx - org[0]) / S, (hy - org[1]) / S)


def newf():
    return np.zeros((FH, FW, 4), np.uint8)


# Place each concept pose onto a 64x56 canvas (no sword yet) so we can
# sample boots in game-frame coordinates and reuse the same placement.
placed = []  # (frame, ox, oy) without the procedural sword
hand = [
    hand_local(0, 217, 430),
    hand_local(1, 530, 420),
    hand_local(2, 830, 362),
    hand_local(3, 0, 0),  # unused; attack pose already has a sword
]
for i in range(4):
    f = newf()
    ox, oy = place(poses[i][0], f)
    placed.append((f, ox, oy))

# Extract boot stamps from the idle (feet together) and stride poses.
# These are already on the 64x56 canvas.
idle_fr, _, _ = placed[0]
# Rebuild a temporary stride frame from pose 1 (includes its muddy sword — we filter that out)
stride_src = newf()
place(poses[1][0], stride_src)

boot_back, back_org = extract_stamp(stride_src, 20, 45, 32, 55, keep_boot)   # rear boot, stride
boot_front, front_org = extract_stamp(stride_src, 33, 45, 46, 55, keep_boot)  # forward boot, stride
boot_pass_l, passl_org = extract_stamp(idle_fr, 22, 46, 31, 55, keep_boot)
boot_pass_r, passr_org = extract_stamp(idle_fr, 30, 46, 40, 55, keep_boot)

# Bodies for walk: erase legs + residual blade so we can composite new ones.

def fill_small_holes(arr):
    """Fill 1px interior gaps (e.g. after a cape shift) with a neighbor color."""
    out = arr.copy()
    solid = out[..., 3] > 0
    p = np.pad(solid, 1)
    n = (p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:])
    ys, xs = np.where((~solid) & (n >= 3))
    for y, x in zip(ys, xs):
        cols = []
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < arr.shape[0] and 0 <= xx < arr.shape[1] and out[yy, xx, 3]:
                if tuple(out[yy, xx]) != OUTLINE:
                    cols.append(out[yy, xx])
        if cols:
            out[y, x] = np.median(np.stack(cols), axis=0).astype(np.uint8)
    return out


def walk_body(src_fr, cut_y=47):
    b = erase_sword_pixels(src_fr.copy(), x0=34)
    b = erase_below(b, cut_y)
    return clean(b)


body_pass = walk_body(idle_fr, 47)
# stride pose placed into a fresh canvas, then cleaned
stride_clean = erase_sword_pixels(stride_src.copy(), x0=34)
# also strip the original painted sword near the hand (gold/grip leftovers)
# wipe a triangle on the lower-right of the stride body
stride_clean[40:, 36:] = 0
body_stride = walk_body(stride_clean, 47)

# ── assemble named frames ──────────────────────────────────────────────
frames = {}  # name -> 64x56 array


def add(name, fr):
    frames[name] = fr


# idle 0/1 (pose 0 + sword; idle 1 = 1px breathe via squash)
f = newf(); ox, oy = place(poses[0][0], f)
sword(f, ox + hand[0][0] + 1, oy + hand[0][1], 52, 10)
add('hero-idle-0', f)
p = poses[0][0]; h, w = p.shape[:2]
sq = np.array(Image.fromarray(p).resize((w, h - 1), Image.NEAREST))
f = newf(); ox, oy = place(sq, f)
sword(f, ox + hand[0][0] + 1, oy + hand[0][1], 52, 10)
add('hero-idle-1', f)

# ── 8-frame walk cycle ─────────────────────────────────────────────────
# Classic four poses, then the opposite step:
#   0 contact R, 1 down R, 2 passing, 3 up L,
#   4 contact L, 5 down L, 6 passing, 7 up R
# bob > 0 lowers the body (weight into the planted foot).
# Boot stamp origins are the top-left of each cropped stamp; we position
# by the stamp's top-left so the sole stays near y=53 when planted.

WALK = [
    # body: 'stride' or 'pass'; bob; lean; cape_dx,cape_dy; head_dy;
    # sword ang, hand_dx, hand_dy;
    # back boot (stamp, dx, dy, lifted), front boot (stamp, dx, dy, lifted)
    # dx/dy are added to the stamp's original top-left.
    # contact R: near (front) leg planted forward, far leg back
    dict(body='stride', bob=1, lean=1, cape=(-1, 1), sang=66, hdx=0, hdy=1,
         boots=[
             ('far',  boot_back,  back_org,  0, 0, False),
             ('near', boot_front, front_org, 0, 0, False),
         ]),
    # down R: weight on front foot, rear foot peeling up
    dict(body='stride', bob=2, lean=2, cape=(-2, 1), sang=58, hdx=0, hdy=2,
         boots=[
             ('far',  boot_back,  back_org,  1, -3, True),
             ('near', boot_front, front_org,-1,  1, False),
         ]),
    # passing: left leg swings through, feet under the body
    dict(body='pass', bob=0, lean=0, cape=(-1, 0), sang=48, hdx=1, hdy=1,
         boots=[
             ('far',  boot_pass_l, passl_org,  1, -3, True),
             ('near', boot_pass_r, passr_org, -1,  0, False),
         ]),
    # up L: left (far) foot reaches forward, body high, near toes almost off
    dict(body='pass', bob=-1, lean=0, cape=(0, -1), sang=38, hdx=2, hdy=0,
         boots=[
             ('far',  boot_front,  front_org,  1, -2, True),
             ('near', boot_pass_l, passl_org, -2,  0, False),
         ]),
    # contact L: far leg planted forward, near leg back (draw near on top)
    dict(body='stride', bob=1, lean=1, cape=(-1, 1), sang=32, hdx=2, hdy=0,
         boots=[
             ('far',  boot_front, front_org,  0, -1, False),  # forward, slightly "further" (up)
             ('near', boot_back,  back_org,  -1,  1, False),  # back, closer to camera
         ]),
    # down L: weight on the far/forward foot, near foot peeling up
    dict(body='stride', bob=2, lean=2, cape=(-2, 1), sang=40, hdx=1, hdy=1,
         boots=[
             ('far',  boot_front, front_org, -1,  0, False),
             ('near', boot_back,  back_org,   1, -3, True),
         ]),
    # passing: right (near) leg swings through
    dict(body='pass', bob=0, lean=0, cape=(-1, 0), sang=52, hdx=0, hdy=1,
         boots=[
             ('far',  boot_pass_l, passl_org, -1,  0, False),
             ('near', boot_pass_r, passr_org,  1, -3, True),
         ]),
    # up R: near foot reaches forward, body high
    dict(body='pass', bob=-1, lean=0, cape=(0, -1), sang=62, hdx=0, hdy=1,
         boots=[
             ('far',  boot_pass_l, passl_org,  1,  0, False),
             ('near', boot_front,  front_org,  0, -2, True),
         ]),
]


def compose_walk(spec):
    fr = newf()
    src_body = body_stride if spec['body'] == 'stride' else body_pass
    # place body with bob + lean (lean is extra x shift)
    # body arrays are already 64x56 canvases, so "place" would double-offset.
    # Just roll/shift pixels inside the canvas.
    bob, lean = spec['bob'], spec['lean']
    body = np.zeros_like(src_body)
    h, w = src_body.shape[:2]
    for y in range(h):
        for x in range(w):
            if src_body[y, x, 3] == 0:
                continue
            X, Y = x + lean, y + bob
            if 0 <= X < FW and 0 <= Y < FH:
                body[Y, X] = src_body[y, x]
    body = clean(body)

    # cape sway (lags the body a little). No separate head lag — at this
    # size a 1px neck gap looks like a decapitation.
    cdx, cdy = spec['cape']
    body = shift_mask(body, cape_mask(body), cdx, cdy)

    # legs first (under the tunic), then body on top of the connectors,
    # then boots over empty pixels / outlines at the bottom.
    # Draw pant connectors + boots onto a layer, body over, boots over again at soles.
    legs = np.zeros_like(fr)

    def boot_pos(entry):
        layer, stamp, org, dx, dy, lifted = entry
        x = org[0] + dx + lean
        if lifted:
            y = org[1] + dy + max(bob, 0)  # lifted foot follows the body only when it drops
        else:
            y = org[1] + dy  # planted sole stays on the ground
        return layer, stamp, x, y, lifted

    placed_boots = [boot_pos(e) for e in spec['boots']]
    for layer, stamp, x, y, lifted in placed_boots:
        hem = 46 + bob
        sole = y + stamp.shape[0] - 1
        cx = x + stamp.shape[1] / 2
        draw_leg(legs, cx, sole, lifted, front=(layer == 'near'), hem_y=hem)
        blit(legs, stamp, x, y, over=True)

    # composite: legs, then body (tunic covers top of legs), then boots again
    # so soles aren't eaten by a too-long tunic. Near boot is blit last.
    fr = legs.copy()
    put_layer(fr, body, over=True)
    for layer, stamp, x, y, lifted in placed_boots:
        blit(fr, stamp, x, y, over=True)

    # sword / arm — hand tracks the body bob & lean, plus a swing offset
    # Use the idle hand as the base (works for both bodies, close enough)
    hx = 32 + hand[0][0] + 1 + lean + spec['hdx']
    # oy of the idle placement + local hand y, plus bob
    # idle body was placed with place(); hand was ox+hand+1, oy+hand
    # On the 64x56 canvas the idle hand is already at its absolute pixel.
    # We recorded ox, oy from place() of pose 0:
    _, ox0, oy0 = placed[0]
    hx = ox0 + hand[0][0] + 1 + lean + spec['hdx']
    hy = oy0 + hand[0][1] + bob + spec['hdy']
    sword(fr, hx, hy, spec['sang'], 10, over=True)
    return clean(fill_small_holes(fr))


for i, spec in enumerate(WALK):
    add(f'hero-walk-{i}', compose_walk(spec))

# jump: pose 3 + sword trailing down-back
f = newf(); ox, oy = place(poses[2][0], f)
sword(f, ox + hand[2][0] + 1, oy + hand[2][1] + 1, 60, 10)
add('hero-jump-0', f)

# attack0 windup: pose 3 body w/ sword raised up-back
f = newf(); ox, oy = place(poses[2][0], f, dx=-2)
sword(f, ox + hand[2][0] + 1, oy + hand[2][1], -70, 11, over=True)
add('hero-attack-0', f)

# attack1/2: pose 4 (sword already in the art), attack2 lunges 2px
f = newf(); place(poses[3][0], f, dx=4)
add('hero-attack-1', f)
f = newf(); place(poses[3][0], f, dx=6)
add('hero-attack-2', f)

# hurt: jump pose tinted reddish-white
f = frames['hero-jump-0'].copy()
m = f[..., 3] > 0
f[m, :3] = np.clip(f[m, :3].astype(int) * 0.6 + np.array([110, 60, 60]), 0, 255).astype(np.uint8)
add('hero-hurt-0', f)

# ── write individual frames + a linear preview strip ───────────────────
if FRAME_DIR.exists():
    shutil.rmtree(FRAME_DIR)
FRAME_DIR.mkdir(parents=True)

order = (
    [f'hero-idle-{i}' for i in range(2)]
    + [f'hero-walk-{i}' for i in range(8)]
    + ['hero-jump-0']
    + [f'hero-attack-{i}' for i in range(3)]
    + ['hero-hurt-0']
)
assert all(n in frames for n in order), set(order) - set(frames)

for name in order:
    Image.fromarray(frames[name], 'RGBA').save(FRAME_DIR / f'{name}.png')

# preview strip at 4x, labeled by a small separator
pad = 4
strip = Image.new('RGBA', (len(order) * (FW * 4 + pad) + pad, FH * 4 + pad * 2), (24, 24, 32, 255))
for i, name in enumerate(order):
    fr = Image.fromarray(frames[name], 'RGBA').resize((FW * 4, FH * 4), Image.NEAREST)
    strip.paste(fr, (pad + i * (FW * 4 + pad), pad), fr)
strip.save(PREVIEW)

# also a walk-only 4x strip for the shots folder later
walk_names = [f'hero-walk-{i}' for i in range(8)]
wstrip = Image.new('RGBA', (len(walk_names) * (FW * 4 + pad) + pad, FH * 4 + pad * 2), (24, 24, 32, 255))
for i, name in enumerate(walk_names):
    fr = Image.fromarray(frames[name], 'RGBA').resize((FW * 4, FH * 4), Image.NEAREST)
    wstrip.paste(fr, (pad + i * (FW * 4 + pad), pad), fr)
wstrip.save(ROOT / 'tools/walk-preview.png')

print('wrote', len(order), 'frames to', FRAME_DIR)
print('preview', PREVIEW)
