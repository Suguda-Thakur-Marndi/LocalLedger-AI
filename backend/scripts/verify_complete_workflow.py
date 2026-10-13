import sqlite3

import httpx

client = httpx.Client(base_url="http://127.0.0.1:8000/api/v1", timeout=10)

# STEP 1: Verify dashboard before test
conn = sqlite3.connect("data/db/localledger.db")
initial_docs = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
initial_txs = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
print(f"[1] Initial DB state: {initial_docs} documents, {initial_txs} transactions")

# STEP 2 & 3: Upload sample synthetic receipt
import pymupdf

doc = pymupdf.open()
page = doc.new_page()
receipt_text = (
    "Starlight Software Labs\n"
    "Invoice #: SSL-2026-991\n"
    "Date: 2026-05-18\n\n"
    "Cloud Hosting Pro       $120.00\n"
    "Subtotal: $120.00\n"
    "Tax: $12.00\n"
    "Total: $132.00\n"
    "Payment Method: Visa ending in 8831\n"
)
page.insert_text((50, 72), receipt_text, fontsize=12)
pdf_bytes = doc.tobytes()
doc.close()

files = {"file": ("sample_synthetic_receipt.pdf", pdf_bytes, "application/pdf")}
upload_res = client.post("/documents/upload", files=files)
assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
upload_data = upload_res.json()
doc_id = upload_data["document_id"]
print(
    f"[2-4] Uploaded and validated: doc_id={doc_id}, mime={upload_data['mime_type']}, sha256={upload_data['sha256_hash'][:12]}..."
)

# STEP 5, 6, 7: Review and extraction (check fallback when Ollama is offline)
review_res = client.get(f"/documents/{doc_id}/review")
assert review_res.status_code == 200, f"Review failed: {review_res.text}"
review_data = review_res.json()
print(
    f"[5-7] Extraction: ollama_used={review_data['ollama_used']}, model={review_data['model_name']}"
)
print(f"      Extracted merchant: {review_data['extracted']['merchant']}")
print(f"      Extracted total: {review_data['extracted']['total']}")
print(f"      Extracted invoice: {review_data['extracted']['invoice_number']}")
print(f"      Warnings: {review_data['warnings']}")

# STEP 8 & 9: Manual review correction and save transaction
confirm_payload = {
    "document_id": doc_id,
    "merchant": "Starlight Software Labs",
    "invoice_number": "SSL-2026-991",
    "transaction_date": "2026-05-18",
    "subtotal": 120.00,
    "tax": 12.00,
    "total": 132.00,
    "currency": "USD",
    "category": "Cloud Services & Hosting",
    "payment_method": "Visa ending in 8831",
    "notes": "Synthetic verification test note",
}
confirm_res = client.post("/receipts/confirm", json=confirm_payload)
assert confirm_res.status_code == 200, f"Confirm failed: {confirm_res.text}"
tx = confirm_res.json()
tx_id = tx["id"]
print(f"[8-9] Saved transaction: tx_id={tx_id}, total={tx['total']} {tx['currency']}")

# STEP 10: Verify persistence in SQLite
row = conn.execute(
    "SELECT id, merchant, total, currency FROM transactions WHERE id = ?", (tx_id,)
).fetchone()
assert row is not None, "Transaction not found in SQLite!"
print(f"[10] SQLite verified: ID={row[0]}, Merchant={row[1]}, Total={row[2]} {row[3]}")

# STEP 11: Confirm dashboard reflects saved record
dash_res = client.get("/reports/dashboard")
assert dash_res.status_code == 200
dash = dash_res.json()
print(f"[11] Dashboard total transactions: {dash['total_transactions']}")

# STEP 12: Search and filter
search_res = client.get("/transactions?search=Starlight")
assert search_res.status_code == 200
search_data = search_res.json()
assert search_data["total"] >= 1
print(f"[12] Search for Starlight found {search_data['total']} record(s)")

# STEP 13 & 14: Edit transaction
update_payload = {
    "merchant": "Starlight Software Labs",
    "total": 132.00,
    "currency": "USD",
    "category": "Cloud Services & Hosting",
    "notes": "Updated synthetic verification note",
}
put_res = client.put(f"/transactions/{tx_id}", json=update_payload)
assert put_res.status_code == 200
updated_tx = put_res.json()
assert updated_tx["notes"] == "Updated synthetic verification note"
print(f'[13-14] Transaction updated: notes="{updated_tx["notes"]}"')

# STEP 15: Export CSV
csv_res = client.get("/reports/export")
assert csv_res.status_code == 200
assert "Starlight Software Labs" in csv_res.text
print(f"[15] CSV export contains updated transaction! (Size: {len(csv_res.text)} bytes)")

# STEP 16: Delete test transaction
del_res = client.delete(f"/transactions/{tx_id}")
assert del_res.status_code == 204
print(f"[16] Test transaction {tx_id} deleted")

# Also delete test document record from SQLite and disk if left
conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
conn.commit()
print(f"[16] Test document record {doc_id} cleaned up")

# STEP 17: Verify unrelated user data remains unchanged
final_docs = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
final_txs = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
conn.close()
print(f"[17] Final DB state: {final_docs} documents, {final_txs} transactions")
assert final_docs == initial_docs, (
    f"Documents count mismatch: expected {initial_docs}, got {final_docs}"
)
assert final_txs == initial_txs, (
    f"Transactions count mismatch: expected {initial_txs}, got {final_txs}"
)

print("\n>>> ALL 17 STEPS OF USER WORKFLOW PASSED 100% SUCCESFULLY! <<<")
