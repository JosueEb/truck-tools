# ATS license plate catalog

`src-tauri/src/embeds/license_plates_ats.json` holds, per state, every plate design of
`def/country/<state>/license_plates.sii` (the markup the game wraps around the text, the text
slots and the backgrounds) plus the glyph metrics of `font/license_plate/<state>.font`.
`public/license-plates-ats/<state>/` holds the plate backgrounds and font atlases (SDF or
MSDF) used by the in-app preview.

It reads the installed game directly (Windows, Python 3 + Pillow):

```bash
python gen_license_plates_ats.py "<ATS install dir>" <repo root>
```

`scs_hashfs.py` reads HashFS v2 archives by path. Textures are GDeflate-compressed and are
decoded with the DirectStorage codec the game ships in `bin/win_x64/dstoragecore.dll`.

Emergency plate types (police, fire, medical) and designs whose markup is split around the
text are left out. Generated from ATS 1.62.2.2.
