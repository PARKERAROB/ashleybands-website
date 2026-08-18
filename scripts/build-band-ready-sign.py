from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import black, white
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "ashley-bands-band-ready-qr-sign.pdf"
TARGET_URL = "https://ashleybands.com/open-house"


def draw_centered(c, text, y, font_name, font_size):
    c.setFont(font_name, font_size)
    c.drawCentredString(letter[0] / 2, y, text)


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=letter, pageCompression=1)
    width, height = letter

    c.setTitle("Are You Band Ready? - Ashley Bands Open House")
    c.setAuthor("Ashley High School Bands")
    c.setSubject("Open House Band Ready QR sign")
    c.setFillColor(white)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setFillColor(black)
    c.setStrokeColor(black)

    margin = 0.38 * inch
    c.setLineWidth(3)
    c.rect(margin, margin, width - 2 * margin, height - 2 * margin, fill=0, stroke=1)

    draw_centered(c, "ASHLEY BANDS OPEN HOUSE", height - 0.82 * inch, "Helvetica-Bold", 14)
    c.setLineWidth(1.5)
    c.line(1.35 * inch, height - 1.02 * inch, width - 1.35 * inch, height - 1.02 * inch)

    draw_centered(c, "ARE YOU", height - 1.72 * inch, "Helvetica-Bold", 47)
    draw_centered(c, "BAND READY?", height - 2.42 * inch, "Helvetica-Bold", 54)

    qr_size = 5.35 * inch
    qr = QrCodeWidget(TARGET_URL)
    qr.barLevel = "H"
    qr.barBorder = 4
    qr.barFillColor = black
    x1, y1, x2, y2 = qr.getBounds()
    drawing = Drawing(qr_size, qr_size, transform=[qr_size / (x2 - x1), 0, 0, qr_size / (y2 - y1), 0, 0])
    drawing.add(qr)
    renderPDF.draw(drawing, c, (width - qr_size) / 2, 2.00 * inch)

    draw_centered(c, "SCAN TO BEGIN", 1.46 * inch, "Helvetica-Bold", 20)
    draw_centered(c, "ashleybands.com/open-house", 1.10 * inch, "Helvetica-Bold", 14)

    c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
