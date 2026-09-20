"""
Product name normalizer — extracts model_family, storage_gb, ram_gb, color, sku.

Shared between backend (batch normalization script) and scraper (pipeline auto-normalization).
Pure Python, no database or async dependencies.
"""

import re

# ─── AZ → EN product name translations ─────────────────────────────
# Applied before normalization so AZ and EN names produce the same model_family.
AZ_PRODUCT_TRANSLATIONS: list[tuple[str, str]] = [
    ("aktiv səsboğma ilə", "with Active Noise Cancellation"),
    ("aktiv səs-küy azaltma ilə", "with Active Noise Cancellation"),
    ("səsboğma ilə", "with Noise Cancellation"),
    ("aktiv səsboğma", "Active Noise Cancellation"),
    ("səsboğma", "Noise Cancellation"),
]

# ─── Color dictionary ───────────────────────────────────────────────
KNOWN_COLORS = [
    # English multi-word
    "midnight", "starlight", "sky blue", "space gray", "space grey",
    "space black", "cloud white",
    "natural titanium", "black titanium", "white titanium", "desert titanium",
    "cobalt violet", "icyblue", "icy blue", "silver shadow",
    "phantom black", "midnight black", "ocean cyan", "mocha brown", "navy peony blue",
    "titanium purple", "glacier blue",
    "navy blue", "dark blue", "light blue", "velvet black", "velvet grey",
    "dawning orange", "forest owl", "forest green", "jade black", "sakura pink",
    "verona green", "mica silver", "jet black", "jetblack",
    "titanium gray", "titanium grey", "titanium black", "light gold",
    "light violet", "dark green", "midnight black", "desert gold",
    "meteor silver", "sleek blue", "sleek black",
    "cosmic black", "cosmic orange", "deep blue",
    # English single-word
    "black", "white", "blue", "green", "pink", "yellow", "red",
    "gold", "silver", "gray", "grey", "orange",
    "purple", "brown", "beige", "cream", "coral", "teal",
    "mint", "lavender", "bronze", "graphite", "titanium", "amber",
    "citrus", "indigo", "blush", "plum", "denim", "sage", "mist",
    "cosmic", "deep", "neon", "dark",
    # Device-specific colors
    "moonstone", "obsidian", "moonlight", "emerald", "sunrise",
    "cyan", "ghost", "turquoise", "mocha", "silvery", "creamy",
    "rose", "blackish", "khaki", "ivory", "glacier",
    "ultramarine", "volcanic", "atlantic", "petrol",
    "tapestry", "tendril", "feather", "olive", "nebula", "starry",
    "kingfisher", "swan", "parrot", "peacock",
    "sandy", "titan", "ocean", "lime", "ink", "ripple", "veil",
    # Azerbaijani colors
    "çəhrayı qızıl", "mavi göy",
    "ağ", "qara", "göy", "yaşıl", "qırmızı", "narıncı", "sarı",
    "bənövşəyi", "bənövşəy", "gecəyarısı", "gecəyarı",
    "gümüşü", "gümüş", "qızılı", "qızıl",
    "çəhrayı", "boz", "mavi", "tünd",
    # Turkish colors (Ttec, etc.)
    "lacivert", "siyah", "gri",
]
KNOWN_COLORS.sort(key=len, reverse=True)

COLOR_PATTERN = re.compile(
    r"(?:\b|(?<=[\s,]))("
    + "|".join(re.escape(c) for c in KNOWN_COLORS)
    + r")(?:\b|(?=[\s,]))",
    re.IGNORECASE,
)

# Map AZ color names to English for consistent attribute storage
AZ_COLOR_MAP = {
    "ağ": "White", "qara": "Black", "göy": "Blue", "yaşıl": "Green",
    "qırmızı": "Red", "narıncı": "Orange", "sarı": "Yellow",
    "bənövşəyi": "Purple", "bənövşəy": "Purple",
    "gecəyarısı": "Midnight", "gecəyarı": "Midnight",
    "gümüşü": "Silver", "gümüş": "Silver",
    "qızılı": "Gold", "qızıl": "Gold",
    "çəhrayı qızıl": "Rose Gold", "çəhrayı": "Pink",
    "boz": "Gray", "mavi": "Blue", "mavi göy": "Blue",
    "tünd": "Dark",
    # Turkish colors
    "lacivert": "Navy Blue", "siyah": "Black", "gri": "Gray",
}

# ─── Apple SKU pattern ──────────────────────────────────────────────
APPLE_SKU_PATTERN = re.compile(
    r"\b(M[A-Z0-9]{4,7})(?:/[A-Z])?\b",
)

# ─── Apple/Mac chip pattern ─────────────────────────────────────────
CHIP_PATTERN = re.compile(
    r"\b(M[1-9]\d?\s+(?:Max|Ultra|Pro)|M[1-9]\d?|A\d{1,2}\s+Pro|A\d{1,2})\b",
    re.IGNORECASE,
)

# ─── Watch size pattern (40mm, 42mm, 44mm, 46mm, 49mm) ─────────────
WATCH_SIZE_PATTERN = re.compile(r"\b(\d{2})m{1,2}\b", re.IGNORECASE)

# ─── Storage patterns ───────────────────────────────────────────────
STORAGE_PATTERN = re.compile(
    r"(?<!\d[/x])(\d{1,4})\s*([GT])B\b",
    re.IGNORECASE,
)

RAM_STORAGE_PATTERN = re.compile(
    r"(\d{1,3})\s*(?:GB)?\s*[/]\s*(\d{1,4})\s*([GT])B\b",
    re.IGNORECASE,
)

# ─── AZ product name prefixes to strip ──────────────────────────────
AZ_PREFIXES = [
    "Smartfon ", "Notbuk ", "Noutbuk ",
    "Simsiz qulaqlıq ", "Simsiz qulaqlıqlar ",
    "Qulaqlıq ", "Qulaqlıqlar ",
    "Smart saat ", "Klaviatura ", "Kabel ",
    "Qidalanma adapteri ", "Trekpad ",
]


def _normalize_apple_watch_family(family: str) -> str:
    """Simplify Apple Watch model_family to series only (without size).

    'Apple Watch Series 11 GPS 46mm Jet Black Aluminium Case with Sport Band M/L'
    → 'Apple Watch Series 11'
    """
    m = re.match(
        r"(Apple\s+Watch\s+"
        r"(?:Ultra(?:\s+Series)?\s*\d?|Series\s+\d+|SE\b\s*\d?))"  # series part
        r".*",
        family,
        re.IGNORECASE,
    )
    if m:
        series = re.sub(r"\s+", " ", m.group(1)).strip()
        # Normalize "Gen.2" / "Gen 2" / "(2024)" out of SE names
        series = re.sub(r"\s*Gen\.?\s*\d+", "", series)
        series = re.sub(r"\s*\(\d{4}\)", "", series)
        # Normalize "Ultra Series 2" → "Ultra 2"
        series = re.sub(r"Ultra\s+Series\s+(\d)", r"Ultra \1", series)
        # Clean trailing numbers from SE (SE 3, SE 2, etc. are marketing names)
        series = re.sub(r"\bSE\s+\d+", "SE", series)
        return series
    return family


def _normalize_family_case(family: str) -> str:
    """Normalize model family casing for consistent grouping."""
    apple_prefixed = re.match(
        r"^(?:APPLE|Apple)\s+((?:iPhone|iPad|MacBook|AirPods|Apple\s+Watch|"
        r"EarPods|AirTag|HomePod|Mac\s+\w+).*)",
        family,
        re.IGNORECASE,
    )
    if apple_prefixed:
        family = apple_prefixed.group(1)
    # Simplify Apple Watch families to series + size
    if re.match(r"Apple\s+Watch", family, re.IGNORECASE):
        family = _normalize_apple_watch_family(family)
    return family


def _should_remove_parens(match: re.Match) -> str:
    """Keep chip identifiers like (A18 Pro), (M4); remove everything else."""
    content = match.group(1).strip()
    if re.match(r"^[AM]\d{1,2}(?:\s+Pro)?$", content):
        return content
    return ""


def normalize_name(name: str) -> dict:
    """Extract model_family, storage_gb, ram_gb, color, sku from a product name."""
    result = {
        "model_family": None,
        "storage_gb": None,
        "ram_gb": None,
        "color": None,
        "sku": None,
        "chip": None,
        "size_mm": None,
    }

    # Normalize whitespace: replace non-breaking spaces, tabs, etc.
    cleaned = re.sub(r"[\u00a0\u200b\u2009\u2007\t]+", " ", name).strip()

    for prefix in AZ_PREFIXES:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
            break

    # Translate AZ product feature phrases to EN for consistent matching
    for az_phrase, en_phrase in AZ_PRODUCT_TRANSLATIONS:
        cleaned = re.sub(re.escape(az_phrase), en_phrase, cleaned, flags=re.IGNORECASE)

    # Clean messy separators: "Pro, , Cosmic" → "Pro, Cosmic"
    cleaned = re.sub(r",\s*,", ",", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

    # Extract color
    color_matches = list(COLOR_PATTERN.finditer(cleaned))
    if color_matches:
        raw_color = color_matches[-1].group(1).strip()
        result["color"] = AZ_COLOR_MAP.get(
            raw_color.lower(), raw_color.strip().title()
        )

    # Extract Apple SKU (e.g. MHFA4RU from "MHFA4RU/A")
    sku_match = APPLE_SKU_PATTERN.search(cleaned)
    if sku_match:
        result["sku"] = sku_match.group(1)

    # Extract RAM/Storage combined
    ram_storage_match = RAM_STORAGE_PATTERN.search(cleaned)
    if ram_storage_match:
        ram = int(ram_storage_match.group(1))
        storage = int(ram_storage_match.group(2))
        unit = ram_storage_match.group(3).upper()
        if unit == "T":
            storage *= 1024
        if ram <= 64:
            result["ram_gb"] = ram
        result["storage_gb"] = storage
    else:
        storage_matches = list(STORAGE_PATTERN.finditer(cleaned))
        if storage_matches:
            for m in storage_matches:
                val = int(m.group(1))
                unit = m.group(2).upper()
                if unit == "T":
                    val *= 1024
                if val >= 32:
                    result["storage_gb"] = val
                    break

    # Build model family
    family = cleaned
    family = RAM_STORAGE_PATTERN.sub("", family)
    family = STORAGE_PATTERN.sub("", family)
    family = COLOR_PATTERN.sub("", family)
    family = re.sub(r"\(([^)]*)\)", _should_remove_parens, family)
    family = re.sub(r"\bM[A-Z0-9]{4,7}(?:/[A-Z])?\b", "", family)
    family = re.sub(r"\b\d{2}NR[A-Z0-9\-]+\b", "", family)
    family = re.sub(
        r"\d+C\s*CPU\s*/\s*\d+C\s*GPU", "", family, flags=re.IGNORECASE
    )
    family = re.sub(r'(\d+)["\u2033\u201d]', r"\1", family)
    family = re.sub(r"[\s,\-/]+$", "", family)
    family = re.sub(r"\s{2,}", " ", family).strip()
    family = re.sub(r"\b\d*\s*[GT]B\b", "", family, flags=re.IGNORECASE).strip()
    family = re.sub(r"\s{2,}", " ", family).strip()
    family = re.sub(r"[\s,\-/]+$", "", family).strip()
    family = re.sub(r'[,\s"]+$', "", family).strip()

    if family:
        # Normalize "Pro Plus" → "Pro+" for consistent grouping
        family = re.sub(r"\bPro\s+Plus\b", "Pro+", family, flags=re.IGNORECASE)

        # Clean MacBook families: strip "chip with ...CPU...GPU" descriptors, trailing SSD
        family = re.sub(
            r"\s+chip\s+with\s+\d+-core\s+CPU[^,]*",
            "", family, flags=re.IGNORECASE,
        )
        family = re.sub(r"[,\s/]*\bSSD\b", "", family, flags=re.IGNORECASE)

        # Normalize MacBook screen sizes: 13.6 → 13, 14.2 → 14, 15.3 → 15, 16.2 → 16
        family = re.sub(
            r"\b(1[3-6])\.\d\b",
            r"\1", family,
        )

        # Extract chip attribute ONLY for Mac products (M4, M5 Pro, M5 Max, etc.)
        is_mac = bool(re.search(r"\bMac[Bb]ook\b", family, re.IGNORECASE))
        if is_mac:
            chip_match = CHIP_PATTERN.search(family)
            if chip_match:
                raw_chip = chip_match.group(1).strip()
                result["chip"] = raw_chip[0].upper() + raw_chip[1:]

        # Extract watch size attribute (40mm, 42mm, 44mm, 46mm, 49mm)
        size_match = WATCH_SIZE_PATTERN.search(family)
        if size_match and re.search(r"\bwatch\b", family, re.IGNORECASE):
            result["size_mm"] = int(size_match.group(1))

        # Strip trailing noise: lone "Color", "Edition", trailing punctuation
        family = re.sub(r"\bColou?r\b", "", family, flags=re.IGNORECASE)
        family = re.sub(r"\s{2,}", " ", family).strip()
        family = re.sub(r"[\s,\-/]+$", "", family).strip()

        result["model_family"] = _normalize_family_case(family)

    return result
