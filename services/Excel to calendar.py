import pandas as pd
from datetime import datetime
import streamlit as st

def format_date_ics(dt):
    try:
        return pd.to_datetime(dt).strftime('%Y%m%dT%H%M%S')
    except:
        return ''

def convert_excel_to_ics(file):
    try:
        df = pd.read_excel(file, header=None)

        # Колонки: 0 (start), 1 (end), 4 (summary), 6–9 (desc), 10 (location)
        dtstart_col = 0
        dtend_col = 1
        summary_col = 4
        desc_cols = [6, 7, 8, 9]
        location_col = 10

        ics = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "CALSCALE:GREGORIAN",
            "PRODID:-//XLS-to-iCal Streamlit Tool//EN"
        ]

        for _, row in df.iterrows():
            dtstart = format_date_ics(row[dtstart_col])
            dtend = format_date_ics(row[dtend_col])
            summary = str(row[summary_col]) if pd.notna(row[summary_col]) else "Event"
            description = " | ".join(str(row[i]) for i in desc_cols if pd.notna(row[i]))
            location = str(row[location_col]) if pd.notna(row[location_col]) else ""

            if not dtstart or not dtend:
                continue

            ics.extend([
                "BEGIN:VEVENT",
                f"DTSTART:{dtstart}",
                f"DTEND:{dtend}",
                f"SUMMARY:{summary}",
                f"DESCRIPTION:{description}",
                f"LOCATION:{location}",
                "END:VEVENT"
            ])

        ics.append("END:VCALENDAR")
        return "\n".join(ics)
    except Exception as e:
        return f"ERROR: {str(e)}"

def run(lang="en"):
    translations = {
        "en": {
            "title": "📅 XLS to iCal Converter",
            "uploadLabel": "Upload your Excel file",
            "convertButton": "Convert to ICS",
            "downloadFileName": "calendar.ics",
            "error": "An error occurred:",
            "success": "✅ ICS file generated!"
        },
        "uk": {
            "title": "📅 Конвертер XLS у iCal",
            "uploadLabel": "Завантажте файл Excel",
            "convertButton": "Конвертувати в ICS",
            "downloadFileName": "календар.ics",
            "error": "Сталася помилка:",
            "success": "✅ Файл ICS згенеровано!"
        }
    }

    t = translations.get(lang, translations["en"])
    st.markdown(f"<h2 style='text-align:center'>{t['title']}</h2>", unsafe_allow_html=True)

    uploaded_file = st.file_uploader(t["uploadLabel"], type=["xls", "xlsx"])
    if uploaded_file:
        if st.button(t["convertButton"]):
            ics_content = convert_excel_to_ics(uploaded_file)
            if ics_content.startswith("ERROR:"):
                st.error(f"{t['error']} {ics_content}")
            else:
                st.success(t["success"])
                st.download_button(
                    label=t["convertButton"],
                    data=ics_content,
                    file_name=t["downloadFileName"],
                    mime="text/calendar"
                )
