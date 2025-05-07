import streamlit as st
import os
import tempfile
from PIL import Image
from pydub import AudioSegment
from gtts import gTTS
from PyPDF2 import PdfReader
from ebooklib import epub
from fpdf import FPDF
import base64
import subprocess
from translations import translations

# 📁 Universal File Converter UI and logic
def run(lang):
    t = translations.get(lang, translations["en"])
    st.title(t["fileconv_title"])

    # 🔽 File uploader
    uploaded_file = st.file_uploader(t["fileconv_upload"], type=["pdf", "png", "jpg", "jpeg", "webp", "bmp", "tiff", "epub", "mobi"])

    # 🗂 Format selector
    conversion_type = st.selectbox(t["fileconv_conversion_type"], [
        "Image to Image",
        "PDF to MP3",
        "PDF to EPUB",
        "PDF to MOBI",
        "EPUB to PDF",
        "MOBI to PDF"
    ])

    lang_code = st.selectbox(t["fileconv_language"], ["en", "pl", "uk", "de", "es", "fr", "zh-cn"])

    if uploaded_file and st.button(t["fileconv_convert_button"]):
        with st.spinner("Converting..."):
            ext = uploaded_file.name.lower().split(".")[-1]

            if conversion_type == "Image to Image":
                try:
                    image = Image.open(uploaded_file)
                    output_format = st.selectbox("Convert to format:", ["png", "jpg", "webp", "bmp", "tiff"])
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

            elif conversion_type == "PDF to EPUB" or conversion_type == "PDF to MOBI":
                try:
                    reader = PdfReader(uploaded_file)
                    text = "\n".join([page.extract_text() or "" for page in reader.pages])
                    book = epub.EpubBook()
                    book.set_identifier("id123456")
                    book.set_title("Converted PDF")
                    book.set_language("en")
                    chapter = epub.EpubHtml(title="Content", file_name="chap_01.xhtml", lang="en")
                    chapter.content = f"<h1>Converted PDF</h1><p>{text}</p>"
                    book.add_item(chapter)
                    book.toc = (epub.Link("chap_01.xhtml", "Content", "chap_01"),)
                    book.add_item(epub.EpubNcx())
                    book.add_item(epub.EpubNav())
                    book.spine = ["nav", chapter]
                    epub_path = tempfile.NamedTemporaryFile(delete=False, suffix=".epub").name
                    epub.write_epub(epub_path, book)

                    if conversion_type == "PDF to EPUB":
                        with open(epub_path, "rb") as f:
                            st.download_button(t["fileconv_download_epub"], f, file_name="converted.epub")
                    else:
                        mobi_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mobi").name
                        subprocess.run(["ebook-convert", epub_path, mobi_path], check=True)
                        with open(mobi_path, "rb") as f:
                            st.download_button(t["fileconv_download_mobi"], f, file_name="converted.mobi")
                except Exception as e:
                    st.error(f"{t['fileconv_error']} {e}")

            elif conversion_type == "EPUB to PDF" or conversion_type == "MOBI to PDF":
                try:
                    file_path = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}").name
                    with open(file_path, "wb") as f:
                        f.write(uploaded_file.read())

                    pdf_path = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf").name
                    subprocess.run(["ebook-convert", file_path, pdf_path], check=True)
                    with open(pdf_path, "rb") as f:
                        st.download_button(t["fileconv_download_pdf"], f, file_name="converted.pdf")
                except Exception as e:
                    st.error(f"{t['fileconv_error']} {e}")
