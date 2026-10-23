#!/usr/bin/env python3
"""Blog generator for HelenTech.

Edit POSTS below (or add a new dict), then run:  python3 tools/blog.py
It rebuilds blog.html, every blog-<slug>.html page, the "Latest from the blog"
section on the homepage, the "Helpful reading" blocks on the service pages and sitemap.xml,
then re-stamps the shared header and footer (tools/layout.py).
"""
import os, re, html, json, subprocess, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://helentech.com/"
PUBLISHED = "2026-10-14"

CATS = {
    "gbp": ("Google Business Profile", "google-business-profile.html"),
    "gmc": ("Google Merchant Center", "google-merchant-center.html"),
    "ads": ("Google Ads", "google-ads.html"),
    "ga4": ("Google Analytics 4", "google-analytics-4.html"),
}
ICONS = {
    "gbp": '<path d="M12 21c-4-4-7-7.5-7-11a7 7 0 0114 0c0 3.5-3 7-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    "gmc": '<path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 016 0"/>',
    "ads": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    "ga4": '<path d="M5 20V11M12 20V4M19 20v-6"/>',
}

IMAGES = {  # thumbnails in assets/img/blog/  (file, width, height, alt, object-position)
    "gbp": ("blog-gbp.webp", 736, 736, "Illustration of a Google Business Profile listing on a phone beside a map pin", "50% 42%"),
    "phone": ("blog-phone.webp", 667, 1000, "Illustration of a phone showing a growth chart in front of a dashboard", "50% 55%"),
    "growth": ("blog-growth.webp", 800, 1000, "Illustration of rising charts and arrows on a tablet and phone", "50% 58%"),
}

POSTS = [
 dict(slug="google-business-profile-suspended", img="gbp", cat="gbp", minutes=5,
  title="Google Business Profile Suspended? What to Check Before You Appeal",
  excerpt="A suspended listing disappears from Google Search and Maps. Here is how to find the likely cause and prepare a clean reinstatement request.",
  cta=("Get a Google Business Profile Audit", "Google%20Business%20Profile"),
  takeaways=["Read the exact notification and check whether the suspension is soft or hard.","Fix mismatches between your profile, website and real-world signage before you appeal.","Send one complete request with clear evidence. Do not create a new listing.","Google makes the final decision and no one can guarantee the outcome or timing."],
  body=[
   ("p","A suspended Business Profile can stop customers finding you on Google Search and Maps overnight. It is stressful, but many suspensions come from a small number of fixable problems. The key is to understand the cause before you ask Google to review it."),
   ("h2","Soft suspension or hard suspension?"),
   ("p","With a soft suspension, your listing may still be visible to customers, but you can no longer manage it. With a hard suspension, the listing is removed from Google Search and Maps. The Business Profile notification tells you which situation you are in, so read it carefully and keep a copy."),
   ("h2","Common reasons profiles are suspended"),
   ("ul",["The business does not meet Google's eligibility rules, for example no real storefront or service area.","The address is a PO box, a virtual office or a shared space with no staffed presence.","The business name includes extra keywords, slogans or locations that are not part of your real name or signage.","Categories or services that do not match what the business actually does.","Duplicate listings for the same business.","Details that do not match across your profile, website and public records."]),
   ("h2","What to do before you appeal"),
   ("ol",["Read the notification and the Business Profile guidelines that apply to your situation.","Compare your profile with your website, signage and official documents. Correct anything that does not match.","Gather evidence that shows the business is real: business registration or licence, photos of signage, premises and vehicles, and a recent utility or bank document with the business name and address.","Submit one complete reinstatement request through Google's official process and keep the reference.","Wait for Google's response before making more changes or submitting again."]),
   ("h2","What not to do"),
   ("ul",["Do not create a new profile for the same business, because it can cause further problems.","Do not pay anyone who promises guaranteed reinstatement.","Do not make repeated rapid edits or resubmit the same request many times."]),
   ("h2","A realistic expectation"),
   ("p","Google decides every reinstatement and response times vary, so no one can promise a result or a date. What you can control is the quality of the request: accurate details, clear evidence and a profile that follows the guidelines. If you would like a second pair of eyes before you appeal, we can review the profile and help you prepare the request."),
  ]),
 dict(slug="merchant-center-disapproved-products", img="phone", seo="Merchant Center Disapproved Products: Causes and Fixes", cat="gmc", minutes=5,
  title="Merchant Center Disapproved Products: Common Causes and How to Fix Them",
  excerpt="Disapproved products cannot show in Google Shopping. These are the most common causes and a simple order for fixing them.",
  cta=("Fix Your Merchant Center Issues", "Google%20Merchant%20Center"),
  takeaways=["Start with the issues that affect the most products.","Fix the data at its source in your store, not only in the feed.","Make sure price and availability on your product pages match the feed.","Allow time for Google to re-review after you fix and re-sync."],
  body=[
   ("p","When products are disapproved in Google Merchant Center, they cannot appear in Google Shopping results or Shopping ads. The good news is that most disapprovals come from a short list of causes, and Merchant Center tells you which ones apply."),
   ("h2","Where to find the problem"),
   ("p","In Merchant Center, open the products or diagnostics area and look at the issues list. Sort by the number of affected products so you fix the biggest problem first. Open an issue to see example products and Google's explanation."),
   ("h2","Common causes of disapproval"),
   ("ul",["Missing or invalid required attributes such as title, price, availability, link or image link.","Price or availability on the product page that does not match the feed.","Images that are low quality, contain watermarks or promotional text, or are placeholders.","Missing or incorrect product identifiers such as GTIN, brand or MPN.","Landing pages that do not load, show a different product, or fail at checkout.","Product or page content that breaks Google's shopping policies."]),
   ("h2","How to fix them in a sensible order"),
   ("ol",["Fix account-level issues first, such as website, contact and policy information.","Fix the issue affecting the most products.","Correct the data at the source, in your store's product fields, so the next sync does not overwrite it.","Refresh the feed or wait for the scheduled fetch, then check the issue status.","Repeat for the remaining issues and keep automatic updates on so the feed stays current."]),
   ("h2","Shopify and WooCommerce stores"),
   ("p","If you use Shopify or WooCommerce, the feed is built from your store's product data. That means a fix made only inside Merchant Center can be undone the next time products sync. Update the product titles, images, prices, availability and identifiers in the store, then let the connection pass the corrected data to Google."),
   ("h2","Be patient after fixing"),
   ("p","After you correct an issue, products are checked again and statuses can take some time to change. If products stay disapproved after a reasonable wait, review the issue details again or ask for help. We can go through the diagnostics with you and fix the feed and store data."),
  ]),
 dict(slug="google-ads-conversion-tracking", img="growth", cat="ads", minutes=5,
  title="Google Ads Conversion Tracking: Set It Up Before You Spend",
  excerpt="Without conversion tracking you cannot tell which clicks bring leads or sales. Here is what to track and how to avoid the common mistakes.",
  cta=("Optimize My Google Ads", "Google%20Ads"),
  takeaways=["Track the actions that matter: calls, forms, messages and purchases.","Count each action once. Double counting makes results look better than they are.","Test every conversion action before you rely on the numbers.","Tracking is the first step. It does not guarantee results by itself."],
  body=[
   ("p","Many Google Ads accounts spend money without a clear way to see what that spend produced. Conversion tracking fixes that. It records valuable actions after someone clicks your ad, so you can see which campaigns, keywords and ads lead to enquiries or sales."),
   ("h2","Why it matters"),
   ("p","Reports that only show clicks do not tell you if the clicks were useful. Conversion data also helps Google's automated bidding learn what a good result looks like for your business, so poor tracking can lead to poor optimization."),
   ("h2","What to track"),
   ("ul",["Contact form submissions.","Phone calls and call button clicks.","WhatsApp or chat clicks.","Purchases, with the order value.","Bookings or quote requests."]),
   ("h2","Common ways to set it up"),
   ("p","You can create conversion actions with the Google tag or Google Tag Manager, or import key events from Google Analytics 4. Choose one method for each action so it is not counted twice. If you sell online, pass the purchase value as well so reports show revenue, not only order counts."),
   ("h2","Common mistakes"),
   ("ul",["Counting every page view as a conversion.","Counting the same action twice, for example from both Google Ads and an imported GA4 event.","Using a thank-you page that people can reach without completing the action.","Not recording a value for purchases.","Never testing, so a broken tag goes unnoticed."]),
   ("h2","Test before you rely on it"),
   ("ol",["Complete a real test action, such as submitting your own form.","Use Google's tag testing tools to confirm the tag fired.","Check that the conversion action shows as recording in Google Ads.","Repeat after any website change that touches forms or checkout."]),
   ("h2","Next step"),
   ("p","Once tracking is reliable, you can review search terms, adjust bids and budgets, and pause what is not working. If you would like your tracking set up and checked before more budget goes in, we can help."),
  ]),
 dict(slug="local-seo-checklist-google-maps", img="gbp", cat="gbp", minutes=6,
  title="A Practical Local SEO Checklist for Showing Up on Google Maps",
  excerpt="A step-by-step checklist for improving your local visibility, from your Business Profile to citations, reviews and local links.",
  cta=("Get a Google Business Profile Audit", "Google%20Business%20Profile"),
  takeaways=["Start with a complete, accurate and verified Business Profile.","Keep your name, address and phone number consistent everywhere.","Ask real customers for reviews and respond to them.","Local rankings depend on many factors, so no one can guarantee a position."],
  body=[
   ("p","When someone searches for a service near them, Google often shows a map with local businesses. Appearing there starts with a well-managed Google Business Profile and a few consistent habits. Use this checklist as a starting point."),
   ("h2","1. Claim and verify your profile"),
   ("p","Make sure the profile belongs to you and is verified. An unverified or unclaimed profile limits what you can control."),
   ("h2","2. Complete every relevant section"),
   ("ul",["Business name exactly as it appears on your signage and website.","Accurate address or service area, phone number, website and opening hours, including holiday hours.","A primary category that describes what you mainly do, plus relevant additional categories.","A clear description, and your services or products.","Real photos of your premises, team and work."]),
   ("h2","3. Keep your details consistent"),
   ("p","Your business name, address and phone number should match across your website, your profile and the directories where you are listed. Inconsistent details can confuse both customers and search engines."),
   ("h2","4. Build local citations"),
   ("p","Citations are mentions of your business details in relevant online directories. Focus on reputable, relevant listings and keep each one accurate rather than chasing a very large number."),
   ("h2","5. Earn genuine reviews"),
   ("ul",["Ask satisfied customers to leave an honest review, for example after a completed job.","Respond politely to every review, positive or negative.","Never buy reviews or offer rewards for positive ones, because it breaks Google's policies."]),
   ("h2","6. Build relevant local links"),
   ("p","Links from local organisations, suppliers, partners and community websites can support your local visibility. Aim for links that exist for a real reason and avoid paid link schemes."),
   ("h2","7. Check your website"),
   ("p","Make sure your website clearly states what you do and where, loads quickly on a phone, and links to your profile and contact details."),
   ("h2","Keep it realistic"),
   ("p","Local rankings depend on factors such as competition, proximity and relevance, so no one can honestly promise a number one position. Steady, accurate and consistent work is what moves the needle. If you would like us to audit your profile and tell you what to fix first, we can do that."),
  ]),
 dict(slug="merchant-center-misrepresentation-policy", img="phone", seo="Merchant Center Misrepresentation Policy: How to Prepare", cat="gmc", minutes=6,
  title="Merchant Center Misrepresentation Policy: What It Means and How to Prepare",
  excerpt="A Misrepresentation flag limits your products in Google. Here is what the policy looks at and a checklist to work through before you request a review.",
  cta=("Fix Your Merchant Center Issues", "Google%20Merchant%20Center"),
  takeaways=["The policy is about clear, honest and trustworthy information on your website.","Check contact details, returns, shipping, payment terms and checkout.","Make your website and Merchant Center business details consistent.","Fix everything first, then request one review. Google decides the outcome."],
  body=[
   ("p","The Misrepresentation policy exists so shoppers can trust the stores they buy from. If Google flags a Merchant Center account for it, your products can lose visibility until the issue is resolved. The policy is about whether your website clearly and honestly shows who you are and how you do business."),
   ("h2","What Google looks for"),
   ("p","Google reviews things such as whether a customer can contact you, whether your policies are clear, whether your pricing and payment terms are transparent, and whether your site looks like a genuine, working business. The exact reasons can vary, so always read the message shown in your Merchant Center account."),
   ("h2","A website checklist"),
   ("ul",["Real contact details that work: email, phone number and, where it applies, a business address.","A clear return and refund policy.","Clear shipping information, including costs and delivery times.","Terms that explain billing, payment and any recurring charges.","Prices and currency that are consistent between product pages, checkout and your feed.","A secure website and a checkout that works from start to finish.","An About page or other information that shows who runs the business.","Honest product descriptions and claims."]),
   ("h2","Check your Merchant Center details"),
   ("p","Make sure your business name, website address and contact information in Merchant Center match what is on your website. Differences between the two can make a store look unreliable."),
   ("h2","Before you request a review"),
   ("ol",["Read the exact issue shown in your account.","Update the website and Merchant Center details to fix every gap you find.","Test the full customer journey: browse, add to basket, check out and contact you.","Request one review once everything is in place, rather than several rushed requests."]),
   ("h2","What to expect"),
   ("p","Google makes the decision and review times vary, so we cannot promise an outcome or a date. A careful, complete fix gives the review the best chance. If you would like help working through the checklist and preparing the review request, we can do that with you."),
  ]),
 dict(slug="ga4-events-and-key-events-explained", img="growth", cat="ga4", minutes=5,
  title="GA4 Events and Key Events Explained in Plain English",
  excerpt="In Google Analytics 4 everything is an event. Learn the difference between events and key events and how to plan your tracking.",
  cta=("Set Up My GA4 Tracking", "Google%20Analytics%204"),
  takeaways=["GA4 records activity as events.","Key events are the events that matter most to your business.","Plan your actions first, then set up the events to measure them.","Test with GA4's debugging tools before trusting the reports."],
  body=[
   ("p","Google Analytics 4 works differently from the older Universal Analytics. Instead of sessions and page views as the main building blocks, GA4 records everything as an event. Understanding events is the key to getting useful reports."),
   ("h2","What is an event?"),
   ("p","An event is any recorded interaction, such as a page view, a click, a form submission or a purchase. Some events are collected automatically. Others are recommended by Google, and you can also create custom events for actions specific to your business."),
   ("h2","What is a key event?"),
   ("p","A key event is an event you mark as especially important to your business, such as a lead form submission or a purchase. In earlier versions of GA4 these were called conversions. Google now calls them key events in Analytics, although Google Ads still uses the word conversions for its own conversion actions."),
   ("h2","Plan your tracking before you build it"),
   ("ol",["List the actions that show a visitor is valuable: enquiries, calls, bookings, purchases.","Decide the event for each action and give it a clear, consistent name.","Mark the important ones as key events.","Decide which reports and channels you want to compare."]),
   ("h2","Where Google Tag Manager helps"),
   ("p","Google Tag Manager lets you add and change tracking without editing your website code each time. It is commonly used to send events when someone clicks a button, submits a form or reaches a confirmation page."),
   ("h2","Test before you trust it"),
   ("ul",["Use GA4 DebugView to watch events arrive in real time.","Complete the actions yourself and confirm each one is recorded once.","Check that your own visits are not distorting the data.","Link GA4 with Google Ads if you want to use your key events there."]),
   ("h2","Getting help"),
   ("p","A clean GA4 setup means you can trust your numbers when you decide where to spend time and money. If your current setup is missing, broken or confusing, we can install and configure GA4 and Tag Manager and build reports you can actually use."),
  ]),
]
CROSS = {'google-business-profile-suspended': 'Once your profile is back, use our <a href="blog-local-seo-checklist-google-maps.html">local SEO checklist for Google Maps</a> to keep it healthy and visible.', 'local-seo-checklist-google-maps': 'If your profile has been suspended, start with <a href="blog-google-business-profile-suspended.html">what to check before you appeal</a>.', 'merchant-center-disapproved-products': 'If the whole account has been flagged, read our guide to the <a href="blog-merchant-center-misrepresentation-policy.html">Merchant Center Misrepresentation policy</a>.', 'merchant-center-misrepresentation-policy': 'If individual products are the problem, see <a href="blog-merchant-center-disapproved-products.html">common causes of disapproved products</a> and how to fix them.', 'google-ads-conversion-tracking': 'If you plan to import GA4 key events into Google Ads, read <a href="blog-ga4-events-and-key-events-explained.html">GA4 events and key events explained</a> first.', 'ga4-events-and-key-events-explained': 'Planning to use these events in your ads? See <a href="blog-google-ads-conversion-tracking.html">Google Ads conversion tracking: set it up before you spend</a>.'}
READING = {"google-business-profile.html": ["google-business-profile-suspended", "local-seo-checklist-google-maps"],
           "google-merchant-center.html": ["merchant-center-disapproved-products", "merchant-center-misrepresentation-policy"],
           "google-ads.html": ["google-ads-conversion-tracking", "ga4-events-and-key-events-explained"],
           "google-analytics-4.html": ["ga4-events-and-key-events-explained", "google-ads-conversion-tracking"],
           "google-services.html": ["google-business-profile-suspended", "merchant-center-disapproved-products", "merchant-center-misrepresentation-policy", "google-ads-conversion-tracking", "ga4-events-and-key-events-explained", "local-seo-checklist-google-maps"],
           "faq.html": ["google-business-profile-suspended", "merchant-center-misrepresentation-policy", "google-ads-conversion-tracking", "ga4-events-and-key-events-explained"]}
ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M7 17L17 7M17 7H8M17 7V16"/></svg>'
CHK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
E = html.escape
BYSLUG = {p["slug"]: p for p in POSTS}

def human_date(): return datetime.date.fromisoformat(PUBLISHED).strftime("%-d %B %Y")
def url(p): return f"blog-{p['slug']}.html"
def read(f): return open(os.path.join(ROOT, f), encoding="utf-8").read()
def write(f, s): open(os.path.join(ROOT, f), "w", encoding="utf-8").write(s)

def head(title, desc, page, ld, active="blog", image=None):
    t = E(title, quote=False); d = E(desc)
    og_image = f'<meta property="og:image" content="{BASE}assets/img/blog/{image}">\n' if image else ''
    return f'''<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t}</title>
<meta name="description" content="{d}">
<link rel="canonical" href="{BASE}{page}">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{d}">
<meta property="og:type" content="{'article' if page != 'blog.html' else 'website'}">
<meta property="og:url" content="{BASE}{page}">
<meta property="og:site_name" content="HelenTech">
{og_image}<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#2680BF">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpolygon points='50,4 91,27 91,73 50,96 9,73 9,27' fill='%23F78616'/%3E%3Cpolygon points='50,28 71,40 71,60 50,72 29,60 29,40' fill='%23fff'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/site.css">
{ld}</head>
<body data-nav="{active}">
<!-- SITE-HEADER:START -->
<!-- SITE-HEADER:END -->
'''
TAIL = '''<!-- SITE-FOOTER:START -->
<!-- SITE-FOOTER:END -->
<script src="assets/js/config.js"></script>
<script src="assets/js/site.js" defer></script>
</body>
</html>
'''
def ldjson(o): return '<script type="application/ld+json">\n' + json.dumps(o, indent=1, ensure_ascii=False) + '\n</script>\n'

def thumb(p, eager=False):
    f, w, h, alt, pos = IMAGES[p["img"]]
    return f'<img src="assets/img/blog/{f}" width="{w}" height="{h}" alt="" style="object-position:{pos}"{"" if eager else " loading=\"lazy\""} decoding="async">'

def card(p, i=0):
    name, _ = CATS[p["cat"]]
    return f'''<article class="blog-card blog-card--{p['cat']}" data-cat="{p['cat']}">
  <a class="blog-card-media blog-card-media--img" href="{url(p)}" tabindex="-1" aria-hidden="true">{thumb(p)}</a>
  <div class="blog-card-body">
    <span class="blog-tag">{name}</span>
    <h3><a href="{url(p)}">{E(p['title'], quote=False)}</a></h3>
    <p>{E(p['excerpt'], quote=False)}</p>
    <div class="blog-meta"><time datetime="{PUBLISHED}">{human_date()}</time><span aria-hidden="true">&bull;</span><span>{p['minutes']} min read</span></div>
    <a class="blog-more" href="{url(p)}">Read article {ARROW}</a>
  </div>
</article>'''


LINKS = [("Google Business Profile", "google-business-profile.html"), ("Google Merchant Center", "google-merchant-center.html"),
         ("Merchant Center", "google-merchant-center.html"), ("Google Ads", "google-ads.html"),
         ("Google Analytics 4", "google-analytics-4.html"), ("GA4", "google-analytics-4.html")]

def autolink(text, used):
    """Link the first mention of each service in a paragraph or list item to its service page."""
    parts = re.split(r"(<a\b.*?</a>|<[^>]+>)", text)
    for i, part in enumerate(parts):
        if part.startswith("<"): continue
        for phrase, target in LINKS:
            if target in used: continue
            m = re.search(r"(?<![\w>])" + re.escape(phrase) + r"(?![\w])", part)
            if m:
                part = part[:m.start()] + f'<a href="{target}">{phrase}</a>' + part[m.end():]; used.add(target)
        parts[i] = part
    return "".join(parts)

def render_body(items, extra=None):
    out = []; used = set()
    for kind, val in items:
        if kind == "p": out.append(f"<p>{autolink(val, used)}</p>")
        elif kind == "h2":
            out.append(f'<h2 id="{re.sub(r"[^a-z0-9]+", "-", re.sub(r"^[0-9]+\. ", "", val).lower()).strip("-")}">{val}</h2>')
        elif kind == "ul": out.append("<ul>" + "".join(f"<li>{autolink(x, used)}</li>" for x in val) + "</ul>")
        elif kind == "ol": out.append("<ol>" + "".join(f"<li>{autolink(x, used)}</li>" for x in val) + "</ol>")
    return "\n".join(out)

def post_page(p):
    name, spage = CATS[p["cat"]]
    related = [q for q in POSTS if q["slug"] != p["slug"] and (q["cat"] == p["cat"])] + [q for q in POSTS if q["slug"] != p["slug"] and q["cat"] != p["cat"]]
    related = related[:3]
    desc = p["excerpt"]
    ld = ldjson({"@context": "https://schema.org", "@type": "BlogPosting", "headline": p["title"], "description": desc,
                 "image": BASE + "assets/img/blog/" + IMAGES[p["img"]][0], "datePublished": PUBLISHED, "dateModified": PUBLISHED, "author": {"@type": "Organization", "name": "HelenTech"},
                 "publisher": {"@type": "Organization", "name": "HelenTech", "url": BASE}, "mainEntityOfPage": BASE + url(p)})
    ld += '<script type="application/ld+json" id="bc-ld">\n' + json.dumps({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE}, {"@type": "ListItem", "position": 2, "name": "Blog", "item": BASE + "blog.html"},
        {"@type": "ListItem", "position": 3, "name": p["title"], "item": BASE + url(p)}]}, indent=1, ensure_ascii=False) + '\n</script>\n'
    take = "".join(f"<li>{CHK}<span>{x}</span></li>" for x in p["takeaways"])
    rel = "".join(card(q) for q in related)
    st = p.get("seo", p["title"]); return head(st if len(st) > 56 else st + " | HelenTech", desc, url(p), ld, image=IMAGES[p["img"]][0]) + f'''<main id="main">
<section class="faq-hero post-hero">
  <div class="wrap">
    <span class="blog-tag blog-tag--light">{name}</span>
    <h1>{E(p['title'], quote=False)}</h1>
    <div class="blog-meta blog-meta--light"><span>By HelenTech</span><span aria-hidden="true">&bull;</span><time datetime="{PUBLISHED}">{human_date()}</time><span aria-hidden="true">&bull;</span><span>{p['minutes']} min read</span></div>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="blog.html">Blog</a><span aria-hidden="true">/</span><span aria-current="page">Article</span></nav>
  </div>
</section>
<section class="section post-section">
  <div class="wrap">
    <div class="post-layout">
      <article class="post-body">
        <figure class="post-figure"><img src="assets/img/blog/{IMAGES[p['img']][0]}" width="{IMAGES[p['img']][1]}" height="{IMAGES[p['img']][2]}" alt="{E(IMAGES[p['img']][3])}" style="object-position:{IMAGES[p['img']][4]}" decoding="async"></figure>
        <aside class="post-take" aria-label="Key takeaways"><h2>Key takeaways</h2><ul>{take}</ul></aside>
        {render_body(p['body'])}
        <p class="post-related"><strong>Related guide:</strong> {CROSS[p['slug']]}</p>
        <div class="post-cta">
          <h2>Need help with {name}?</h2>
          <p>Tell us what is happening and we will reply with clear next steps by email or WhatsApp.</p>
          <div class="btn-row"><a class="btn btn-primary" href="contact.html?service={p['cta'][1]}">{p['cta'][0]} {ARROW.replace('<svg', '<svg class="btn-arrow"')}</a><a class="btn btn-outline-light" href="{spage}">See the {name} service</a></div>
        </div>
      </article>
      <aside class="post-side" aria-label="More from HelenTech">
        <div class="post-side-card">
          <h2>About this service</h2>
          <p>HelenTech provides {name} support as one of four Google services. <a href="about.html">Meet Helen, the founder</a>.</p>
          <a class="blog-more" href="{spage}">View {name} {ARROW}</a>
        </div>
        <div class="post-side-card">
          <h2><a href="google-services.html">All Google services</a></h2>
          <ul class="post-side-links"><li><a href="google-business-profile.html">Google Business Profile</a></li><li><a href="google-merchant-center.html">Google Merchant Center</a></li><li><a href="google-ads.html">Google Ads</a></li><li><a href="google-analytics-4.html">Google Analytics 4</a></li></ul>
        </div>
      </aside>
    </div>
  </div>
</section>
<section class="section related" aria-labelledby="more-h"><div class="wrap"><h2 id="more-h">Keep reading</h2><div class="blog-grid">{rel}</div><p class="mt-6"><a class="btn btn-blue" href="blog.html">All articles {ARROW.replace('<svg', '<svg class="btn-arrow"')}</a></p></div></section>
</main>
''' + TAIL

def blog_page():
    D = "Practical guides on Google Business Profile, Google Merchant Center, Google Ads and Google Analytics 4 from HelenTech."
    ld = ldjson({"@context": "https://schema.org", "@type": "Blog", "name": "HelenTech Blog", "description": D, "url": BASE + "blog.html",
                 "blogPost": [{"@type": "BlogPosting", "headline": p["title"], "url": BASE + url(p), "datePublished": PUBLISHED} for p in POSTS]})
    ld += '<script type="application/ld+json" id="bc-ld">\n' + json.dumps({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE}, {"@type": "ListItem", "position": 2, "name": "Blog", "item": BASE + "blog.html"}]}, indent=1) + '\n</script>\n'
    chips = '<button type="button" class="filter" data-cat="all" aria-pressed="true">All</button>' + "".join(
        f'<button type="button" class="filter" data-cat="{k}" aria-pressed="false">{v[0]}</button>' for k, v in CATS.items())
    feat = POSTS[0]
    return head("Blog: Google Business Profile, Merchant Center & Ads Guides", D, "blog.html", ld) + f'''<main id="main">
<section class="faq-hero">
  <div class="wrap">
    <h1>Blog</h1>
    <p class="blog-hero-sub">Practical guides on Google Business Profile, Merchant Center, Google Ads and GA4.</p>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><span aria-current="page">Blog</span></nav>
  </div>
</section>
<section class="section blog-section">
  <div class="wrap">
    <div class="blog-filters filters" role="group" aria-label="Filter articles by topic" data-blog-filters>{chips}</div>
    <div class="blog-grid" data-blog-grid>
      {"".join(card(p) for p in POSTS)}
    </div>
    <p class="blog-empty" data-blog-empty hidden>No articles in this topic yet.</p>
  </div>
</section>
<section class="cta-band cta-band--v2" aria-labelledby="cta-title">
  <div class="wrap"><div class="cta-panel">
    <h2 id="cta-title">Have a question about your <span class="hl">Google presence?</span></h2>
    <p>Tell us what is happening with your Business Profile, Merchant Center, Google Ads or GA4. We will reply with clear next steps.</p>
    <div class="btn-row"><a href="contact.html" class="btn btn-primary">Contact HelenTech {ARROW.replace('<svg', '<svg class="btn-arrow"')}</a></div>
  </div></div>
</section>
</main>
<script>
(function () {{
  var bar = document.querySelector('[data-blog-filters]'), grid = document.querySelector('[data-blog-grid]'), empty = document.querySelector('[data-blog-empty]');
  if (!bar || !grid) return;
  bar.addEventListener('click', function (e) {{
    var b = e.target.closest('button[data-cat]'); if (!b) return;
    var cat = b.getAttribute('data-cat'), n = 0;
    bar.querySelectorAll('button').forEach(function (x) {{ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }});
    grid.querySelectorAll('.blog-card').forEach(function (c) {{ var show = cat === 'all' || c.getAttribute('data-cat') === cat; c.hidden = !show; if (show) n++; }});
    empty.hidden = n > 0;
  }});
}})();
</script>
''' + TAIL

def home_block():
    latest = POSTS[:3]
    return f'''<!-- BLOG:START -->
<section class="section home-blog" id="blog" aria-labelledby="blog-title">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="eyebrow label">Blog</span>
      <h2 id="blog-title">Latest from <span class="hl">the blog</span></h2>
      <p>Plain-English guides on Business Profile, Merchant Center, Google Ads and GA4.</p>
    </div>
    <div class="blog-grid">{"".join(card(p) for p in latest)}</div>
    <div class="mt-6"><a href="blog.html" class="btn btn-blue">View All Articles {ARROW.replace('<svg', '<svg class="btn-arrow"')}</a></div>
  </div>
</section>
<!-- BLOG:END -->
'''

def reading_block(page):
    items = "".join(f'<li><a href="{url(BYSLUG[s])}"><span>{E(BYSLUG[s]["title"], quote=False)}</span>{ARROW}</a></li>' for s in READING[page])
    return f'''<!-- READING:START -->
<section class="section reading" aria-labelledby="reading-h"><div class="wrap"><h2 id="reading-h">Helpful reading</h2><ul class="reading-list">{items}</ul><p><a class="text-link" href="blog.html">See all articles</a></p></div></section>
<!-- READING:END -->
'''

def main():
    write("blog.html", blog_page())
    for p in POSTS: write(url(p), post_page(p))
    # homepage
    h = read("index.html"); h = re.sub(r"<!-- BLOG:START -->.*?<!-- BLOG:END -->\n?", "", h, flags=re.S)
    m = re.search(r'<section class="section faq-v2" id="faq"', h)
    h = h[:m.start()] + home_block() + "\n" + h[m.start():]
    write("index.html", h)
    # service pages
    for page in READING:
        s = read(page); s = re.sub(r"<!-- READING:START -->.*?<!-- READING:END -->\n?", "", s, flags=re.S)
        m = re.search(r"<!-- RELATED:START -->", s)
        s = s[:m.start()] + reading_block(page) + s[m.start():] if m else s.replace("</main>", reading_block(page) + "</main>", 1)
        write(page, s)
    # sitemap
    sm = read("sitemap.xml")
    sm = re.sub(r"\s*<url><loc>https://helentech.com/(blog[^<]*)</loc>.*?</url>", "", sm)
    add = f'  <url><loc>{BASE}blog.html</loc><lastmod>{PUBLISHED}</lastmod><priority>0.7</priority></url>\n' + "".join(
        f'  <url><loc>{BASE}{url(p)}</loc><lastmod>{PUBLISHED}</lastmod><priority>0.6</priority></url>\n' for p in POSTS)
    sm = sm.replace("</urlset>", add + "</urlset>"); write("sitemap.xml", sm)
    subprocess.run([sys.executable, os.path.join(ROOT, "tools", "layout.py")], check=True)
    print("Blog built:", len(POSTS), "articles")

if __name__ == "__main__":
    main()
