"""Restore the private review artwork from the supplied Spellful-AppStore-Update ZIP."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("archive", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent
entries = json.loads((root / "review-assets.json").read_text())["private_review_files"]
pending = []
with ZipFile(args.archive) as archive:
    for entry in entries:
        relative = entry["path"]
        payload = archive.read("Spellful-AppStore-Update/" + relative)
        if hashlib.sha256(payload).hexdigest() != entry["sha256"]:
            raise SystemExit("Source checksum mismatch for " + relative)
        output = root / relative
        if output.exists():
            if output.read_bytes() != payload:
                raise SystemExit("Local artwork differs at " + relative)
        else:
            pending.append((output, payload))
for output, payload in pending:
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as stream:
        stream.write(payload)
print(f"Verified {len(entries)} private assets, restored {len(pending)}.")
