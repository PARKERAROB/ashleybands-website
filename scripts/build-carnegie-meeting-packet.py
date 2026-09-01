#!/usr/bin/env python3
"""Build the public Carnegie Hall 2027 family meeting packet PDF from canonical website JSON."""

from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content" / "carnegie-2027-meeting-packet.json"
OUTPUT = ROOT / "public" / "downloads" / "carnegie-hall-2027-family-meeting-packet.pdf"

GARNET = colors.HexColor("#6F1525")
DARK = colors.HexColor("#48101B")
GOLD = colors.HexColor("#D2AA32")
BLUE = colors.HexColor("#245C73")
PAPER = colors.HexColor("#FFFAF0")
INK = colors.HexColor("#211A18")
MUTED = colors.HexColor("#655A53")
PALE = colors.HexColor("#F5ECDD")


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="CoverKicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=GOLD, spaceAfter=14, uppercase=True))
    styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Times-Roman", fontSize=38, leading=38, textColor=colors.white, spaceAfter=16))
    styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=GOLD, spaceAfter=14))
    styles.add(ParagraphStyle(name="CoverBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=15, textColor=PAPER))
    styles.add(ParagraphStyle(name="Eyebrow", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=GARNET, spaceAfter=8))
    styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Times-Roman", fontSize=25, leading=27, textColor=DARK, spaceAfter=16))
    styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Times-Roman", fontSize=18, leading=20, textColor=DARK, spaceBefore=10, spaceAfter=10))
    styles.add(ParagraphStyle(name="H3x", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=DARK, spaceAfter=6))
    styles.add(ParagraphStyle(name="TableHead", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.white, spaceAfter=0))
    styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK, spaceAfter=8))
    styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.7, leading=10.5, textColor=MUTED, spaceAfter=5))
    styles.add(ParagraphStyle(name="Number", parent=styles["Title"], fontName="Times-Roman", fontSize=34, leading=34, textColor=GARNET, alignment=TA_CENTER, spaceAfter=4))
    styles.add(ParagraphStyle(name="NumberLabel", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=DARK, alignment=TA_CENTER, spaceAfter=6))
    styles.add(ParagraphStyle(name="NumberBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=8, leading=11, textColor=INK, alignment=TA_CENTER))
    return styles


def bullets(items, styles):
    return [Paragraph(f"• {esc(item)}", styles["Bodyx"]) for item in items]


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(2)
    canvas.line(doc.leftMargin, letter[1] - 0.42 * inch, letter[0] - doc.rightMargin, letter[1] - 0.42 * inch)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(DARK)
    canvas.drawString(doc.leftMargin, 0.37 * inch, "ASHLEY BANDS • CARNEGIE HALL 2027 FAMILY MEETING PACKET")
    canvas.setFillColor(MUTED)
    canvas.drawRightString(letter[0] - doc.rightMargin, 0.37 * inch, f"{canvas.getPageNumber()}")
    canvas.restoreState()


def section(story, styles, eyebrow, title):
    story.extend([Spacer(1, 5), Paragraph(esc(eyebrow.upper()), styles["Eyebrow"]), Paragraph(esc(title), styles["H1x"])])


def build():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = build_styles()
    doc = BaseDocTemplate(str(OUTPUT), pagesize=letter, leftMargin=0.62 * inch, rightMargin=0.62 * inch, topMargin=0.62 * inch, bottomMargin=0.58 * inch, title=data["title"], author="Ashley Bands")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="packet", frames=[frame], onPage=header_footer)])
    story = []

    cover = Table([[Paragraph("ASHLEY BANDS • FAMILY INFORMATION", styles["CoverKicker"])], [Paragraph(esc(data["title"]), styles["CoverTitle"])], [Paragraph(esc(data["subtitle"]), styles["CoverSub"])], [Paragraph(esc(data["summary"]), styles["CoverBody"])]], colWidths=[doc.width], rowHeights=[0.38 * inch, 1.45 * inch, 0.34 * inch, 0.95 * inch])
    cover.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), DARK), ("BOX", (0, 0), (-1, -1), 0, DARK), ("LEFTPADDING", (0, 0), (-1, -1), 34), ("RIGHTPADDING", (0, 0), (-1, -1), 34), ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.extend([Spacer(1, 0.25 * inch), cover, Spacer(1, 0.28 * inch)])

    anchor_cells = []
    for item in data["anchors"]:
        anchor_cells.append([Paragraph(esc(item["number"]), styles["Number"]), Paragraph(esc(item["label"].upper()), styles["NumberLabel"]), Paragraph(esc(item["description"]), styles["NumberBody"])])
    anchors = Table([[cell for cell in anchor_cells]], colWidths=[doc.width / 3] * 3)
    anchors.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), PAPER), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#D8CBBB")), ("INNERGRID", (0, 0), (-1, -1), 0.7, colors.HexColor("#D8CBBB")), ("TOPPADDING", (0, 0), (-1, -1), 15), ("BOTTOMPADDING", (0, 0), (-1, -1), 14), ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.extend([anchors, Spacer(1, 0.18 * inch), Table([[Paragraph(esc(data["planningFigure"]), styles["Bodyx"])]], colWidths=[doc.width], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), PALE), ("LINEBEFORE", (0, 0), (0, -1), 4, GOLD), ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)])), PageBreak()])

    section(story, styles, "The opportunity", "Ashley was selected - and now the plan has to become real")
    story.extend(bullets(data["opportunity"], styles))
    story.append(Spacer(1, 10))
    section(story, styles, "Participation", "The trip can move forward in one of two ways")
    path_cells = []
    for path in data["participationPaths"]:
        path_cells.append([Paragraph(esc(path["number"]), styles["Number"]), Paragraph(esc(path["title"]), styles["NumberLabel"]), *bullets(path["details"], styles)])
    paths = Table([[path_cells[0], path_cells[1]]], colWidths=[doc.width / 2] * 2)
    paths.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), PAPER), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#D8CBBB")), ("INNERGRID", (0, 0), (-1, -1), 0.7, colors.HexColor("#D8CBBB")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 14), ("BOTTOMPADDING", (0, 0), (-1, -1), 10), ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14)]))
    story.extend([paths, PageBreak()])

    section(story, styles, "What tonight means", "Serious intent now; final contract next")
    story.extend(bullets(data["commitment"], styles))
    payment_rows = [[Paragraph("DATE", styles["TableHead"]), Paragraph("WORKING MAXIMUM", styles["TableHead"]), Paragraph("MEANING", styles["TableHead"])]] + [[Paragraph(esc(row["date"]), styles["Bodyx"]), Paragraph(esc(row["amount"]), styles["Bodyx"]), Paragraph(esc(row["meaning"]), styles["Bodyx"])] for row in data["paymentSchedule"]]
    payment = Table(payment_rows, colWidths=[1.5 * inch, 1.7 * inch, doc.width - 3.2 * inch], repeatRows=1)
    payment.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), DARK), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8CBBB")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    story.extend([Spacer(1, 10), payment, Spacer(1, 8), Paragraph(esc(data["paymentScheduleNote"]), styles["Smallx"]), PageBreak()])

    section(story, styles, "If plans change", "What happens when an individual student withdraws")
    for index, row in enumerate(data["withdrawalStages"], 1):
        stage = Table([[Paragraph(str(index), styles["NumberLabel"]), [Paragraph(esc(row["stage"]), styles["H3x"]), Paragraph(esc(row["answer"]), styles["Bodyx"])]]], colWidths=[0.55 * inch, doc.width - 0.55 * inch])
        stage.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), PALE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
        story.extend([stage, Spacer(1, 7)])
    story.extend([Paragraph("Current standard cancellation bands without FRP", styles["H2x"]), Table([[Paragraph("CANCELLATION DATE", styles["TableHead"]), Paragraph("CURRENT WORLDSTRIDES CONSEQUENCE", styles["TableHead"])]] + [[Paragraph(esc(row["date"]), styles["Bodyx"]), Paragraph(esc(row["result"]), styles["Bodyx"])] for row in data["standardCancellation"]], colWidths=[2.35 * inch, doc.width - 2.35 * inch], repeatRows=1, style=TableStyle([("BACKGROUND", (0, 0), (-1, 0), DARK), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8CBBB")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)])), Spacer(1, 8), Paragraph(esc(data["standardCancellationNote"]), styles["Smallx"]), PageBreak()])

    section(story, styles, "Optional protection", data["frp"]["title"])
    story.append(Paragraph(esc(data["frp"]["summary"]), styles["Bodyx"]))
    frp_cols = Table([[[Paragraph("WHAT IS KNOWN", styles["H3x"]), *bullets(data["frp"]["known"], styles)], [Paragraph("WHAT ASHLEY IS CONFIRMING", styles["H3x"]), *bullets(data["frp"]["open"], styles)]]], colWidths=[doc.width / 2] * 2)
    frp_cols.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), PAPER), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#D8CBBB")), ("INNERGRID", (0, 0), (-1, -1), 0.7, colors.HexColor("#D8CBBB")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, -1), 14), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.extend([Spacer(1, 8), frp_cols, Spacer(1, 18)])
    section(story, styles, "The shared campaign", "Moving the family total toward $500 starts tonight")
    story.append(Paragraph(esc(data["funding"]["summary"]), styles["Bodyx"]))
    story.extend(bullets(data["funding"]["actions"], styles))
    story.extend([Paragraph(esc(data["funding"]["boundary"]), styles["Smallx"]), PageBreak()])

    section(story, styles, "Before the final agreement", "These details still require written answers")
    story.extend(bullets(data["openBeforeFinalAgreement"], styles))
    story.extend([Spacer(1, 12), Paragraph("PARENT QUESTIONS", styles["Eyebrow"]), Paragraph("Frequently asked questions", styles["H1x"])])
    faq_rows = []
    for item in data["faq"]:
        faq_rows.append([Paragraph(esc(item["question"]), styles["H3x"]), Paragraph(esc(item["answer"]), styles["Bodyx"])])
    faq = Table(faq_rows, colWidths=[2.25 * inch, doc.width - 2.25 * inch])
    faq.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8CBBB")), ("BACKGROUND", (0, 0), (0, -1), PALE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    story.extend([faq, PageBreak()])

    section(story, styles, "Due Friday, September 4", "Give Ashley an honest answer")
    story.extend([Paragraph("Complete one response per student. A serious yes creates the connected $50 conditional-deposit charge and lets the family pay immediately at ashleybands.com/carnegie-2027/commit.", styles["Bodyx"]), Spacer(1, 18), HRFlowable(width="100%", thickness=3, color=GOLD), Spacer(1, 18), Paragraph("Sources and status", styles["H2x"]), *bullets(data["sources"], styles), Paragraph("Planning information as of September 1, 2026. Estimates and open terms are labeled throughout.", styles["Smallx"])])

    doc.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    build()
