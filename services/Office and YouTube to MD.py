import streamlit as st
import os
import tempfile
import re
from markitdown import MarkItDown
from translations import translations


def get_file_extension(filename):
    return filename.rsplit(".", 1)[1].lower() if "." in filename else ""

def is_youtube_url(url):
    youtube_regex = r"^(https?://)?(www\.)?(youtube\.com|youtu\.?be)/.+$"
    return bool(re.match(youtube_regex, url))

def extract_youtube_id(url):
    patterns = [
        r"(?:v=|\/)([0-9A-Za-z_-]{11}).*",
        r"(?:youtu\.be\/)([0-9A-Za-z_-]{11})",
        r"(?:embed\/)([0-9A-Za-z_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def convert_file_to_markdown(file_data, filename):
    try:
        ext = get_file_extension(filename)
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp_file:
            tmp_file.write(file_data)
            tmp_file_path = tmp_file.name
        md = MarkItDown(enable_plugins=False)
        result = md.convert(tmp_file_path)
        os.unlink(tmp_file_path)
        return result.text_content, None
    except Exception as e:
        return "", str(e)

def convert_youtube_to_markdown(url):
    try:
        md = MarkItDown(enable_plugins=False)
        result = md.convert(url)
        return result.text_content, None
    except Exception as e:
        return "", str(e)

def get_supported_formats():
    return {
        "📝 Documents": {
            "formats": ["Word (.docx, .doc)", "PDF", "EPub"],
            "extensions": ["docx", "doc", "pdf", "epub"],
        },
        "📊 Spreadsheets": {
            "formats": ["Excel (.xlsx, .xls)"],
            "extensions": ["xlsx", "xls"],
        },
        "📊 Presentations": {
            "formats": ["PowerPoint (.pptx, .ppt)"],
            "extensions": ["pptx", "ppt"],
        },
        "🌐 Web": {
            "formats": ["HTML", "YouTube URLs"],
            "extensions": ["html", "htm"]
        },
        "📁 Others": {
            "formats": ["CSV", "JSON", "XML", "ZIP (iterates over contents)"],
            "extensions": ["csv", "json", "xml", "zip"]
        }
    }

def run(lang):
    t = translations.get(lang, translations["en"])

    if "markdown_content" not in st.session_state:
        st.session_state.markdown_content = ""
    if "file_name" not in st.session_state:
        st.session_state.file_name = ""

    st.markdown(f"## 📄 {t['md_title']}")

    all_extensions = []
    formats = get_supported_formats()
    for category, info in formats.items():
        all_extensions.extend(info["extensions"])

    uploaded_file = st.file_uploader(t["md_upload"], type=all_extensions)

    youtube_url = st.text_input(t["md_youtube_placeholder"], placeholder="https://www.youtube.com/watch?v=...")

    if st.button(t["md_convert"]):
        if not uploaded_file and not youtube_url:
            st.error(t["md_error_nofile"])
        elif youtube_url and not is_youtube_url(youtube_url):
            st.error(t["md_error_invalid_url"])
        else:
            with st.spinner(t["md_spinner"]):
                if uploaded_file:
                    markdown_content, error = convert_file_to_markdown(
                        uploaded_file.getbuffer(), uploaded_file.name
                    )
                    if error:
                        st.error(t["md_error"] + error)
                    else:
                        st.session_state.markdown_content = markdown_content
                        st.session_state.file_name = uploaded_file.name
                        st.success(t["md_success"])
                elif youtube_url:
                    markdown_content, error = convert_youtube_to_markdown(youtube_url)
                    if error:
                        st.error(t["md_error"] + error)
                    else:
                        video_id = extract_youtube_id(youtube_url)
                        file_name = f"youtube_{video_id}.md" if video_id else "youtube_video.md"
                        st.session_state.markdown_content = markdown_content
                        st.session_state.file_name = file_name
                        st.success(t["md_success"])

    if st.session_state.markdown_content:
        st.divider()
        file_name = st.session_state.file_name.rsplit(".", 1)[0] + ".md"
        st.download_button(
            label=t["md_download"],
            data=st.session_state.markdown_content,
            file_name=file_name,
            mime="text/markdown",
            use_container_width=True,
        )
        st.subheader(t["md_preview"])
        preview_content = st.session_state.markdown_content[:2000]
        if len(st.session_state.markdown_content) > 2000:
            preview_content += "...\n\n(Preview truncated. Download the full file to see all content.)"
        st.text_area(label="", value=preview_content, height=400, disabled=True)
