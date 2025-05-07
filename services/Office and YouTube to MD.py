import streamlit as st
import os
import tempfile
import re
from markitdown import MarkItDown
from translations import translations

# 📝 Office to Markdown Tool

def get_file_extension(filename):
    return filename.rsplit(".", 1)[1].lower() if "." in filename else ""

def is_youtube_url(url):
    return bool(re.match(r"^(https?://)?(www\.)?(youtube\.com|youtu\.?be)/.+$", url))

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
        "📝 Documents": {"formats": ["Word (.docx, .doc)", "PDF", "EPub"], "extensions": ["docx", "doc", "pdf", "epub"]},
        "📊 Spreadsheets": {"formats": ["Excel (.xlsx, .xls)"], "extensions": ["xlsx", "xls"]},
        "📊 Presentations": {"formats": ["PowerPoint (.pptx, .ppt)"], "extensions": ["pptx", "ppt"]},
        "🌐 Web": {"formats": ["HTML", "YouTube URLs"], "extensions": ["html", "htm"]},
        "📁 Others": {"formats": ["CSV", "JSON", "XML", "ZIP"], "extensions": ["csv", "json", "xml", "zip"]},
    }

def run(lang):
    t = translations.get(lang, translations.get("en"))

    if "markdown_content" not in st.session_state:
        st.session_state.markdown_content = ""
    if "file_name" not in st.session_state:
        st.session_state.file_name = ""

    st.markdown(f"### {t['md_title']}")

    formats = get_supported_formats()
    all_extensions = sum([info["extensions"] for info in formats.values()], [])

    uploaded_file = st.file_uploader(t["md_upload"], type=all_extensions, help=t["md_help"])
    youtube_url = st.text_input(t["md_youtube"], placeholder=t["md_youtube_placeholder"], help=t["md_help_url"])

    if st.button(t["md_convert"], use_container_width=True):
        if not uploaded_file and not youtube_url:
            st.error(t["md_error_empty"])
        elif youtube_url and not is_youtube_url(youtube_url):
            st.error(t["md_error_invalid_url"])
        else:
            with st.spinner("Converting to Markdown..."):
                if uploaded_file:
                    content, error = convert_file_to_markdown(uploaded_file.getbuffer(), uploaded_file.name)
                    if error:
                        st.error(f"Error: {error}")
                    else:
                        st.session_state.markdown_content = content
                        st.session_state.file_name = uploaded_file.name
                        st.success(t["md_success"])
                elif youtube_url:
                    content, error = convert_youtube_to_markdown(youtube_url)
                    if error:
                        st.error(f"Error: {error}")
                    else:
                        video_id = extract_youtube_id(youtube_url)
                        st.session_state.markdown_content = content
                        st.session_state.file_name = f"youtube_{video_id}.md" if video_id else "youtube_video.md"
                        st.success(t["md_success"])

    if st.session_state.markdown_content:
        st.divider()
        name = st.session_state.file_name.rsplit(".", 1)[0] + ".md"
        st.download_button(
            label=t["md_download"],
            data=st.session_state.markdown_content,
            file_name=name,
            mime="text/markdown",
            use_container_width=True,
        )
        st.subheader(t["md_preview"])
        preview = st.session_state.markdown_content[:2000]
        if len(st.session_state.markdown_content) > 2000:
            preview += f"\n\n{t['md_truncated']}"
        st.text_area("", value=preview, height=400, disabled=True)
