from PIL import Image, ImageDraw
import os
SRC = r"D:\CascadeProjects\All_System\sysall16.jpg"
OUT = r"D:\CascadeProjects\All_System\portfolio\icons"
os.makedirs(OUT, exist_ok=True)
BG = (13,17,23)
im = Image.open(SRC).convert("RGB")
CX, CY, SIDE = 1436, 545, 600
art = im.crop((CX-SIDE//2, CY-SIDE//2, CX+SIDE//2, CY+SIDE//2))

def compose(size, fill, radius=0):
    canvas = Image.new("RGB", (size,size), BG)
    inner = int(size*fill)
    a = art.resize((inner,inner), Image.LANCZOS)
    canvas.paste(a, ((size-inner)//2,(size-inner)//2))
    if radius:
        mask = Image.new("L",(size,size),0)
        ImageDraw.Draw(mask).rounded_rectangle([0,0,size-1,size-1], radius=radius, fill=255)
        out = Image.new("RGBA",(size,size),(0,0,0,0))
        out.paste(canvas,(0,0),mask)
        return out
    return canvas

compose(512,0.92).save(os.path.join(OUT,"icon-512.png"), optimize=True)
compose(192,0.92).save(os.path.join(OUT,"icon-192.png"), optimize=True)
compose(512,0.72).save(os.path.join(OUT,"icon-maskable-512.png"), optimize=True)
compose(180,0.92).save(os.path.join(OUT,"apple-touch-icon.png"), optimize=True)
compose(64,0.92).save(os.path.join(OUT,"favicon-64.png"), optimize=True)
compose(32,0.92).save(os.path.join(OUT,"favicon-32.png"), optimize=True)
# header logo: rounded, small
compose(96,0.92,radius=18).save(os.path.join(OUT,"logo-96.png"), optimize=True)
for f in sorted(os.listdir(OUT)):
    p=os.path.join(OUT,f); print("%-26s %6d bytes" % (f, os.path.getsize(p)))

# preview sheet: how it looks on a home screen
prev = Image.new("RGB",(6*180, 200),(35,35,38))
for i,f in enumerate(["icon-192.png","icon-512.png","icon-maskable-512.png","apple-touch-icon.png","favicon-64.png","logo-96.png"]):
    ic = Image.open(os.path.join(OUT,f)).convert("RGBA").resize((140,140), Image.LANCZOS)
    prev.paste(ic,(i*180+20,30),ic)
    ImageDraw.Draw(prev).text((i*180+20,10), f, fill=(220,220,220))
pp = r"C:\Users\User\AppData\Local\Temp\icon_preview.png"
prev.save(pp); print(pp)
