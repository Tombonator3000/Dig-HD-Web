#!/usr/bin/env python3
"""Lag en GitHub Pages-pakke uten spillfiler eller HD-bilder.

Kjør engine/build-web.sh først. Denne pakken laster private filer fra brukerens
maskin gjennom nettleseren, og skal aldri inneholde game/, mods/ eller work/.
"""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile

HERE = Path(__file__).resolve().parent
THEMES = {
    'achievements.dat', 'classicmacfonts.dat', 'encoding.dat', 'gui-icons.dat',
    'helpdialog.zip', 'macgui.dat', 'residualvm.zip', 'scummclassic.zip',
    'scummmodern.zip', 'scummremastered.zip', 'shaders.dat', 'translations.dat',
}
UI = ('index.html', 'style.css', 'player.mjs', 'local-files.mjs', 'touch.mjs', 'credits.html')


def pack(src: Path, out: Path) -> dict:
    dist = src / 'build-emscripten'
    for name in ('scummvm.js', 'scummvm.wasm'):
        if not (dist / name).is_file():
            raise RuntimeError(f'Mangler {dist / name}. Kjør engine/build-web.sh først.')
    # Do not accept a source with a different upstream commit by accident.
    commit = (HERE / 'SCUMMVM_COMMIT').read_text().strip()
    actual = subprocess.check_output(['git', '-C', str(src), 'rev-parse', 'HEAD'], text=True).strip()
    if actual != commit:
        raise RuntimeError('ScummVM-kilden er ikke den låste commiten.')
    subprocess.run(['git', '-C', str(src), 'apply', '--reverse', '--check',
                    str(HERE / 'patches/0001-dighd-hd-grafikk.patch')], check=True)
    if out.exists():
        raise RuntimeError(f'{out} finnes allerede. Velg en ny utmappe eller fjern bare den gamle Pages-pakken.')
    out.mkdir(parents=True)
    for name in ('scummvm.js', 'scummvm.wasm'):
        shutil.copy2(dist / name, out / name)
    for name in UI:
        shutil.copy2(HERE / 'pages' / name, out / name)
    # Strict allowlist: never copy a distribution's games/ or extra data files.
    (out / 'data').mkdir()
    index = {}
    for name in sorted(THEMES):
        if (dist / 'data' / name).is_file():
            shutil.copy2(dist / 'data' / name, out / 'data' / name)
            index[name] = (out / 'data' / name).stat().st_size
    # Empty icon directory is a built-in ScummVM search path.
    (out / 'data' / 'gui-icons').mkdir()
    (out / 'data' / 'gui-icons' / 'index.json').write_text('{}')
    index['gui-icons'] = {}
    (out / 'data' / 'index.json').write_text(json.dumps(index))
    (out / 'scummvm.ini').write_text(
        '[scummvm]\nsubtitles=true\naspect_ratio=true\n\n'
        '[dig]\ndescription=The Dig HD\nengineid=scumm\ngameid=dig\n'
        'path=/data/games/dig\nsubtitles=true\naspect_ratio=true\n')
    shutil.copy2(src / 'COPYING', out / 'COPYING.txt')
    shutil.copy2(src / 'COPYRIGHT', out / 'COPYRIGHT.txt')
    shutil.copytree(dist / 'doc', out / 'licenses')
    (out / '.nojekyll').touch()

    # GPL corresponding source: actual patched tracked sources + new HD files,
    # together with the exact patch, build scripts and this browser frontend.
    tracked = subprocess.check_output(['git', '-C', str(src), 'ls-files', '-z']).decode().split('\0')
    with tarfile.open(out / 'source.tar.gz', 'w:gz') as archive:
        for name in sorted(set(tracked + ['engines/scumm/dighd.cpp', 'engines/scumm/dighd.h'])):
            if name and (src / name).is_file():
                archive.add(src / name, arcname='dig-hd-source/scummvm/' + name, recursive=False)
        for name in ('SCUMMVM_COMMIT', 'build-web.sh', 'build-pages.py', 'patches/0001-dighd-hd-grafikk.patch'):
            archive.add(HERE / name, arcname='dig-hd-source/engine/' + name)
        for name in UI:
            archive.add(HERE / 'pages' / name, arcname='dig-hd-source/engine/pages/' + name)
        archive.add(HERE.parent / 'docs/PAGES.md', arcname='dig-hd-source/BUILD.md')

    hashes = {str(file.relative_to(out)): hashlib.sha256(file.read_bytes()).hexdigest()
              for file in sorted(out.rglob('*')) if file.is_file()}
    info = {'scummvm_commit': commit, 'format': 1, 'includes_game_data': False, 'includes_hd_images': False, 'sha256': hashes}
    (out / 'build.json').write_text(json.dumps(info, indent=2) + '\n')
    return {'output': str(out), 'files': len(hashes) + 1,
            'bytes': sum(file.stat().st_size for file in out.rglob('*') if file.is_file())}


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--src', type=Path, default=HERE / 'scummvm-web')
    parser.add_argument('--out', type=Path, default=HERE.parent / 'out/pages')
    args = parser.parse_args()
    print(json.dumps(pack(args.src.resolve(), args.out.resolve()), indent=2))


if __name__ == '__main__':
    main()
