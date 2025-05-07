import streamlit as st
import qrcode
from PIL import Image, ImageDraw
from translations import translations

def run(lang):
    t = translations[lang]

    st.markdown(f"<h2 style='text-align:center'>{t['title']}</h2>", unsafe_allow_html=True)

    # Вхідні дані
    text = st.text_input(t["text"], placeholder=t["placeholder"])
    style = st.selectbox(t["style"], ["solid", "gradient"])
    col1, col2 = st.columns(2)
    color1 = col1.color_picker(t["color1"], "#000000")
    color2 = col2.color_picker(t["color2"], "#000000" if style == "solid" else "#ff0000")

    if st.button(t["button"]):
        if text.strip() == "":
            st.warning("❗ Please enter some text.")
            return

        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H)
        qr.add_data(text)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
        width, height = img.size

        if style == "gradient":
            gradient = Image.new("RGBA", (width, height), "white")
            draw = ImageDraw.Draw(gradient)
            for y in range(height):
                ratio = y / height
                r = int(int(color1[1:3], 16) * (1 - ratio) + int(color2[1:3], 16) * ratio)
                g = int(int(color1[3:5], 16) * (1 - ratio) + int(color2[3:5], 16) * ratio)
                b = int(int(color1[5:7], 16) * (1 - ratio) + int(color2[5:7], 16) * ratio)
                draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

            # Маска чорних пікселів
            bw = img.convert("L").point(lambda x: 0 if x > 128 else 255)
            img = Image.composite(gradient, Image.new("RGBA", img.size, "white"), bw)

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

def img_to_bytes(img):
    from io import BytesIO
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
