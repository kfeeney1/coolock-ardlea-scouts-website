#!/usr/bin/env python3
"""Convert reviewed XLSX member rows into a private JSON manifest.

Uses only Python's standard library. The output contains personal data: keep it outside Git,
Jira, CI artifacts and documentation.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS}


def column_of(cell_ref: str) -> str:
    match = re.match(r"([A-Z]+)", cell_ref)
    return match.group(1) if match else ""


def load_sheet(path: Path, sheet_name: str):
    with zipfile.ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared.append("".join(node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t")))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rel_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rels = {node.attrib["Id"]: node.attrib["Target"] for node in rel_root.findall(f"{{{PKG_REL_NS}}}Relationship")}
        target = None
        for sheet in workbook.find("m:sheets", NS):
            if sheet.attrib["name"].strip() == sheet_name.strip():
                target = rels[sheet.attrib[f"{{{REL_NS}}}id"]]
                break
        if not target:
            raise ValueError(f"Worksheet not found: {sheet_name}")
        worksheet_path = target.lstrip("/") if target.startswith("/") else f"xl/{target}"
        worksheet_path = worksheet_path.replace("xl/../", "")
        root = ET.fromstring(archive.read(worksheet_path))
        rows = []
        for row in root.findall(".//m:sheetData/m:row", NS):
            values = {}
            for cell in row.findall("m:c", NS):
                ref = cell.attrib["r"]
                cell_type = cell.attrib.get("t")
                value_node = cell.find("m:v", NS)
                value = None
                if cell_type == "inlineStr":
                    value = "".join(node.text or "" for node in cell.iter(f"{{{MAIN_NS}}}t"))
                elif value_node is not None:
                    raw = value_node.text or ""
                    if cell_type == "s":
                        value = shared[int(raw)]
                    else:
                        try:
                            value = float(raw)
                        except ValueError:
                            value = raw
                values[column_of(ref)] = value
            if values:
                rows.append((int(row.attrib["r"]), values))
        return rows


def iso_date(value) -> str:
    if isinstance(value, (int, float)):
        if not 20000 < value < 80000:
            return ""
        return (dt.datetime(1899, 12, 30) + dt.timedelta(days=float(value))).date().isoformat()
    if isinstance(value, str):
        text = value.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
            try:
                return dt.datetime.strptime(text, fmt).date().isoformat()
            except ValueError:
                pass
    return ""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", action="append", required=True, help="Source workbook path; repeat for each section")
    parser.add_argument("--mapping", action="append", required=True, help="section|sheet|nameColumn|dobColumn; repeat in the same order as --xlsx")
    parser.add_argument("--batch", required=True, help="Non-personal import batch label")
    parser.add_argument("--output", required=True, help="Private JSON manifest path")
    args = parser.parse_args()
    if len(args.xlsx) != len(args.mapping):
        raise SystemExit("Each --xlsx requires one --mapping.")

    records = []
    rejected = []
    for workbook_path, mapping in zip(args.xlsx, args.mapping):
        parts = mapping.split("|")
        if len(parts) != 4:
            raise SystemExit("Mapping format is section|sheet|nameColumn|dobColumn")
        section, sheet, name_col, dob_col = [part.strip() for part in parts]
        if section not in {"Beavers", "Cubs", "Scouts"}:
            raise SystemExit(f"Unsupported section: {section}")
        for row_number, values in load_sheet(Path(workbook_path), sheet):
            if row_number == 1:
                continue
            name = values.get(name_col)
            dob = iso_date(values.get(dob_col))
            if not isinstance(name, str) or not name.strip():
                continue
            if not dob:
                rejected.append({"sourceRef": f"{section}:row-{row_number}", "reason": "missing-or-invalid-dob"})
                continue
            records.append({
                "displayName": re.sub(r"\s+", " ", name.strip()),
                "dateOfBirth": dob,
                "section": section,
                "importBatch": args.batch,
                "sourceRef": f"{section}:row-{row_number}"
            })

    output = {"version": 1, "batch": args.batch, "records": records, "preparationRejected": rejected}
    Path(args.output).write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    counts = {section: sum(1 for row in records if row["section"] == section) for section in ("Beavers", "Cubs", "Scouts")}
    print(json.dumps({"recordsBySection": counts, "preparationRejected": len(rejected)}, separators=(",", ":")))
    print("Private manifest written. Do not commit, attach to Jira, or upload as a CI artifact.")


if __name__ == "__main__":
    main()
