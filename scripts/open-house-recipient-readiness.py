#!/usr/bin/env python3
"""Aggregate-only email readiness for the confirmed Aug. 17 class roster."""
import csv
import json
import argparse
from pathlib import Path
from importlib.util import module_from_spec, spec_from_file_location

ROOT = Path(__file__).resolve().parents[1]
PDF = Path("/Users/parkerarob/Desktop/Atlas Inbox/Band Student Report - 8:17:26.pdf")
spec = spec_from_file_location("sis_contacts", ROOT / "scripts" / "import-sis-primary-contacts.py")
sis = module_from_spec(spec)
spec.loader.exec_module(sis)

parser = argparse.ArgumentParser()
parser.add_argument("--apply-tag", action="store_true", help="Add the exact SIS roster as a broadcast audience facet")
args = parser.parse_args()

env = sis.load_env(ROOT / ".env.local")
rest = sis.Rest(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SECRET_KEY"])
report = sis.report_records(PDF)
with open("/Users/parkerarob/Atlas/BandsofAHS/data/students.csv", newline="", encoding="utf-8-sig") as stream:
    canonical = list(csv.DictReader(stream))
source_by_sis = {row["sis_id"].strip(): row["id"] for row in canonical if row.get("sis_id", "").strip()}
students = rest.get("portal_students", "id,source_student_id,display_name,legal_first,legal_last,preferred_first,school_email")
portal_by_source = {row["source_student_id"]: row for row in students}
portal_by_name = {}
for row in students:
    names = {
        sis.norm(row["display_name"]),
        sis.norm(f"{row.get('legal_first') or ''} {row.get('legal_last') or ''}"),
        sis.norm(f"{row.get('preferred_first') or ''} {row.get('legal_last') or ''}"),
    }
    for name in names:
        if name:
            portal_by_name.setdefault(name, []).append(row)
target_students = set()
unmatched = 0
for record in report:
    student = portal_by_source.get(source_by_sis.get(record["sis_id"]))
    if not student:
        matches = {row["id"]: row for row in portal_by_name.get(sis.norm(record["student_name"]), [])}
        student = next(iter(matches.values())) if len(matches) == 1 else None
    if student:
        target_students.add(student["id"])
    else:
        unmatched += 1
links = rest.get("portal_student_people", "student_id,person_id,relationship_status")
contacts = rest.get("portal_contact_methods", "person_id,contact_type,value_normalized,verification_status")
people = rest.get("portal_people", "id,person_type")
guardian_ids = {row["id"] for row in people if row["person_type"] != "student"}

people_by_student = {}
for row in links:
    if row["student_id"] in target_students and row["relationship_status"] == "trusted" and row["person_id"] in guardian_ids:
        people_by_student.setdefault(row["student_id"], set()).add(row["person_id"])
email_by_person = {}
for row in contacts:
    if row["contact_type"] == "email":
        email_by_person.setdefault(row["person_id"], []).append(row)

dead = {"hard_bounce", "replaced", "superseded"}
covered = set()
unique = {}
for student_id, person_ids in people_by_student.items():
    for person_id in person_ids:
        for row in email_by_person.get(person_id, []):
            email = (row.get("value_normalized") or "").lower()
            if "@" not in email or row["verification_status"] in dead:
                continue
            covered.add(student_id)
            verified = str(row.get("verification_status") or "").startswith("verified_")
            if email not in unique or verified:
                unique[email] = verified

result = {
    "sis_report_students": len(report),
    "matched_portal_students": len(target_students),
    "unmatched_sis_students": unmatched,
    "students_with_guardian_email": len(covered),
    "students_without_guardian_email": len(target_students - covered),
    "uncovered_students_with_school_email_fallback": sum(
        1 for row in students
        if row["id"] in (target_students - covered) and "@" in (row.get("school_email") or "")
    ),
    "unique_guardian_recipients_after_dedupe": len(unique),
    "verified_recipient_emails": sum(unique.values()),
    "unverified_recipient_emails": len(unique) - sum(unique.values()),
}
print(json.dumps(result, indent=2))
if args.apply_tag:
    for student_id in target_students:
        rest.post("portal_student_attributes", {
            "student_id": student_id,
            "key": "open_house_roster",
            "value": "2026-08-17_current_classes",
            "source": "bulk",
        }, "student_id,key,value")
    print(f"applied_open_house_roster_tags={len(target_students)}")
