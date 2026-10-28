"""Extract original embedded badge images; never draw, recolour or infer a stage.

Usage: python3 scripts/extract-adventure-badge-artwork.py /path/to/adventureskills_handbook.pdf
Requires PyMuPDF. Source identity and the ordered stage images are verified below.
"""
import hashlib
import json
from pathlib import Path
import sys
import fitz

SOURCE_URL = "https://scouting360.ie/wp-content/uploads/2025/09/adventureskills_handbook.pdf"
SOURCE_SHA256 = "c900a3bf2a837d1e19b3bc47f6cb371fe06e23097d05958503157de2ee2c317d"
# Stage order verified visually against every embedded numeral, not page ordering alone.
SOURCES = {
    "camping": [(9,21),(10,25),(11,29),(12,33),(14,39),(15,43),(17,49),(18,53),(19,57)],
    "backwoods": [(23,69),(23,70),(24,74),(26,80),(27,84),(28,90),(28,91),(29,96),(30,100)],
    "pioneering": [(35,114),(35,115),(36,120),(36,121),(38,127),(39,131),(40,135),(41,139),(42,143)],
    "hillwalking": [(47,156),(48,160),(49,164),(50,168),(51,172),(52,176),(54,182),(55,186),(56,190)],
    "emergencies": [(61,204),(61,205),(62,209),(63,213),(64,217),(65,221),(66,225),(67,229),(68,233)],
    "air-activities": [(73,247),(73,248),(74,252),(75,256),(76,260),(77,264),(78,268),(79,272),(80,276)],
    "paddling": [(87,294),(87,295),(88,299),(89,303),(90,307),(91,312),(91,313),(92,317),(93,321)],
    "rowing": [(100,340),(100,341),(101,345),(102,349),(103,353),(104,357),(105,361),(107,367),(108,371)],
    "sailing": [(115,388),(116,392),(117,396),(118,400),(119,404),(120,408),(121,412),(123,418),(125,424)]
}

def main():
    source = Path(sys.argv[1])
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError("Source PDF differs from the verified original. Re-audit before extracting.")
    document = fitz.open(source)
    root = Path(__file__).resolve().parents[1] / "public/badges/adventure-skills"
    entries = []
    for skill_id, sources in SOURCES.items():
        for stage, (page, xref) in enumerate(sources, 1):
            if xref not in [image[0] for image in document[page-1].get_images()]:
                raise ValueError(f"Source image missing on verified page: {skill_id}/{stage}")
            # Decode the source colour space through the PDF renderer. No resize,
            # rotation, crop, numeral replacement, border paint or image generation.
            original = fitz.Pixmap(document, xref)
            rgb = fitz.Pixmap(fitz.csRGB, original)
            path = root / skill_id / f"stage-{stage}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            rgb.save(path)
            entries.append({"skillId":skill_id, "stage":stage, "page":page, "xref":xref,
                            "width":rgb.width, "height":rgb.height,
                            "sha256":hashlib.sha256(path.read_bytes()).hexdigest()})
    (root / "catalogue.json").write_text(json.dumps({"sourceUrl":SOURCE_URL,
        "sourceSha256":SOURCE_SHA256, "entries":entries}, indent=2) + "\n")
    print(f"Extracted {len(entries)} original numbered badges. Swimming artwork is not supplied by this source.")

if __name__ == "__main__":
    main()
