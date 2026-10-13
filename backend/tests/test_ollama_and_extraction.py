from decimal import Decimal

import pytest

from app.services.ai.extractor import extract_receipt_data
from app.services.ai.ollama_client import ollama_client
from app.services.receipts.validation import (
    parse_decimal,
    validate_monetary_amounts,
)


@pytest.mark.asyncio
async def test_extraction_when_ollama_offline(monkeypatch):
    # Simulate Ollama offline
    async def mock_offline():
        return {"connected": False, "models": [], "model_present": False}

    monkeypatch.setattr(ollama_client, "check_health", mock_offline)

    sample_text = (
        "Green Valley Organic Market\n"
        "Receipt #: ORG-5510\n"
        "Date: 2026-04-10\n"
        "Groceries            $35.00\n"
        "Subtotal: $35.00\n"
        "Tax: $2.80\n"
        "Total: $37.80\n"
        "Visa Card ending in 4412\n"
    )

    extracted, suggestions, warnings, ollama_used, model = await extract_receipt_data(sample_text)

    assert ollama_used is False
    assert model is None
    assert extracted.merchant == "Green Valley Organic Market"
    assert extracted.total == Decimal("37.80")
    assert extracted.subtotal == Decimal("35.00")
    assert extracted.tax == Decimal("2.80")
    assert extracted.currency == "USD"
    assert suggestions["total"].source == "ocr_rules"
    assert len(warnings) == 0


@pytest.mark.asyncio
async def test_extraction_with_mocked_ollama_success(monkeypatch):
    mock_json = (
        '{"merchant": "SaaS Cloud Hosting Inc", "invoice_number": "INV-9900", '
        '"date": "2026-05-01", "subtotal": 100.00, "tax": 10.00, "total": 110.00, '
        '"currency": "USD", "category": "Software & Subscriptions", "payment_method": "Credit Card"}'
    )

    async def mock_health():
        return {"connected": True, "models": ["qwen2.5:3b"], "model_present": True}

    async def mock_generate(*args, **kwargs):
        return mock_json

    monkeypatch.setattr(ollama_client, "check_health", mock_health)
    monkeypatch.setattr(ollama_client, "generate_json", mock_generate)

    extracted, suggestions, warnings, ollama_used, _model = await extract_receipt_data(
        "Raw receipt text"
    )

    assert ollama_used is True
    assert extracted.merchant == "SaaS Cloud Hosting Inc"
    assert extracted.invoice_number == "INV-9900"
    assert extracted.total == Decimal("110.00")
    assert extracted.category == "Software & Subscriptions"
    assert suggestions["total"].source == "ai"
    assert len(warnings) == 0


@pytest.mark.asyncio
async def test_extraction_with_malformed_ollama_fallback(monkeypatch):
    # Ollama returns malformed non-JSON
    async def mock_health():
        return {"connected": True, "models": ["qwen2.5:3b"], "model_present": True}

    async def mock_generate(*args, **kwargs):
        return "I am an AI and I refuse to return JSON. Here is some chatter."

    monkeypatch.setattr(ollama_client, "check_health", mock_health)
    monkeypatch.setattr(ollama_client, "generate_json", mock_generate)

    sample_text = "Quick Stop Cafe\nTotal: $12.50\n"
    extracted, _suggestions, _warnings, ollama_used, _model = await extract_receipt_data(sample_text)

    # Should fall back cleanly to heuristic rules
    assert ollama_used is False
    assert extracted.total == Decimal("12.50")


def test_monetary_validation_mismatch():
    warnings = validate_monetary_amounts(
        subtotal=Decimal("50.00"),
        tax=Decimal("5.00"),
        total=Decimal("80.00"),  # Subtotal + Tax = 55, not 80
    )
    assert len(warnings) > 0
    assert "differs from Total" in warnings[0]


def test_decimal_parser_clean():
    assert parse_decimal("$1,234.56") == Decimal("1234.56")
    assert parse_decimal("12,50") == Decimal("12.50")
    assert parse_decimal(None) == Decimal("0.00")
    assert parse_decimal("invalid") == Decimal("0.00")
