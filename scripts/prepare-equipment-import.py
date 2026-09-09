#!/usr/bin/env python3
"""Convert the SW-42 asset-register workbook to a reviewed equipment manifest."""
import argparse, datetime as dt, json, re, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

MAIN="http://schemas.openxmlformats.org/spreadsheetml/2006/main"; REL="http://schemas.openxmlformats.org/officeDocument/2006/relationships"; PKG="http://schemas.openxmlformats.org/package/2006/relationships"
NS={"m":MAIN}; COL=lambda ref: re.match(r"[A-Z]+",ref).group(0)

def workbook_rows(path):
  with zipfile.ZipFile(path) as z:
    shared=[]
    if "xl/sharedStrings.xml" in z.namelist():
      root=ET.fromstring(z.read("xl/sharedStrings.xml")); shared=["".join(n.text or "" for n in item.iter(f"{{{MAIN}}}t")) for item in root.findall("m:si",NS)]
    book=ET.fromstring(z.read("xl/workbook.xml")); relroot=ET.fromstring(z.read("xl/_rels/workbook.xml.rels")); rels={n.attrib["Id"]:n.attrib["Target"] for n in relroot.findall(f"{{{PKG}}}Relationship")}
    for sheet in book.find("m:sheets",NS):
      name=sheet.attrib["name"].strip(); target=rels[sheet.attrib[f"{{{REL}}}id"]]; target=(target.lstrip("/") if target.startswith("/") else "xl/"+target).replace("xl/../","")
      root=ET.fromstring(z.read(target)); rows=[]
      for row in root.findall(".//m:sheetData/m:row",NS):
        values={}
        for cell in row.findall("m:c",NS):
          node=cell.find("m:v",NS); value=None
          if cell.attrib.get("t")=="inlineStr": value="".join(n.text or "" for n in cell.iter(f"{{{MAIN}}}t"))
          elif node is not None:
            raw=node.text or ""; value=shared[int(raw)] if cell.attrib.get("t")=="s" else raw
          values[COL(cell.attrib["r"])]=value
        rows.append((int(row.attrib["r"]),values))
      yield name,rows

def date_value(value):
  if value in (None,"", "N/A"): return ""
  try: return (dt.datetime(1899,12,30)+dt.timedelta(days=float(value))).date().isoformat()
  except (ValueError,TypeError): return ""

def number(value):
  try:
    parsed=float(value)
    return int(parsed) if parsed.is_integer() and parsed >= 0 else None
  except (ValueError,TypeError): return None

def main():
  parser=argparse.ArgumentParser(); parser.add_argument("--xlsx",required=True); parser.add_argument("--batch",required=True); parser.add_argument("--output",required=True); args=parser.parse_args()
  records=[]; rejected=[]
  for sheet,rows in workbook_rows(Path(args.xlsx)):
    for row,values in rows:
      if row < 3 or not values.get("C"): continue
      qty=number(values.get("B")); source=f"{sheet}:row-{row}"
      if qty is None: rejected.append({"sourceRef":source,"reason":"quantity-is-not-a-single-whole-number","sourceValue":str(values.get("B") or "")}); continue
      replacement=number(values.get("E")); replacement_note="" if replacement is not None else str(values.get("E") or "").strip()
      records.append({"name":re.sub(r"\s+"," ",str(values["C"]).strip()),"category":re.sub(r"\s+"," ",str(values.get("D") or "").strip()),"trackingMode":"quantity","totalQuantity":qty,"location":"Hall" if sheet.casefold()=="hall" else "Location not recorded","condition":"not-recorded","notes":"","replacementValue":replacement,"purchaseDate":date_value(values.get("A")),"disposalDate":date_value(values.get("F")),"replacementValueNote":replacement_note,"assetRegisterSection":sheet,"source":"spreadsheet-import","importBatch":args.batch,"importSourceRef":source})
  result={"version":1,"batch":args.batch,"records":records,"preparationRejected":rejected}
  Path(args.output).write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
  print(json.dumps({"records":len(records),"rejected":len(rejected),"rejectedReasons":sorted({r["reason"] for r in rejected})}))
if __name__=="__main__": main()
