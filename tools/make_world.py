"""Procedurally author Maple-like world art: tiles, parallax bg, slime, coin, portal, fx, hud, digits."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np, math, random
random.seed(7)
OUT='public/assets/'
OL=(40,26,20,255)

def outline(arr,col=OL):
    a=arr[...,3]>0
    p=np.pad(a,1); nb=p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:]
    arr=arr.copy(); arr[nb&~a]=col; return arr

def sheet(frames,path):
    h=max(f.shape[0] for f in frames); w=frames[0].shape[1]
    s=np.zeros((h,w*len(frames),4),np.uint8)
    for i,f in enumerate(frames): s[:f.shape[0],i*w:(i+1)*w]=f
    Image.fromarray(s,'RGBA').save(path); return s

def hexc(h,a=255): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(a,)

# ---------------- TILES (32x32) ----------------
T=32
GR=[hexc('#4fa83a'),hexc('#6fcf47'),hexc('#a4ec6e'),hexc('#2f7a2c')]
DI=[hexc('#9a5a2c'),hexc('#b8733a'),hexc('#d18e4e'),hexc('#6e3d1f')]
def dirt(t,seed):
    rnd=random.Random(seed)
    t[:,:]=DI[1]
    for _ in range(14):
        x,y=rnd.randrange(T),rnd.randrange(T)
        c=rnd.choice([DI[0],DI[2]])
        t[y:y+2,x:x+2]=c
    for _ in range(3):  # pebbles
        x,y=rnd.randrange(2,T-5),rnd.randrange(10,T-4)
        t[y:y+3,x:x+4]=hexc('#cdb79a'); t[y+2,x:x+4]=hexc('#8f7a62'); t[y,x+1]=hexc('#efe3cf')
def grass_top(t,seed,full=True):
    rnd=random.Random(seed)
    for x in range(T):
        d=8+ (2 if (x//4+len(str(seed)))%3==0 else 0) + rnd.choice([0,0,1])
        t[0:d,x]=GR[1]; t[d:d+1,x]=GR[3]
        t[0:2,x]=GR[2]; t[2:3,x]=GR[1]
        if rnd.random()<0.25: t[3:5,x]=GR[0]
    # tiny blades on top edge
    for x in range(1,T,5): t[0,x]=hexc('#d4ff9a')
def tile_grass(kind):
    t=np.zeros((T,T,4),np.uint8); dirt(t,kind); grass_top(t,kind)
    if kind=='L':
        t[:,0:2]=DI[3]; t[0:10,0:2]=GR[3]; t[0,0:3]=(0,0,0,0); t[1,0]=(0,0,0,0)
    if kind=='R':
        t[:,-2:]=DI[3]; t[0:10,-2:]=GR[3]; t[0,-3:]=(0,0,0,0); t[1,-1]=(0,0,0,0)
    return t
def tile_dirt(kind):
    t=np.zeros((T,T,4),np.uint8); dirt(t,kind+'d')
    if kind=='L': t[:,0:2]=DI[3]
    if kind=='R': t[:,-2:]=DI[3]
    return t
WD=[hexc('#7a4a26'),hexc('#a0653a'),hexc('#c9874f'),hexc('#4b2a14')]
def tile_ledge(kind):
    """floating Maple ledge: grass cap over a wooden/stone slab, 18px tall, rest transparent"""
    t=np.zeros((T,T,4),np.uint8)
    t[0:18,:]=WD[1]
    for y in (7,12): t[y,:]=WD[0]
    for x in range(3,T,11): t[6:18,x]=WD[0]
    t[16:18,:]=WD[3]
    grass_top(t,kind)  # grass overrides top rows
    # hanging moss
    for x in range(2,T,7): t[18:18+random.randint(2,5),x:x+2]=GR[0]
    if kind=='L':
        t[:,0:2]=0; t[0:18,2]=OL; t[0:2,2:4]=0
    if kind=='R':
        t[:,-2:]=0; t[0:18,-3]=OL; t[0:2,-4:-2]=0
    t[18,:][t[17,:,3]>0]=OL[:4]
    return outline(t)
tiles=[tile_grass('L'),tile_grass('M'),tile_grass('R'),tile_dirt('L'),tile_dirt('M'),tile_dirt('R'),tile_ledge('L'),tile_ledge('M'),tile_ledge('R')]
sheet(tiles,OUT+'tiles.png')

# ---------------- BACKGROUND (640x360 tileable) ----------------
W,H=640,360
sky=Image.new('RGB',(W,H))
d=ImageDraw.Draw(sky)
top,bot=np.array([88,170,255]),np.array([200,236,255])
for y in range(H):
    c=top+(bot-top)*(y/H)**0.9; d.line([(0,y),(W,y)],fill=tuple(int(v) for v in c))
sky.save(OUT+'bg_sky.png')

def cloud_layer():
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    for cx,cy,s in [(80,60,1.0),(300,40,0.7),(470,90,1.2),(600,30,0.6)]:
        for dx,dy,r in [(-30,8,18),(-10,0,24),(16,-4,28),(40,6,20),(10,12,22)]:
            r=int(r*s); x=cx+int(dx*s); y=cy+int(dy*s)
            for off in (0,W,-W):
                d.ellipse([x-r+off,y-r+4,x+r+off,y+r+4],fill=(170,205,240,255))
        for dx,dy,r in [(-30,8,18),(-10,0,24),(16,-4,28),(40,6,20),(10,12,22)]:
            r=int(r*s); x=cx+int(dx*s); y=cy+int(dy*s)
            for off in (0,W,-W):
                d.ellipse([x-r+off,y-r,x+r+off,y+r],fill=(255,255,255,255))
    return im
cloud_layer().save(OUT+'bg_clouds.png')

def hills(base,col,dark,amp,freqs,trees=False,seed=0):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); px=im.load(); d=ImageDraw.Draw(im)
    ys=[]
    for x in range(W):
        y=base
        for a,f,ph in freqs: y+=a*math.sin(2*math.pi*(x/W)*f+ph)
        ys.append(int(y))
    for x,y in enumerate(ys):
        d.line([(x,y),(x,H)],fill=col)
        d.line([(x,y),(x,y+2)],fill=dark)
    if trees:
        rnd=random.Random(seed)
        for i in range(9):
            x=int((i+rnd.random()*0.6)*W/9); y=ys[x%W]
            kind=rnd.random()
            if kind<0.55:  # round maple tree
                d.rectangle([x-2,y-26,x+2,y+2],fill=(120,74,40,255))
                for off in (0,W,-W):
                    for (dx,dy,r,c) in [(0,-34,15,(40,140,60,255)),(-9,-28,10,(40,140,60,255)),(9,-28,10,(40,140,60,255)),(-3,-38,8,(90,190,80,255))]:
                        d.ellipse([x+dx-r+off,y+dy-r,x+dx+r+off,y+dy+r],fill=c)
            else:  # mushroom house (Henesys vibe)
                d.rectangle([x-7,y-16,x+7,y+2],fill=(245,230,200,255))
                d.rectangle([x-2,y-8,x+2,y+2],fill=(130,80,40,255))
                d.pieslice([x-18,y-34,x+18,y-6],180,360,fill=(230,90,60,255))
                for sx in (-9,0,8): d.ellipse([x+sx-3,y-28,x+sx+3,y-22],fill=(255,240,230,255))
    return im
hills(220,(150,205,170,255),(130,190,160,255),0,[(28,2,0.3),(14,5,1.1)]).save(OUT+'bg_far.png')
hills(270,(96,180,90,255),(70,150,70,255),0,[(18,3,1.7),(8,7,0.2)],trees=True,seed=3).save(OUT+'bg_near.png')

# ---------------- SLIME (32x32) ----------------
def slime_frame(w,h,face='norm',yoff=0):
    S=32; f=np.zeros((S,S,4),np.uint8)
    cx=S/2; base=S-2-yoff; cy=base-h/2
    body=hexc('#6bd36b'); light=hexc('#a8f59a'); shade=hexc('#3e9e4a'); hi=hexc('#eaffea')
    for y in range(S):
        for x in range(S):
            nx=(x+0.5-cx)/(w/2); ny=(y+0.5-cy)/(h/2)
            # drop shape: flatter bottom
            if ny>0: ny*=1.15
            r=nx*nx+ny*ny
            if r<=1:
                c=body
                if nx*0.6+ny*0.8>0.45: c=shade
                elif nx*0.5+ny*0.8<-0.55: c=light
                f[y,x]=c
    # highlight
    hx,hy=int(cx-w*0.22),int(cy-h*0.22)
    f[hy:hy+2,hx:hx+3]=hi; f[hy+2,hx]=hi
    # eyes
    ey=int(cy-h*0.02)
    for ex in (int(cx-w*0.18),int(cx+w*0.14)):
        if face=='hurt':
            f[ey,ex-1]=OL; f[ey+1,ex]=OL; f[ey,ex+1]=OL  # > <
        else:
            f[ey-1:ey+2,ex:ex+2]=OL; f[ey-1,ex]=hexc('#ffffff')
    # mouth
    if face!='hurt': f[ey+3,int(cx-1):int(cx+2)]=hexc('#2a5a2a')
    else: f[ey+3:ey+5,int(cx-1):int(cx+1)]=hexc('#b03030')
    # leaf sprout
    top=int(cy-h/2*1.0)-1
    f[top-1:top+1,int(cx)]=hexc('#3e7a2a')
    f[top-3:top-1,int(cx)-3:int(cx)]=hexc('#7fd04a'); f[top-2,int(cx)-1:int(cx)+3]=hexc('#5cb53c')
    return outline(f)
slimes=[slime_frame(24,18),slime_frame(25,17),slime_frame(28,13),slime_frame(20,21,yoff=3),slime_frame(26,16,'hurt')]
sheet(slimes,OUT+'slime.png')

# ---------------- COIN (16x16, 6 spin frames) ----------------
def coin(w):
    S=16; f=np.zeros((S,S,4),np.uint8); cx,cy=S/2,S/2
    for y in range(S):
        for x in range(S):
            nx=(x+0.5-cx)/max(w/2,0.6); ny=(y+0.5-cy)/6.5
            if nx*nx+ny*ny<=1:
                c=hexc('#f7c531')
                if nx*nx+ny*ny>0.55: c=hexc('#d68a14')
                if (nx<-0.1 and ny<-0.1 and nx*nx+ny*ny<0.5): c=hexc('#fff0a0')
                f[y,x]=c
    if w>=8: f[6:10,int(cx)-1:int(cx)+1]=hexc('#b06a0c')
    return outline(f,hexc('#6a3c08'))
sheet([coin(w) for w in (12,10,6,2,6,10)],OUT+'coin.png')

# ---------------- PORTAL (48x64, 6 frames) ----------------
def portal(ph):
    Wp,Hp=48,64; im=Image.new('RGBA',(Wp,Hp),(0,0,0,0)); px=im.load()
    cx,cy=Wp/2,Hp/2+4
    for y in range(Hp):
        for x in range(Wp):
            nx=(x-cx)/18; ny=(y-cy)/26; r=math.sqrt(nx*nx+ny*ny)
            if r<1:
                ang=math.atan2(ny,nx)
                sw=math.sin(ang*3+r*9-ph)
                t=(1-r)
                if sw>0.3: c=(170+int(85*t),240,255,int(255*(0.55+0.45*t)))
                elif sw>-0.4: c=(90,150+int(60*t),255,int(220*(0.5+0.5*t)))
                else: c=(70,60,200,int(200*(0.4+0.6*t)))
                if r<0.25: c=(255,255,255,255)
                px[x,y]=c
            elif r<1.12:
                px[x,y]=(120,220,255,110)
    return np.array(im)
sheet([portal(i*math.pi/3) for i in range(6)],OUT+'portal.png')

# ---------------- FX ----------------
def star(sz,s):
    f=np.zeros((9,9,4),np.uint8); c=4
    col=hexc('#fffbd0')
    for i in range(-s,s+1): f[c,c+i]=col; f[c+i,c]=col
    if s>=2: f[c-1:c+2,c-1:c+2]=hexc('#ffffff')
    return f
sheet([star(9,1),star(9,2),star(9,3),star(9,2)],OUT+'sparkle.png')
def puff(k):
    S=32; im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    rnd=random.Random(5)
    for i in range(6):
        a=i/6*2*math.pi; dist=3+k*2.5; r=max(1,7-k*1.1)
        x=S/2+math.cos(a)*dist; y=S/2+math.sin(a)*dist
        d.ellipse([x-r,y-r,x+r,y+r],fill=(255,255,255,255-k*35),outline=(200,210,230,255-k*35))
    return np.array(im)
sheet([puff(k) for k in range(6)],OUT+'puff.png')
def slash(k):
    S=64; im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    a0=-80+k*25; a1=a0+110
    d.arc([6,6,58,58],a0,a1,fill=(255,255,255,230-k*60),width=7-k*2)
    d.arc([10,10,54,54],a0+10,a1-5,fill=(190,240,255,200-k*60),width=3)
    return np.array(im)
sheet([slash(k) for k in range(3)],OUT+'slash.png')
def heart(full):
    pat=["..XX...XX..",".XooX.XooX.","XoWooXoooRX","XoooooooooX","XoooooooooX",".XoooooooX.","..XoooooX..","...XoooX...","....XoX....",".....X....."]
    f=np.zeros((10,11,4),np.uint8)
    for y,row in enumerate(pat):
        for x,ch in enumerate(row):
            if ch=='X': f[y,x]=hexc('#3a1010')
            elif ch in 'oR': f[y,x]=hexc('#ff4d6a') if full else hexc('#5a4a55')
            elif ch=='W': f[y,x]=hexc('#ffffff') if full else hexc('#8a7a85')
    return f
sheet([heart(True),heart(False)],OUT+'heart.png')

# ---------------- DAMAGE DIGITS (Maple orange & purple) ----------------
font=ImageFont.truetype('/usr/share/fonts/truetype/sand-box/google/Lilita One/LilitaOne-Regular.ttf',26)
def digits(top,bot,ol):
    frames=[]
    for ch in '0123456789':
        DW,DH=22,30
        m=Image.new('L',(DW,DH),0); ImageDraw.Draw(m).text((DW/2,DH/2),ch,font=font,fill=255,anchor='mm')
        ma=np.array(m)>100
        f=np.zeros((DH,DW,4),np.uint8)
        for y in range(DH):
            t=y/DH; c=[int(top[i]+(bot[i]-top[i])*t) for i in range(3)]
            f[y][ma[y]]=c+[255]
        o=f.copy()
        for _ in range(2): o=outline(o,ol)
        frames.append(o)
    return frames
sheet(digits((255,240,120),(255,120,20),hexc('#5a1e00'))+digits((240,180,255),(160,60,230),hexc('#2a0a40')),OUT+'digits.png')
print('ok')
