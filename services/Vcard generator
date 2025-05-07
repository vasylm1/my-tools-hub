import streamlit as st
from PIL import Image
from io import BytesIO
import qrcode
from translations import translations

def run(lang):
    t = translations[lang]

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

        # Share links
        encoded_msg = f"{name} contact info:\n{phone}\n{email}"
        whatsapp_url = f"https://api.whatsapp.com/send?text={encoded_msg.replace(' ', '%20')}"
        email_url = f"mailto:?subject=Contact Card for {name}&body={encoded_msg.replace(' ', '%20')}"

        col1, col2 = st.columns(2)
        col1.markdown(f"[🔗 WhatsApp]({whatsapp_url})", unsafe_allow_html=True)
        col2.markdown(f"[✉️ Email]({email_url})", unsafe_allow_html=True)
