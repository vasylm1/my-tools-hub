# services/xls_to_ical.py
import streamlit as st
import pandas as pd
from io import BytesIO
from datetime import datetime

def format_date(dt):
    if pd.isna(dt):
        return ""
    if isinstance(dt, float):
        dt = pd.to_datetime("1899-12-30") + pd.to_timedelta(dt, unit="D")
    return dt.strftime("%Y%m%dT%H%M%S")

def generate_ics(df):
    ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//My Tools Hub//EN\nCALSCALE:GREGORIAN\n"
    for _, row in df.iterrows():
        start = format_date(row[0])
        end = format_date(row[1])
        title = row[2] if pd.notna(row[2]) else "Event"
        description = row[3] if pd.notna(row[3]) else ""
        location = row[4] if pd.notna(row[4]) else ""
        ics += "BEGIN:VEVENT\n"
        ics += f"DTSTART:{start}\n"
        ics += f"DTEND:{end}\n"
        ics += f"SUMMARY:{title}\n"
        if description:
            ics += f"DESCRIPTION:{description}\n"
        if location:
            ics += f"LOCATION:{location}\n"
        ics += "END:VEVENT\n"
    ics += "END:VCALENDAR"
    return ics

def get_template_file():
    sample = pd.DataFrame([
        ["2023-01-01 09:00", "2023-01-01 10:00", "Team Meeting", "Weekly sync", "Conference Room A"],
        ["2023-01-02 14:00", "2023-01-02 15:30", "Client Call", "Project discussion", "Zoom"],
        ["2023-01-03 10:00", "2023-01-03 12:00", "Workshop", "Training session", "Training Room"],
    ], columns=["Start Date", "End Date", "Event Title", "Description", "Location"])
    output = BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        sample.to_excel(writer, index=False, sheet_name="Events")
    return output.getvalue()

def run(lang):
    st.markdown("### 📅 XLS to iCal Converter")

    st.markdown("#### 📘 How to use")
    st.markdown("""
    1. Download our Excel template or use your own file  
    2. Make sure your file has the following columns:  
    `Start Date`, `End Date`, `Event Title`, `Description`, `Location`  
    3. Upload your Excel file  
    4. Convert and download your calendar file (.ics)
    """)
    st.download_button("📥 Download Excel Template", get_template_file(), file_name="Calendar_Template.xlsx")

    uploaded_file = st.file_uploader("Select your Excel file:", type=["xls", "xlsx"])

    if uploaded_file:
        try:
            df = pd.read_excel(uploaded_file)
            st.markdown("### 📊 Template Preview")
            st.dataframe(df)

            if st.button("🔁 Convert to ICS"):
                ics_content = generate_ics(df)
                st.download_button("📤 Download ICS Calendar", data=ics_content, file_name="calendar.ics", mime="text/calendar")
        except Exception as e:
            st.error(f"Error processing file: {e}")
