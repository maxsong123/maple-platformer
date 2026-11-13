"""Deterministic chiptune SFX + a short upbeat music loop (numpy -> wav)."""
import numpy as np, wave
SR=22050
D='public/assets/sfx/'
def write(name,x,vol=0.5):
    x=np.clip(x*vol,-1,1); w=wave.open(D+name,'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((x*32767).astype('<i2').tobytes()); w.close()
def t(d): return np.arange(int(SR*d))/SR
def sq(f,d,duty=0.5):
    ph=np.cumsum(np.broadcast_to(f,(int(SR*d),))/SR) if np.ndim(f) else t(d)*f
    return np.where((ph%1)<duty,1.0,-1.0)
def tri(f,d):
    ph=t(d)*f; return 2*np.abs(2*(ph%1)-1)-1
def env(n,a=0.005,r=None):
    e=np.ones(n); ai=int(a*SR); e[:ai]=np.linspace(0,1,ai) if ai else 1
    rr=r if r is not None else n/SR
    e*=np.exp(-np.arange(n)/SR/(rr/4)); return e
def note(f,d,kind='sq',duty=0.5):
    x=sq(f,d,duty) if kind=='sq' else tri(f,d); return x*env(len(x),r=d)
def cat(*a): return np.concatenate(a)
def noise(d): return np.random.default_rng(1).uniform(-1,1,int(SR*d))
# coin: classic two-note
write('coin.wav',cat(note(988,0.06,duty=0.25),note(1319,0.22,duty=0.25)),0.35)
# jump: rising sweep
n=int(SR*0.16); f=np.linspace(300,720,n); write('jump.wav',sq(f,0.16,0.25)*np.linspace(1,0.2,n),0.3)
# swing: filtered noise whoosh
x=noise(0.14); k=np.ones(6)/6; x=np.convolve(x,k,'same'); e=np.sin(np.linspace(0,np.pi,len(x)))
write('swing.wav',x*e,0.55)
# hit: crunchy noise + low thump
n=int(SR*0.12); th=np.sin(2*np.pi*np.cumsum(np.linspace(220,60,n))/SR)
write('hit.wav',(noise(0.12)*0.6+th)*np.exp(-np.arange(n)/SR/0.04),0.6)
# hurt: descending square
n=int(SR*0.25); f=np.linspace(520,140,n); write('hurt.wav',sq(f,0.25,0.5)*np.exp(-np.arange(n)/SR/0.12),0.3)
# puff: soft noise burst
n=int(SR*0.3); x=np.convolve(noise(0.3),np.ones(14)/14,'same'); write('puff.wav',x*np.exp(-np.arange(n)/SR/0.08),0.9)
# select
write('select.wav',cat(note(660,0.05,duty=0.25),note(880,0.1,duty=0.25)),0.3)
# level up fanfare: C E G C' arpeggio + held chord
C,E,G,C2,E2=523,659,784,1047,1319
fan=cat(*[note(f,0.09,duty=0.25) for f in (C,E,G,C2,E,G,C2,E2)])
held=(note(C2,0.7,duty=0.5)+note(E2,0.7,duty=0.25)+note(G*2,0.7,duty=0.125))/2.2
write('levelup.wav',cat(fan,held),0.35)
# star ding
write('star.wav',cat(note(1568,0.05,duty=0.25),note(2093,0.25,duty=0.25)),0.3)

# music: 8 bars, 140bpm, I-V-vi-IV in C, square lead + triangle bass + noise hat
bpm=140; beat=60/bpm; step=beat/2
def mtof(m): return 440*2**((m-69)/12)
prog=[(60,64,67),(67,71,74),(69,72,76),(65,69,72)]
melody=[72,74,76,79, 76,74,72,74, 74,76,79,81, 79,76,74,72, 76,77,79,81, 79,77,76,74, 72,76,74,79, 77,76,74,72]
bars=8; total=int(SR*step*8*bars); out=np.zeros(total)
def add(x,pos):
    i=int(pos*SR); j=min(total,i+len(x)); out[i:j]+=x[:j-i]
for b in range(bars):
    ch=prog[b%4]
    for s in range(8):
        pos=(b*8+s)*step
        add(note(mtof(ch[0]-24),step*0.95,'tri')*0.55,pos)            # bass
        if s%2==1: add(note(mtof(ch[s//2%3]),step*0.8,duty=0.125)*0.12,pos)  # arp
        hat=np.random.default_rng(b*8+s).uniform(-1,1,int(SR*0.03))*np.exp(-np.arange(int(SR*0.03))/SR/0.008)
        add(hat*0.12,pos)
    for s in range(4):
        m=melody[(b*4+s)%len(melody)]
        add(note(mtof(m),beat*0.9,duty=0.25)*0.22,(b*8+s*2)*step)
write('music.wav',out/np.max(np.abs(out)),0.55)
print('audio ok')
