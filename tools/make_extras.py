"""v2 art + sfx: King Slime sheet, crown icon, checkpoint flag, shockwave, boss/checkpoint sounds."""
from PIL import Image, ImageDraw
import numpy as np, wave, math, subprocess, os
OUT='public/assets/'
OL=(40,26,20,255)
def hexc(h,a=255): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(a,)
def outline(arr,col=OL):
    a=arr[...,3]>0
    p=np.pad(a,1); nb=p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:]
    arr=arr.copy(); arr[nb&~a]=col; return arr
def sheet(frames,path):
    h=max(f.shape[0] for f in frames); w=frames[0].shape[1]
    s=np.zeros((h,w*len(frames),4),np.uint8)
    for i,f in enumerate(frames): s[:f.shape[0],i*w:(i+1)*w]=f
    Image.fromarray(s,'RGBA').save(path); return s

# ---------- KING SLIME (40x40 frames, drawn at slime pixel density; scaled x3 in game) ----------
CROWN=["..Y...Y...Y..",".YRY.YBY.YRY.","YYYYYYYYYYYYY","YWYYYYYYYYYWY","YYYYYYYYYYYYY"]
def king_frame(w,h,face='norm',yoff=0):
    S=40; f=np.zeros((S,S,4),np.uint8)
    cx=S/2; base=S-2-yoff; cy=base-h/2
    body=hexc('#4fc6c0'); light=hexc('#9ff2e6'); shade=hexc('#2c8f9a'); hi=hexc('#f0fffd')
    for y in range(S):
        for x in range(S):
            nx=(x+0.5-cx)/(w/2); ny=(y+0.5-cy)/(h/2)
            if ny>0: ny*=1.15
            if nx*nx+ny*ny<=1:
                c=body
                if nx*0.6+ny*0.8>0.45: c=shade
                elif nx*0.5+ny*0.8<-0.55: c=light
                f[y,x]=c
    hx,hy=int(cx-w*0.24),int(cy-h*0.2)
    f[hy:hy+2,hx:hx+4]=hi; f[hy+2,hx]=hi
    ey=int(cy-h*0.0)
    for i,ex in enumerate((int(cx-w*0.2),int(cx+w*0.14))):
        if face=='hurt':
            f[ey,ex-1]=OL; f[ey+1,ex]=OL; f[ey,ex+1]=OL; f[ey-1,ex-2]=OL; f[ey-1,ex+2]=OL
        elif face=='angry':
            f[ey-1:ey+2,ex:ex+3]=hexc('#c0102a'); f[ey-1,ex+1]=hexc('#ffd0d0')
            # angry brows
            if i==0: f[ey-3,ex]=OL; f[ey-2,ex+1:ex+3]=OL
            else: f[ey-3,ex+2]=OL; f[ey-2,ex:ex+2]=OL
        else:
            f[ey-1:ey+2,ex:ex+3]=OL; f[ey-1,ex]=hexc('#ffffff')
    my=ey+4
    if face=='hurt': f[my:my+3,int(cx-2):int(cx+1)]=hexc('#b03030')
    elif face=='angry': f[my,int(cx-3):int(cx+3)]=OL; f[my+1,int(cx-2):int(cx+2)]=hexc('#b03030')
    else: f[my,int(cx-2):int(cx+2)]=hexc('#1f5a5a'); f[my-1,int(cx-3)]=hexc('#1f5a5a'); f[my-1,int(cx+2)]=hexc('#1f5a5a')
    f=outline(f)
    # crown on top
    top=int(cy-h/2)-len(CROWN)+1; cx0=int(cx)-len(CROWN[0])//2
    for yy,row in enumerate(CROWN):
        for xx,ch in enumerate(row):
            col={'Y':hexc('#ffd23b'),'R':hexc('#ff4d6a'),'B':hexc('#4d8bff'),'W':hexc('#fff6b0')}.get(ch)
            if col and 0<=top+yy<S: f[top+yy,cx0+xx]=col
    return outline(f)
kings=[king_frame(30,22),king_frame(31,21),king_frame(35,15),king_frame(26,26,yoff=3),king_frame(32,20,'hurt'),king_frame(30,22,'angry'),king_frame(36,14,'angry')]
sheet(kings,OUT+'kingslime.png')
# crown icon for HUD
c=np.zeros((7,15,4),np.uint8)
for yy,row in enumerate(CROWN):
    for xx,ch in enumerate(row):
        col={'Y':hexc('#ffd23b'),'R':hexc('#ff4d6a'),'B':hexc('#4d8bff'),'W':hexc('#fff6b0')}.get(ch)
        if col: c[yy+1,xx+1]=col
Image.fromarray(outline(c),'RGBA').save(OUT+'crown.png')

# ---------- CHECKPOINT FLAG (24x48): 0 idle(down), 1-3 raising, 4-6 waving ----------
def flag(h,wave_ph,lit):
    W,H=24,48; im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rectangle([3,42,12,46],fill=hexc('#8a8f9e'),outline=OL)       # stone base
    d.rectangle([6,4,8,42],fill=hexc('#e9e2cf'),outline=OL)          # pole
    d.rectangle([5,1,9,5],fill=hexc('#ffd23b') if lit else hexc('#b9b2a0'),outline=OL)  # knob
    top=6+int((1-h)*28)
    col=hexc('#ff4d6a') if lit else hexc('#7a86a8'); dk=hexc('#c02a48') if lit else hexc('#56617f')
    pts=[]
    for i in range(0,13):
        x=9+i; y=top+math.sin(i*0.6+wave_ph)*1.3*(i/12)
        pts.append((x,y))
    bot=[(x,y+10) for x,y in reversed(pts)]
    d.polygon(pts+bot,fill=col,outline=OL)
    d.line([(10,top+5),(20,top+5+math.sin(wave_ph)*1)],fill=dk)
    if lit:  # leaf emblem
        d.ellipse([13,top+3,17,top+7],fill=hexc('#fff6b0'))
    return np.array(im)
sheet([flag(0,0,False),flag(0.35,0,True),flag(0.7,0.5,True),flag(1,1,True),flag(1,2,True),flag(1,3.1,True),flag(1,4.2,True)],OUT+'flag.png')

# ---------- SHOCKWAVE (32x24, 3 frames) ----------
def shock(k):
    im=Image.new('RGBA',(32,24),(0,0,0,0)); d=ImageDraw.Draw(im)
    h=18-k*2
    d.polygon([(2,23),(10,23-h),(16,23-h-2),(22,23-h),(30,23)],fill=(255,240,170,230),outline=(200,120,40,255))
    d.polygon([(8,23),(13,23-h+6),(19,23-h+6),(24,23)],fill=(255,255,255,240))
    return np.array(im)
sheet([shock(k) for k in range(3)],OUT+'shock.png')

# ---------- SFX ----------
SR=22050; D=OUT+'sfx/'
def write(name,x,vol=0.5):
    x=np.clip(x*vol,-1,1); w=wave.open(D+name+'.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((x*32767).astype('<i2').tobytes()); w.close()
    for ext,args in (('ogg',['-c:a','libvorbis','-q:a','4']),('mp3',['-c:a','libmp3lame','-b:a','96k'])):
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',D+name+'.wav',*args,D+name+'.'+ext],check=True)
    os.remove(D+name+'.wav')
def t(d): return np.arange(int(SR*d))/SR
def sq(f,d,duty=0.5):
    ph=np.cumsum(np.broadcast_to(f,(int(SR*d),))/SR) if np.ndim(f) else t(d)*f
    return np.where((ph%1)<duty,1.0,-1.0)
def note(f,d,duty=0.25):
    x=sq(f,d,duty); return x*np.exp(-np.arange(len(x))/SR/(d/4))
def noise(d,seed=1): return np.random.default_rng(seed).uniform(-1,1,int(SR*d))
cat=np.concatenate
# checkpoint: bright rising arpeggio + shimmer
write('checkpoint',cat([note(f,0.07) for f in (784,988,1175,1568)]+[note(2093,0.35,0.125)]),0.32)
# slam: deep thump + rumble
n=int(SR*0.6); th=np.sin(2*np.pi*np.cumsum(np.linspace(120,30,n))/SR)
rum=np.convolve(noise(0.6,3),np.ones(30)/30,'same')*3
write('slam',(th+rum*0.6)*np.exp(-np.arange(n)/SR/0.18),0.85)
# roar: growly low square wobble
n=int(SR*0.8); f=110+30*np.sin(np.arange(n)/SR*2*np.pi*9)+np.linspace(40,-30,n)
x=sq(f,0.8,0.4)*0.6+np.convolve(noise(0.8,4),np.ones(4)/4,'same')*0.4
write('roar',x*np.sin(np.linspace(0,np.pi,n))**0.5,0.4)
# warn: two quick beeps (telegraph)
write('warn',cat([note(880,0.06,0.5),np.zeros(int(SR*0.03)),note(880,0.08,0.5)]),0.22)
# bossdie: descending sweep into fanfare
n=int(SR*0.5); sw=sq(np.linspace(900,120,n),0.5,0.5)*np.linspace(1,0.3,n)
fan=cat([note(f,0.1) for f in (523,659,784,1047,784,1047)]+[note(1319,0.6,0.5)])
write('bossdie',cat([sw*0.6,fan]),0.35)
print('extras ok')
