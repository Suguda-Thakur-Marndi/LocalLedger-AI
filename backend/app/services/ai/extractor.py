import json
import re
from datetime import date
from decimal import Decimal

from app.core.config import settings
from app.core.logging import logger
from app.schemas.receipt_review import FieldSuggestion, ReceiptReviewData
from app.services.ai.ollama_client import ollama_client
from app.services.ai.prompt_templates import (
    RECEIPT_EXTRACTION_SYSTEM_PROMPT,
    RECEIPT_EXTRACTION_USER_PROMPT,
)
from app.services.receipts.receipt_parser import extract_heuristically
from app.services.receipts.validation import (
    normalize_category,
    normalize_currency,
    parse_date,
    parse_decimal,
    validate_monetary_amounts,
)


def _clean_json_response(raw_text: str) -> dict | None:
    """Strip markdown code fence if model returned ```json ... ``` and parse JSON."""
    if not raw_text:
        return None
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Search for first { and last }
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError:
                pass
    return None


async def extract_receipt_data(
    text: str,
) -> tuple[ReceiptReviewData, dict[str, FieldSuggestion], list[str], bool, str | None]:
    """
    Main extraction orchestrator:
    1. Attempts extraction via local Ollama.
    2. Validates JSON and amounts using Decimal.
    3. Falls back gracefully to regex/heuristic rules if Ollama is unavailable.
    4. Generates mathematical integrity warnings.
    """
    if not text.strip():
        extracted, suggestions = extract_heuristically("")
        warnings = ["Document appears blank or no text could be extracted."]
        return extracted, suggestions, warnings, False, None

    # Step 1: Check if Ollama is accessible
    ollama_health = await ollama_client.check_health()
    if ollama_health.get("connected") and ollama_health.get("model_present"):
        active_model = ollama_health.get("active_model") or settings.OLLAMA_MODEL
        user_prompt = RECEIPT_EXTRACTION_USER_PROMPT.format(receipt_text=text[:4000])
        response_str = await ollama_client.generate_json(
            prompt=user_prompt,
            system_prompt=RECEIPT_EXTRACTION_SYSTEM_PROMPT,
            model=active_model,
        )

        parsed_json = _clean_json_response(response_str) if response_str else None
        if parsed_json and isinstance(parsed_json, dict):
            # Parse fields safely
            merchant = str(parsed_json.get("merchant") or "").strip() or None
            invoice_num = str(parsed_json.get("invoice_number") or "").strip() or None
            tx_date = parse_date(parsed_json.get("date")) or parse_date(text) or date.today()
            subtotal = parse_decimal(parsed_json.get("subtotal"))
            tax = parse_decimal(parsed_json.get("tax"))
            total = parse_decimal(parsed_json.get("total"))
            currency = normalize_currency(parsed_json.get("currency"), text)
            category = normalize_category(parsed_json.get("category"))
            pm = str(parsed_json.get("payment_method") or "").strip() or None
            notes = str(parsed_json.get("notes") or "").strip() or None

            extracted = ReceiptReviewData(
                merchant=merchant or "Unknown Merchant",
                invoice_number=invoice_num,
                transaction_date=tx_date,
                subtotal=subtotal,
                tax=tax,
                total=total,
                currency=currency,
                category=category,
                payment_method=pm,
                notes=notes,
            )

            suggestions = {
                "merchant": FieldSuggestion(
                    value=extracted.merchant,
                    confidence=0.9 if merchant else 0.4,
                    source="ai",
                ),
                "invoice_number": FieldSuggestion(
                    value=extracted.invoice_number,
                    confidence=0.85 if invoice_num else 0.2,
                    source="ai",
                ),
                "transaction_date": FieldSuggestion(
                    value=extracted.transaction_date,
                    confidence=0.9 if tx_date else 0.4,
                    source="ai",
                ),
                "subtotal": FieldSuggestion(
                    value=float(extracted.subtotal),
                    confidence=0.85 if subtotal > Decimal(0) else 0.3,
                    source="ai",
                ),
                "tax": FieldSuggestion(
                    value=float(extracted.tax),
                    confidence=0.85 if tax > Decimal(0) else 0.3,
                    source="ai",
                ),
                "total": FieldSuggestion(
                    value=float(extracted.total),
                    confidence=0.95 if total > Decimal(0) else 0.3,
                    source="ai",
                ),
                "currency": FieldSuggestion(value=extracted.currency, confidence=0.9, source="ai"),
                "category": FieldSuggestion(
                    value=extracted.category,
                    confidence=0.8,
                    source="ai",
                    is_inferred=True,
                ),
                "payment_method": FieldSuggestion(
                    value=extracted.payment_method,
                    confidence=0.8 if pm else 0.2,
                    source="ai",
                ),
            }

            warnings = validate_monetary_amounts(subtotal, tax, total)
            return extracted, suggestions, warnings, True, settings.OLLAMA_MODEL

    # Step 2: Fallback to Heuristic Extraction (OCR rules)
    logger.info("Using heuristic/rule-based OCR extractor (Ollama offline or bypassed).")
    extracted, suggestions = extract_heuristically(text)
    warnings = validate_monetary_amounts(extracted.subtotal, extracted.tax, extracted.total)
    return extracted, suggestions, warnings, False, None
