#!/usr/bin/env python3
"""Integration regression for HD inventory shading, using private game data.

Needs Pillow and a copied save made in the PDA room (79), with inventory closed.
Game-derived fixtures and screenshots are written only to --out.
"""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import json

from PIL import Image, ImageChops


def run(args, name, mod, save=False):
    folder = args.out / name
    folder.mkdir(parents=True, exist_ok=True)
    config = folder / "scummvm.ini"
    config.write_text("[scummvm]\nfullscreen=false\naspect_ratio=false\nconfirm_exit=false\n")
    env = {k: v for k, v in os.environ.items() if not k.startswith("DIGHD_")}
    env.update(SDL_VIDEODRIVER="dummy", SDL_AUDIODRIVER="dummy",
               DIGHD_MOD=str(mod), DIGHD_TEXT="off", DIGHD_MANGLER="0",
               DIGHD_DUMP_DIR=str(folder), DIGHD_DUMP_EVERY="20",
               DIGHD_DUMP_FLAT="1", DIGHD_VERIFY="1", DIGHD_QUIT_AT="180")
    cmd = [str(args.binary), "--config=" + str(config), "--path=" + str(args.game),
           "--savepath=" + str(args.out / "saves"), "--no-fullscreen", "--debuglevel=1"]
    if save:
        cmd.append("--save-slot=1")
        env["DIGHD_TEST_KEYS"] = "90:i,160:i"
    else:
        env.update(DIGHD_SKIP_VIDEO="1", DIGHD_TEST_ROOM="97")
    cmd.append("dig")
    with (folder / "log.txt").open("w") as log:
        subprocess.run(cmd, env=env, stdout=log, stderr=subprocess.STDOUT,
                       timeout=120, check=True)
    log = (folder / "log.txt").read_text()
    checks = re.findall(r"verify frame \d+: (\d+) screen pixels differ from the whole screen built again", log)
    assert checks and all(int(n) == 0 for n in checks), name + ": partial redraw differs"
    return folder, len(checks)


def build_nearest(args):
    output = args.out / "nearest"
    output.mkdir(parents=True, exist_ok=True)
    (output / "mod.json").write_text(json.dumps({"format": 1, "scale": 4}))
    for group in ("rooms", "objects", "costumes"):
        (output / group).mkdir(exist_ok=True)
        for path in (args.mod / group).glob("*_idx.png"):
            if group == "rooms" and int(path.name[4:7]) not in (79, 97):
                continue
            if group == "costumes" and int(path.name[7:10]) not in (286, 287, 288, 289):
                continue
            shutil.copy2(path, output / group / path.name)
            image = Image.open(path).convert("RGBA")
            mask = path.with_name(path.name.replace("_idx", "_mask"))
            if mask.exists():
                shutil.copy2(mask, output / group / mask.name)
                image.putalpha(Image.open(mask).convert("L"))
            image.resize((image.width * 4, image.height * 4), Image.Resampling.NEAREST).save(
                output / group / path.name.replace("_idx", ""))
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("binary", "game", "mod", "save", "out"):
        parser.add_argument("--" + name, required=True, type=Path)
    args = parser.parse_args()
    for key in vars(args):
        setattr(args, key, getattr(args, key).resolve())
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "saves").mkdir(exist_ok=True)
    shutil.copy2(args.save, args.out / "saves/dig.s01")
    nearest = build_nearest(args)
    results = {}
    for name, room, save in (("nearest-inventory", 79, True), ("nearest-crystals", 97, False)):
        folder, count = run(args, name, nearest, save)
        hd = folder / f"frame_000140_room{room:03d}.png"
        flat = hd.with_name(hd.stem + "_flat.png")
        assert hd.exists(), f"{name}: expected room {room}; provide a closed-inventory save from room 79"
        assert not ImageChops.difference(Image.open(hd).convert("RGB"), Image.open(flat).convert("RGB")).getbbox(), name
        results[name] = {"redraw_checks": count, "exact_original_pixels": True}

    # A constant HD image must remain constant through one inventory cell.
    # The old per-source-pixel ratios reconstruct the original hand/portrait
    # texture over this fixture and fail the unique-colour assertion.
    uniform = args.out / "uniform-hd"
    uniform.mkdir(exist_ok=True)
    (uniform / "mod.json").write_text(json.dumps({"format": 1, "scale": 4}))
    for group, stem in (("rooms", "room079"), ("objects", "obj547_01")):
        (uniform / group).mkdir(exist_ok=True)
        idx = args.mod / group / (stem + "_idx.png")
        shutil.copy2(idx, uniform / group / idx.name)
        im = Image.open(idx)
        Image.new("RGBA", (im.width * 4, im.height * 4), (137, 91, 59, 255)).save(uniform / group / (stem + ".png"))
        mask = idx.with_name(stem + "_mask.png")
        if mask.exists():
            shutil.copy2(mask, uniform / group / mask.name)
    folder, count = run(args, "constant-hd-inventory", uniform, True)
    crop = (70 * 4, 82 * 4, 92 * 4, 98 * 4)
    for frame in (80, 140):
        path = folder / f"frame_{frame:06d}_room079.png"
        colours = Image.open(path).convert("RGB").crop(crop).getcolors(100000)
        assert colours and len(colours) == 1, f"frame {frame}: original texture leaks into constant HD ({len(colours or [])} colours)"
    results["constant-hd-inventory"] = {"redraw_checks": count, "no_original_texture_imprint": True}
    (args.out / "result.json").write_text(json.dumps(results, indent=2))
    print("PASS: exact original inventory/crystals and no original texture in constant HD")


if __name__ == "__main__":
    main()
