from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import black, white
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import getAscent, getDescent, stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SIGNS_OUTPUT = ROOT / "output" / "pdf" / "ashley-bands-open-house-station-signs-bw.pdf"
PAPER_OUTPUT = ROOT / "output" / "pdf" / "ashley-bands-band-ready-paper-checklist-bw.pdf"
TARGET_URL = "https://ashleybands.com/open-house"


STATIONS = [
    {
        "number": "01",
        "title": "CONNECT YOUR FAMILY",
        "location": "START HERE / PORTAL HELP",
        "actions": [
            "Scan the main Band Ready sign and open the Family Portal.",
            "Sign in or request access, then choose the correct student.",
            "Review the student and family contact information. Update anything that has changed.",
        ],
        "finish": "Band Ready shows Connect your family as complete.",
        "paper": "No phone or portal access? Ask for the paper Band Ready checklist. Never write down or share a password.",
    },
    {
        "number": "02",
        "title": "SUBSCRIBE TO THE CALENDAR",
        "location": "BAND CALENDAR",
        "actions": [
            "Open Step 2 in Band Ready and choose Subscribe, Download, or View.",
            "Put the Ashley Bands calendar where your family will actually see it.",
            "Return to Band Ready and confirm that you reviewed or subscribed.",
        ],
        "finish": "The calendar stop is saved for this student.",
        "paper": "Use the paper checklist to request subscription help. The live calendar must be connected later on a phone or computer.",
    },
    {
        "number": "03",
        "title": "BE READY FOR DAY ONE",
        "location": "DAY ONE SUPPLIES",
        "actions": [
            "Choose personal instrument, county instrument, or I need help.",
            "Confirm a black one-inch binder for music and handouts.",
            "Confirm a dedicated band pencil, give it a name, and keep it in the binder.",
        ],
        "finish": "Instrument, binder, and band pencil answers are saved.",
        "paper": "Record all three answers on the paper checklist. A helper will flag anything the student still needs.",
    },
    {
        "number": "04",
        "title": "COMPLETE APPLICABLE FORMS",
        "location": "INSTRUMENT FORMS",
        "actions": [
            "Check the instrument answer from the Day One stop.",
            "Personal instrument or need help: no county agreement is due right now.",
            "County instrument: submit the responsibility agreement. Mr. Parker adds assignment details later.",
        ],
        "finish": "Band Ready says the forms step is covered.",
        "paper": "Mark county instrument or instrument help on the paper checklist. Do not put sensitive identification information on paper.",
    },
    {
        "number": "05",
        "title": "KNOW HOW BAND WORKS",
        "location": "GRADES / PRACTICE / COMMUNICATION",
        "actions": [
            "Review the county 60% performance and 40% practice grading balance.",
            "Plan for regular preparation and an integrated assessment about once each week.",
            "Communicate absences and performance conflicts as soon as they are known.",
        ],
        "finish": "The family confirms that it reviewed how band works.",
        "paper": "The essential expectations are printed on the paper checklist. Read them and check the acknowledgment.",
    },
    {
        "number": "06",
        "title": "CONFIRM THE RED BAND SHIRT",
        "location": "CLOTHING ORDER",
        "actions": [
            "Start with the official red band shirt required for every band student.",
            "Choose a size, then add any optional clothing for the student or family.",
            "Complete portal payment by Friday, August 28. The student receives the bulk order through band.",
        ],
        "finish": "The order is complete, or the family's return-later plan is saved.",
        "paper": "Record red-shirt status and size on the paper checklist. Never write card or payment information on paper.",
    },
    {
        "number": "07",
        "title": "CHECK IN WITH THE BAND BOOSTERS",
        "location": "BOOSTERS / LEVEL 2 VOLUNTEERS",
        "actions": [
            "Say hello to the Boosters and learn how families support the band.",
            "Review the annual NHCS volunteer training and assessment.",
            "Start or confirm Level 2 status. Ashley Bands recommends Level 2 for every parent and guardian.",
        ],
        "finish": "Your current Level 2 status or follow-up plan is saved.",
        "paper": "A Booster can explain the process. Mark current, started, later, or need help on the paper checklist.",
    },
    {
        "number": "08",
        "title": "SAY HEY TO MR. PARKER",
        "location": "DIRECTOR GREETING / FINAL STOP",
        "actions": [
            "Stop by for a quick hello. A long conversation is not needed.",
            "Share something from summer, band camp, or what you are excited about this year.",
            "If Mr. Parker is helping another family, a wave counts. Online families may mark that option.",
        ],
        "finish": "Save the greeting, review Band Ready, and show the completed screen for the prize.",
        "paper": "No technology is needed for the greeting. Mark said hey, waved, or completed away from Open House.",
    },
]


def wrap_lines(text, font_name, font_size, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and stringWidth(candidate, font_name, font_size) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def draw_wrapped(c, text, x, y, max_width, font_name="Helvetica", font_size=12, leading=None, color=black, max_lines=None):
    leading = leading or font_size * 1.25
    lines = wrap_lines(text, font_name, font_size, max_width)
    if max_lines is not None:
        lines = lines[:max_lines]
    c.setFillColor(color)
    c.setFont(font_name, font_size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_wrapped_centered(c, text, x, center_y, max_width, font_name="Helvetica", font_size=12, leading=None, color=black, max_lines=None):
    leading = leading or font_size * 1.25
    lines = wrap_lines(text, font_name, font_size, max_width)
    if max_lines is not None:
        lines = lines[:max_lines]
    if not lines:
        return

    ascent = getAscent(font_name, font_size)
    descent = getDescent(font_name, font_size)
    block_height = ascent - descent + (len(lines) - 1) * leading
    baseline = center_y + (block_height / 2) - ascent

    c.setFillColor(color)
    c.setFont(font_name, font_size)
    for line in lines:
        c.drawString(x, baseline, line)
        baseline -= leading


def fit_font(text, font_name, maximum, minimum, max_width):
    size = maximum
    while size > minimum and stringWidth(text, font_name, size) > max_width:
        size -= 1
    return size


def draw_checkbox(c, x, text_baseline, size=8):
    # Align the box's visual center with the lowercase text beside it.
    # ReportLab positions text from its baseline, not its bounding-box center.
    bottom = text_baseline - (size * 0.20)
    c.setLineWidth(0.8)
    c.setStrokeColor(black)
    c.rect(x, bottom, size, size, fill=0, stroke=1)


def draw_qr(c, size, x, y):
    qr = QrCodeWidget(TARGET_URL)
    qr.barLevel = "H"
    qr.barBorder = 4
    qr.barFillColor = black
    x1, y1, x2, y2 = qr.getBounds()
    drawing = Drawing(size, size, transform=[size / (x2 - x1), 0, 0, size / (y2 - y1), 0, 0])
    drawing.add(qr)
    renderPDF.draw(drawing, c, x, y)


def build_station_signs():
    SIGNS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(SIGNS_OUTPUT), pagesize=letter, pageCompression=1)
    c.setTitle("Ashley Bands Open House Station Signs - Black and White")
    c.setAuthor("Ashley High School Bands")
    width, height = letter

    for station in STATIONS:
        c.setFillColor(white)
        c.rect(0, 0, width, height, fill=1, stroke=0)
        c.setStrokeColor(black)
        c.setFillColor(black)
        c.setLineWidth(3)
        c.rect(0.36 * inch, 0.36 * inch, width - 0.72 * inch, height - 0.72 * inch, fill=0, stroke=1)

        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(width / 2, height - 0.72 * inch, "ASHLEY BANDS OPEN HOUSE")
        c.setLineWidth(1.5)
        c.line(1.15 * inch, height - 0.94 * inch, width - 1.15 * inch, height - 0.94 * inch)

        c.circle(0.95 * inch, height - 1.66 * inch, 0.48 * inch, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 25)
        c.drawCentredString(0.95 * inch, height - 1.78 * inch, station["number"])
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1.55 * inch, height - 1.40 * inch, station["location"])
        title_size = fit_font(station["title"], "Helvetica-Bold", 39, 19, width - 2.10 * inch)
        c.setFont("Helvetica-Bold", title_size)
        c.drawString(1.55 * inch, height - 1.90 * inch, station["title"])

        c.setFont("Helvetica-Bold", 12)
        c.drawString(0.72 * inch, height - 2.55 * inch, "WHAT YOU DO AT THIS STATION")

        action_y = height - 3.10 * inch
        for index, action in enumerate(station["actions"], start=1):
            box_y = action_y - 0.66 * inch
            c.setLineWidth(1.1)
            c.rect(0.72 * inch, box_y, width - 1.44 * inch, 0.80 * inch, fill=0, stroke=1)
            c.setFillColor(black)
            c.rect(0.86 * inch, box_y + 0.20 * inch, 0.38 * inch, 0.38 * inch, fill=1, stroke=0)
            c.setFillColor(white)
            c.setFont("Helvetica-Bold", 15)
            c.drawCentredString(1.05 * inch, box_y + 0.31 * inch, str(index))
            draw_wrapped_centered(
                c,
                action,
                1.43 * inch,
                box_y + 0.40 * inch,
                width - 2.40 * inch,
                "Helvetica-Bold",
                15.3,
                19,
                black,
                3,
            )
            action_y -= 0.96 * inch

        c.setFillColor(black)
        c.rect(0.72 * inch, 1.68 * inch, width - 1.44 * inch, 0.92 * inch, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(0.92 * inch, 2.34 * inch, "BEFORE YOU LEAVE")
        draw_wrapped(c, station["finish"], 0.92 * inch, 2.08 * inch, width - 1.84 * inch, "Helvetica-Bold", 13.5, 16.5, white, 3)

        c.setFillColor(white)
        c.setStrokeColor(black)
        c.setLineWidth(1.1)
        c.rect(0.72 * inch, 0.65 * inch, width - 1.44 * inch, 0.78 * inch, fill=1, stroke=1)
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(0.90 * inch, 1.20 * inch, "PAPER OPTION")
        draw_wrapped(c, station["paper"], 0.90 * inch, 1.01 * inch, width - 1.82 * inch, "Helvetica", 9.8, 12, black, 3)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawRightString(width - 0.46 * inch, 0.46 * inch, "ashleybands.com/open-house")
        c.showPage()

    c.save()
    print(SIGNS_OUTPUT)


def draw_field(c, label, x, y, width):
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x, y, label)
    start = x + stringWidth(label, "Helvetica-Bold", 8) + 5
    c.setLineWidth(0.7)
    c.line(start, y - 1, x + width, y - 1)


def draw_inline_options(c, x, y, options, font_size=7.6, gap=10):
    cursor = x
    for option in options:
        draw_checkbox(c, cursor, y, 7)
        cursor += 11
        c.setFont("Helvetica", font_size)
        c.drawString(cursor, y, option)
        cursor += stringWidth(option, "Helvetica", font_size) + gap


def draw_panel(c, x, top, width, height, number, title, rows, note=None):
    bottom = top - height
    c.setLineWidth(1)
    c.setStrokeColor(black)
    c.rect(x, bottom, width, height, fill=0, stroke=1)
    c.setFillColor(black)
    c.rect(x, top - 0.30 * inch, width, 0.30 * inch, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 10.2)
    c.drawString(x + 0.10 * inch, top - 0.21 * inch, f"{number}  {title}")
    c.setFillColor(black)
    y = top - 0.48 * inch
    for row in rows:
        if row[0] == "options":
            label, options = row[1], row[2]
            c.setFont("Helvetica-Bold", 7.8)
            c.drawString(x + 0.10 * inch, y, label)
            label_width = stringWidth(label, "Helvetica-Bold", 7.8) + 7
            draw_inline_options(c, x + 0.10 * inch + label_width, y, options, 7.4, 7)
            y -= 0.22 * inch
        elif row[0] == "check":
            draw_checkbox(c, x + 0.10 * inch, y, 7)
            y = draw_wrapped(c, row[1], x + 0.25 * inch, y, width - 0.36 * inch, "Helvetica", 7.8, 9.4, black, 2) - 2
        elif row[0] == "line":
            c.setFont("Helvetica-Bold", 7.8)
            c.drawString(x + 0.10 * inch, y, row[1])
            start = x + 0.10 * inch + stringWidth(row[1], "Helvetica-Bold", 7.8) + 5
            c.line(start, y - 1, x + width - 0.10 * inch, y - 1)
            y -= 0.22 * inch
    if note:
        draw_wrapped(c, note, x + 0.10 * inch, bottom + 0.17 * inch, width - 0.20 * inch, "Helvetica-Oblique", 6.9, 8.2, black, 2)


def build_paper_checklist():
    PAPER_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(PAPER_OUTPUT), pagesize=letter, pageCompression=1)
    c.setTitle("Ashley Bands Band Ready Paper Checklist - Black and White")
    c.setAuthor("Ashley High School Bands")
    width, height = letter
    c.setFillColor(white)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setFillColor(black)
    c.setStrokeColor(black)
    c.setLineWidth(2)
    c.rect(0.28 * inch, 0.28 * inch, width - 0.56 * inch, height - 0.56 * inch, fill=0, stroke=1)

    c.setFont("Helvetica-Bold", 21)
    c.drawString(0.48 * inch, height - 0.66 * inch, "BAND READY - PAPER CHECKLIST")
    c.setFont("Helvetica", 8.5)
    c.drawString(0.48 * inch, height - 0.88 * inch, "Use only when a family cannot complete Band Ready online. Return this page to a helper or Mr. Parker.")
    draw_qr(c, 0.72 * inch, width - 1.27 * inch, height - 1.15 * inch)

    draw_field(c, "Student:", 0.48 * inch, height - 1.25 * inch, 3.65 * inch)
    draw_field(c, "Parent/guardian:", 4.28 * inch, height - 1.25 * inch, 3.65 * inch)
    draw_field(c, "Best email:", 0.48 * inch, height - 1.53 * inch, 3.65 * inch)
    draw_field(c, "Best phone:", 4.28 * inch, height - 1.53 * inch, 3.65 * inch)

    c.setLineWidth(0.8)
    c.rect(0.48 * inch, height - 2.05 * inch, width - 0.96 * inch, 0.32 * inch, fill=0, stroke=1)
    c.setFont("Helvetica-Bold", 7.3)
    c.drawString(0.58 * inch, height - 1.92 * inch, "PRIVACY: Give this directly to a helper or Mr. Parker. Do not write passwords, card numbers, medical details, or identification numbers.")

    panel_width = 3.78 * inch
    panel_height = 1.62 * inch
    left_x = 0.39 * inch
    right_x = 4.33 * inch
    first_top = height - 2.24 * inch
    gap = 0.10 * inch

    panels = [
        ("01", "CONNECT YOUR FAMILY", [
            ("check", "Need portal access or sign-in help"),
            ("check", "Family contact update needed"),
            ("check", "Student is missing from the portal"),
        ], "Helper: flag portal follow-up. Never collect a password."),
        ("02", "BAND CALENDAR", [
            ("check", "We know where to find the live band calendar"),
            ("check", "We need help subscribing later"),
        ], "ashleybands.com/calendar - online subscription still required."),
        ("03", "DAY ONE", [
            ("options", "Instrument:", ["personal", "county", "help"]),
            ("options", "Black binder:", ["ready", "need"]),
            ("options", "Band pencil:", ["ready", "need"]),
            ("line", "Pencil name:"),
        ], "Black one-inch binder; dedicated pencil stays in the binder."),
        ("04", "APPLICABLE FORMS", [
            ("check", "No county instrument agreement needed"),
            ("check", "County instrument agreement follow-up"),
            ("check", "Instrument decision help needed"),
        ], "The official county agreement is completed in the portal or with Mr. Parker."),
        ("05", "HOW BAND WORKS", [
            ("check", "We reviewed the 60% performance / 40% practice balance"),
            ("check", "We understand regular preparation and weekly assessment"),
            ("check", "We will communicate absences and conflicts early"),
        ], "Families email Mr. Parker; students use the announced school channel."),
        ("06", "RED SHIRT / CLOTHING", [
            ("options", "Red shirt:", ["have", "need"]),
            ("line", "Student shirt size:"),
            ("check", "Clothing or payment help needed"),
        ], "Deadline: Friday, August 28. Never record payment information here."),
        ("07", "BOOSTERS / LEVEL 2", [
            ("options", "Status:", ["current", "started", "later", "help"]),
            ("check", "We spoke with a Band Booster"),
        ], "Annual training; 80% assessment; $22.50 background check valid 3 years."),
        ("08", "SAY HEY TO MR. PARKER", [
            ("options", "Greeting:", ["said hey", "waved", "online"]),
            ("check", "Ready for final review and prize"),
        ], "A quick hello or wave counts. No long conversation is required."),
    ]

    for index, panel in enumerate(panels):
        column_x = left_x if index < 4 else right_x
        row = index if index < 4 else index - 4
        top = first_top - row * (panel_height + gap)
        draw_panel(c, column_x, top, panel_width, panel_height, *panel)

    footer_y = 0.66 * inch
    c.setFont("Helvetica-Bold", 8)
    c.drawString(0.48 * inch, footer_y + 0.25 * inch, "STAFF FOLLOW-UP:")
    draw_inline_options(c, 1.62 * inch, footer_y + 0.25 * inch, ["portal", "instrument", "clothing", "Level 2", "other"], 7.4, 8)
    draw_field(c, "Received by:", 0.48 * inch, footer_y, 4.35 * inch)
    draw_field(c, "Date:", 4.62 * inch, footer_y, 3.30 * inch)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawRightString(width - 0.40 * inch, 0.38 * inch, "ashleybands.com/open-house")

    c.showPage()
    c.save()
    print(PAPER_OUTPUT)


if __name__ == "__main__":
    build_station_signs()
    build_paper_checklist()
