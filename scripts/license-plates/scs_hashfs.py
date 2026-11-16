"""Minimal reader for SCS HashFS v2 archives (.scs), the format ATS/ETS2 ship since 1.50.

Entries are looked up by CityHash64 (v1.0.3) of the path without its leading slash.
Plain files are zlib streams; packed textures (.tobj) keep their pixels in GDeflate
streams, decoded with the DirectStorage codec the game ships in bin/win_x64.
"""
import ctypes
import os
import struct
import uuid
import zlib

MASK = 0xFFFFFFFFFFFFFFFF
K0 = 0xC3A5C85C97CB3127
K1 = 0xB492B66FBE98F273
K2 = 0x9AE16A3B2F90404F
K3 = 0xC949D7C7509E6557
KMUL = 0x9DDFEA08EB382D69

# Metadata types of a HashFS v2 entry.
META_IMAGE = 1
META_PLAIN = 128
META_DIRECTORY = 129
META_MIP_0 = 130
META_MIP_TAIL = 132
COMPRESSION_ZLIB = 1
COMPRESSION_GDEFLATE = 3


def _u64(data, offset):
    return struct.unpack_from("<Q", data, offset)[0]


def _u32(data, offset):
    return struct.unpack_from("<I", data, offset)[0]


def _rotate(value, shift):
    return value if shift == 0 else ((value >> shift) | (value << (64 - shift))) & MASK


def _shift_mix(value):
    return value ^ (value >> 47)


def _hash16(low, high):
    a = ((low ^ high) * KMUL) & MASK
    a ^= a >> 47
    b = ((high ^ a) * KMUL) & MASK
    b ^= b >> 47
    return (b * KMUL) & MASK


def _hash_0_to_16(s):
    n = len(s)
    if n > 8:
        a, b = _u64(s, 0), _u64(s, n - 8)
        return _hash16(a, _rotate((b + n) & MASK, n)) ^ b
    if n >= 4:
        return _hash16((n + (_u32(s, 0) << 3)) & MASK, _u32(s, n - 4))
    if n > 0:
        y = s[0] + (s[n >> 1] << 8)
        z = n + (s[n - 1] << 2)
        return (_shift_mix(((y * K2) ^ (z * K3)) & MASK) * K2) & MASK
    return K2


def _hash_17_to_32(s):
    n = len(s)
    a = (_u64(s, 0) * K1) & MASK
    b = _u64(s, 8)
    c = (_u64(s, n - 8) * K2) & MASK
    d = (_u64(s, n - 16) * K0) & MASK
    return _hash16(
        (_rotate((a - b) & MASK, 43) + _rotate(c, 30) + d) & MASK,
        (a + _rotate(b ^ K3, 20) - c + n) & MASK,
    )


def _hash_33_to_64(s):
    n = len(s)
    z = _u64(s, 24)
    a = (_u64(s, 0) + (n + _u64(s, n - 16)) * K0) & MASK
    b = _rotate((a + z) & MASK, 52)
    c = _rotate(a, 37)
    a = (a + _u64(s, 8)) & MASK
    c = (c + _rotate(a, 7)) & MASK
    a = (a + _u64(s, 16)) & MASK
    vf = (a + z) & MASK
    vs = (b + _rotate(a, 31) + c) & MASK
    a = (_u64(s, 16) + _u64(s, n - 32)) & MASK
    z = _u64(s, n - 8)
    b = _rotate((a + z) & MASK, 52)
    c = _rotate(a, 37)
    a = (a + _u64(s, n - 24)) & MASK
    c = (c + _rotate(a, 7)) & MASK
    a = (a + _u64(s, n - 16)) & MASK
    wf = (a + z) & MASK
    ws = (b + _rotate(a, 31) + c) & MASK
    r = _shift_mix(((vf + ws) * K2 + (wf + vs) * K0) & MASK)
    return (_shift_mix((r * K0 + vs) & MASK) * K2) & MASK


def _weak_hash32(s, offset, a, b):
    w, x, y, z = (_u64(s, offset + 8 * i) for i in range(4))
    a = (a + w) & MASK
    b = _rotate((b + a + z) & MASK, 21)
    c = a
    a = (a + x + y) & MASK
    b = (b + _rotate(a, 44)) & MASK
    return (a + z) & MASK, (b + c) & MASK


def city_hash64(s):
    n = len(s)
    if n <= 16:
        return _hash_0_to_16(s)
    if n <= 32:
        return _hash_17_to_32(s)
    if n <= 64:
        return _hash_33_to_64(s)
    x = _u64(s, n - 40)
    y = (_u64(s, n - 16) + _u64(s, n - 56)) & MASK
    z = _hash16((_u64(s, n - 48) + n) & MASK, _u64(s, n - 24))
    v = _weak_hash32(s, n - 64, n, z)
    w = _weak_hash32(s, n - 32, (y + K1) & MASK, x)
    x = (x * K1 + _u64(s, 0)) & MASK
    remaining = (n - 1) & ~63
    offset = 0
    while True:
        x = (_rotate((x + y + v[0] + _u64(s, offset + 8)) & MASK, 37) * K1) & MASK
        y = (_rotate((y + v[1] + _u64(s, offset + 48)) & MASK, 42) * K1) & MASK
        x ^= w[1]
        y = (y + v[0] + _u64(s, offset + 40)) & MASK
        z = (_rotate((z + w[0]) & MASK, 33) * K1) & MASK
        v = _weak_hash32(s, offset, (v[1] * K1) & MASK, (x + w[0]) & MASK)
        w = _weak_hash32(s, offset + 32, (z + w[1]) & MASK, (y + _u64(s, offset + 16)) & MASK)
        z, x = x, z
        offset += 64
        remaining -= 64
        if remaining == 0:
            break
    return _hash16(
        (_hash16(v[0], w[0]) + _shift_mix(y) * K1 + z) & MASK,
        (_hash16(v[1], w[1]) + x) & MASK,
    )


class _GUID(ctypes.Structure):
    _fields_ = [("data", ctypes.c_ubyte * 16)]


class GDeflate:
    """GDeflate decoder backed by the game's DirectStorage runtime (Windows only)."""

    CODEC_IID = "84ef5121-9b43-4d03-b5c1-cc34606b262d"

    def __init__(self, install_dir):
        bin_dir = os.path.join(install_dir, "bin", "win_x64")
        library = ctypes.WinDLL(os.path.join(bin_dir, "dstoragecore.dll"))
        iid = _GUID()
        iid.data[:] = list(uuid.UUID(self.CODEC_IID).bytes_le)
        self.codec = ctypes.c_void_p()
        result = library.DStorageCreateCompressionCodecCore(
            ctypes.c_int(1), ctypes.c_uint32(1), ctypes.byref(iid), ctypes.byref(self.codec)
        )
        if result != 0:
            raise OSError(f"DStorageCreateCompressionCodecCore failed: {result & 0xFFFFFFFF:#x}")
        vtable = ctypes.cast(
            ctypes.cast(self.codec, ctypes.POINTER(ctypes.c_void_p))[0],
            ctypes.POINTER(ctypes.c_void_p),
        )
        # IDStorageCompressionCodec::DecompressBuffer is the 5th vtable slot.
        self._decompress = ctypes.WINFUNCTYPE(
            ctypes.c_long,
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_size_t,
            ctypes.c_void_p,
            ctypes.c_size_t,
            ctypes.POINTER(ctypes.c_size_t),
        )(vtable[4])

    def decompress(self, data, size):
        output = ctypes.create_string_buffer(size)
        used = ctypes.c_size_t(0)
        result = self._decompress(self.codec, data, len(data), output, size, ctypes.byref(used))
        if result != 0:
            raise OSError(f"GDeflate DecompressBuffer failed: {result & 0xFFFFFFFF:#x}")
        return output.raw[: used.value]


class Texture:
    def __init__(self, width, height, dxgi_format, pitch_alignment, data):
        self.width = width
        self.height = height
        self.dxgi_format = dxgi_format
        self.pitch_alignment = pitch_alignment
        self.data = data


class HashFS:
    def __init__(self, path, gdeflate=None):
        self.file = open(path, "rb")
        self.gdeflate = gdeflate
        header = self.file.read(64)
        (
            magic,
            version,
            _salt,
            _hash_method,
            entry_count,
            entry_table_size,
            _metadata_count,
            metadata_table_size,
            entry_table_offset,
            metadata_table_offset,
            _security_offset,
            _platform,
        ) = struct.unpack_from("<4sHH4sIIIIQQQB", header)
        if magic != b"SCS#" or version != 2:
            raise ValueError(f"{path} is not a HashFS v2 archive")
        self.file.seek(entry_table_offset)
        entries = zlib.decompress(self.file.read(entry_table_size))
        self.file.seek(metadata_table_offset)
        self.metadata = zlib.decompress(self.file.read(metadata_table_size))
        self.entries = {}
        for i in range(entry_count):
            path_hash, metadata_index, metadata_count, _flags = struct.unpack_from("<QIHH", entries, i * 16)
            self.entries[path_hash] = (metadata_index, metadata_count)

    def _metadata(self, path):
        entry = self.entries.get(city_hash64(path.strip("/").encode()))
        if entry is None:
            return None
        index, count = entry
        result = {}
        for k in range(count):
            value = _u32(self.metadata, (index + k) * 4)
            result[value >> 24] = value & 0xFFFFFF
        return result

    def _read_block(self, index):
        packed_size, size, _unknown, offset = struct.unpack_from("<IIII", self.metadata, index * 4)
        compression = packed_size >> 28
        self.file.seek(offset * 16)
        data = self.file.read(packed_size & 0x0FFFFFFF)
        size &= 0x0FFFFFFF
        if compression == COMPRESSION_ZLIB:
            return zlib.decompress(data)
        if compression == COMPRESSION_GDEFLATE:
            if self.gdeflate is None:
                raise ValueError("GDeflate data needs a GDeflate decoder")
            return self.gdeflate.decompress(data, size)
        if compression != 0:
            raise ValueError(f"unknown compression {compression}")
        return data

    def exists(self, path):
        return self._metadata(path) is not None

    def read(self, path):
        metadata = self._metadata(path)
        if metadata is None or META_PLAIN not in metadata:
            return None
        return self._read_block(metadata[META_PLAIN])

    def listdir(self, path):
        metadata = self._metadata(path)
        if metadata is None or META_DIRECTORY not in metadata:
            return None
        data = self._read_block(metadata[META_DIRECTORY])
        count = _u32(data, 0)
        lengths = data[4 : 4 + count]
        offset = 4 + count
        names = []
        for length in lengths:
            names.append(data[offset : offset + length].decode("utf-8", "replace"))
            offset += length
        return names

    def texture(self, path):
        """Mip 0 of a packed .tobj (single-image textures only)."""
        metadata = self._metadata(path)
        if metadata is None or META_IMAGE not in metadata:
            return None
        size_info, image_info = struct.unpack_from("<II", self.metadata, metadata[META_IMAGE] * 4)
        width = (size_info & 0xFFFF) + 1
        height = (size_info >> 16) + 1
        dxgi_format = (image_info >> 4) & 0xFF
        pitch_alignment = 1 << ((image_info >> 20) & 0xF)
        # Large textures split mip 0 into its own block; small ones keep every mip in the tail.
        data = self._read_block(metadata.get(META_MIP_0, metadata.get(META_MIP_TAIL)))
        return Texture(width, height, dxgi_format, pitch_alignment, data)
