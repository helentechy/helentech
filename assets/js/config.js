/* HelenTech site settings. Edit the values below. No secrets belong in this file. */
window.HELENTECH_CONFIG = {
  // Google Analytics 4 Measurement ID (looks like G-ABC123XYZ9).
  // Find it in GA4: Admin > Data streams > your web stream.
  // While this is left as the placeholder, analytics is NOT loaded and no tracking runs.
  gaMeasurementId: 'G-XXXXXXXXXX',

  // Contact details used by WhatsApp and email links created by scripts.
  whatsappNumber: '2349010843157',
  contactEmail: 'helentech776@gmail.com',

  // HelenTech's own analytics (the private dashboard at /admin/). Only runs for visitors who accept analytics.
  customAnalyticsEnabled: true,
  analyticsEndpoint: '/api/collect',

  // Enquiry pop-up: opens by itself once per browsing session after this many milliseconds.
  // Set enquiryPopupEnabled to false to turn the automatic pop-up off (the button and links still work).
  enquiryPopupEnabled: false,   // the pop-up is switched off site-wide (see ENQUIRY_POPUP_ENABLED in tools/layout.py)
  enquiryPopupDelayMs: 10000,

  // Testimonials: while you have no real testimonials in content.js, the site shows
  // clearly labelled placeholder cards. Set to false to hide the testimonial section
  // on the homepage and show a short "coming soon" note on the Testimonials page.
  showTestimonialPlaceholders: true
};
