from datetime import date
from decimal import Decimal

import pytest

from app.services.ai.extractor import extract_receipt_data
from app.services.ai.ollama_client import ollama_client
from app.services.receipts.validation import normalize_currency, parse_date, parse_optional_decimal


@pytest.mark.asyncio
async def test_empty_ocr_output_no_fake_defaults():
    """Verify empty OCR output produces None fields and clear warnings, not zero/fake values."""
    extracted, suggestions, warnings, ollama_used, model_name = await extract_receipt_data("")

    assert ollama_used is False
    assert model_name is None
    assert extracted.merchant is None
    assert extracted.transaction_date is None
    assert extracted.subtotal is None
    assert extracted.tax is None
    assert extracted.total is None
    assert extracted.currency is None
    assert len(warnings) > 0
    assert any("empty" in w.lower() or "blank" in w.lower() for w in warnings)


@pytest.mark.asyncio
async def test_whitespace_ocr_output():
    """Whitespace-only text must be treated as empty extraction."""
    extracted, suggestions, warnings, _, _ = await extract_receipt_data("   \n\n\t  ")
    assert extracted.merchant is None
    assert extracted.total is None
    assert len(warnings) > 0


@pytest.mark.asyncio
async def test_ollama_unavailable_graceful_fallback(monkeypatch):
    """When Ollama is unavailable, fallback to heuristic extraction without fake amounts."""
    async def mock_offline():
        return {"connected": False, "models": [], "model_present": False}

    monkeypatch.setattr(ollama_client, "check_health", mock_offline)

    raw_text = """
    Acme Corp
    Invoice #1002
    Date: 2026-01-10
    Total: $50.00
    """
    extracted, suggestions, warnings, ollama_used, _ = await extract_receipt_data(raw_text)

    assert ollama_used is False
    assert extracted.merchant == "Acme Corp"
    assert extracted.total == Decimal("50.00")
    assert extracted.currency == "USD"


@pytest.mark.asyncio
async def test_invalid_model_json_fallback(monkeypatch):
    """When Ollama generates invalid/malformed JSON, system must recover gracefully."""
    async def mock_health():
        return {"connected": True, "models": ["qwen2.5:1.5b"], "model_present": True}

    async def mock_bad_json(*args, **kwargs):
        return "I am an AI and here is the text: { broken json: 'yes'"

    monkeypatch.setattr(ollama_client, "check_health", mock_health)
    monkeypatch.setattr(ollama_client, "generate_json", mock_bad_json)

    raw_text = """
    Harbor Cafe
    Date: 2026-03-01
    Total: $12.50
    """
    extracted, suggestions, warnings, ollama_used, _ = await extract_receipt_data(raw_text)

    assert ollama_used is False
    assert extracted.merchant == "Harbor Cafe"
    assert extracted.total == Decimal("12.50")


@pytest.mark.asyncio
async def test_missing_fields_validation_warnings():
    """Missing fields should produce validation warnings, not silent fabricated values."""
    raw_text = "Some random unformatted document without amounts or dates."
    extracted, suggestions, warnings, _, _ = await extract_receipt_data(raw_text)

    assert extracted.total is None
    assert extracted.transaction_date is None
    assert any("Total" in w for w in warnings)


def test_currency_normalization():
    """Currency normalization must detect MYR, RM, and global ISO currencies, and not default to USD."""
    assert normalize_currency("MYR") == "MYR"
    assert normalize_currency("RM") == "MYR"
    assert normalize_currency("rm") == "MYR"
    assert normalize_currency(None, "OJC MARKETING SDN BHD, 81750 MASAI, JOHOR") == "MYR"
    assert normalize_currency("EUR") == "EUR"
    assert normalize_currency("GBP") == "GBP"
    assert normalize_currency("SGD") == "SGD"
    # Tax codes must NOT be treated as currency
    assert normalize_currency("SR", "No location text") is None
    # Unknown currency returns None instead of defaulting to USD
    assert normalize_currency(None, "Generic text with no symbols") is None


def test_date_parsing_no_default_today():
    """Date parsing must return None if unparseable, not today's date."""
    assert parse_date("15/01/2019") == date(2019, 1, 15)
    assert parse_date("2019-01-15") == date(2019, 1, 15)
    assert parse_date("invalid-date-string") is None
    assert parse_date("") is None


def test_parse_optional_decimal():
    """parse_optional_decimal returns Decimal or None, never forcing 0.00."""
    assert parse_optional_decimal("193.00") == Decimal("193.00")
    assert parse_optional_decimal(193) == Decimal("193.00")
    assert parse_optional_decimal(None) is None
    assert parse_optional_decimal("") is None
    assert parse_optional_decimal("N/A") is None


@pytest.mark.asyncio
async def test_sample_receipt_extraction_expected_values(monkeypatch):
    """
    Test extraction with the exact sample receipt fields:
    - Merchant: OJC MARKETING SDN BHD
    - Invoice number: PEGIV-1030765
    - Date: 2019-01-15
    - Currency: MYR
    - Total: 193.00
    - Item: KINGS SAFETY SHOES KWD 805
    """
    sample_ocr = """tan chay yee
*** COPY ***
OJC MARKETING SDN BHD
ROC NO: 538358-H
NO 2 & 4, JALAN BAYU 4,
BANDAR SERI ALAM,
81750 MASAI, JOHOR

TAX INVOICE
Invoice No: PEGIV-1030765
Date : 15/01/2019 11:05:16 AM

Bill To : THE PEAK QUARRY WORKS

Description Qty. Price Amount
000000111 1 193.00 193.00 SR
KINGS SAFETY SHOES KWD 805

Total Exclude GST: 193.00
Total GST @6%: 0.00
Total Inclusive GST: 193.00
TOTAL: 193.00
VISA CARD 193.00
"""
    # Test heuristic fallback directly
    extracted, suggestions, warnings, ollama_used, _ = await extract_receipt_data(sample_ocr)

    assert extracted.merchant == "OJC MARKETING SDN BHD"
    assert extracted.invoice_number == "PEGIV-1030765"
    assert extracted.transaction_date == date(2019, 1, 15)
    assert extracted.currency == "MYR"
    assert extracted.total == Decimal("193.00")
