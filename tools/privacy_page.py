#!/usr/bin/env python3
"""Builds privacy.html (privacy & cookie notice). Edit the text here and run: python3 tools/privacy_page.py"""
import os, sys, subprocess, json, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import blog as B

UPDATED = "16 October 2026"
EMAIL = "helentech776@gmail.com"
BODY = f'''
<p><strong>Last updated: {UPDATED}.</strong> This is a plain-language notice about what the HelenTech website does with information. It is not legal advice.</p>

<h2 id="who">Who we are</h2>
<p>HelenTech is a Google services specialist (Google Business Profile, Google Merchant Center, Google Ads and Google Analytics 4). You can contact us about this notice at <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>

<h2 id="enquiries">Enquiries you send us</h2>
<p>When you use an enquiry form, we receive the details you type (name, email, optional phone or WhatsApp number, optional business name, service, enquiry type, optional budget and your message). We use them only to respond to your enquiry. The form sends them to our email inbox through our email provider, and we do not add you to a marketing list. If a confirmation email is switched on, we send you one copy of what you wrote.</p>

<h2 id="analytics">Analytics (only if you accept)</h2>
<p>When you first visit, a banner asks whether we may use privacy-friendly analytics. <strong>If you decline, nothing is stored and nothing is sent.</strong> If you accept, we collect:</p>
<ul>
<li>the pages you view (web address without the part after "?") and the page title, with the date and time;</li>
<li>how long a page is open and active on your screen (an estimate);</li>
<li>where you came from (for example Google, social media, a link on another site, or direct);</li>
<li>your device type (desktop, mobile or tablet), browser and operating system names;</li>
<li>your approximate country and city, worked out by our hosting provider from your connection. We do not store your IP address;</li>
<li>clicks on key buttons and links (contact buttons, WhatsApp, email, phone, downloads, portfolio items), recorded as a label such as "Contact HelenTech";</li>
<li>whether you completed an enquiry (we record that an enquiry was sent, which page it came from and the service chosen, but not your name, email or message).</li>
</ul>
<p><strong>What we never collect through analytics:</strong> your name, email address, phone number, anything you type into a form, passwords or payment details. We do not try to find out who you are.</p>
<p>To tell visits apart, the analytics stores two random identifiers in your browser's local storage: an anonymous visitor ID and a session ID (a new session starts after 30 minutes of inactivity). They contain no personal information. If you decline or withdraw consent, we delete them from your browser.</p>
<p>We use the data to understand which pages and services interest visitors and which pages lead to enquiries, so we can improve the website. We do not sell it.</p>

<h2 id="ga4">Google Analytics 4</h2>
<p>If we have switched on Google Analytics 4, it loads only after you accept analytics, and Google's own privacy policy applies to the data it processes. If it is switched off, no Google Analytics code runs.</p>

<h2 id="choices">Your choices</h2>
<ul>
<li>Accept or decline in the banner. You can change your mind at any time with <button type="button" class="foot-linkbtn" data-ht-consent-open style="display:inline;min-height:0;padding:.75rem .1rem;color:var(--blue-700);font-weight:600">Cookie settings</button> (also in the footer of every page).</li>
<li>If your browser sends a Global Privacy Control or Do Not Track signal, we treat it as a refusal and analytics stays off.</li>
<li>You can also clear your browser's site data at any time, which removes the anonymous IDs.</li>
</ul>

<h2 id="providers">Services that help us run the site</h2>
<p>We use a hosting provider (Vercel), a database provider (Supabase) that stores the analytics described above, and an email provider (Resend) that delivers enquiries to our inbox. They process data on our behalf to provide those services.</p>

<h2 id="retention">How long we keep it</h2>
<p>Analytics data is kept for up to 24 months and is then deleted. Enquiry emails are kept in our inbox for as long as we need to deal with your enquiry and any follow-up.</p>

<h2 id="rights">Your rights and questions</h2>
<p>You can ask us what we hold about you, ask us to correct or delete it, or ask a question about this notice by emailing <a href="mailto:{EMAIL}">{EMAIL}</a>. Because analytics uses anonymous IDs that we cannot link to a person, we may not be able to find analytics data for a specific individual, but we will explain what we can and cannot do.</p>
'''
D = "How the HelenTech website handles information: enquiry forms, optional privacy-friendly analytics, cookies and your choices."
ld = '<script type="application/ld+json" id="bc-ld">\n' + json.dumps({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":B.BASE},{"@type":"ListItem","position":2,"name":"Privacy & Cookies","item":B.BASE+"privacy.html"}]}, indent=1) + '\n</script>\n'
html = B.head("Privacy & Cookies | HelenTech", D, "privacy.html", ld, active="privacy").replace('<meta property="og:type" content="article">','<meta property="og:type" content="website">') + f'''<main id="main">
<section class="faq-hero">
  <div class="wrap">
    <h1>Privacy &amp; Cookies</h1>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><span aria-current="page">Privacy &amp; Cookies</span></nav>
  </div>
</section>
<section class="section post-section">
  <div class="wrap"><article class="post-body">{BODY}</article></div>
</section>
</main>
''' + B.TAIL
open(os.path.join(ROOT, "privacy.html"), "w", encoding="utf-8").write(html)
sm = open(os.path.join(ROOT, "sitemap.xml")).read()
if "privacy.html" not in sm:
    sm = sm.replace("</urlset>", '  <url><loc>%sprivacy.html</loc><lastmod>2026-10-16</lastmod><priority>0.3</priority></url>\n</urlset>' % B.BASE)
    open(os.path.join(ROOT, "sitemap.xml"), "w").write(sm)
subprocess.run([sys.executable, os.path.join(HERE, "layout.py")], check=True)
print("privacy.html built")
