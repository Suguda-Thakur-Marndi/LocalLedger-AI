import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

VALID_CATEGORIES = [
    "Meals & Entertainment",
    "Office Supplies",
    "Software & Subscriptions",
    "Travel",
    "Utilities",
    "Professional Services",
    "Equipment",
    "Other",
]

COMMON_CURRENCIES = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "C$": "CAD",
    "A$": "AUD",
    "USD": "USD",
    "EUR": "EUR",
    "GBP": "GBP",
    "CAD": "CAD",
    "AUD": "AUD",
    "JPY": "JPY",
    "CHF": "CHF",
    "INR": "INR",
}


def parse_optional_decimal(value: any) -> Decimal | None:
    """Safely convert any numeric value or string to Decimal with 2 decimal places, or None if missing."""
    if value is None:
        return None
    if isinstance(value, (int, float, Decimal)):
        try:
            return Decimal(str(value)).quantize(Decimal("0.01"))
        except (InvalidOperation, TypeError):
            return None

    text = str(value).strip()
    cleaned = re.sub(r"[^\d.,-]", "", text)
    if not cleaned:
        return None

    if "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")
    elif "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(",", "")

    try:
        val = Decimal(cleaned)
        return val.quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None


def parse_decimal(value: any, default: Decimal = Decimal("0.00")) -> Decimal:
    """Safely convert any numeric value or string to Decimal with 2 decimal places."""
    res = parse_optional_decimal(value)
    return res if res is not None else default


def parse_date(date_str: any) -> date | None:
    """Parse various date formats into date object without defaulting to today."""
    if not date_str:
        return None
    if isinstance(date_str, date) and not isinstance(date_str, datetime):
        return date_str
    if isinstance(date_str, datetime):
        return date_str.date()

    text = str(date_str).strip()
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%m-%d-%Y",
        "%b %d, %Y",
        "%B %d, %Y",
        "%d %b %Y",
        "%d %B %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    # Try regex matching YYYY-MM-DD anywhere in string
    match = re.search(r"\b(20\d\d)[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b", text)
    if match:
        try:
            return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        except ValueError:
            pass

    # Try regex matching DD/MM/YYYY
    match_dmy = re.search(r"\b(0[1-9]|[12]\d|3[01])[-/](0[1-9]|1[0-2])[-/](20\d\d)\b", text)
    if match_dmy:
        try:
            return date(int(match_dmy.group(3)), int(match_dmy.group(2)), int(match_dmy.group(1)))
        except ValueError:
            pass

    return None


def normalize_category(cat: str | None) -> str:
    """Normalize extracted category to one of standard categories."""
    if not cat:
        return "Other"
    cat_lower = cat.lower()
    for standard in VALID_CATEGORIES:
        if standard.lower() == cat_lower:
            return standard
    if any(
        k in cat_lower
        for k in ["meal", "food", "restaurant", "dining", "lunch", "coffee", "cafe", "dinner"]
    ):
        return "Meals & Entertainment"
    if any(k in cat_lower for k in ["office", "stationery", "paper", "pen", "supplies"]):
        return "Office Supplies"
    if any(
        k in cat_lower
        for k in ["software", "saas", "subscription", "cloud", "hosting", "github", "aws"]
    ):
        return "Software & Subscriptions"
    if any(
        k in cat_lower
        for k in ["travel", "flight", "hotel", "taxi", "uber", "transit", "train", "parking"]
    ):
        return "Travel"
    if any(
        k in cat_lower for k in ["utility", "utilities", "electric", "water", "internet", "phone"]
    ):
        return "Utilities"
    if any(k in cat_lower for k in ["legal", "accounting", "consulting", "service"]):
        return "Professional Services"
    if any(k in cat_lower for k in ["shoe", "shoes", "boot", "hardware", "computer", "laptop", "monitor", "equipment", "tool", "wear"]):
        return "Equipment"
    return "Other"


KNOWN_CURRENCY_CODES = {
    "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "INR", "MYR", "SGD",
    "NZD", "HKD", "SEK", "NOK", "DKK", "ZAR", "BRL", "MXN", "AED", "SAR",
    "THB", "IDR", "PHP", "VND", "PLN", "TRY", "CNY", "KRW"
}


def normalize_currency(curr: str | None, full_text: str = "") -> str | None:
    """
    Normalize currency to 3-letter ISO code.
    Returns None if currency cannot be reliably detected.
    Does NOT default to USD when the currency is unknown.
    """
    if curr:
        c = curr.upper().strip()
        # Direct lookup in known symbols
        if curr in COMMON_CURRENCIES:
            return COMMON_CURRENCIES[curr]
        if c in COMMON_CURRENCIES:
            return COMMON_CURRENCIES[c]
        if c == "RM":
            return "MYR"
        if c == "S$":
            return "SGD"
        if c in KNOWN_CURRENCY_CODES:
            return c
        # Reject GST/VAT tax rate markers often confused for currency
        if c in {"SR", "ZR", "TX", "GST", "VAT", "TAX", "TOT", "SUB"}:
            c = None
        elif re.match(r"^[A-Z]{3}$", c):
            return c

    # Contextual check in document text
    text_upper = full_text.upper()
    if any(kw in text_upper for kw in ["MYR", "RINGGIT", "JOHOR", "MASAI", "KUALA LUMPUR", "SELANGOR", "PENANG", "MALAYSIA"]):
        return "MYR"
    if re.search(r"\bRM\s*\d+", full_text):
        return "MYR"
    if "€" in full_text:
        return "EUR"
    if "£" in full_text:
        return "GBP"
    if "¥" in full_text:
        return "JPY"
    if "CAD" in full_text or "C$" in full_text:
        return "CAD"
    if "AUD" in full_text or "A$" in full_text:
        return "AUD"
    if "SGD" in full_text or "S$" in full_text:
        return "SGD"
    if "$" in full_text:
        return "USD"

    return None


def validate_monetary_amounts(
    subtotal: Decimal | None,
    tax: Decimal | None,
    total: Decimal | None,
) -> list[str]:
    """Check mathematical coherence between Subtotal, Tax, and Total."""
    warnings = []
    if total is None:
        warnings.append("Total amount could not be determined from the document.")
    elif total <= Decimal("0.00"):
        warnings.append("Total amount extracted is $0.00 or negative; please verify with the original receipt.")

    if subtotal is not None and total is not None:
        effective_tax = tax if tax is not None else Decimal("0.00")
        expected_total = subtotal + effective_tax
        diff = abs(expected_total - total)
        # Allow small deviation (e.g. up to 0.05) for rounding or tips
        if diff > Decimal("0.05"):
            warnings.append(
                f"Subtotal ({subtotal}) + Tax ({effective_tax}) = {expected_total}, which differs from Total ({total}) by {diff}."
            )

    return warnings
