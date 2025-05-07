import streamlit as st
from PIL import Image
from io import BytesIO
import qrcode
from translations import translations

def run(lang):
    t = translations[lang]

    # Додати переклади в translations.py:
    # "vcard_title": "vCard Generator",
    # "vcard_name": "Full Name",
    # "vcard_phone": "Phone",
    # "vcard_email": "Email",
    # "vcard_company": "Company",
    # "vcard_website": "Website",
    # "vcard_address": "Address",
    # "vcard_button": "Generate vCard & QR",
    # "vcard_required": "Name, phone, and email are required.",
    # "vcard_download": "Download vCard",
    # "vcard_qr_caption": "QR Code"

    st.markdown(f"<h2 style='text-align:center'>📇 {t['vcard_title']}</h2>", unsafe_allow_html=True)

    name = st.text_input(t["vcard_name"], placeholder="John Doe")
    phone = st.text_input(t["vcard_phone"], placeholder="+123456789")
    email = st.text_input(t["vcard_email"], placeholder="john@example.com")
    company = st.text_input(t["vcard_company"], placeholder="ACME Corp")
    website = st.text_input(t["vcard_website"], placeholder="https://example.com")
    address = st.text_input(t["vcard_address"], placeholder="123 Main St, City, Country")

    if st.button(t["vcard_button"]):
        if not name or not phone or not email:
            st.warning(t["vcard_required"])
            return

        vcard = f"BEGIN:VCARD\nVERSION:3.0\nFN:{name}\nTEL;TYPE=CELL:{phone}\nEMAIL:{email}"
        if company:
            vcard += f"\nORG:{company}"
        if website:
            vcard += f"\nURL:{website}"
        if address:
            vcard += f"\nADR;TYPE=HOME:;;{address}"
        vcard += "\nEND:VCARD"

        # Download button
        st.download_button("⬇️ " + t["vcard_download"], data=vcard.encode("utf-8"), file_name=f"{name.replace(' ', '_')}_contact.vcf", mime="text/vcard")

        # QR code
        qr = qrcode.make(vcard)
        qr_buf = BytesIO()
        qr.save(qr_buf, format="PNG")
        st.image(qr_buf.getvalue(), caption=t["vcard_qr_caption"], width=200)
