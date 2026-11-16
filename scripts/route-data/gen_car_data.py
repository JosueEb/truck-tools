"""Builds src-tauri/src/embeds/car_catalog_ats.json from the installed ATS game files.

Reads car jobs and cargos from def.scs, car models from the DLC archives that add
drivable cars and English names from locale.scs:
    python gen_car_data.py "<ATS install dir>" <repo root>

The archives are HashFS v2; instead of parsing the entry table, every zlib stream is
inflated and the .sii files that match are kept, which is enough for these small defs.
"""
import json
import os
import re
import sys
import zlib

# Archives that hold car_job_data / car_cargo_data and the drivable car models.
DEF_ARCHIVES = ["def.scs"]
CAR_ARCHIVES = ["dlc_rt_ford.scs"]
LOCALE_ARCHIVE = "locale.scs"
ZLIB_HEADER = re.compile(rb"\x78[\x01\x5e\x9c\xda]")


def inflate_all(path, wanted):
    """Yields every inflated stream of the archive that contains one of `wanted`."""
    with open(path, "rb") as archive:
        data = archive.read()
    for match in ZLIB_HEADER.finditer(data):
        try:
            text = zlib.decompressobj().decompress(data[match.start() : match.start() + 8_000_000])
        except zlib.error:
            continue
        if len(text) > 20 and any(token in text for token in wanted):
            yield text.decode("utf-8", "replace")


def units(text, unit_type):
    return re.findall(r"^" + unit_type + r"\s*:\s*(\S+)\s*\{(.*?)^\}", text, re.M | re.S)


def values(body, key):
    return re.findall(r"^\s*" + key + r"(?:\[\])?\s*:\s*(.+?)\s*(?:#.*)?$", body, re.M)


def strip_string(value):
    return value.strip().strip('"')


def localized(value, strings):
    match = re.fullmatch(r"@@(.+)@@", strip_string(value))
    return strings.get(match.group(1), "") if match else strip_string(value)


def read_english_strings(install):
    """Strings of every locale file whose lang_name is US English."""
    strings = {}
    for text in inflate_all(os.path.join(install, LOCALE_ARCHIVE), [b'"lang_name"']):
        pairs = re.findall(r'key\[\]: "(.*?)"\s*val\[\]: "(.*?)"', text)
        block = dict(pairs)
        if block.get("lang_name") == "English (United States)":
            strings.update(block)
    return strings


def main():
    install, repo = sys.argv[1], sys.argv[2]
    strings = read_english_strings(install)

    jobs, cargos = {}, {}
    for archive in DEF_ARCHIVES:
        for text in inflate_all(os.path.join(install, archive), [b"car_job_data", b"car_cargo_data"]):
            for name, body in units(text, "car_cargo_data"):
                cargos[name.removeprefix("car_cargo.")] = {
                    "name": localized((values(body, "name") or [""])[0], strings),
                    "fragility": float((values(body, "fragility") or ["0"])[0]),
                }
            for name, body in units(text, "car_job_data"):
                distance = re.findall(r"\d+", (values(body, "company_distance") or ["(0, 0)"])[0])
                jobs[name.removeprefix("car_job.")] = {
                    "name": localized((values(body, "name") or [""])[0], strings),
                    "cargos": [c.removeprefix("car_cargo.") for c in values(body, "cargos")],
                    "vehicle_types": values(body, "vehicle_types"),
                    "express": (values(body, "express") or ["false"])[0] == "true",
                    "distance": [int(distance[0]), int(distance[1])],
                    "rating": float((values(body, "required_courier_rating") or ["0"])[0]),
                }

    # Company cars are "<brand>_<model>_<color>"; their type comes from the model's tags.
    models = {}
    for archive in CAR_ARCHIVES:
        for text in inflate_all(os.path.join(install, archive), [b"accessory_truck_data"]):
            for name, body in units(text, "accessory_truck_data"):
                if not name.startswith("vehicle.") or "/def/vehicle/car/" not in body:
                    continue
                token = name.removeprefix("vehicle.").replace(".", "_")
                # Model names live in each DLC's own locale; the token reads fine as a label.
                info = [localized(v, strings) for v in values(body, "info")]
                models[token] = {
                    "name": " ".join(part for part in info[:2] if part)
                    or token.replace("_", " ").title(),
                    "types": [strip_string(tag) for tag in values(body, "tags")],
                }

    catalog = {
        "jobs": dict(sorted(jobs.items())),
        "cargos": dict(sorted(cargos.items())),
        "models": dict(sorted(models.items())),
    }
    output = os.path.join(repo, "src-tauri", "src", "embeds", "car_catalog_ats.json")
    with open(output, "w", encoding="utf-8") as file:
        json.dump(catalog, file, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(jobs)} jobs, {len(cargos)} cargos, {len(models)} car models -> {output}")


if __name__ == "__main__":
    main()
