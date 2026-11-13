from PIL import Image
im=Image.open('/cursor/stores/user/grok-bot/agents/cd1ec2ac-8fe3-4475-92d2-34ebcdc54542/assets/3325b863d36f0b8fad70c7ee057ad057da37c78496abebed00d0dcb2c60c9968.jpg')
im.crop((180,380,300,520)).resize((360,420),Image.NEAREST).save('/tmp/sword.png')
im.crop((470,330,600,470)).resize((390,420),Image.NEAREST).save('/tmp/hand2.png')
im.crop((770,300,900,440)).resize((390,420),Image.NEAREST).save('/tmp/hand3.png')
