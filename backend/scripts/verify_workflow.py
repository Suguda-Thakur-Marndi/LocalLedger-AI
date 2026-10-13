import fitz
import httpx

# 1. Generate clean synthetic receipt PDF
doc = fitz.open()
page = doc.new_page()
receipt_text = (
    "Blue Harbor Coworking\n"
    "Invoice #: BHC-2026-089\n"
    "Date: 2026-04-12\n\n"
    "1x Monthly Hot Desk Pass       $180.00\n"
    "Subtotal: $180.00\n"
    "Tax (10%): $18.00\n"
    "Total: $198.00\n\n"
    "Payment Method: Mastercard ending in 9102\n"
    "Thank you for your business!\n"
)
page.insert_text((50, 72), receipt_text, fontsize=12)
pdf_bytes = doc.tobytes()
doc.close()

client = httpx.Client(base_url="http://127.0.0.1:8000/api/v1", timeout=10)

# 2. Upload
files = {"file": ("blue_harbor_desk_invoice.pdf", pdf_bytes, "application/pdf")}
upload_res = client.post("/documents/upload", files=files)
assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
doc_id = upload_res.json()["document_id"]
print(f"[OK] Uploaded document ID: {doc_id}")

# 3. Review
review_res = client.get(f"/documents/{doc_id}/review")
assert review_res.status_code == 200, f"Review failed: {review_res.text}"
data = review_res.json()
extracted = data["extracted"]
print(f"[OK] Extracted Merchant: {extracted['merchant']}")
print(f"[OK] Extracted Total: {extracted['total']}")
print(f"[OK] Extracted Subtotal: {extracted['subtotal']}")
print(f"[OK] Extracted Tax: {extracted['tax']}")
print(f"[OK] Extracted Date: {extracted['transaction_date']}")
print(f"[OK] Extracted Currency: {extracted['currency']}")

# 4. Confirm transaction
confirm_payload = {
    "document_id": doc_id,
    "merchant": extracted["merchant"],
    "invoice_number": extracted["invoice_number"],
    "transaction_date": extracted["transaction_date"],
    "subtotal": float(extracted["subtotal"]),
    "tax": float(extracted["tax"]),
    "total": float(extracted["total"]),
    "currency": extracted["currency"],
    "category": "Office Supplies",
    "payment_method": extracted["payment_method"],
    "notes": "Coworking office monthly membership"
}
confirm_res = client.post("/receipts/confirm", json=confirm_payload)
assert confirm_res.status_code == 200, f"Confirm failed: {confirm_res.text}"
tx = confirm_res.json()
print(f"[OK] Confirmed Transaction: ID={tx['id']}, Merchant={tx['merchant']}, Total={tx['total']} {tx['currency']}")

# 5. Dashboard Summary
dash_res = client.get("/reports/dashboard")
assert dash_res.status_code == 200
dash = dash_res.json()
print(f"[OK] Dashboard Transactions Count: {dash['total_transactions']}")
for ct in dash["currency_totals"]:
    print(f"     Currency: {ct['currency']}, Total Amount: {ct['total_amount']}")

# 6. CSV Export
csv_res = client.get("/reports/export")
assert csv_res.status_code == 200
print(f"[OK] CSV Export returned {len(csv_res.text.splitlines())} lines (including headers)")

print("\n--- ALL VERIFICATIONS SUCCEEDED CLEANLY! ---")
