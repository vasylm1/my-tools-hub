import streamlit as st
import qrcode
from PIL import Image, ImageDraw

# Вибір мови
languages = {
    "en": {
        "title": "QR Code Generator",
        "text": "Text or URL:",
        "placeholder": "Enter something...",
        "style": "Design Style:",
        "color1": "Color 1",
        "color2": "Color 2",
        "button": "Generate QR Code",
        "download": "Download QR Code"
    },
    "uk": {
        "title": "Генератор QR-кодів",
        "text": "Текст або посилання:",
        "placeholder": "Введіть щось...",
        "style": "Стиль оформлення:",
        "color1": "Колір 1",
        "color2": "Колір 2",
        "button": "Згенерувати QR-код",
        "download": "Завантажити QR-код"
    },
    "pl": {
        "title": "Generator kodów QR",
        "text": "Tekst lub URL:",
        "placeholder": "Wpisz coś...",
        "style": "Styl projektu:",
        "color1": "Kolor 1",
        "color2": "Kolor 2",
        "button": "Wygeneruj kod QR",
        "download": "Pobierz kod QR"
    },
    "de": {
        "title": "QR-Code Generator",
        "text": "Text oder URL:",
        "placeholder": "Geben Sie etwas ein...",
        "style": "Design-Stil:",
        "color1": "Farbe 1",
        "color2": "Farbe 2",
        "button": "QR-Code generieren",
        "download": "QR-Code herunterladen"
    },
    "zh": {
        "title": "二维码生成器",
        "text": "文字或网址：",
        "placeholder": "请输入...",
        "style": "设计样式：",
        "color1": "颜色 1",
        "color2": "颜色 2",
        "button": "生成二维码",
        "download": "下载二维码"
    }
}

lang = st.selectbox("🌐 Language / Мова / Język / Sprache / 语言", list(languages.keys()))
t = languages[lang]

st.markdown(f"<h2 style='text-align:center'>{t['title']}</h2>", unsafe_allow_html=True)

# Вхідні дані
text = st.text_input(t["text"], placeholder=t["placeholder"])
style = st.selectbox(t["style"], ["solid", "gradient"])
col1, col2 = st.columns(2)
color1 = col1.color_picker(t["color1"], "#000000")
color2 = col2.color_picker(t["color2"], "#000000" if style == "solid" else "#ff0000")

# Генерація
if st.button(t["button"]):
    if text.strip() == "":
        st.warning("❗ Please enter some text.")
    else:
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H)
        qr.add_data(text)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
        width, height = img.size

        # Накладаємо градієнт якщо потрібно
        if style == "gradient":
            gradient = Image.new("RGBA", (width, height), color=0)
            draw = ImageDraw.Draw(gradient)

            for y in range(height):
                r = int(int(color1[1:3], 16) * (1 - y / height) + int(color2[1:3], 16) * (y / height))
                g = int(int(color1[3:5], 16) * (1 - y / height) + int(color2[3:5], 16) * (y / height))
                b = int(int(color1[5:7], 16) * (1 - y / height) + int(color2[5:7], 16) * (y / height))
                draw.line([(0, y), (width, y)], fill=(r, g, b, 255))
            img = Image.alpha_composite(Image.new("RGBA", img.size, "white"), Image.composite(gradient, img, img))

        elif style == "solid":
            img = img.convert("RGBA")
            pixels = img.load()
            r, g, b = tuple(int(color1[i:i+2], 16) for i in (1, 3, 5))
            for y in range(height):
                for x in range(width):
                    if pixels[x, y][0] < 128:
                        pixels[x, y] = (r, g, b, 255)
                    else:
                        pixels[x, y] = (255, 255, 255, 255)

        st.image(img, caption=t["download"])
        st.download_button(label=t["download"], data=img_to_bytes(img), file_name="qrcode.png", mime="image/png")

# Допоміжна функція
def img_to_bytes(img):
    from io import BytesIO
    buf = BytesIO()
    img.save(buf, format="PNG")
    byte_im = buf.getvalue()
    return byte_im
