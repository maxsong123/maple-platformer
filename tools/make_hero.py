"""Cut the 4 concept poses into a game sprite sheet (64x56 frames).
Frames: 0-1 idle, 2-5 walk, 6 jump, 7-9 attack, 10 hurt."""
from PIL import Image, ImageFilter
import numpy as np, math
SRC='/cursor/stores/user/grok-bot/agents/cd1ec2ac-8fe3-4475-92d2-34ebcdc54542/assets/3325b863d36f0b8fad70c7ee057ad057da37c78496abebed00d0dcb2c60c9968.jpg'
OUT='public/assets/hero.png'
FW,FH=64,56
S=8.0  # downscale factor (~384px -> 48px)
src=Image.open(SRC).convert('RGB')
A=np.array(src).astype(int)
boxes=[(47,150,295,534),(329,153,575,531),(610,152,889,500),(901,162,1257,531)]
OUTLINE=(34,22,18,255)

def cut(i):
    x0,y0,x1,y1=boxes[i]
    pad=4
    x0-=pad;y0-=pad;x1+=pad;y1+=pad
    reg=A[y0:y1,x0:x1]
    # white-ish background -> transparent; flood-ish by threshold
    wh=(reg.min(axis=2)>222)&((reg.max(axis=2)-reg.min(axis=2))<22)
    alpha=np.where(wh,0,255).astype(np.uint8)
    rgba=np.dstack([reg.astype(np.uint8),alpha])
    im=Image.fromarray(rgba,'RGBA')
    w=round(im.width/S); h=round(im.height/S)
    # premultiplied-ish downscale: resize color with box, alpha with box then threshold
    col=im.convert('RGB').resize((w,h),Image.BOX)
    al=Image.fromarray(alpha).resize((w,h),Image.BOX)
    a=np.array(al)>110
    c=np.array(col)
    out=np.zeros((h,w,4),np.uint8); out[...,:3]=c; out[...,3]=np.where(a,255,0)
    return out,(x0,y0)

def quantize(arr,n=32):
    im=Image.fromarray(arr,'RGBA')
    rgb=im.convert('RGB').quantize(colors=n,method=Image.MEDIANCUT,dither=Image.NONE).convert('RGB')
    o=np.array(rgb); res=arr.copy(); res[...,:3]=o; return res

def boost(arr):
    # punch up saturation/contrast a bit for small size readability
    im=Image.fromarray(arr,'RGBA')
    from PIL import ImageEnhance
    rgb=ImageEnhance.Color(im.convert('RGB')).enhance(1.25)
    rgb=ImageEnhance.Contrast(rgb).enhance(1.1)
    r=np.array(rgb); arr=arr.copy(); arr[...,:3]=r; return arr

def outline(arr):
    a=arr[...,3]>0
    p=np.pad(a,1)
    nb=p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:]
    edge=nb&~a
    arr=arr.copy(); arr[edge]=OUTLINE
    return arr

def place(arr,frame,dx=0,dy=0):
    """paste arr onto frame bottom-centered (feet on bottom-2)."""
    h,w=arr.shape[:2]
    ox=(FW-w)//2+dx; oy=FH-2-h+dy
    for y in range(h):
        for x in range(w):
            if arr[y,x,3]:
                X,Y=ox+x,oy+y
                if 0<=X<FW and 0<=Y<FH: frame[Y,X]=arr[y,x]
    return ox,oy

BLADE_HI=(238,244,250,255); BLADE=(190,200,212,255); BLADE_LO=(120,130,146,255)
GOLD=(232,180,60,255); GOLD_LO=(160,108,30,255); GRIP=(98,58,30,255)

def put(fr,x,y,c,under=True):
    x,y=int(round(x)),int(round(y))
    if 0<=x<FW and 0<=y<FH and (not under or fr[y,x,3]==0 or tuple(fr[y,x])==OUTLINE):
        fr[y,x]=c

def sword(fr,hx,hy,ang,length=13,over=False):
    """draw a pixel sword whose grip is at (hx,hy), blade pointing at angle (deg, 0=right, 90=down)."""
    dx,dy=math.cos(math.radians(ang)),math.sin(math.radians(ang))
    px,py=-dy,dx
    layer=np.zeros_like(fr)
    def P(x,y,c):
        x,y=int(round(x)),int(round(y))
        if 0<=x<FW and 0<=y<FH: layer[y,x]=c
    # pommel/grip behind the hand
    for t in (-2,-1): P(hx+dx*t,hy+dy*t,GRIP)
    P(hx-dx*3,hy-dy*3,GOLD)
    # crossguard
    for s in (-2,-1,0,1,2): P(hx+dx*1.5+px*s,hy+dy*1.5+py*s,GOLD if abs(s)<2 else GOLD_LO)
    # blade (2px wide)
    for i in range(2*length):
        t=2.5+i*0.5
        P(hx+dx*t,hy+dy*t,BLADE_HI)
        P(hx+dx*t+px*0.9,hy+dy*t+py*0.9,BLADE)
    P(hx+dx*(2.5+length),hy+dy*(2.5+length),BLADE_HI)
    # outline the sword layer
    a=layer[...,3]>0
    p=np.pad(a,1); nb=p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:]
    layer[nb&~a]=OUTLINE
    # composite: sword goes UNDER body pixels except keep hand on top -> draw where body is empty
    m=(layer[...,3]>0)&((fr[...,3]==0)|over)
    fr[m]=layer[m]

poses=[]
for i in range(4):
    arr,org=cut(i)
    arr=outline(quantize(boost(arr)))
    poses.append((arr,org))

# pose1: erase the muddy downscaled sword and redraw a crisp one later
p0=poses[0][0].copy(); p0[35:,23:]=0
p0[...,3]=np.where(p0[...,3]>0,255,0)
# strip outline pixels left floating after erase
def clean(a):
    body=(a[...,3]>0)&~np.all(a==OUTLINE,axis=2)
    p=np.pad(body,1); nb=p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:]
    lone=np.all(a==OUTLINE,axis=2)&~nb
    a[lone]=0; return a
p0=clean(p0); poses[0]=(p0,poses[0][1])
def hand_local(i,hx,hy):
    """convert full-res hand coords to downscaled pose coords"""
    org=poses[i][1]; return ((hx-org[0])/S,(hy-org[1])/S)

frames=[]
def newf(): return np.zeros((FH,FW,4),np.uint8)

# idle 0/1 (pose1 has sword already; idle1 = 1px breathe via squash)
hand1=hand_local(0,217,430)
f=newf(); ox,oy=place(poses[0][0],f); sword(f,ox+hand1[0]+1,oy+hand1[1],52,10); frames.append(f)
p=poses[0][0]; h,w=p.shape[:2]
sq=np.array(Image.fromarray(p).resize((w,h-1),Image.NEAREST))
f=newf(); ox,oy=place(sq,f); sword(f,ox+hand1[0]+1,oy+hand1[1],52,10); frames.append(f)
# walk: pose2+sword, pose2 bob, pose1 (contact), pose1 bob
hand2=hand_local(1,530,420)
for dy in (0,-1):
    f=newf(); ox,oy=place(poses[1][0],f,dy=dy)
    sword(f,ox+hand2[0]+1,oy+hand2[1]+1,50,10); frames.append(f)
for dy in (0,-1):
    f=newf(); ox,oy=place(poses[0][0],f,dy=dy); sword(f,ox+hand1[0]+1,oy+hand1[1],52,10); frames.append(f)
# reorder so walk = pose2, pose1, pose2b, pose1b (alternating)
frames[2:6]=[frames[2],frames[4],frames[3],frames[5]]
# jump: pose3 + sword trailing down-back
hand3=hand_local(2,830,362)
f=newf(); ox,oy=place(poses[2][0],f)
sword(f,ox+hand3[0]+1,oy+hand3[1]+1,60,10); frames.append(f)
# attack0 windup: pose3 body w/ sword raised up-back
f=newf(); ox,oy=place(poses[2][0],f,dx=-2)
sword(f,ox+hand3[0]+1,oy+hand3[1],-70,11,over=True); frames.append(f)
# attack1/2: pose4 (sword forward, already in art), attack2 lunges 2px
f=newf(); place(poses[3][0],f,dx=4); frames.append(f)
f=newf(); place(poses[3][0],f,dx=6); frames.append(f)
# hurt: jump pose tinted reddish-white
f=frames[6].copy(); m=f[...,3]>0
f[m,:3]=np.clip(f[m,:3].astype(int)*0.6+np.array([110,60,60]),0,255).astype(np.uint8); frames.append(f)

sheet=np.zeros((FH,FW*len(frames),4),np.uint8)
for i,f in enumerate(frames): sheet[:,i*FW:(i+1)*FW]=f
Image.fromarray(sheet,'RGBA').save(OUT)
Image.fromarray(sheet,'RGBA').resize((sheet.shape[1]*4,FH*4),Image.NEAREST).save('/tmp/hero_preview.png')
print('frames',len(frames),[p[0].shape for p in poses])
