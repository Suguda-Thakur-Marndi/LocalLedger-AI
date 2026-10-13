import re
from datetime import date
from decimal import Decimal

from app.schemas.receipt_review import FieldSuggestion, ReceiptReviewData
from app.services.receipts.validation import (
    normalize_category,
    normalize_currency,
    parse_date,
    parse_decimal,
    parse_optional_decimal,
)


def extract_heuristically(text: str) -> tuple[ReceiptReviewData, dict[str, FieldSuggestion]]:
    """
    Extract structured receipt information from raw OCR text using regex and heuristics.
    Used for OCR-only mode or as fallback when Ollama is unavailable.
    """
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    # 1. Merchant: look at first 3 non-generic lines
    merchant = None
    merchant_conf = 0.3
    generic_words = {
        "receipt",
        "invoice",
        "tax invoice",
        "bill",
        "cash receipt",
        "sales receipt",
        "welcome",
    }
    for line in lines[:4]:
        if (
            line.lower() not in generic_words
            and len(line) > 2
            and not re.match(r"^[\d\s.,$/#:-]+$", line)
        ):
            merchant = line
            merchant_conf = 0.6
            break
    if not merchant and lines:
        merchant = lines[0]

    # 2. Invoice number
    invoice_num = None
    inv_conf = 0.3
    inv_match = re.search(
        r"(?:invoice\s+(?:number|num|no\.?|#)|receipt\s+(?:number|num|no\.?|#)|invoice|inv|receipt|bill|order|ref|ticket)[#:\s.-]+([A-Z0-9_-]{3,25})",
        text,
        re.IGNORECASE,
    )
    if inv_match:
        extracted_num = inv_match.group(1).strip()
        if extracted_num.lower() not in {"number", "num", "no"}:
            invoice_num = extracted_num
            inv_conf = 0.7

    # 3. Date
    tx_date = parse_date(text)
    date_conf = 0.7 if tx_date else 0.0

    # 4. Amounts
    # Find Total
    total_val = None
    total_conf = 0.0
    total_patterns = [
        r"(?:grand\s+total|total\s+amount|total|balance\s+due|amount\s+due|net\s+payable)[\s:]*[$€£]?\s*([0-9]+[.,][0-9]{2})",
        r"[$€£]\s*([0-9]+[.,][0-9]{2})\s*$",
    ]
    for pattern in total_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
        if matches:
            total_val = parse_optional_decimal(matches[-1])
            if total_val is not None:
                total_conf = 0.7
                break

    # Find Subtotal
    subtotal_val = None
    subtotal_conf = 0.0
    sub_match = re.search(
        r"(?:subtotal|sub\s+total|net\s+amount)[\s:]*[$€£]?\s*([0-9]+[.,][0-9]{2})",
        text,
        re.IGNORECASE,
    )
    if sub_match:
        subtotal_val = parse_optional_decimal(sub_match.group(1))
        if subtotal_val is not None:
            subtotal_conf = 0.7

    # Find Tax
    tax_val = None
    tax_conf = 0.0
    tax_match = re.search(
        r"(?:tax|vat|gst|sales\s+tax|hst)(?:\s*\([^)]*\))?[\s:]*[$€£]?\s*([0-9]+[.,][0-9]{2})",
        text,
        re.IGNORECASE,
    )
    if tax_match:
        tax_val = parse_optional_decimal(tax_match.group(1))
        if tax_val is not None:
            tax_conf = 0.7

    # If subtotal is missing but total and tax are present
    if subtotal_val is None and total_val is not None:
        if tax_val is not None and total_val > tax_val:
            subtotal_val = total_val - tax_val
            subtotal_conf = 0.5
        else:
            subtotal_val = total_val
            subtotal_conf = 0.5

    # 5. Currency
    currency = normalize_currency(None, text)
    curr_conf = 0.8 if currency else 0.0

    # 6. Payment method
    payment_method = None
    pm_conf = 0.0
    pm_match = re.search(
        r"\b(visa|mastercard|amex|american\s+express|discover|cash|debit|apple\s+pay|google\s+pay)\b",
        text,
        re.IGNORECASE,
    )
    if pm_match:
        pm_raw = pm_match.group(1).title()
        payment_method = pm_raw
        pm_conf = 0.75

    # 7. Category inference
    category = normalize_category(merchant or text)

    extracted = ReceiptReviewData(
        merchant=merchant,
        invoice_number=invoice_num,
        transaction_date=tx_date,
        subtotal=subtotal_val,
        tax=tax_val,
        total=total_val,
        currency=currency,
        category=category,
        payment_method=payment_method,
        notes=None,
        line_items=[],
    )

    suggestions = {
        "merchant": FieldSuggestion(
            value=extracted.merchant, confidence=merchant_conf if merchant else 0.0, source="ocr_rules"
        ),
        "invoice_number": FieldSuggestion(
            value=extracted.invoice_number, confidence=inv_conf if invoice_num else 0.0, source="ocr_rules"
        ),
        "transaction_date": FieldSuggestion(
            value=extracted.transaction_date, confidence=date_conf, source="ocr_rules"
        ),
        "subtotal": FieldSuggestion(
            value=float(extracted.subtotal) if extracted.subtotal is not None else None,
            confidence=subtotal_conf,
            source="ocr_rules",
        ),
        "tax": FieldSuggestion(
            value=float(extracted.tax) if extracted.tax is not None else None,
            confidence=tax_conf,
            source="ocr_rules",
        ),
        "total": FieldSuggestion(
            value=float(extracted.total) if extracted.total is not None else None,
            confidence=total_conf,
            source="ocr_rules",
        ),
        "currency": FieldSuggestion(value=extracted.currency, confidence=curr_conf, source="ocr_rules"),
        "category": FieldSuggestion(
            value=extracted.category, confidence=0.5, source="ocr_rules", is_inferred=True
        ),
        "payment_method": FieldSuggestion(
            value=extracted.payment_method, confidence=pm_conf, source="ocr_rules"
        ),
    }

    return extracted, suggestions
