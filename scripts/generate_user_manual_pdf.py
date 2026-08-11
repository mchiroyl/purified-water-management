from __future__ import annotations

import re
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "MANUAL_USUARIO.md"
OUTPUT = ROOT / "docs" / "MANUAL_USUARIO.pdf"


def inline_markup(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r"<font name='Courier'>\1</font>", text)
    return text


def image_flowable(path: Path, caption: str):
    with PILImage.open(path) as source:
        width, height = source.size
    max_width = 174 * mm
    max_height = 205 * mm
    ratio = min(max_width / width, max_height / height)
    image = Image(str(path), width=width * ratio, height=height * ratio)
    image.hAlign = "CENTER"
    caption_style = ParagraphStyle("caption", parent=STYLES["BodyText"], fontSize=8, leading=10,
                                   textColor=colors.HexColor("#45656d"), alignment=TA_CENTER)
    return KeepTogether([image, Spacer(1, 2 * mm), Paragraph(inline_markup(caption), caption_style)])


def parse_table(lines: list[str], index: int):
    rows: list[list[str]] = []
    while index < len(lines) and lines[index].strip().startswith("|"):
        cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
        if not all(re.fullmatch(r"[-: ]+", cell or "-") for cell in cells):
            rows.append(cells)
        index += 1
    paragraph_rows = [[Paragraph(inline_markup(cell), STYLES["TableText"]) for cell in row] for row in rows]
    available = 174 * mm
    columns = max(len(row) for row in rows)
    widths = [available * (0.30 if position == 0 and columns == 2 else 1 / columns) for position in range(columns)]
    if columns == 2:
        widths[1] = available - widths[0]
    table = Table(paragraph_rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0b8793")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bad7dc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2fafb")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table, index


def page_footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#bad7dc"))
    canvas.line(18 * mm, 13 * mm, 192 * mm, 13 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#45656d"))
    canvas.drawString(18 * mm, 8 * mm, "Sistema Agua Pura — Manual de usuario")
    canvas.drawRightString(192 * mm, 8 * mm, f"Página {document.page}")
    canvas.restoreState()


STYLES = getSampleStyleSheet()
STYLES.add(ParagraphStyle("TitleWater", parent=STYLES["Title"], fontName="Helvetica-Bold",
                          fontSize=25, leading=30, textColor=colors.HexColor("#12343b"), spaceAfter=8 * mm))
STYLES.add(ParagraphStyle("H1Water", parent=STYLES["Heading1"], fontName="Helvetica-Bold",
                          fontSize=18, leading=22, textColor=colors.HexColor("#12343b"), spaceBefore=7 * mm, spaceAfter=3 * mm))
STYLES.add(ParagraphStyle("H2Water", parent=STYLES["Heading2"], fontName="Helvetica-Bold",
                          fontSize=13, leading=16, textColor=colors.HexColor("#087f8c"), spaceBefore=5 * mm, spaceAfter=2 * mm))
STYLES.add(ParagraphStyle("H3Water", parent=STYLES["Heading3"], fontName="Helvetica-Bold",
                          fontSize=11, leading=14, textColor=colors.HexColor("#12343b"), spaceBefore=4 * mm, spaceAfter=1.5 * mm))
STYLES.add(ParagraphStyle("BodyWater", parent=STYLES["BodyText"], fontName="Helvetica",
                          fontSize=9.2, leading=13, textColor=colors.HexColor("#173b43"), spaceAfter=2.3 * mm))
STYLES.add(ParagraphStyle("BulletWater", parent=STYLES["BodyWater"], leftIndent=6 * mm,
                          firstLineIndent=-3 * mm, bulletIndent=2 * mm, spaceAfter=1.2 * mm))
STYLES.add(ParagraphStyle("QuoteWater", parent=STYLES["BodyWater"], leftIndent=5 * mm,
                          rightIndent=5 * mm, borderColor=colors.HexColor("#0b8793"), borderWidth=1,
                          borderPadding=6, backColor=colors.HexColor("#e9f8fa")))
STYLES.add(ParagraphStyle("TableText", parent=STYLES["BodyWater"], fontSize=7.8, leading=10, spaceAfter=0))


def build_story():
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    story = []
    index = 0
    ordered_counter = 0
    while index < len(lines):
        raw = lines[index].rstrip()
        text = raw.strip()
        if not text:
            ordered_counter = 0
            story.append(Spacer(1, 1.5 * mm))
            index += 1
            continue
        image_match = re.fullmatch(r"!\[(.+?)\]\((.+?)\)", text)
        if image_match:
            story.append(Spacer(1, 2 * mm))
            story.append(image_flowable(ROOT / "docs" / image_match.group(2), image_match.group(1)))
            story.append(Spacer(1, 3 * mm))
            index += 1
            continue
        if text.startswith("|"):
            table, index = parse_table(lines, index)
            story.extend([Spacer(1, 2 * mm), table, Spacer(1, 3 * mm)])
            continue
        if text.startswith("# "):
            story.extend([Spacer(1, 35 * mm), Paragraph(inline_markup(text[2:]), STYLES["TitleWater"]),
                          Paragraph("Manual operativo para administración, bodega, supervisión y ventas", STYLES["H2Water"]),
                          Spacer(1, 125 * mm), PageBreak()])
        elif text.startswith("## "):
            story.append(Paragraph(inline_markup(text[3:]), STYLES["H1Water"]))
        elif text.startswith("### "):
            story.append(Paragraph(inline_markup(text[4:]), STYLES["H2Water"]))
        elif text.startswith("> "):
            story.append(Paragraph(inline_markup(text[2:]), STYLES["QuoteWater"]))
        elif text.startswith("- "):
            story.append(Paragraph(inline_markup(text[2:]), STYLES["BulletWater"], bulletText="•"))
        elif re.match(r"^\d+\. ", text):
            ordered_counter += 1
            item = re.sub(r"^\d+\. ", "", text)
            story.append(Paragraph(inline_markup(item), STYLES["BulletWater"], bulletText=f"{ordered_counter}."))
        else:
            story.append(Paragraph(inline_markup(text), STYLES["BodyWater"]))
        index += 1
    return story


def main():
    document = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=18 * mm,
        title="Manual de usuario — Sistema Agua Pura", author="Sistema Agua Pura",
    )
    document.build(build_story(), onFirstPage=page_footer, onLaterPages=page_footer)
    print(OUTPUT)


if __name__ == "__main__":
    main()
