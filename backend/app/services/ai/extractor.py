import json
import re
import time

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
    parse_optional_decimal,
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
    1. Rejects blank OCR text with clear warning.
    2. Attempts neural extraction via local Ollama (qwen2.5:1.5b).
    3. Validates JSON, types, amounts, and dates without fabricating fake fallbacks.
    4. Falls back to regex/heuristic rules if Ollama is unavailable.
    5. Emits mathematical reconciliation and confidence warnings.
    """
    if not text.strip():
        extracted = ReceiptReviewData(
            merchant=None,
            invoice_number=None,
            transaction_date=None,
            subtotal=None,
            tax=None,
            total=None,
            currency=None,
            category="Other",
            payment_method=None,
            notes=None,
            line_items=[],
        )
        suggestions: dict[str, FieldSuggestion] = {}
        warnings = ["Document text is empty or OCR did not detect legible text. Please verify or re-upload."]
        logger.warning("Extraction requested on empty or whitespace text.")
        return extracted, suggestions, warnings, False, None

    # Step 1: Check if Ollama is accessible
    ollama_health = await ollama_client.check_health()
    if ollama_health.get("connected") and ollama_health.get("model_present"):
        active_model = ollama_health.get("active_model") or settings.OLLAMA_MODEL
        user_prompt = RECEIPT_EXTRACTION_USER_PROMPT.format(receipt_text=text[:4000])
        
        start_time = time.time()
        response_str = await ollama_client.generate_json(
            prompt=user_prompt,
            system_prompt=RECEIPT_EXTRACTION_SYSTEM_PROMPT,
            model=active_model,
        )
        latency_ms = (time.time() - start_time) * 1000

        parsed_json = _clean_json_response(response_str) if response_str else None
        if parsed_json and isinstance(parsed_json, dict):
            # Parse fields safely without fabricating defaults
            merchant = str(parsed_json.get("merchant") or "").strip() or None
            invoice_num = str(parsed_json.get("invoice_number") or "").strip() or None
            tx_date = parse_date(parsed_json.get("date")) or parse_date(text)
            subtotal = parse_optional_decimal(parsed_json.get("subtotal"))
            tax = parse_optional_decimal(parsed_json.get("tax"))
            total = parse_optional_decimal(parsed_json.get("total"))
            currency = normalize_currency(parsed_json.get("currency"), text)
            category = normalize_category(parsed_json.get("category"))
            pm = str(parsed_json.get("payment_method") or "").strip() or None
            notes = str(parsed_json.get("notes") or "").strip() or None
            line_items = parsed_json.get("line_items") or []

            extracted = ReceiptReviewData(
                merchant=merchant,
                invoice_number=invoice_num,
                transaction_date=tx_date,
                subtotal=subtotal,
                tax=tax,
                total=total,
                currency=currency,
                category=category,
                payment_method=pm,
                notes=notes,
                line_items=line_items if isinstance(line_items, list) else [],
            )

            suggestions = {
                "merchant": FieldSuggestion(
                    value=extracted.merchant,
                    confidence=0.92 if merchant else 0.0,
                    source="ai",
                ),
                "invoice_number": FieldSuggestion(
                    value=extracted.invoice_number,
                    confidence=0.9 if invoice_num else 0.0,
                    source="ai",
                ),
                "transaction_date": FieldSuggestion(
                    value=extracted.transaction_date,
                    confidence=0.9 if tx_date else 0.0,
                    source="ai",
                ),
                "subtotal": FieldSuggestion(
                    value=float(extracted.subtotal) if subtotal is not None else None,
                    confidence=0.9 if subtotal is not None else 0.0,
                    source="ai",
                ),
                "tax": FieldSuggestion(
                    value=float(extracted.tax) if tax is not None else None,
                    confidence=0.9 if tax is not None else 0.0,
                    source="ai",
                ),
                "total": FieldSuggestion(
                    value=float(extracted.total) if total is not None else None,
                    confidence=0.95 if total is not None else 0.0,
                    source="ai",
                ),
                "currency": FieldSuggestion(
                    value=extracted.currency,
                    confidence=0.9 if currency else 0.0,
                    source="ai",
                ),
                "category": FieldSuggestion(
                    value=extracted.category,
                    confidence=0.85,
                    source="ai",
                    is_inferred=True,
                ),
                "payment_method": FieldSuggestion(
                    value=extracted.payment_method,
                    confidence=0.85 if pm else 0.0,
                    source="ai",
                ),
            }

            warnings = validate_monetary_amounts(subtotal, tax, total)
            if not merchant:
                warnings.append("Merchant name could not be confidently detected from the document.")
            if not tx_date:
                warnings.append("Transaction date could not be detected; please review before confirming.")
            if not currency:
                warnings.append("Currency could not be detected automatically; please choose currency.")

            logger.info(
                "Ollama extraction success: model=%s, latency=%.1fms, merchant=%s, invoice=%s, date=%s, total=%s %s, warnings=%d",
                active_model,
                latency_ms,
                merchant or "None",
                invoice_num or "None",
                str(tx_date) if tx_date else "None",
                str(total) if total is not None else "None",
                currency or "None",
                len(warnings),
            )
            return extracted, suggestions, warnings, True, active_model
        else:
            logger.warning(
                "Ollama extraction failed to parse JSON (model=%s, latency=%.1fms, output_len=%d)",
                active_model,
                latency_ms,
                len(response_str or ""),
            )

    # Step 2: Fallback to Heuristic Extraction (OCR rules)
    logger.info("Using heuristic/rule-based OCR extractor (Ollama offline or parsing bypassed).")
    extracted, suggestions = extract_heuristically(text)
    warnings = validate_monetary_amounts(extracted.subtotal, extracted.tax, extracted.total)
    if not extracted.merchant:
        warnings.append("Merchant name could not be identified.")
    if not extracted.transaction_date:
        warnings.append("Transaction date could not be identified.")
    if not extracted.currency:
        warnings.append("Currency could not be identified.")
    return extracted, suggestions, warnings, False, None
