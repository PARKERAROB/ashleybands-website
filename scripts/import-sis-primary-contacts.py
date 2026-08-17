#!/usr/bin/env python3
"""Conditionally seed unverified primary guardian contacts from an NHCS roster PDF."""

import argparse
import json
import re
import unicodedata
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

import pdfplumber


def norm(value):
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]", "", value)


def load_env(path):
    values = {}
    for line in path.read_text().splitlines():
        if line and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


class Rest:
    def __init__(self, base, key):
        self.base = base.rstrip("/") + "/rest/v1/"
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(self, table, select="*"):
        url = self.base + table + "?" + urllib.parse.urlencode({"select": select})
        with urllib.request.urlopen(urllib.request.Request(url, headers=self.headers)) as response:
            return json.load(response)

    def post(self, table, row, on_conflict=None):
        query = ""
        if on_conflict:
            query = "?" + urllib.parse.urlencode({"on_conflict": on_conflict})
        headers = {**self.headers, "Content-Type": "application/json", "Prefer": "return=representation,resolution=merge-duplicates"}
        request = urllib.request.Request(self.base + table + query, json.dumps(row).encode(), headers, method="POST")
        with urllib.request.urlopen(request) as response:
            return json.load(response)


def report_records(path):
    guardian_by_sis = {}
    with pdfplumber.open(path) as pdf:
        text = "\n".join((page.extract_text(x_tolerance=2, y_tolerance=3) or "") for page in pdf.pages)
        for page in pdf.pages:
            words = page.extract_words(extra_attrs=["fontname"])
            sis_words = sorted(
                [word for word in words if re.fullmatch(r"#\d+", word["text"]) and word["x0"] < 120],
                key=lambda word: word["top"],
            )
            for index, sis_word in enumerate(sis_words):
                start = sis_word["top"] - 10
                end = sis_words[index + 1]["top"] - 10 if index + 1 < len(sis_words) else page.height
                guardian_words = [
                    word for word in words
                    if word["x0"] > 385 and start <= word["top"] < end and "Bold" in word["fontname"]
                ]
                if not guardian_words:
                    continue
                first_top = min(word["top"] for word in guardian_words)
                first_name = " ".join(
                    word["text"] for word in sorted(
                        [word for word in guardian_words if abs(word["top"] - first_top) < 1],
                        key=lambda word: word["x0"],
                    )
                )
                guardian_by_sis[sis_word["text"][1:]] = first_name
    pattern = re.compile(r"^(9|10|11|12)\s+([^\n]+?)\s+[MF]\s+[^\n]*\n#(\d+)", re.M)
    matches = list(pattern.finditer(text))
    records = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.start():end]
        for marker in ("\nIncoming Students:", "\nCourse:"):
            marker_index = block.find(marker)
            if marker_index >= 0:
                block = block[:marker_index]
        emails = re.findall(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b", block)
        email = emails[0].lower() if emails else None
        email_index = block.lower().find(email) if email else -1
        before_email = block[:email_index].splitlines() if email else []
        guardian_name = guardian_by_sis.get(match.group(3))
        after_email = block[email_index + len(email):] if email else block
        phones = re.findall(r"(?:C:|Oth:|Wk:)?\s*(\([0-9]{3}\)[0-9]{3}-[0-9]{4})", after_email)
        if not phones:
            phones = re.findall(r"(?:C:|Oth:|Wk:)?\s*(\([0-9]{3}\)[0-9]{3}-[0-9]{4})", block)
        last, rest = [part.strip() for part in match.group(2).split(",", 1)]
        records.append({
            "sis_id": match.group(3),
            "student_name": f"{rest.split()[0]} {last}",
            "guardian_name": guardian_name,
            "email": email,
            "phone": re.sub(r"\D", "", phones[0]) if phones else None,
        })
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    env = load_env(Path(".env.local"))
    rest = Rest(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SECRET_KEY"])

    students = rest.get("portal_students", "id,source_student_id,display_name")
    people = rest.get("portal_people", "id,source_person_key,display_name,person_type")
    links = rest.get("portal_student_people", "student_id,person_id,role,relationship_status,primary_contact")
    contacts = rest.get("portal_contact_methods", "person_id,contact_type,value_normalized,verification_status")
    person_by_id = {row["id"]: row for row in people}
    links_by_student = {}
    contacts_by_person = {}
    for row in links:
        links_by_student.setdefault(row["student_id"], []).append(row)
    for row in contacts:
        contacts_by_person.setdefault(row["person_id"], []).append(row)

    # Match the report's SIS IDs through the canonical source record.
    import csv
    with open("/Users/parkerarob/Atlas/BandsofAHS/data/students.csv", newline="", encoding="utf-8-sig") as stream:
        canonical = list(csv.DictReader(stream))
    source_by_sis = {row.get("sis_id", "").strip(): row["id"] for row in canonical if row.get("sis_id", "").strip()}
    portal_by_source = {row["source_student_id"]: row for row in students}

    planned = []
    skipped = []
    for record in report_records(args.pdf):
        portal_student = portal_by_source.get(source_by_sis.get(record["sis_id"]))
        if not portal_student:
            skipped.append((record["student_name"], "no portal student match"))
            continue
        guardian_links = [
            row for row in links_by_student.get(portal_student["id"], [])
            if row["relationship_status"] == "trusted" and person_by_id.get(row["person_id"], {}).get("person_type") == "guardian"
        ]
        usable = [row for link in guardian_links for row in contacts_by_person.get(link["person_id"], [])]
        if usable:
            skipped.append((record["student_name"], "existing guardian contact"))
            continue
        if not record["guardian_name"] or not (record["email"] or record["phone"]):
            skipped.append((record["student_name"], "no importable guardian contact"))
            continue

        matching_links = [row for row in guardian_links if norm(person_by_id[row["person_id"]]["display_name"]) == norm(record["guardian_name"])]
        selected = matching_links
        person_id = selected[0]["person_id"] if selected else str(uuid.uuid4())
        planned.append((portal_student, record, person_id, bool(selected)))

    print(f"report_students={len(report_records(args.pdf))} planned_primary_imports={len(planned)} skipped={len(skipped)}")
    if not args.apply:
        for student, record, _, existing in planned:
            print(f"PLAN {student['display_name']}: {record['guardian_name']} email={bool(record['email'])} phone={bool(record['phone'])} existing_guardian={existing}")
        return

    for student, record, person_id, existing in planned:
        if not existing:
            source_key = f"nhcs-sis-2026-08-17:{student['source_student_id']}:{norm(record['guardian_name'])}"
            person = rest.post("portal_people", {
                "id": person_id,
                "source_person_key": source_key,
                "person_type": "guardian",
                "display_name": record["guardian_name"],
                "source": "nhcs_sis_roster_2026_08_17",
            }, "source_person_key")[0]
            person_id = person["id"]
        rest.post("portal_student_people", {
            "student_id": student["id"],
            "person_id": person_id,
            "role": "Parent/Guardian",
            "relationship_status": "trusted",
            "primary_contact": True,
            "source": "nhcs_sis_roster_2026_08_17",
        }, "student_id,person_id")
        values = (("email", record["email"]), ("phone", record["phone"]))
        for contact_type, value in values:
            if not value:
                continue
            normalized = value.lower() if contact_type == "email" else re.sub(r"\D", "", value)
            rest.post("portal_contact_methods", {
                "person_id": person_id,
                "contact_type": contact_type,
                "value_display": value,
                "value_normalized": normalized,
                "verification_status": "unverified",
                "evidence": {"source_file": args.pdf.name, "effective_date": "2026-08-17", "student_sis_id": record["sis_id"]},
                "source": "nhcs_sis_roster_2026_08_17",
            }, "person_id,contact_type,value_normalized")
    print(f"applied_primary_imports={len(planned)}")


if __name__ == "__main__":
    main()
