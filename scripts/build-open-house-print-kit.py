from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "ashley-bands-open-house-print-kit.pdf"
QR = ROOT / "tmp" / "pdfs" / "open-house-challenge-qr.png"
LOGO = ROOT / "public" / "bandsofahslogo.png"

MAROON = colors.HexColor("#7B1829")
GOLD = colors.HexColor("#D3A62C")
INK = colors.HexColor("#191716")
MUTED = colors.HexColor("#625D55")
CREAM = colors.HexColor("#FFF8E8")

styles = getSampleStyleSheet()
title = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=32, leading=34, textColor=MAROON, alignment=TA_CENTER, spaceAfter=10)
display = ParagraphStyle("Display", parent=title, fontSize=43, leading=45, textColor=INK)
subtitle = ParagraphStyle("Subtitle", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=MUTED, alignment=TA_CENTER)
h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=22, leading=25, textColor=MAROON, spaceAfter=9)
h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=15, textColor=MAROON, spaceBefore=5, spaceAfter=4)
body = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=14, textColor=INK, spaceAfter=4)
small = ParagraphStyle("Small", parent=body, fontSize=8.5, leading=11, textColor=MUTED)
card_title = ParagraphStyle("CardTitle", parent=h1, fontSize=15, leading=17, alignment=TA_CENTER, spaceAfter=4)
card_body = ParagraphStyle("CardBody", parent=body, fontSize=10, leading=12, alignment=TA_CENTER)

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#DED4BF")); canvas.line(0.55*inch, 0.42*inch, 7.95*inch, 0.42*inch)
    canvas.setFont("Helvetica", 8); canvas.setFillColor(MUTED)
    canvas.drawString(0.55*inch, 0.25*inch, "Ashley High School Bands - Open House 2026")
    canvas.drawRightString(7.95*inch, 0.25*inch, f"Page {doc.page}")
    canvas.restoreState()

def qr(size):
    return Image(str(QR), width=size, height=size)

def section(label, text):
    return [Paragraph(label, h2), Paragraph(text, body)]

OUT.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(str(OUT), pagesize=letter, leftMargin=0.58*inch, rightMargin=0.58*inch, topMargin=0.48*inch, bottomMargin=0.55*inch)
story = []

# Page 1: entrance sign
logo_box = Table([[Image(str(LOGO), width=1.05*inch, height=1.05*inch)]], colWidths=[1.25*inch], rowHeights=[1.25*inch], hAlign="CENTER")
logo_box.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),MAROON),("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
story += [logo_box, Spacer(1, 0.08*inch), Paragraph("OPEN HOUSE", title), Paragraph("GET BAND READY", display), Spacer(1, 0.12*inch), Paragraph("Scan. Sign in. Complete six quick stops.", subtitle), Spacer(1, 0.18*inch)]
t = Table([[qr(4.1*inch)]], colWidths=[4.45*inch], rowHeights=[4.45*inch])
t.setStyle(TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("BOX",(0,0),(-1,-1),2,MAROON),("BACKGROUND",(0,0),(-1,-1),colors.white)]))
story += [t, Spacer(1, 0.14*inch), Paragraph("ashleybands.com/open-house", subtitle), Spacer(1, 0.12*inch), Paragraph("Finish the Band Ready Challenge, show a student helper, and choose a sticker. Optional candy while supplies last.", ParagraphStyle("Prize", parent=subtitle, fontSize=13, leading=16, textColor=INK)), PageBreak()]

# Page 2: four small room signs
cards=[]
for heading, prompt in [("START HERE","Open the Band Ready Challenge"),("FAMILY PORTAL","Connect, confirm, and complete forms"),("DAY 1 READY","Check instrument, binder, and pencil"),("FINISH + PRIZE","Show completion to a student helper")]:
    content=[Paragraph(heading,card_title),qr(1.65*inch),Spacer(1,4),Paragraph(prompt,card_body),Paragraph("ashleybands.com/open-house",small)]
    cards.append(content)
grid=Table([[cards[0],cards[1]],[cards[2],cards[3]]],colWidths=[3.55*inch,3.55*inch],rowHeights=[4.25*inch,4.25*inch],hAlign="CENTER")
grid.setStyle(TableStyle([("BOX",(0,0),(-1,-1),1.3,MAROON),("INNERGRID",(0,0),(-1,-1),0.8,MAROON),("BACKGROUND",(0,0),(-1,-1),CREAM),("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),12),("RIGHTPADDING",(0,0),(-1,-1),12),("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12)]))
story += [Paragraph("ROOM QR SIGNS - CUT INTO FOUR", h1), grid, PageBreak()]

# Page 3: family fallback
header=Table([[Image(str(LOGO),width=.7*inch,height=.7*inch),Paragraph("Band Ready: Family Essentials",h1),qr(1.15*inch)]],colWidths=[.9*inch,5.1*inch,1.25*inch])
header.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("ALIGN",(0,0),(0,0),"CENTER"),("BACKGROUND",(0,0),(0,0),MAROON),("ALIGN",(2,0),(2,0),"RIGHT"),("BOTTOMPADDING",(0,0),(-1,-1),8)]))
story += [header, Paragraph("The website and Family Portal are the source of truth. This page is a paper fallback; forms should still be completed online.", ParagraphStyle("Intro",parent=body,fontName="Helvetica-Bold",backColor=CREAM,borderColor=GOLD,borderWidth=1,borderPadding=7,spaceAfter=8))]
cols=[[
    section("1. Connect your family","Go to <b>ashleybands.com/portal</b>. Sign in or request access. Confirm the student, parent/guardian names, email addresses, and phone numbers."),
    section("2. Day 1 necessities","Bring a personal instrument or complete the county instrument agreement in the portal; a black one-inch binder for music and handouts; and a named band pencil that stays in the binder."),
    section("3. Calendar","The live band calendar is official. Open <b>ashleybands.com/calendar</b> and subscribe so updates appear automatically."),
    section("4. Clothing order","The six-item bulk collection closes <b>Friday, August 28</b>. Pay in the portal. Prices include 7% sales tax and no individual shipping. Financial hardship never excludes a student.")
],[
    section("How grades work","County weighting is <b>60% performance and 40% practice</b>. The ensemble is assessed at least weekly in an integrated way: class or individual performance, written work, or another appropriate assessment. Regular practice and engaged class work prepare students for both assessments and concerts."),
    section("Absences and performances","Communicate as soon as a conflict or illness is known - months ahead or that morning. With communication, we can decide what is appropriate. Uncommunicated or avoidable missed performances may require an individual replacement project."),
    section("Communication","Families: email <b>robert.parker@nhcs.net</b>.<br/>Students: Google Chat for now. Changes during the Microsoft transition will be announced.<br/>Band website: <b>ashleybands.com</b>. MyMusicOffice has retired."),
    section("Complete the challenge","Scan the code, complete all six stops, then show a student helper. Every finisher may choose a sticker; optional individually wrapped candy is available while supplies last.")
]]
info=Table([list(row) for row in zip(*cols)],colWidths=[3.58*inch,3.58*inch],hAlign="CENTER")
info.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("BOX",(0,0),(-1,-1),.8,colors.HexColor("#DED4BF")),("INNERGRID",(0,0),(-1,-1),.6,colors.HexColor("#DED4BF")),("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),6)]))
story += [info,PageBreak()]

# Page 4: helpers
story += [Paragraph("Student Helper Guide",h1),Paragraph("Your job is to keep families moving, help with simple access problems, and send questions to Mr. Parker only when his judgment is actually needed.",body)]
helper_rows=[
    [Paragraph("Station",h2),Paragraph("What to do",h2),Paragraph("When to get Mr. Parker",h2)],
    [Paragraph("Portal help<br/><b>2 students</b>",body),Paragraph("Invite families to scan the QR code. Help them find Sign In or Request Access, choose their student, and locate the instrument and clothing forms. Let the family type private information themselves. Paper is a fallback, not a replacement form.",body),Paragraph("Student is missing; guardian cannot be matched; repeated login failure; family has a private or unusual circumstance.",body)],
    [Paragraph("Prize table<br/><b>1-2 students</b>",body),Paragraph("Ask the family to show the completed challenge screen. Give every finisher one sticker. Offer one individually wrapped candy while supplies last. Be welcoming - this is a celebration, not an inspection.",body),Paragraph("A family disputes completion, needs an accommodation, or raises an allergy/safety concern.",body)],
]
ht=Table(helper_rows,colWidths=[1.35*inch,3.65*inch,2.2*inch],repeatRows=1)
ht.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("BACKGROUND",(0,0),(-1,0),CREAM),("BOX",(0,0),(-1,-1),1,MAROON),("INNERGRID",(0,0),(-1,-1),.5,colors.HexColor("#CDBFA8")),("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7)]))
story += [ht,Spacer(1,10),Paragraph("Simple family flow",h2),Paragraph("1. Scan the entrance QR. &nbsp;&nbsp; 2. Complete the six stops. &nbsp;&nbsp; 3. Ask a helper only if needed. &nbsp;&nbsp; 4. Show completion at the prize table. &nbsp;&nbsp; 5. Say hello to Mr. Parker if desired.",body),Paragraph("Helper boundaries",h2),Paragraph("Do not write down passwords, sign-in codes, addresses, phone numbers, medical information, or payment details. Do not promise an instrument assignment, change a student record, interpret a special attendance situation, or handle money. Bring those questions to Mr. Parker.",body),Paragraph("Opening checklist",h2),Paragraph("Place the large sign at the entrance. Put the four small signs around the room. Stock stickers and optional wrapped candy. Keep a few essentials sheets visible. Open the portal on one helper device only for demonstration - families should use their own device for sign-in and payment.",body)]

doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)
