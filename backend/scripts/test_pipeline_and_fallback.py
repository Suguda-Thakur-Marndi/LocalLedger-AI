import sqlite3
import httpx
import pymupdf
from app.services.receipts.receipt_parser import extract_heuristically

client = httpx.Client(base_url="http://127.0.0.1:8000/api/v1", timeout=30)
conn = sqlite3.connect("data/db/localledger.db")
initial_docs = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
initial_txs = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]

print(f"=== BASELINE DB: {initial_docs} documents, {initial_txs} transactions ===")

# ==========================================
# PART A: LIVE OLLAMA qwen2.5:1.5b EXTRACTION
# ==========================================
doc_a = pymupdf.open()
page_a = doc_a.new_page()
text_a = (
    "Apex Cloud Solutions\n"
    "Invoice Number: ACS-2026-789\n"
    "Date: 2026-06-15\n\n"
    "Kubernetes Cluster Hosting    $250.00\n"
    "Subtotal: $250.00\n"
    "Tax (8%): $20.00\n"
    "Total: $270.00\n"
    "Payment Method: Corporate Amex ending in 1004\n"
)
page_a.insert_text((50, 72), text_a, fontsize=12)
pdf_a_bytes = doc_a.tobytes()
doc_a.close()

upload_a = client.post(
    "/documents/upload",
    files={"file": ("apex_invoice.pdf", pdf_a_bytes, "application/pdf")},
)
assert upload_a.status_code == 200, f"Upload A failed: {upload_a.text}"
doc_a_id = upload_a.json()["document_id"]

review_a = client.get(f"/documents/{doc_a_id}/review")
assert review_a.status_code == 200, f"Review A failed: {review_a.text}"
data_a = review_a.json()
print("[PART A - LIVE OLLAMA EXTRACTION RESULT]")
print("  ollama_used:", data_a["ollama_used"])
print("  model_name:", data_a["model_name"])
print("  extracted merchant:", data_a["extracted"]["merchant"])
print("  extracted invoice:", data_a["extracted"]["invoice_number"])
print("  extracted total:", data_a["extracted"]["total"])
print("  extracted subtotal:", data_a["extracted"]["subtotal"])
print("  extracted tax:", data_a["extracted"]["tax"])
print("  extracted currency:", data_a["extracted"]["currency"])
print("  extracted category:", data_a["extracted"]["category"])
print("  warnings:", data_a["warnings"])

assert data_a["ollama_used"] is True, "Expected Ollama to be used"
assert data_a["model_name"] == "qwen2.5:1.5b"
assert "Apex Cloud" in data_a["extracted"]["merchant"]

# Confirm and save transaction A
confirm_a = client.post(
    "/receipts/confirm",
    json={
        "document_id": doc_a_id,
        "merchant": data_a["extracted"]["merchant"],
        "invoice_number": data_a["extracted"]["invoice_number"],
        "transaction_date": data_a["extracted"]["transaction_date"],
        "subtotal": float(data_a["extracted"]["subtotal"]),
        "tax": float(data_a["extracted"]["tax"]),
        "total": float(data_a["extracted"]["total"]),
        "currency": data_a["extracted"]["currency"],
        "category": data_a["extracted"]["category"],
        "payment_method": data_a["extracted"]["payment_method"],
        "notes": "Live Ollama verified transaction",
    },
)
assert confirm_a.status_code == 200
tx_a_id = confirm_a.json()["id"]
tx_total = confirm_a.json()["total"]
tx_curr = confirm_a.json()["currency"]
print(f"  Saved TX A: ID={tx_a_id}, Total={tx_total} {tx_curr}")

# ==========================================
# PART B: OCR-ONLY FALLBACK WORKFLOW
# ==========================================
fallback_text = (
    "Quick Stop Convenience\n"
    "Receipt #: QS-4401\n"
    "Date: 2026-07-20\n"
    "Subtotal: $15.00\n"
    "Tax: $1.20\n"
    "Total: $16.20\n"
    "Cash\n"
)
ext_b, sugg_b = extract_heuristically(fallback_text)
print("[PART B - OCR-ONLY FALLBACK RESULT]")
print("  fallback merchant:", ext_b.merchant)
print("  fallback total:", ext_b.total)
print("  fallback subtotal:", ext_b.subtotal)
print("  fallback tax:", ext_b.tax)
print("  fallback date:", ext_b.transaction_date)
print("  source of total:", sugg_b["total"].source)
assert sugg_b["total"].source == "ocr_rules"

# Verify CSV export includes Apex Cloud Solutions
csv_res = client.get("/reports/export")
assert csv_res.status_code == 200
assert "Apex Cloud" in csv_res.text
print("  CSV export confirmed containing TX A.")

# Clean up TX A
del_res = client.delete(f"/transactions/{tx_a_id}")
assert del_res.status_code == 204
conn.execute("DELETE FROM documents WHERE id = ?", (doc_a_id,))
conn.commit()

final_docs = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
final_txs = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
conn.close()

assert final_docs == initial_docs
assert final_txs == initial_txs
print(f"=== CLEANUP VERIFIED: {final_docs} documents, {final_txs} transactions intact ===")
print(">>> PIPELINE AND FALLBACK VERIFICATION SUCCESSFUL! <<<")
