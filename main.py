import streamlit as st
import os
import importlib.util
from translations import translations

# 🛠 Налаштування сторінки
st.set_page_config(page_title="🛠️ My Tools Hub", layout="wide")

# 🎨 Вбудовані стилі
st.markdown("""
<style>
:root {
  --primary: #4361ee;
  --accent: #4895ef;
  --secondary: #3f37c9;
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

# 🌍 Мова
lang = st.sidebar.selectbox("🌐 Language / Мова", list(translations.keys()))
t = translations[lang]

# 📁 Інструменти
services_dir = os.path.join(os.path.dirname(__file__), "services")
if not os.path.exists(services_dir):
    os.makedirs(services_dir)

tools = [f for f in os.listdir(services_dir) if f.endswith(".py")]
selected = st.sidebar.selectbox("🧰 " + t["selectTool"], tools)

st.title("🛠️ My Tools Hub")

# 🔧 Відображення інструменту
module_name = selected.replace(".py", "")
file_path = os.path.join(services_dir, selected)
spec = importlib.util.spec_from_file_location("tool_module", file_path)
tool_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool_module)
if hasattr(tool_module, "run"):
    tool_module.run(lang)

# 👤 Блок "Про мене" внизу сторінки
st.markdown("""
---
### 👤 {about_title}
<p style='font-size:1.1rem'>{about1}</p>
<p style='font-size:1.1rem'>{about2}</p>
<p style='font-size:1.1rem'>{about3}</p>
<p style='font-size:1.1rem'>{about4}</p>
<a class="social-link" href="https://www.linkedin.com/in/vasyl-madei-399488247/" target="_blank">
  🔗 {linkedin}
</a>
""".format(
    about_title=t["aboutTitle"],
    about1=t["aboutText1"],
    about2=t["aboutText2"],
    about3=t["aboutText3"],
    about4=t["aboutText4"],
    linkedin=t["linkedinText"]
), unsafe_allow_html=True)
