import os
import subprocess
import shutil
import xml.etree.ElementTree as ET
from PIL import Image

DOCS_ASSETS = r"C:\niva\docs\assets"
WEB_PUBLIC = r"C:\niva\apps\web\public"
WEB_ICONS = r"C:\niva\apps\web\public\icons"
SCRATCH_DIR = r"C:\Users\swarn\.gemini\antigravity\brain\bd98708d-6929-40ad-871c-f290dd0612a0\scratch"

os.makedirs(DOCS_ASSETS, exist_ok=True)
os.makedirs(WEB_PUBLIC, exist_ok=True)
os.makedirs(WEB_ICONS, exist_ok=True)
os.makedirs(SCRATCH_DIR, exist_ok=True)

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# -------------------------------------------------------------
# 1. niva-symbol.svg (Standalone Neural N Symbol, Transparent)
# -------------------------------------------------------------
SYMBOL_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Left Pillar: Deep Emerald -> Vibrant Emerald -->
    <linearGradient id="nivaSymbolLeft" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="60%" stop-color="#059669" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>

    <!-- Diagonal Traverse: Radiant Emerald -> Turquoise -> Teal -->
    <linearGradient id="nivaSymbolDiag" x1="10%" y1="10%" x2="90%" y2="90%">
      <stop offset="0%" stop-color="#34D399" />
      <stop offset="42%" stop-color="#06B6D4" />
      <stop offset="82%" stop-color="#14B8A6" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>

    <!-- Right Pillar: Teal -> Vibrant Emerald -> Subtle Lime -->
    <linearGradient id="nivaSymbolRight" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0D9488" />
      <stop offset="45%" stop-color="#10B981" />
      <stop offset="85%" stop-color="#84CC16" />
      <stop offset="100%" stop-color="#A3E635" />
    </linearGradient>
  </defs>

  <!-- Left Pillar -->
  <path d="M 96 400 C 96 411, 105 420, 116 420 L 148 420 C 159 420, 168 411, 168 400 L 168 184 L 96 112 Z" fill="url(#nivaSymbolLeft)" />

  <!-- Diagonal Traverse -->
  <path d="M 96 112 C 96 100, 106 92, 118 92 L 148 92 C 160 92, 172 98, 180 108 L 396 364 C 406 376, 416 388, 416 400 C 416 412, 406 420, 394 420 L 364 420 C 352 420, 340 414, 332 404 L 116 148 C 106 136, 96 124, 96 112 Z" fill="url(#nivaSymbolDiag)" />

  <!-- Right Pillar -->
  <path d="M 344 328 L 416 400 L 416 112 C 416 101, 407 92, 396 92 L 364 92 C 353 92, 344 101, 344 112 Z" fill="url(#nivaSymbolRight)" />
</svg>"""

# -------------------------------------------------------------
# 2. niva-icon.svg (Square Application Icon with Midnight Container)
# -------------------------------------------------------------
ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="nivaIconBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0D131F" />
      <stop offset="50%" stop-color="#070A10" />
      <stop offset="100%" stop-color="#04060A" />
    </linearGradient>

    <!-- Subtle Border Glow Gradient -->
    <linearGradient id="nivaIconBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.4" />
      <stop offset="50%" stop-color="#06B6D4" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#84CC16" stop-opacity="0.3" />
    </linearGradient>

    <!-- Symbol Gradients -->
    <linearGradient id="nivaIconLeft" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="60%" stop-color="#059669" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>

    <linearGradient id="nivaIconDiag" x1="10%" y1="10%" x2="90%" y2="90%">
      <stop offset="0%" stop-color="#34D399" />
      <stop offset="42%" stop-color="#06B6D4" />
      <stop offset="82%" stop-color="#14B8A6" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>

    <linearGradient id="nivaIconRight" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0D9488" />
      <stop offset="45%" stop-color="#10B981" />
      <stop offset="85%" stop-color="#84CC16" />
      <stop offset="100%" stop-color="#A3E635" />
    </linearGradient>
  </defs>

  <!-- Squircle Base Plate -->
  <rect x="8" y="8" width="496" height="496" rx="112" fill="url(#nivaIconBg)" stroke="url(#nivaIconBorder)" stroke-width="4" />

  <!-- Neural N Symbol Centered -->
  <g transform="translate(32, 32) scale(0.875)">
    <!-- Left Pillar -->
    <path d="M 96 400 C 96 411, 105 420, 116 420 L 148 420 C 159 420, 168 411, 168 400 L 168 184 L 96 112 Z" fill="url(#nivaIconLeft)" />

    <!-- Diagonal Traverse -->
    <path d="M 96 112 C 96 100, 106 92, 118 92 L 148 92 C 160 92, 172 98, 180 108 L 396 364 C 406 376, 416 388, 416 400 C 416 412, 406 420, 394 420 L 364 420 C 352 420, 340 414, 332 404 L 116 148 C 106 136, 96 124, 96 112 Z" fill="url(#nivaIconDiag)" />

    <!-- Right Pillar -->
    <path d="M 344 328 L 416 400 L 416 112 C 416 101, 407 92, 396 92 L 364 92 C 353 92, 344 101, 344 112 Z" fill="url(#nivaIconRight)" />
  </g>
</svg>"""

# -------------------------------------------------------------
# 3. favicon.svg (Scalable Browser Tab Favicon)
# -------------------------------------------------------------
FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
  <defs>
    <linearGradient id="favBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0C121D" />
      <stop offset="100%" stop-color="#04060A" />
    </linearGradient>
    <linearGradient id="favLeft" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>
    <linearGradient id="favDiag" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399" />
      <stop offset="50%" stop-color="#06B6D4" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>
    <linearGradient id="favRight" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0D9488" />
      <stop offset="50%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#A3E635" />
    </linearGradient>
  </defs>

  <!-- Rounded Squircle Backdrop for crisp legibility in both dark & light browser chrome -->
  <rect width="64" height="64" rx="16" fill="url(#favBg)" stroke="#10B981" stroke-opacity="0.3" stroke-width="1.5" />

  <!-- Neural N Symbol scaled to 64x64 -->
  <g transform="translate(6, 6) scale(0.1015625)">
    <path d="M 96 400 C 96 411, 105 420, 116 420 L 148 420 C 159 420, 168 411, 168 400 L 168 184 L 96 112 Z" fill="url(#favLeft)" />
    <path d="M 96 112 C 96 100, 106 92, 118 92 L 148 92 C 160 92, 172 98, 180 108 L 396 364 C 406 376, 416 388, 416 400 C 416 412, 406 420, 394 420 L 364 420 C 352 420, 340 414, 332 404 L 116 148 C 106 136, 96 124, 96 112 Z" fill="url(#favDiag)" />
    <path d="M 344 328 L 416 400 L 416 112 C 416 101, 407 92, 396 92 L 364 92 C 353 92, 344 101, 344 112 Z" fill="url(#favRight)" />
  </g>
</svg>"""

# -------------------------------------------------------------
# 4. niva-logo.svg & niva-logo-dark.svg (Horizontal Logo for Dark Theme)
# -------------------------------------------------------------
LOGO_DARK_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" width="100%" height="100%">
  <defs>
    <!-- Left Pillar -->
    <linearGradient id="darkLeft" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="60%" stop-color="#059669" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>

    <!-- Diagonal Traverse -->
    <linearGradient id="darkDiag" x1="10%" y1="10%" x2="90%" y2="90%">
      <stop offset="0%" stop-color="#34D399" />
      <stop offset="42%" stop-color="#06B6D4" />
      <stop offset="82%" stop-color="#14B8A6" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>

    <!-- Right Pillar -->
    <linearGradient id="darkRight" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0D9488" />
      <stop offset="45%" stop-color="#10B981" />
      <stop offset="85%" stop-color="#84CC16" />
      <stop offset="100%" stop-color="#A3E635" />
    </linearGradient>

    <!-- Accent for letter A -->
    <linearGradient id="darkAccentA" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="50%" stop-color="#06B6D4" />
      <stop offset="100%" stop-color="#A3E635" />
    </linearGradient>
  </defs>

  <!-- Neural N Symbol (Height 80px) -->
  <g transform="translate(16, 20) scale(0.15625)">
    <!-- Left Pillar -->
    <path d="M 96 400 C 96 411, 105 420, 116 420 L 148 420 C 159 420, 168 411, 168 400 L 168 184 L 96 112 Z" fill="url(#darkLeft)" />
    <!-- Diagonal Traverse -->
    <path d="M 96 112 C 96 100, 106 92, 118 92 L 148 92 C 160 92, 172 98, 180 108 L 396 364 C 406 376, 416 388, 416 400 C 416 412, 406 420, 394 420 L 364 420 C 352 420, 340 414, 332 404 L 116 148 C 106 136, 96 124, 96 112 Z" fill="url(#darkDiag)" />
    <!-- Right Pillar -->
    <path d="M 344 328 L 416 400 L 416 112 C 416 101, 407 92, 396 92 L 364 92 C 353 92, 344 101, 344 112 Z" fill="url(#darkRight)" />
  </g>

  <!-- Typography: NIVA Wordmark -->
  <g transform="translate(116, 68)">
    <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', 'Helvetica Neue', sans-serif" font-weight="900" font-size="44" letter-spacing="7" fill="#F8FAFC">
      NIV<tspan fill="url(#darkAccentA)">A</tspan>
    </text>
  </g>

  <!-- Subtitle Tagline -->
  <g transform="translate(118, 96)">
    <text font-family="'JetBrains Mono', 'Fira Code', Menlo, -apple-system, monospace" font-size="11" font-weight="600" letter-spacing="3" fill="#94A3B8">
      YOUR LIFE, UNDERSTOOD.
    </text>
  </g>
</svg>"""

# -------------------------------------------------------------
# 5. niva-logo-light.svg (Horizontal Logo for Light Theme)
# -------------------------------------------------------------
LOGO_LIGHT_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" width="100%" height="100%">
  <defs>
    <!-- High-Contrast Left Pillar -->
    <linearGradient id="lightLeft" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#064E3B" />
      <stop offset="60%" stop-color="#047857" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>

    <!-- High-Contrast Diagonal Traverse -->
    <linearGradient id="lightDiag" x1="10%" y1="10%" x2="90%" y2="90%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="45%" stop-color="#0891B2" />
      <stop offset="85%" stop-color="#0D9488" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>

    <!-- High-Contrast Right Pillar -->
    <linearGradient id="lightRight" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0F766E" />
      <stop offset="45%" stop-color="#047857" />
      <stop offset="85%" stop-color="#4D7C0F" />
      <stop offset="100%" stop-color="#65A30D" />
    </linearGradient>

    <!-- Accent for letter A in light mode -->
    <linearGradient id="lightAccentA" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="50%" stop-color="#0891B2" />
      <stop offset="100%" stop-color="#65A30D" />
    </linearGradient>
  </defs>

  <!-- Neural N Symbol (Height 80px) -->
  <g transform="translate(16, 20) scale(0.15625)">
    <!-- Left Pillar -->
    <path d="M 96 400 C 96 411, 105 420, 116 420 L 148 420 C 159 420, 168 411, 168 400 L 168 184 L 96 112 Z" fill="url(#lightLeft)" />
    <!-- Diagonal Traverse -->
    <path d="M 96 112 C 96 100, 106 92, 118 92 L 148 92 C 160 92, 172 98, 180 108 L 396 364 C 406 376, 416 388, 416 400 C 416 412, 406 420, 394 420 L 364 420 C 352 420, 340 414, 332 404 L 116 148 C 106 136, 96 124, 96 112 Z" fill="url(#lightDiag)" />
    <!-- Right Pillar -->
    <path d="M 344 328 L 416 400 L 416 112 C 416 101, 407 92, 396 92 L 364 92 C 353 92, 344 101, 344 112 Z" fill="url(#lightRight)" />
  </g>

  <!-- Typography: NIVA Wordmark (Dark Slate #0F172A) -->
  <g transform="translate(116, 68)">
    <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', 'Helvetica Neue', sans-serif" font-weight="900" font-size="44" letter-spacing="7" fill="#0F172A">
      NIV<tspan fill="url(#lightAccentA)">A</tspan>
    </text>
  </g>

  <!-- Subtitle Tagline (Medium Slate #475569) -->
  <g transform="translate(118, 96)">
    <text font-family="'JetBrains Mono', 'Fira Code', Menlo, -apple-system, monospace" font-size="11" font-weight="600" letter-spacing="3" fill="#475569">
      YOUR LIFE, UNDERSTOOD.
    </text>
  </g>
</svg>"""

svg_assets = {
    "niva-symbol.svg": SYMBOL_SVG,
    "niva-icon.svg": ICON_SVG,
    "favicon.svg": FAVICON_SVG,
    "niva-logo.svg": LOGO_DARK_SVG,
    "niva-logo-dark.svg": LOGO_DARK_SVG,
    "niva-logo-light.svg": LOGO_LIGHT_SVG,
}

print("=== 1. Validating and Writing SVG Files ===")
for filename, content in svg_assets.items():
    ET.fromstring(content)
    print(f"  [OK] Valid XML: {filename}")
    with open(os.path.join(DOCS_ASSETS, filename), "w", encoding="utf-8") as f:
        f.write(content)
    with open(os.path.join(WEB_PUBLIC, filename), "w", encoding="utf-8") as f:
        f.write(content)

# -------------------------------------------------------------
# Function to render an SVG string to PNG at exact target resolution
# -------------------------------------------------------------
def render_svg_to_png(svg_content, output_png_path, size=1024, transparent=True):
    temp_html = os.path.join(SCRATCH_DIR, f"temp_{size}_{os.path.basename(output_png_path)}.html")
    bg_style = "background: transparent;" if transparent else "background: #04060A;"
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    html, body {{
      width: {size}px;
      height: {size}px;
      overflow: hidden;
      {bg_style}
    }}
    svg {{
      width: 100%;
      height: 100%;
      display: block;
    }}
  </style>
</head>
<body>
  {svg_content}
</body>
</html>"""
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_content)

    cmd = [
        CHROME,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--force-device-scale-factor=1",
        "--default-background-color=00000000" if transparent else "--default-background-color=FF04060A",
        f"--window-size={size},{size}",
        f"--screenshot={output_png_path}",
        f"file:///{temp_html.replace(os.sep, '/')}"
    ]
    subprocess.run(cmd, check=True)
    if os.path.exists(temp_html):
        os.remove(temp_html)
    print(f"  [PNG GENERATED] {output_png_path} ({size}x{size})")

print("\n=== 2. Generating High-Resolution 1024x1024 Master PNGs ===")
raw_icon_1024 = os.path.join(SCRATCH_DIR, "raw_icon_1024.png")
raw_symbol_1024 = os.path.join(SCRATCH_DIR, "raw_symbol_1024.png")

render_svg_to_png(ICON_SVG, raw_icon_1024, size=1024, transparent=True)
render_svg_to_png(SYMBOL_SVG, raw_symbol_1024, size=1024, transparent=True)

# Copy master 1024 PNGs
shutil.copy(raw_icon_1024, os.path.join(DOCS_ASSETS, "niva-icon-1024.png"))
shutil.copy(raw_symbol_1024, os.path.join(DOCS_ASSETS, "niva-symbol-1024.png"))
shutil.copy(raw_icon_1024, os.path.join(WEB_ICONS, "niva-icon-1024.png"))
shutil.copy(raw_symbol_1024, os.path.join(WEB_ICONS, "niva-symbol-1024.png"))

print("\n=== 3. Downsampling Precision High-Quality PNG Variants (Pillow LANCZOS) ===")
# Generate 512x512
img_icon = Image.open(raw_icon_1024)
img_symbol = Image.open(raw_symbol_1024)

icon_512 = img_icon.resize((512, 512), Image.Resampling.LANCZOS)
symbol_512 = img_symbol.resize((512, 512), Image.Resampling.LANCZOS)

icon_512.save(os.path.join(DOCS_ASSETS, "niva-icon-512.png"), format="PNG")
symbol_512.save(os.path.join(DOCS_ASSETS, "niva-symbol-512.png"), format="PNG")

icon_512.save(os.path.join(WEB_ICONS, "niva-icon-512.png"), format="PNG")
symbol_512.save(os.path.join(WEB_ICONS, "niva-symbol-512.png"), format="PNG")
icon_512.save(os.path.join(WEB_ICONS, "icon-512x512.png"), format="PNG")

# Generate 192x192 & 180x180 for PWA
icon_192 = img_icon.resize((192, 192), Image.Resampling.LANCZOS)
icon_192.save(os.path.join(WEB_ICONS, "icon-192x192.png"), format="PNG")

icon_180 = img_icon.resize((180, 180), Image.Resampling.LANCZOS)
icon_180.save(os.path.join(WEB_ICONS, "icon-180x180.png"), format="PNG")

print("\n=== 4. Generating Multi-Resolution favicon.ico (16, 32, 48) ===")
ico_16 = img_icon.resize((16, 16), Image.Resampling.LANCZOS)
ico_32 = img_icon.resize((32, 32), Image.Resampling.LANCZOS)
ico_48 = img_icon.resize((48, 48), Image.Resampling.LANCZOS)

ico_path_web = os.path.join(WEB_PUBLIC, "favicon.ico")
ico_32.save(
    ico_path_web,
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=[ico_16, ico_48]
)
print(f"  [ICO SAVED] {ico_path_web}")

print("\n=== All Brand Identity Vector and Raster Assets Generated Successfully! ===")
