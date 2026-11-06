import os
import xml.etree.ElementTree as ET
from PIL import Image

def test_svg_validity(path):
    assert os.path.exists(path), f"File missing: {path}"
    tree = ET.parse(path)
    root = tree.getroot()
    assert root.tag.endswith("svg"), f"Root tag is not svg in {path}"
    assert "viewBox" in root.attrib, f"viewBox missing in {path}"
    print(f"  [PASS] {os.path.basename(path)} is valid SVG (viewBox: {root.attrib.get('viewBox')})")

def test_png_dimensions(path, expected_w, expected_h):
    assert os.path.exists(path), f"File missing: {path}"
    with Image.open(path) as img:
        w, h = img.size
        assert (w, h) == (expected_w, expected_h), f"Dimensions mismatch for {path}: expected ({expected_w}, {expected_h}), got ({w}, {h})"
        print(f"  [PASS] {os.path.basename(path)} verified: {w}x{h}, mode: {img.mode}")

def main():
    print("=== NIVA BRAND IDENTITY VALIDATION SUITE ===")
    
    docs_assets = r"C:\niva\docs\assets"
    web_public = r"C:\niva\apps\web\public"
    web_icons = r"C:\niva\apps\web\public\icons"
    
    print("\n1. Testing SVG Vector Master Assets...")
    svgs = [
        "niva-symbol.svg",
        "niva-icon.svg",
        "favicon.svg",
        "niva-logo.svg",
        "niva-logo-dark.svg",
        "niva-logo-light.svg",
        "niva-banner.svg",
        "niva-social-preview.svg"
    ]
    for s in svgs:
        path = os.path.join(docs_assets, s)
        test_svg_validity(path)
        
    print("\n2. Testing High-Resolution Raster PNG Assets...")
    png_tests = [
        (os.path.join(docs_assets, "niva-icon-1024.png"), 1024, 1024),
        (os.path.join(docs_assets, "niva-symbol-1024.png"), 1024, 1024),
        (os.path.join(docs_assets, "niva-icon-512.png"), 512, 512),
        (os.path.join(docs_assets, "niva-symbol-512.png"), 512, 512),
        (os.path.join(web_icons, "icon-512x512.png"), 512, 512),
        (os.path.join(web_icons, "icon-192x192.png"), 192, 192),
        (os.path.join(web_icons, "icon-180x180.png"), 180, 180),
    ]
    for path, w, h in png_tests:
        test_png_dimensions(path, w, h)
        
    print("\n3. Testing Multi-Resolution favicon.ico...")
    ico_path = os.path.join(web_public, "favicon.ico")
    assert os.path.exists(ico_path), f"favicon.ico missing at {ico_path}"
    with Image.open(ico_path) as ico:
        print(f"  [PASS] favicon.ico verified (format: {ico.format}, size: {ico.size})")

    print("\n4. Checking Web Public Asset Mirroring...")
    for s in ["niva-symbol.svg", "niva-icon.svg", "favicon.svg", "niva-logo.svg", "niva-logo-dark.svg", "niva-logo-light.svg"]:
        p = os.path.join(web_public, s)
        test_svg_validity(p)

    print("\nALL BRAND IDENTITY ASSET CHECKS PASSED (100%)!")

if __name__ == "__main__":
    main()
