import streamlit as st
from PIL import Image, ImageDraw, ImageFont
import base64
from io import BytesIO
import os
from pathlib import Path

# Email signature template
SIGNATURE_TEMPLATE = """
<div style="
    font-family: {font_family} !important;
    font-size: {font_size}px;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    border: {border_width}px solid {primary_color}20;
    border-radius: {border_radius}px;
    background-color: {bg_color};
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
    
    {greeting_html}
    
    <div style="display: flex; align-items: center; margin: 15px 0;">
        {photo_html}
        <div style="margin-left: 20px;">
            <h2 style="color: {text_color}; margin: 0 0 5px 0; font-size: {heading_size}px !important; font-weight: bold;">{full_name}</h2>
            <p style="color: {primary_color}; font-weight: 600; margin: 0 0 3px 0; font-size: {job_title_size}px !important;">{job_title}</p>
            <p style="color: {text_color}cc; margin: 0 0 15px 0; font-size: {company_name_size}px !important;">{company_name}</p>
            
            <div style="margin-top: 10px;">
                <div style="margin-bottom: 8px;">{phone_html}</div>
                <div style="margin-bottom: 8px;">{email_html}</div>
                <div>{website_html}</div>
            </div>
        </div>
    </div>
    
    <div style="
        border-top: 1px solid {primary_color}20;
        padding-top: 15px;
        margin-top: 15px;
        font-size: 0.9em;
        text-align: center;">
        {social_icons}
    </div>
</div>
"""

def create_signature(
    full_name,
    job_title,
    company_name,
    phone,
    email,
    website,
    photo=None,
    social_links=None,
    greeting="",
    primary_color="#4361ee",
    accent_color="#4895ef",
    text_color="#333333",
    bg_color="#ffffff",
    font_family="Arial, sans-serif",
    font_size=14,
    heading_scale=1.0,
    border_radius=8,
    border_width=1,
    link_style="With Icon"
):
    """Generate HTML email signature with preview"""
    
    # Process photo
    photo_url = ""
    if photo:
        try:
            # Convert photo to base64
            buffered = BytesIO()
            photo.save(buffered, format=photo.format or 'PNG')
            img_str = base64.b64encode(buffered.getvalue()).decode()
            photo_url = f"data:image/png;base64,{img_str}"
            
            # Generate photo HTML
            photo_html = f'''
            <div style="
                width: 100px;
                height: 100px;
                border-radius: 50%;
                overflow: hidden;
                border: 2px solid {primary_color};
                flex-shrink: 0;">
                <img src="{photo_url}" 
                     alt="{full_name}" 
                     style="width: 100%; 
                            height: 100%; 
                            object-fit: cover;">
            </div>'''
        except Exception as e:
            st.error(f"Error processing photo: {e}")
            photo_html = ''
    else:
        # Default initials HTML (100x100)
        initials = ''.join([name[0].upper() for name in full_name.split()[:2]])
        photo_html = f'''
        <div style="
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background-color: {primary_color}20;
            display: flex;
            align-items: center;
            justify-content: center;
            color: {primary_color};
            font-size: 36px;
            font-weight: bold;
            border: 2px solid {primary_color};
            flex-shrink: 0;">
            {initials}
        </div>'''
    
    # Process contact info with link styling
    def format_link(url, text=None, icon=None):
        if not url:
            return ''
            
        if not text:
            text = url.replace('https://', '').replace('http://', '').rstrip('/')
        
        if link_style == "Icon Only":
            display_text = f"{icon}"
        elif link_style == "With Icon":
            display_text = f"{icon} {text}" if icon else text
        else:  # Text Only
            display_text = text
            
        return f'<a href="{url}" target="_blank" style="color: {primary_color}; text-decoration: none; font-size: {font_size}px;">{display_text}</a>'
    
    # Format contact links
    phone_html = f'<div style="margin-bottom: 8px; color: {text_color}; font-size: {font_size}px;">📞 {phone}</div>' if phone else ''
    
    email_icon = "✉️" if link_style != "Icon Only" else ""
    email_html = f'<div style="margin-bottom: 8px; color: {text_color};">{email_icon} {format_link(f"mailto:{email}", email, "")}</div>' if email else ''
    
    website_icon = "🌐" if link_style != "Icon Only" else ""
    website_display = website.replace('https://', '').replace('http://', '').rstrip('/')
    website_html = f'<div style="color: {text_color};">{website_icon} {format_link(website, website_display, "")}</div>' if website else ''
    
    # Process greeting
    greeting_html = f'<p style="margin: 0 0 15px 0; color: {text_color}cc;">{greeting}</p>' if greeting else ''
    
    # Process social links
    social_icons = ''
    if social_links:
        social_icons = '<div style="display: flex; justify-content: center; gap: 16px; margin-top: 10px;">'
        
        # Social media icons with brand colors
        platform_icons = {
            'linkedin': {
                'svg': '''
                <svg width="24" height="24" viewBox="0 0 16 16" fill="#0077B5" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z"/>
                </svg>''',
                'color': '#0077B5'  # LinkedIn blue
            },
            'twitter': {
                'svg': '''
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#1DA1F2" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23.953 4.57a10 10 0 01-2.83.78 4.96 4.96 0 002.17-2.73 9.99 9.99 0 01-3.13 1.2 4.92 4.92 0 00-8.39 4.48A14 14 0 011.67 3.15 4.93 4.93 0 003.2 9.72a4.9 4.9 0 01-2.23-.62v.06a4.92 4.92 0 003.95 4.82 4.9 4.9 0 01-2.22.08 4.93 4.93 0 004.6 3.42 9.88 9.88 0 01-6.1 2.1 13.9 13.9 0 007.55 2.2c9.05 0 13.99-7.5 13.99-13.98 0-.21 0-.42-.01-.63a10 10 0 002.44-2.55"/>
                </svg>''',
                'color': '#1DA1F2'  # Twitter blue
            },
            'facebook': {
                'svg': '''
                <svg width="24" height="24" viewBox="0 0 16 16" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951"/>
                </svg>''',
                'color': '#1877F2'  # Facebook blue
            },
            'instagram': {
                'svg': '''
                <svg width="24" height="24" viewBox="0 0 16 16" fill="#E1306C" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334"/>
                </svg>''',
                'color': '#E1306C'  # Instagram pink
            },
            'telegram': {
                'svg': '''
                <svg width="24" height="24" viewBox="0 0 16 16" fill="#26A5E4" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.287 5.906q-1.168.486-4.666 2.01-.567.225-.595.442c-.03.243.275.339.69.47l.175.055c.408.133.958.288 1.243.294q.39.01.868-.32 3.269-2.206 3.374-2.23c.05-.012.12-.026.166.016s.042.12.037.141c-.03.129-1.227 1.241-1.846 1.817-.193.18-.33.307-.358.336a8 8 0 0 1-.188.186c-.38.366-.664.64.015 1.088.327.216.589.393.85.571.284.194.568.387.936.629q.14.092.27.187c.331.236.63.448.997.414.214-.02.435-.22.547-.82.265-1.417.786-4.486.906-5.751a1.4 1.4 0 0 0-.013-.315.34.34 0 0 0-.114-.217.53.53 0 0 0-.31-.093c-.3.005-.763.166-2.984 1.09"/>
                </svg>''',
                'color': '#26A5E4'  # Telegram blue
            },
            'discord': {
                'svg': '''
                <svg width="24" height="24" viewBox="0 0 16 16" fill="#5865F2" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"/>
                </svg>''',
                'color': '#5865F2'  # Discord purple
            },
            'github': {
                'svg': '''
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#181717" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 22c-5.52 0-10-4.48-10-10S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm-1-12h2v6h-2v-6zm1-3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                </svg>''',
                'color': '#181717'  # GitHub black
            },
            'tiktok': {
                'svg': '''
                <svg width="24" height="24" viewBox="0 0 16 16" fill="#000000" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"/>
                </svg>''',
                'color': '#000000'  # TikTok black
            },
            'wechat': {
                'svg': '''
                <svg width="24" height="24" viewBox="-81 -81 462.00 462.00" fill="#07C160" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#07C160" d="M300 255c0 24.854-20.147 45-45 45H45c-24.854 0-45-20.146-45-45V45C0 20.147 20.147 0 45 0h210c24.853 0 45 20.147 45 45v210z"></path>
                    <g fill="#FFF">
                        <path d="M200.803 111.88c-24.213 1.265-45.268 8.605-62.362 25.188-17.271 16.754-25.155 37.284-23 62.734-9.464-1.172-18.084-2.462-26.753-3.192-2.994-.252-6.547.106-9.083 1.537-8.418 4.75-16.488 10.113-26.053 16.092 1.755-7.938 2.891-14.889 4.902-21.575 1.479-4.914.794-7.649-3.733-10.849-29.066-20.521-41.318-51.232-32.149-82.85 8.483-29.25 29.315-46.989 57.621-56.236 38.635-12.62 82.054.253 105.547 30.927 8.485 11.08 13.688 23.516 15.063 38.224zm-111.437-9.852c.223-5.783-4.788-10.993-10.74-11.167-6.094-.179-11.106 4.478-11.284 10.483-.18 6.086 4.475 10.963 10.613 11.119 6.085.154 11.186-4.509 11.411-10.435zm58.141-11.171c-5.974.11-11.022 5.198-10.916 11.004.109 6.018 5.061 10.726 11.204 10.652 6.159-.074 10.83-4.832 10.772-10.977-.051-6.032-4.981-10.79-11.06-10.679z"></path>
                        <path d="M255.201 262.83c-7.667-3.414-14.7-8.536-22.188-9.318-7.459-.779-15.3 3.524-23.104 4.322-23.771 2.432-45.067-4.193-62.627-20.432-33.397-30.89-28.625-78.254 10.014-103.568 34.341-22.498 84.704-14.998 108.916 16.219 21.129 27.24 18.646 63.4-7.148 86.284-7.464 6.623-10.15 12.073-5.361 20.804.884 1.612.985 3.653 1.498 5.689zm-87.274-84.499c4.881.005 8.9-3.815 9.085-8.636.195-5.104-3.91-9.385-9.021-9.406-5.06-.023-9.299 4.318-9.123 9.346.166 4.804 4.213 8.69 9.059 8.696zm56.261-18.022c-4.736-.033-8.76 3.844-8.953 8.629-.205 5.117 3.772 9.319 8.836 9.332 4.898.016 8.768-3.688 8.946-8.562.19-5.129-3.789-9.364-8.829-9.399z"></path>
                    </g>
                </svg>''',
                'color': '#07C160'  # WeChat green
            },
            'default': {
                'svg': '''
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 22c-5.52 0-10-4.48-10-10S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm-1-12h2v6h-2v-6zm1-3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                </svg>''',
                'color': primary_color  # Use primary color for unknown platforms
            }
        }
        
        for link in social_links:
            platform = link['platform'].lower()
            # Try to find matching platform icon, otherwise use default
            icon_data = platform_icons.get(platform, platform_icons['default'])
            
            # Determine what to display based on link_style
            if link_style == "Text Only":
                link_content = f'''
                <span style="
                    color: {icon_data['color']};
                    font-size: {font_size}px;
                    white-space: nowrap;
                ">
                    {link['name']}
                </span>'''
                link_style_css = f"""
                    display: inline-block;
                    padding: 8px 12px;
                    margin: 0 4px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                """
            elif link_style == "Icon Only":
                link_content = f'''
                <div style="
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;">
                    {icon_data['svg']}
                </div>'''
                link_style_css = f"""
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: {primary_color}10;
                    margin: 0 4px;
                    transition: all 0.2s;
                """
            else:  # With Icon (default)
                link_content = f'''
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 12px;
                ">
                    <div style="
                        width: 20px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">
                        {icon_data['svg']}
                    </div>
                    <span style="
                        color: {icon_data['color']};
                        font-size: {font_size}px;
                        white-space: nowrap;
                    ">
                        {link['name']}
                    </span>
                </div>'''
                link_style_css = f"""
                    display: inline-block;
                    border-radius: 20px;
                    background: {primary_color}08;
                    margin: 0 4px;
                    transition: all 0.2s;
                """
            
            # Add hover effect
            hover_effect = """
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            """
            
            social_icons += f'''
            <a href="{link['url']}" 
               target="_blank" 
               title="{link['name']}"
               style="
                   color: {icon_data['color']}; 
                   text-decoration: none;
                   {link_style_css}
               "
               onmouseover="this.style.cssText += '{hover_effect}'"
               onmouseout="this.style.cssText = this.style.cssText.replace('{hover_effect}', '')">
                {link_content}
            </a>'''
            
        social_icons += '</div>'
    
    # Calculate dynamic values
    heading_size = int(font_size * 1.5 * heading_scale)
    job_title_size = int(font_size * 1.1)
    company_name_size = int(font_size * 0.95)
    
    # Format the template with user data
    signature_html = SIGNATURE_TEMPLATE.format(
        full_name=full_name,
        job_title=job_title,
        company_name=company_name,
        phone_html=phone_html,
        email_html=email_html,
        website_html=website_html,
        website_display=website_display,
        photo_html=photo_html,
        social_icons=social_icons,
        primary_color=primary_color,
        accent_color=accent_color,
        text_color=text_color,
        bg_color=bg_color,
        font_family=font_family,
        font_size=font_size,
        heading_size=heading_size,
        job_title_size=job_title_size,
        company_name_size=company_name_size,
        border_radius=border_radius,
        border_width=border_width,
        greeting_html=greeting_html
    )
    
    return signature_html

def run(lang=None):
    """Main function to run the email signature creator"""
    # Import translations
    from translations import translations
    
    # Get translations for selected language or default to English
    t = translations.get(lang, translations["English"])
    
    st.title(t.get("email_signature_title", "📧 Email Signature Creator"))
    
    # Create two main columns: preview (wider) and form (narrower)
    preview_col, form_col = st.columns([2, 1])
    
    with form_col:
        st.subheader(t.get("signature_details", "Signature Details"))
        
        # Personal Information
        full_name = st.text_input(t.get("full_name", "Full Name"), "John Doe")
        job_title = st.text_input(t.get("job_title", "Job Title"), "Software Engineer")
        company_name = st.text_input(t.get("company_name", "Company Name"), "ACME Inc.")
        
        # Contact Information
        st.subheader(t.get("contact_info", "Contact Information"))
        phone = st.text_input(t.get("phone_number", "Phone Number"), "+1 (123) 456-7890")
        email = st.text_input(t.get("email", "Email"), "john.doe@example.com")
        website = st.text_input(t.get("website", "Website"), "https://example.com")
        
        # Greeting
        st.subheader(t.get("greeting_label", "Greeting"))
        greeting = st.text_area("", t.get("greeting_default", "Best regards,"), 
                              placeholder=t.get("greeting_label", "Greeting (optional)"))
        
        # Social Media & Contact
        st.subheader(t.get("connect_title", "🌐 Connect With Me"))
        st.caption(t.get("connect_subtitle", "Add your social media profiles to stay connected"))
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            linkedin = st.text_input("LinkedIn", "https://linkedin.com/in/username", 
                                   label_visibility="collapsed", placeholder="LinkedIn URL")
        with col2:
            twitter = st.text_input("Twitter", "https://twitter.com/username", 
                                  label_visibility="collapsed", placeholder="Twitter URL")
        with col3:
            facebook = st.text_input("Facebook", "https://facebook.com/username", 
                                   label_visibility="collapsed", placeholder="Facebook URL")
        with col4:
            instagram = st.text_input(t.get("instagram", "Instagram"), "https://instagram.com/username", 
                                    label_visibility="collapsed", placeholder="Instagram URL")
            
        col5, col6, col7, col8 = st.columns(4)
        with col5:
            wechat = st.text_input(t.get("wechat", "WeChat"), "", 
                                 label_visibility="collapsed", placeholder="WeChat ID")
        with col6:
            telegram = st.text_input(t.get("telegram", "Telegram"), "", 
                                   label_visibility="collapsed", placeholder="Telegram @username")
        with col7:
            discord = st.text_input(t.get("discord", "Discord"), "", 
                                  label_visibility="collapsed", placeholder="Discord Username")
        with col8:
            tiktok = st.text_input(t.get("tiktok", "TikTok"), "", 
                                 label_visibility="collapsed", placeholder="TikTok @username")
        
        # Appearance
        st.subheader(t.get("appearance_title", "Appearance"))
        
        # Color Scheme
        st.markdown(f"**{t.get('color_scheme', 'Color Scheme')}**")
        col1, col2, col3 = st.columns(3)
        with col1:
            primary_color = st.color_picker(t.get("primary_color", "Primary Color"), "#4361ee")
        with col2:
            bg_color = st.color_picker(t.get("bg_color", "Background"), "#ffffff")
        with col3:
            text_color = st.color_picker(t.get("text_color", "Text"), "#333333")
        
        # Font Settings
        st.markdown(f"**{t.get('font_settings', 'Font Settings')}**")
        font_col1, font_col2 = st.columns(2)
        with font_col1:
            font_family = st.selectbox(
                t.get("font_family", "Font Family"),
                ["Arial, sans-serif", "Helvetica, sans-serif", "Verdana, sans-serif", 
                 "Georgia, serif", "Times New Roman, serif", "Courier New, monospace"]
            )
        with font_col2:
            font_size = st.slider(
                f"{t.get('font_size', 'Base Font Size')} (px)", 
                10, 20, 14
            )
        
        # Link Style
        st.markdown(f"**{t.get('link_settings', 'Link Settings')}**")
        
        # Define the link style options with translations
        link_style_options = [
            "Text Only",
            "Icon Only",
            "With Icon"
        ]
        
        # Get the selected index to maintain selection across language changes
        selected_index = 0  # Default to first option
        if 'link_style' in st.session_state:
            try:
                selected_index = link_style_options.index(st.session_state.link_style)
            except ValueError:
                pass
                
        # Display radio with translated labels but store English values
        link_style = st.radio(
            t.get("link_style", "Link Style"),
            [
                t.get("link_style_text", "Text Only"),
                t.get("link_style_icon", "Icon Only"),
                t.get("link_style_both", "With Icon")
            ],
            index=selected_index,
            horizontal=True,
            label_visibility="collapsed"
        )
        
        # Map the selected translated text back to the English value
        if link_style == t.get("link_style_text", "Text Only"):
            link_style = "Text Only"
        elif link_style == t.get("link_style_icon", "Icon Only"):
            link_style = "Icon Only"
        else:  # With Icon
            link_style = "With Icon"
            
        # Store the selected style in session state
        st.session_state.link_style = link_style
        
        # Profile Photo
        st.subheader(t.get("profile_photo", "Profile Photo"))
        uploaded_file = st.file_uploader(
            t.get("upload_photo", "Upload a square photo (optional)"), 
            type=["jpg", "jpeg", "png"]
        )
        
        # Generate Button
        if st.button(t.get("preview", "Preview"), use_container_width=True, type="primary"):
            st.session_state.generate_clicked = True
            
        # Download Buttons (initially hidden)
        if st.session_state.get('generate_clicked', False):
            st.download_button(
                label=t.get("download_html", "Download HTML Signature"),
                data=st.session_state.get('signature_html', ''),
                file_name="signature.html",
                mime="text/html",
                use_container_width=True
            )
            
            if st.button(t.get("copy_clipboard", "Copy to Clipboard"), use_container_width=True):
                st.session_state.copied = True
                st.rerun()
                
            if st.session_state.get('copied', False):
                st.success(t.get("copied_success", "Signature copied to clipboard!"))
                st.session_state.copied = False
                
    # Prepare social links with platform-specific icons
    social_links = [
        {
            'url': linkedin,
            'platform': 'linkedin',
            'name': 'LinkedIn'
        } if linkedin else None,
        {
            'url': twitter,
            'platform': 'twitter',
            'name': 'Twitter'
        } if twitter else None,
        {
            'url': facebook,
            'platform': 'facebook',
            'name': 'Facebook'
        } if facebook else None,
        {
            'url': instagram,
            'platform': 'instagram',
            'name': 'Instagram'
        } if instagram else None,
        {
            'url': wechat,
            'platform': 'wechat',
            'name': 'WeChat'
        } if wechat else None,
        {
            'url': telegram,
            'platform': 'telegram',
            'name': 'Telegram'
        } if telegram else None,
        {
            'url': discord,
            'platform': 'discord',
            'name': 'Discord'
        } if discord else None,
        {
            'url': tiktok,
            'platform': 'tiktok',
            'name': 'TikTok'
        } if tiktok else None
    ]
    social_links = [link for link in social_links if link]  # Remove None values
    
    # Process uploaded photo
    photo = None
    if uploaded_file is not None:
        try:
            photo = Image.open(uploaded_file)
        except Exception as e:
            st.error(f"Error loading image: {e}")
    
    # Calculate font sizes
    heading_scale = 1.5  # 150% of base font size for headings
    
    # Generate HTML
    signature_html = create_signature(
        full_name=full_name,
        job_title=job_title,
        company_name=company_name,
        phone=phone,
        email=email,
        website=website,
        greeting=greeting,
        social_links=social_links,
        primary_color=primary_color,
        bg_color=bg_color,
        text_color=text_color,
        font_family=font_family,
        font_size=font_size,
        heading_scale=heading_scale,
        border_radius=8,
        border_width=1,
        link_style=link_style,
        photo=photo
    )
    
    # Store in session state for download
    st.session_state.signature_html = signature_html
    
    # Display preview
    with preview_col:
        st.subheader(t.get("preview", "Preview"))
        st.components.v1.html(signature_html, height=400, scrolling=True)
        
        # Download buttons
        st.download_button(
            label=t.get("download_html", "Download HTML Signature"),
            data=signature_html,
            file_name="signature.html",
            mime="text/html"
        )
        
        # Copy to clipboard button
        if st.button("Copy to Clipboard"):
            st.experimental_set_query_params(copy=signature_html)
            st.success("Signature copied to clipboard!")

if __name__ == "__main__":
    run()
