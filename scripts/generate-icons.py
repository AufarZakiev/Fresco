"""
Generate all Fresco icon files from a source PNG.

Usage: python scripts/generate-icons.py <source.png>
Output: src-tauri/icons/
"""

import struct
import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ICONS_DIR = Path(__file__).parent.parent / "src-tauri" / "icons"
MASTER_SIZE = 1024
PADDING_RATIO = 0.08  # 8% padding on each side


def crop_and_center(src: Image.Image, target_size: int) -> Image.Image:
    """Crop to content, add padding, center in a square canvas."""
    arr = np.array(src.convert("RGBA"))

    # Find content bounding box via alpha
    has_content = arr[:, :, 3] > 10
    rows = np.any(has_content, axis=1)
    cols = np.any(has_content, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]

    # Crop to content
    cropped = src.crop((cmin, rmin, cmax + 1, rmax + 1))
    cw, ch = cropped.size

    # Fit into square with padding
    usable = int(target_size * (1 - 2 * PADDING_RATIO))
    scale = min(usable / cw, usable / ch)
    new_w = int(cw * scale)
    new_h = int(ch * scale)
    resized = cropped.resize((new_w, new_h), Image.LANCZOS)

    # Center on transparent canvas
    canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    offset_x = (target_size - new_w) // 2
    offset_y = (target_size - new_h) // 2
    canvas.paste(resized, (offset_x, offset_y), resized)
    return canvas


def build_ico(master: Image.Image, sizes: list[int]) -> bytes:
    """Build .ico using Pillow — pass one image, let Pillow resize internally."""
    buf = io.BytesIO()
    master.save(buf, format="ICO", sizes=[(sz, sz) for sz in sizes])
    return buf.getvalue()


ICNS_TYPES = {
    16: b"icp4",
    32: b"icp5",
    64: b"icp6",
    128: b"ic07",
    256: b"ic08",
    512: b"ic09",
    1024: b"ic10",
}


def build_icns(master: Image.Image) -> bytes:
    """Build a minimal .icns file with PNG entries."""
    entries = []
    for px_size, ostype in ICNS_TYPES.items():
        img = (
            master.resize((px_size, px_size), Image.LANCZOS)
            if px_size != master.width
            else master.copy()
        )
        png_buf = io.BytesIO()
        img.save(png_buf, format="PNG")
        png_data = png_buf.getvalue()
        entry_len = 8 + len(png_data)
        entries.append(struct.pack(">4sI", ostype, entry_len) + png_data)

    body = b"".join(entries)
    header = struct.pack(">4sI", b"icns", 8 + len(body))
    return header + body


def make_tray_icon(master: Image.Image, size: int) -> Image.Image:
    """White silhouette from the master (threshold alpha → white)."""
    img = master.resize((size, size), Image.LANCZOS).convert("RGBA")
    arr = np.array(img)
    # Where there's content (alpha > 30), make it white; rest stays transparent
    mask = arr[:, :, 3] > 30
    result = np.zeros_like(arr)
    result[mask] = [255, 255, 255, 255]
    return Image.fromarray(result)


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/generate-icons.py <source.png>")
        sys.exit(1)

    source_path = sys.argv[1]
    print(f"Source: {source_path}")

    src = Image.open(source_path).convert("RGBA")
    master = crop_and_center(src, MASTER_SIZE)
    print(f"Master: {MASTER_SIZE}x{MASTER_SIZE}")

    # icon.png (512x512)
    master.resize((512, 512), Image.LANCZOS).save(ICONS_DIR / "icon.png")
    print("  icon.png")

    # icon.ico
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    (ICONS_DIR / "icon.ico").write_bytes(build_ico(master, ico_sizes))
    print("  icon.ico")

    # icon.icns
    (ICONS_DIR / "icon.icns").write_bytes(build_icns(master))
    print("  icon.icns")

    # Standard sizes
    for name, px in {"32x32.png": 32, "64x64.png": 64, "128x128.png": 128, "128x128@2x.png": 256}.items():
        master.resize((px, px), Image.LANCZOS).save(ICONS_DIR / name)
        print(f"  {name}")

    # Windows Square logos
    for sz in [30, 44, 71, 89, 107, 142, 150, 284, 310]:
        name = f"Square{sz}x{sz}Logo.png"
        master.resize((sz, sz), Image.LANCZOS).save(ICONS_DIR / name)
        print(f"  {name}")

    # StoreLogo
    master.resize((50, 50), Image.LANCZOS).save(ICONS_DIR / "StoreLogo.png")
    print("  StoreLogo.png")

    # Tray icon (white silhouette)
    make_tray_icon(master, 64).save(ICONS_DIR / "tray-icon.png")
    print("  tray-icon.png")

    print("Done!")


if __name__ == "__main__":
    main()
