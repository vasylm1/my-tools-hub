import streamlit as st
import os
from translations import translations

# ⬛️ Настройки сторінки
st.set_page_config(page_title="🛠️ My Tools Hub", layout="wide")

# 🎨 Вставка стилів напряму
st.markdown("""
<style>
:root {
  --primary: #4361ee;
  --secondary: #3f37c9;
  --accent: #4895ef;
  --light: #f8f9fa;
  --dark: #212529;
}
html, body, [class*="css"] {
  font-family: 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #dfe7f5 100%) !important;
}
.tool-button {
  background: linear-gradient(45deg, var(--primary), var(--accent));
  border: none;
  color: white;
  padding: 0.75rem 1.5rem;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease-in-out;
}
.tool-button:hover {
  background: linear-gradient(45deg, var(--secondary), var(--accent));
  transform: translateY(-2px);
}
.social-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  background-color: rgba(67, 97, 238, 0.1);
  border-radius: 8px;
  text-decoration: none;
  color: #4361ee;
  margin-top: 1rem;
  font-weight: bold;
}
</style>
""", unsafe_allow_html=True)

# 🌐 Мовний вибір
lang = st.sidebar.selectbox("🌍 Language / Мова", list(translations.keys()))
t = translations[lang]

# 📂 Вкладки: Інструменти або Про мене
tab = st.sidebar.radio("📁", [t["toolsTab"], t["aboutTab"]])

# Заголовок
st.title("🛠️ My Tools Hub")

# 🧰 Інструменти
if tab == t["toolsTab"]:
    st.subheader(t["selectTool"])
    tools = [f for f in os.listdir("services") if f.endswith(".py")]

    for tool in tools:
        name = tool.replace(".py", "").replace("_", " ").title()
        st.markdown(f"""
        <div style='margin-bottom: 1rem;'>
          <a href="/{tool}" target="_self">
            <button class="tool-button">🔧 {name}</button>
          </a>
        </div>
        """, unsafe_allow_html=True)

# 👤 Про мене
elif tab == t["aboutTab"]:
    st.subheader(t["aboutTitle"])
    for i in range(1, 5):
        st.markdown(f"<p>{t[f'aboutText{i}']}</p>", unsafe_allow_html=True)
    st.markdown(f"""
    <a class="social-link" href="https://www.linkedin.com/in/vasyl-madei-399488247/" target="_blank">
      🔗 {t["linkedinText"]}
    </a>
    """, unsafe_allow_html=True)
