#!/usr/bin/env python3
"""
HelenTech shared layout (header, footer, floating WhatsApp button).

Every page contains the header and footer between marker comments:
    <!-- SITE-HEADER:START --> ... <!-- SITE-HEADER:END -->
    <!-- SITE-FOOTER:START --> ... <!-- SITE-FOOTER:END -->

To change the menu or footer on ALL pages at once:
  1. Edit the templates below.
  2. Run:  python3 tools/layout.py
The script rewrites the marked sections in every .html file in the project root and
marks the current page in the menu using <body data-nav="...">.
No other dependencies are needed (Python 3 standard library only).
"""
import glob
import os
import re

WHATSAPP = "2349010843157"
EMAIL = "helentech776@gmail.com"

ARROW = '<svg class="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M7 17L17 7M17 7H8M17 7V16"/></svg>'
CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
LOGO = ('<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 100 100"><polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill="#F78616"/>'
        '<polygon points="50,28 71,40 71,60 50,72 29,60 29,40" fill="#fff"/></svg></span><span class="brand-text">Helen<b>Tech</b></span>')

SOCIAL = [
    ("Instagram", "https://www.instagram.com/helentech1/",
     '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>'),
    ("Facebook", "https://www.facebook.com/profile.php?id=61584950315332",
     '<path d="M15 3h-2a5 5 0 00-5 5v3H6v4h2v6h4v-6h3l1-4h-4V8a1 1 0 011-1h3z"/>'),
    ("TikTok", "https://www.tiktok.com/@helen_techy",
     '<path d="M16 3v9.5a3.5 3.5 0 11-3.5-3.5"/><path d="M16 3a5 5 0 005 5"/>'),
    ("Threads", "https://www.threads.com/@helentech1",
     '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zM9 9c0-1.5 1-2.5 3-2.5s3 1.5 3 3.5c0 1.5-1 2-2 2.5 1.5.5 2.5 1.5 2.5 3 0 2-1.5 3.5-3.5 3.5S8 17.5 8 16"/>'),
    ("Google Business Profile", "https://share.google/FciOg8GZRiIqG7gP9",
     '<path d="M12 21c-4-4-7-7.5-7-11a7 7 0 0114 0c0 3.5-3 7-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
]
WA_ICON = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 004.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0012.04 2zm5.8 14.02c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.13.11-1.83-.12-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.83 2 .9 2.15.07.15.12.32.02.51-.1.19-.15.31-.3.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12 1 2.06 1.31 2.35 1.46.29.15.46.13.63-.08.17-.21.72-.84.91-1.13.19-.29.38-.24.64-.14.26.1 1.65.78 1.93.92.28.14.47.21.54.33.07.12.07.68-.17 1.36z"/></svg>')

# Service categories. Page file names are unchanged from the original site.
CATEGORIES = [
    ("Google Business Profile", "google-business-profile.html", "Local SEO, Maps visibility, citations and reinstatement",
     []),
    ("Google Merchant Center", "google-merchant-center.html", "Product feeds, disapprovals and policy issues",
     []),
    ("Google Ads", "google-ads.html", "Search and Shopping campaigns and tracking",
     []),
    ("Google Analytics 4", "google-analytics-4.html", "GA4 setup, events, GTM and reporting",
     []),
]

# (key, label, href)
MAIN_LINKS = [
    ("home", "Home", "index.html"),
    ("services", "Services", None),
    ("portfolio", "Portfolio", "portfolio.html"),
    ("about", "About Us", "about.html"),
    ("blog", "Blog", "blog.html"),
    ("contact", "Contact", "contact.html"),
]


def header(active=""):
    def cur(k):
        return ' aria-current="page"' if k == active else ""

    desktop = []
    for key, label, href in MAIN_LINKS:
        if key == "services":
            cols = "".join(
                f'<div class="mega-col"><h6><a href="{h}">{t}</a></h6>'
                + f'<a class="sub" href="{h}">{_d}</a>' + "</div>"
                for t, h, _d, links in CATEGORIES)
            desktop.append(
                f'<div class="nav-item{" is-current" if active == "services" else ""}">'
                f'<button type="button" aria-haspopup="true">Services {CHEV}</button>'
                f'<div class="mega"><div class="mega-panel">{cols}</div></div></div>')
        else:
            desktop.append(f'<a href="{href}"{cur(key)}>{label}</a>')

    mobile = []
    for key, label, href in MAIN_LINKS:
        if key == "services":
            subs = "".join(f'<a href="{h}"><strong>{t}</strong><small>{d}</small></a>' for t, h, d, _l in CATEGORIES)
            open_attr = "true" if active == "services" else "false"
            mobile.append(
                f'<li><button type="button" class="mm-toggle" aria-expanded="false" aria-controls="mmServices">Services {CHEV}</button>'
                f'<div class="mm-sub" id="mmServices"><div>{subs}</div></div></li>')
        else:
            mobile.append(f'<li><a class="mm-link" href="{href}"{cur(key)}><span>{label}</span></a></li>')

    return f'''<!-- SITE-HEADER:START (generated by tools/layout.py, edit the template there) -->
<a class="skip-link" href="#main">Skip to content</a>
<header class="nav" id="nav">
  <div class="wrap">
    <a href="index.html" class="brand" aria-label="HelenTech home">{LOGO}</a>
    <nav class="nav-links" aria-label="Main">
      {"".join(desktop)}
    </nav>
    <div class="nav-actions">
      <a href="contact.html" class="btn btn-primary btn-sm nav-cta">Contact HelenTech</a>
      <button type="button" class="hamburger" id="hamburger" aria-label="Open menu" aria-expanded="false" aria-controls="mobileMenu"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
<div class="mobile-menu" id="mobileMenu" role="dialog" aria-label="Site menu">
  <nav aria-label="Mobile">
    <ul class="mm-list">
      {"".join(mobile)}
    </ul>
    <div class="mm-cta"><a href="contact.html" class="btn btn-primary btn-block">Contact HelenTech {ARROW}</a></div>
  </nav>
</div>
<!-- SITE-HEADER:END -->'''

ENQUIRY = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'enquiry_modal.html'), encoding='utf-8').read().replace('@@EMAIL@@', EMAIL).replace('@@WA@@', WHATSAPP)

# The enquiry pop-up + floating "Have a Question?" button are switched OFF. To bring them back: set this to True and run
#   python3 tools/blog.py   (it rebuilds every page and re-stamps the footer).
ENQUIRY_POPUP_ENABLED = False
if not ENQUIRY_POPUP_ENABLED:
    ENQUIRY = ''


def footer():
    social = "".join(
        f'<a href="{u}" target="_blank" rel="noopener" aria-label="{n}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">{p}</svg></a>'
        for n, u, p in SOCIAL)
    svc = '<a href="google-services.html">All Services</a>' + "".join(f'<a href="{h}">{t}</a>' for t, h, _d, _l in CATEGORIES)
    return f'''<!-- SITE-FOOTER:START (generated by tools/layout.py, edit the template there) -->
<footer>
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        <a href="index.html" class="brand" aria-label="HelenTech home">{LOGO}</a>
        <p>Google Business Profile, Google Merchant Center, Google Ads and GA4 services for businesses that want to be found, approved and measured on Google.</p>
        <div class="foot-social">{social}</div>
      </div>
      <div class="foot-col">
        <h5>Services</h5>
        {svc}
      </div>
      <div class="foot-col">
        <h5>Company</h5>
        <a href="about.html">About Us</a>
        <a href="portfolio.html">Portfolio</a>
        <a href="reviews.html">Testimonials</a>
        <a href="blog.html">Blog</a>
        <a href="pricing.html">Pricing</a>
        <a href="faq.html">FAQ</a>
      </div>
      <div class="foot-col">
        <h5>Contact</h5>
        <a href="contact.html">Contact HelenTech</a>
        <a href="mailto:{EMAIL}">{EMAIL}</a>
        <a href="https://wa.me/{WHATSAPP}" target="_blank" rel="noopener">WhatsApp: 0901 084 3157</a>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© 2026 HelenTech. All rights reserved.</span>
      <span class="foot-legal"><a href="privacy.html">Privacy &amp; Cookies</a><button type="button" class="foot-linkbtn" data-ht-consent-open>Cookie settings</button><span>Google Services Specialist</span></span>
    </div>
  </div>
</footer>
<a class="wa-float" href="https://wa.me/{WHATSAPP}?text=Hi%20HelenTech%2C%20I%27d%20like%20to%20talk%20about%20a%20project." target="_blank" rel="noopener" aria-label="Chat with HelenTech on WhatsApp">{WA_ICON}</a>
<script src="assets/js/analytics.js" defer></script>
{ENQUIRY}<!-- SITE-FOOTER:END -->'''


def restamp(root):
    n = 0
    for path in sorted(glob.glob(os.path.join(root, "*.html"))):
        html = open(path, encoding="utf-8").read()
        m = re.search(r'<body[^>]*data-nav="([^"]*)"', html)
        active = m.group(1) if m else ""
        new = re.sub(r"<!-- SITE-HEADER:START.*?<!-- SITE-HEADER:END -->", lambda _m: header(active), html, flags=re.S)
        new = re.sub(r"<!-- SITE-FOOTER:START.*?<!-- SITE-FOOTER:END -->", lambda _m: footer(), new, flags=re.S)
        if new != html:
            open(path, "w", encoding="utf-8").write(new)
            n += 1
    print(f"Updated header and footer in {n} page(s).")


if __name__ == "__main__":
    restamp(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
