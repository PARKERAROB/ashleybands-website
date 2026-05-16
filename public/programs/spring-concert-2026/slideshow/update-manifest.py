#!/usr/bin/env python3
"""
Scans movement folders and rewrites the HEROES + IMAGES manifest in index.html.

- HEROES: one chosen image per movement that anchors the title slide.
- IMAGES: everything else, cycled in the gallery slide for that movement.

Edit HEROES below to change which image anchors a title slide.
Run after adding/removing files:
    python3 update-manifest.py
"""
import json
import re
import unicodedata
from pathlib import Path


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)

HERE = Path(__file__).parent
HTML = HERE / "index.html"

# slide-id → folder name
FOLDERS = {
    "slide-gandalf":    "gandalf",
    "slide-lothlorien": "lothlorien",
    "slide-gollum":     "gollum",
    "slide-journey":    "journey",
    "slide-hobbits":    "hobbits",
}

# Title-slide hero image per movement (filename only, no folder).
# Falls back to the alphabetically first file if the named file is missing.
HEROES = {
    "slide-gandalf":    "Donato_Giancola_-_You_Cannot_Pass.jpg",
    "slide-lothlorien": "Alan_Lee_-_Lothlorien.png",
    "slide-gollum":     "Anke_Eissmann_-_Gollum.jpg",
    "slide-journey":    "John_Howe_-_Gandalf_and_the_Balrog.jpg",
    "slide-hobbits":    "Henning_Janssen_-_Hobbit_Marching_Band.jpg",
}

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def scan(folder: Path) -> list[str]:
    if not folder.is_dir():
        return []
    return sorted(
        nfc(p.name) for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in IMG_EXTS and not p.name.startswith(".")
    )


def build_manifest() -> str:
    heroes_out = {}
    images_out = {}
    summary = []
    for slide_id, folder in FOLDERS.items():
        files = scan(HERE / folder)
        if not files:
            heroes_out[slide_id] = None
            images_out[slide_id + "-gallery"] = []
            summary.append((folder, 0, None))
            continue
        hero_name = nfc(HEROES.get(slide_id) or "")
        if hero_name not in files:
            hero_name = files[0]
        heroes_out[slide_id] = f"{folder}/{hero_name}"
        gallery = [f"{folder}/{f}" for f in files if f != hero_name]
        images_out[slide_id + "-gallery"] = gallery
        summary.append((folder, len(files), hero_name))

    lines = ["  const HEROES = {"]
    for sid, path in heroes_out.items():
        lines.append(f"    {json.dumps(sid)}: {json.dumps(path)},")
    lines.append("  };")
    lines.append("")
    lines.append("  const IMAGES = {")
    for sid, paths in images_out.items():
        lines.append(f"    {json.dumps(sid)}: [")
        for p in paths:
            lines.append(f"      {json.dumps(p)},")
        lines.append("    ],")
    lines.append("  };")
    return "\n".join(lines), summary


def main() -> None:
    html = HTML.read_text(encoding="utf-8")
    new_block, summary = build_manifest()
    pattern = re.compile(r"  const HEROES = \{.*?\n  \};\n\n  const IMAGES = \{.*?\n  \};", re.DOTALL)
    if not pattern.search(html):
        # Fall back: replace just the IMAGES block (first run, no HEROES yet)
        pattern = re.compile(r"  const IMAGES = \{.*?\n  \};", re.DOTALL)
        if not pattern.search(html):
            raise SystemExit("Couldn't find HEROES/IMAGES block in index.html")
    updated = pattern.sub(lambda _: new_block, html, count=1)
    HTML.write_text(updated, encoding="utf-8")

    for folder, n, hero in summary:
        hero_note = f"hero: {hero}" if hero else "no hero (folder empty)"
        print(f"  {folder:12s} {n:3d} images  ·  {hero_note}")
    print("\nindex.html updated. Don't forget to deploy.")


if __name__ == "__main__":
    main()
