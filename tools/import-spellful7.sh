#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [[ -n "$(git status --porcelain)" ]]; then echo "Working tree must be clean before importing."; exit 1; fi
read -rsp 'Paste the Dropbox direct-download URL: ' url
printf '\n'
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl --fail --location --silent --show-error --retry 2 "$url" -o "$tmp/spellful.zip"
unset url
printf '%s  %s\n' '129cffa7c0085a5c6a70df48d1315fda23c86e1526248feef13133d35a6f1497' "$tmp/spellful.zip" | sha256sum -c -
python3 - "$tmp/spellful.zip" <<'PY'
import pathlib, sys, zipfile, stat
root = pathlib.Path.cwd()
with zipfile.ZipFile(sys.argv[1]) as z:
    for entry in z.infolist():
        path = pathlib.PurePosixPath(entry.filename)
        if path.is_absolute() or '..' in path.parts or path.parts[0] != 'Spellful' or '.git' in path.parts or stat.S_ISLNK(entry.external_attr >> 16):
            raise SystemExit('Unsafe archive entry: ' + entry.filename)
        if len(path.parts) < 2 or entry.is_dir():
            continue
        if any(p in {'.env', 'node_modules', '.DS_Store'} or p.startswith('.env.') or p.endswith(('.p12','.p8','.pem','.mobileprovision')) for p in path.parts[1:]):
            raise SystemExit('Sensitive or generated archive entry: ' + entry.filename)
    for entry in z.infolist():
        path = pathlib.PurePosixPath(entry.filename)
        if len(path.parts) < 2 or entry.is_dir():
            continue
        out = root.joinpath(*path.parts[1:])
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(z.read(entry))
print('Verified archive extracted. No files committed or pushed.')
PY
git status --short
echo 'STOP: Review source for embedded secrets before staging or pushing. Do not publish yet.'
