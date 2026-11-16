"""Builds the ATS license plate catalog from the installed game files.

    python gen_license_plates_ats.py "<ATS install dir>" <repo root>

Writes:
  - src-tauri/src/embeds/license_plates_ats.json: per state, its plate designs (one per
    license_plate_data template), the markup the game wraps around the text, the plate
    backgrounds and the glyph metrics of its SDF font.
  - public/license-plates-ats/<state>/*.png: plate backgrounds and font atlases for the
    in-app preview.

Needs Pillow and Windows (GDeflate textures are decoded with the game's DirectStorage DLL).
"""
import io
import json
import os
import re
import struct
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scs_hashfs import GDeflate, HashFS  # noqa: E402

# Emergency/service plates are not useful on player vehicles.
SKIPPED_TYPES = {"police", "police_hp", "fire", "medical"}
TYPE_ORDER = ["truck", "trailer", "car", "rigid", "truck_city", "bus"]
# DXGI formats stored as plain 32-bit pixels.
BGRA_FORMATS = {87, 91}
BGRX_FORMATS = {88, 93}
RGBA_FORMATS = {28, 29}
R8_FORMATS = {61}
# DXGI block-compressed formats Pillow decodes from a DX10 .dds.
BC_FORMATS = {71: 8, 72: 8, 74: 16, 75: 16, 77: 16, 78: 16, 80: 8, 83: 16, 98: 16, 99: 16}


def strip_comments(text):
    return "\n".join(re.sub(r"#.*$", "", line) if '"' not in line else line for line in text.splitlines())


def units(text, unit_type):
    pattern = r"^\s*" + unit_type + r"\s*:\s*(\S+)\s*\{(.*?)^\s*\}"
    return re.findall(pattern, text, re.M | re.S)


def attribute(body, key):
    match = re.search(r"^\s*" + key + r"\s*:\s*(.+?)\s*(?:#.*)?$", body, re.M)
    return match.group(1).strip().strip('"') if match else None


def array(body, key):
    return re.findall(r"^\s*" + key + r'\[\]\s*:\s*"([^"]*)"', body, re.M)


def texture_png(texture):
    w, h = texture.width, texture.height
    fmt = texture.dxgi_format
    if fmt in BGRA_FORMATS | BGRX_FORMATS | RGBA_FORMATS | R8_FORMATS:
        bpp = 1 if fmt in R8_FORMATS else 4
        pitch = -(-w * bpp // texture.pitch_alignment) * texture.pitch_alignment
        rows = b"".join(texture.data[y * pitch : y * pitch + w * bpp] for y in range(h))
        if fmt in R8_FORMATS:
            return Image.frombytes("L", (w, h), rows)
        if fmt in BGRX_FORMATS:
            return Image.frombytes("RGB", (w, h), rows, "raw", "BGRX")
        return Image.frombytes("RGBA", (w, h), rows, "raw", "BGRA" if fmt in BGRA_FORMATS else "RGBA")
    if fmt in BC_FORMATS:
        block = BC_FORMATS[fmt]
        blocks_w, blocks_h = max(1, (w + 3) // 4), max(1, (h + 3) // 4)
        pitch = -(-blocks_w * block // texture.pitch_alignment) * texture.pitch_alignment
        data = b"".join(
            texture.data[y * pitch : y * pitch + blocks_w * block] for y in range(blocks_h)
        )
        header = struct.pack(
            "<4sIIIIIII44sII4sIIIIIIIIII",
            b"DDS ", 124, 0x1 | 0x2 | 0x4 | 0x1000 | 0x80000, h, w, len(data), 0, 1, b"\0" * 44,
            32, 0x4, b"DX10", 0, 0, 0, 0, 0,
            0x1000, 0, 0, 0, 0,
        )
        dx10 = struct.pack("<IIIII", fmt, 3, 0, 1, 0)
        return Image.open(io.BytesIO(header + dx10 + data)).convert("RGBA")
    raise ValueError(f"unsupported texture format {fmt}")


def material_texture(fs, material_path):
    """Path of the .tobj a .mat samples."""
    text = fs.read(material_path)
    if text is None:
        return None
    # New materials name it `source : "x.tobj"`, older ones `texture : "x.tobj"`.
    match = re.search(r'(?:source|texture)\s*:\s*"([^"]+\.tobj)"', text.decode("utf-8", "replace"))
    if not match:
        return None
    source = match.group(1)
    if not source.startswith("/"):
        source = os.path.dirname("/" + material_path) + "/" + source
    return source.lstrip("/")


def read_font(fs, state, out_dir):
    text = fs.read(f"font/license_plate/{state}.font")
    if text is None:
        return None
    text = text.decode("utf-8", "replace")
    images = []
    for material, _w, _h, scale_x, scale_y, padding in re.findall(
        r"^image:\s*([^,]+),\s*(\d+),\s*(\d+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)", text, re.M
    ):
        tobj = material_texture(fs, material.strip().lstrip("/"))
        texture = fs.texture(tobj) if tobj else None
        if texture is None:
            return None
        file_name = f"font_{len(images)}.png"
        # Single-channel SDF atlases stay grayscale; MSDF ones keep RGB (the distance is the
        # median of the three channels).
        atlas = texture_png(texture)
        atlas = atlas if atlas.mode == "L" else atlas.convert("RGB")
        atlas.save(os.path.join(out_dir, file_name), optimize=True)
        images.append({"file": file_name, "scaleX": float(scale_x), "scaleY": float(scale_y), "padding": float(padding)})
    glyphs = {}
    for code, *metrics in re.findall(
        r"^x([0-9a-f]{4}),\s*" + r",\s*".join([r"(-?[\d.]+)"] * 7) + r"\s*,\s*(\d+)", text, re.M
    ):
        values = [round(float(v), 4) for v in metrics[:7]] + [int(metrics[7])]
        glyphs[chr(int(code, 16))] = values
    vert_span = re.search(r"^vert_span:\s*([\d.]+)", text, re.M)
    return {
        "images": images,
        "vertSpan": float(vert_span.group(1)) if vert_span else 28.0,
        # atlasX, atlasY, width, height, planeX, planeY, advance, image
        "glyphs": glyphs,
    }


def design_parts(template, defs):
    """Splits a template into the markup before/after the text and the text slots."""
    tokens = []
    for char in template:
        options = defs.get(char) if char.isdigit() else None
        if char.isdigit() and options is None:
            return None
        if options is None:
            tokens.append(("text", [char]))
        elif any("<" in option for option in options):
            if len(set(options)) > 1:
                return None
            tokens.append(("markup", options[0]))
        else:
            tokens.append(("text", options))
    text_positions = [i for i, (kind, _) in enumerate(tokens) if kind == "text"]
    if not text_positions:
        return None
    first, last = text_positions[0], text_positions[-1]
    if any(kind == "markup" for kind, _ in tokens[first : last + 1]):
        return None
    return {
        "prefix": "".join(value for _, value in tokens[:first]),
        "suffix": "".join(value for _, value in tokens[last + 1 :]),
        "slots": [options for _, options in tokens[first : last + 1]],
    }


def main():
    install, repo = sys.argv[1], sys.argv[2]
    gdeflate = GDeflate(install)
    defs_fs = HashFS(os.path.join(install, "def.scs"))
    base_fs = HashFS(os.path.join(install, "base.scs"), gdeflate)
    public_dir = os.path.join(repo, "public", "license-plates-ats")

    states = {}
    for entry in defs_fs.listdir("def/country") or []:
        if not entry.startswith("/"):
            continue
        state = entry[1:]
        plates = defs_fs.read(f"def/country/{state}/license_plates.sii")
        info = defs_fs.read(f"def/country/{state}.sui")
        if plates is None or info is None:
            continue
        info = info.decode("utf-8", "replace")
        out_dir = os.path.join(public_dir, state)
        os.makedirs(out_dir, exist_ok=True)

        backgrounds = {}

        def background(name):
            if not name:
                return None
            if name in backgrounds:
                return backgrounds[name]
            tobj = material_texture(base_fs, f"material/ui/lp/{state}/{name}.mat")
            texture = base_fs.texture(tobj) if tobj else None
            file_name = None
            if texture is not None:
                file_name = os.path.splitext(os.path.basename(tobj))[0] + ".png"
                path = os.path.join(out_dir, file_name)
                if not os.path.exists(path):
                    texture_png(texture).save(path, optimize=True)
            backgrounds[name] = file_name
            return file_name

        designs = []
        seen = set()
        plates_text = strip_comments(plates.decode("utf-8", "replace"))
        for name, body in units(plates_text, "license_plate_data"):
            plate_type = attribute(body, "type") or name.split(".")[-1]
            if plate_type in SKIPPED_TYPES:
                continue
            defs = {}
            for index in range(10):
                values = array(body, f"def{index}")
                if values:
                    defs[str(index)] = values
            # A plate that names only one side uses it on both; with none, the game falls back
            # to the state's front/rear images.
            front_name = attribute(body, "background_front")
            rear_name = attribute(body, "background_rear")
            front = background(front_name or rear_name or "front")
            rear = background(rear_name or front_name or "rear")
            for template in array(body, "templates"):
                parts = design_parts(template, defs)
                if parts is None:
                    continue
                # Buses and rigid trucks often reuse the truck plate verbatim.
                key = (front, rear, parts["prefix"], parts["suffix"], json.dumps(parts["slots"]))
                if key in seen:
                    continue
                seen.add(key)
                designs.append(
                    {
                        "id": f"{plate_type}_{len([d for d in designs if d['type'] == plate_type])}",
                        "type": plate_type,
                        "template": template,
                        "backgroundFront": front or rear,
                        "backgroundRear": rear or front,
                        **parts,
                    }
                )

        font = read_font(base_fs, state, out_dir)
        if not designs or font is None:
            print(f"skipping {state}: no designs or font")
            continue
        designs.sort(key=lambda d: (TYPE_ORDER.index(d["type"]) if d["type"] in TYPE_ORDER else 99, d["id"]))
        states[state] = {
            "name": attribute(info, "name") or state.replace("_", " ").title(),
            "code": attribute(info, "country_code") or "",
            "chars": "".join(sorted(ch for ch in font["glyphs"] if ch.isalnum() or ch in " -.")),
            "designs": designs,
            "font": font,
        }

    catalog = {"states": dict(sorted(states.items()))}
    output = os.path.join(repo, "src-tauri", "src", "embeds", "license_plates_ats.json")
    with open(output, "w", encoding="utf-8") as file:
        json.dump(catalog, file, ensure_ascii=False, separators=(",", ":"))
    total = sum(len(s["designs"]) for s in states.values())
    print(f"{len(states)} states, {total} designs -> {output}")


if __name__ == "__main__":
    main()
