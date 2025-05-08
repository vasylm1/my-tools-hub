import streamlit as st
import os
import tempfile
from PIL import Image
from pydub import AudioSegment
from gtts import gTTS
from PyPDF2 import PdfReader
from translations import translations

# 📁 Universal File Converter UI and logic
def run(lang):
    t = translations.get(lang, translations["English"])
    st.title(t["fileconv_title"])

    # 🕽 File uploader
    uploaded_file = st.file_uploader(t["fileconv_upload"], type=["pdf", "png", "jpg", "jpeg", "webp", "bmp", "tiff"])

    # 🗂 Format selector
    conversion_type = st.selectbox(t["fileconv_conversion_type"], [
        "Image: PNG to JPG",
        "Image: JPG to PNG",
        "Image: WEBP to PNG",
        "Image: BMP to PNG",
        "Image: TIFF to PNG",
        "PDF to MP3"
    ])

    if conversion_type == "PDF to MP3":
        lang_code = st.selectbox(t["fileconv_language"], ["en", "pl", "uk", "de", "es", "fr", "zh-cn"])

    if uploaded_file and st.button(t["fileconv_convert_button"]):
        with st.spinner("Converting..."):
            ext = uploaded_file.name.lower().split(".")[-1]

            # Image conversions
            if conversion_type.startswith("Image"):
                try:
                    image = Image.open(uploaded_file)
                    output_format = conversion_type.split()[-1].lower()
                    buf = tempfile.NamedTemporaryFile(delete=False, suffix=f".{output_format}")
                    image.save(buf.name)
                    st.success(t["fileconv_success"])
                    with open(buf.name, "rb") as f:
                        st.download_button(t["fileconv_download_image"], f, file_name=f"converted.{output_format}")
                except Exception as e:
                    st.error(f"{t['fileconv_error']} {e}")

            elif conversion_type == "PDF to MP3":
                try:
                    reader = PdfReader(uploaded_file)
                    text = "\n".join([page.extract_text() or "" for page in reader.pages])
                    tts = gTTS(text=text, lang=lang_code)
                    mp3_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3").name
                    tts.save(mp3_path)
                    st.success(t["fileconv_mp3_success"])
                    with open(mp3_path, "rb") as f:
                        st.download_button(t["fileconv_download_mp3"], f, file_name="output.mp3")
                except Exception as e:
                    st.error(f"{t['fileconv_error']} {e}")
