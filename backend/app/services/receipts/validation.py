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


def parse_decimal(value: any) -> Decimal:
    """Safely convert any numeric value or string to Decimal with 2 decimal places."""
    if value is None:
        return Decimal("0.00")
    if isinstance(value, (int, float, Decimal)):
        try:
            return Decimal(str(value)).quantize(Decimal("0.01"))
        except (InvalidOperation, TypeError):
            return Decimal("0.00")

    # Clean string
    text = str(value).strip()
    # Remove currency symbols and common spacing
    cleaned = re.sub(r"[^\d.,-]", "", text)
    if not cleaned:
        return Decimal("0.00")

    # Handle comma as decimal separator if format is e.g. "12,50"
    if "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")
    elif "," in cleaned and "." in cleaned:
        # e.g. "1,234.56" -> remove thousands comma
        cleaned = cleaned.replace(",", "")

    try:
        val = Decimal(cleaned)
        return val.quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0.00")


def parse_date(date_str: any) -> date | None:
    """Parse various date formats into date object."""
    if not date_str:
        return None
    if isinstance(date_str, date) and not isinstance(date_str, datetime):
        return date_str
    if isinstance(date_str, datetime):
        return date_str.date()

    text = str(date_str).strip()
    formats = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%d/%m/%Y",
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
    if any(k in cat_lower for k in ["hardware", "computer", "laptop", "monitor", "equipment"]):
        return "Equipment"
    return "Other"


def normalize_currency(curr: str | None, full_text: str = "") -> str:
    """Normalize currency to 3-letter ISO code."""
    if curr:
        c = curr.upper().strip()
        if c in COMMON_CURRENCIES.values():
            return c
        if curr in COMMON_CURRENCIES:
            return COMMON_CURRENCIES[curr]

    # Detect symbol in full document text
    if "€" in full_text:
        return "EUR"
    if "£" in full_text:
        return "GBP"
    if "¥" in full_text:
        return "JPY"
    if "CAD" in full_text or "C$" in full_text:
        return "CAD"
    if "$" in full_text:
        return "USD"

    return "USD"


def validate_monetary_amounts(subtotal: Decimal, tax: Decimal, total: Decimal) -> list[str]:
    """Check mathematical coherence between Subtotal, Tax, and Total."""
    warnings = []
    if total <= Decimal("0.00"):
        warnings.append("Total amount could not be determined or is $0.00.")

    if subtotal > Decimal("0.00") and total > Decimal("0.00"):
        expected_total = subtotal + tax
        diff = abs(expected_total - total)
        # Allow small deviation (e.g. up to 0.05) for rounding or tips
        if diff > Decimal("0.05"):
            warnings.append(
                f"Subtotal ({subtotal}) + Tax ({tax}) = {expected_total}, which differs from Total ({total}) by {diff}."
            )

    return warnings
