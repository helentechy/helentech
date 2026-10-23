/* ==========================================================================
   HelenTech content data. This is the one place to add portfolio projects
   and testimonials. Pages render these automatically.
   ========================================================================== */

/* ---------- PORTFOLIO ----------
   To add a project, copy the template at the bottom of this list, fill it in,
   and add it to the PROJECTS array. Only add results that are genuine.

   filters: 'gmb', 'gmc' or 'ads' (Google services only)
   featured: true shows the project in the Featured Work grid on the homepage
   image: path to an image in assets/img/projects/ (use .webp or .jpg, about 1200px wide)
   url: live site or proof link (optional). caseStudyUrl: full case study page (optional).
   result: a genuine, verifiable result (optional). Leave '' if you do not have one. */
window.HELENTECH_PROJECTS = [
  {
    id: 'victoria-acupuncture',
    title: 'Victoria Acupuncture PC',
    business: 'Acupuncture clinic',
    category: 'GBP Reinstatement',
    service: 'Google Business Profile reinstatement',
    platform: 'Google Business Profile',
    description: 'Suspended listing restored, now verified with a 5.0★ rating.',
    result: 'Verified listing with a 5.0★ rating',
    image: 'assets/img/projects/victoria-acupuncture.webp',
    alt: 'Victoria Acupuncture PC Google Business Profile, restored and verified with 5.0 rating',
    filters: ['google'], featured: false, url: '', caseStudyUrl: ''
  },
  {
    id: 'beacon-stone-care',
    title: 'Beacon Stone Care',
    business: 'Stone care',
    category: 'GBP Suspension Recovery',
    service: 'Google Business Profile suspension recovery',
    platform: 'Google Business Profile',
    description: 'Recovered visibility after a full profile suspension.',
    result: '',
    image: 'assets/img/projects/beacon-stone-care.webp',
    alt: 'Beacon Stone Care Google Business Profile after suspension recovery',
    filters: ['google'], featured: false, url: '', caseStudyUrl: ''
  },
  {
    id: 'air-duct-cleaning-tx',
    title: 'Air Duct Cleaning Services TX',
    business: 'Air duct cleaning, Texas',
    category: 'GBP Appeal and Reinstatement',
    service: 'Google Business Profile appeal',
    platform: 'Google Business Profile',
    description: 'Restriction appeal approved, listing back in search.',
    result: 'Appeal approved by Google',
    image: 'assets/img/projects/air-duct-cleaning-tx.webp',
    alt: 'Google Business Profile appeal approved email for Air Duct Cleaning Services Texas',
    filters: ['google'], featured: false, url: '', caseStudyUrl: ''
  },
  {
    id: 'best-vancouver-cleaning',
    title: 'Best Vancouver Cleaning',
    business: 'Cleaning services, Vancouver',
    category: 'Local SEO and Profile Management',
    service: 'Local SEO and Google Business Profile management',
    platform: 'Google Business Profile',
    description: 'Ongoing profile management for local search visibility.',
    result: '',
    image: 'assets/img/projects/best-vancouver-cleaning.webp',
    alt: 'Best Vancouver Cleaning Services verified Google Business Profile',
    filters: ['google'], featured: false, url: '', caseStudyUrl: ''
  },
  {
    id: 'merchant-center-setup',
    title: 'Merchant Center Setup',
    business: 'Online store',
    category: 'Google Merchant Center',
    service: 'Google Merchant Center setup',
    platform: 'Google Merchant Center',
    description: 'Product feed configured with products approved for Shopping.',
    result: '',
    image: 'assets/img/projects/merchant-center-setup.webp',
    alt: 'Google Merchant Center performance dashboard showing approved products and clicks',
    filters: ['google'], featured: false, url: '', caseStudyUrl: ''
  },
  {
    id: 'google-ads-campaign',
    title: 'Campaign Management',
    business: 'Paid search',
    category: 'Google Ads',
    service: 'Google Ads management',
    platform: 'Google Ads',
    description: 'Active Google Ads campaign tracked through to conversions.',
    result: '',
    image: 'assets/img/projects/google-ads-campaign.webp',
    alt: 'Google Ads campaign overview showing clicks, impressions and cost',
    filters: ['google'], featured: false, url: '', caseStudyUrl: ''
  },
  {
    id: 'champagne-tower-hire',
    title: 'Champagne Tower Hire',
    business: 'Champagne tower hire',
    category: 'GBP Setup and Verification',
    service: 'Google Business Profile setup and verification',
    platform: 'Google Business Profile',
    description: 'Business Profile set up and taken through verification.',
    result: '',
    image: 'assets/img/projects/champagne-tower-hire.webp',
    alt: 'Champagne Tower Hire Google Business Profile setup and verification',
    filters: ['google'], featured: false, url: '', caseStudyUrl: ''
  },

  /* TEMPLATE. Copy this block, remove the comment markers, and fill it in.
  ,{
    id: 'unique-short-id',
    title: 'Project name',
    business: 'Type of business',
    category: 'Short label shown above the title',
    service: 'Service provided',
    platform: 'Platform or technology',
    description: 'One or two sentences about what you did.',
    result: '',
    image: 'assets/img/projects/your-image.webp',
    alt: 'Describe what the image shows',
    filters: ['gmb'],
    featured: false, url: 'https://client-site.com', caseStudyUrl: ''
  }
  */
];


(function () {
  var out = [];

  /* ---------- GOOGLE SERVICES: screenshots (Merchant Center and Business Profile) ----------
     group 'google', sub: 'gmb' (Business Profile), 'gmc' (Merchant Center) or 'ads' (Google Ads).
     Descriptions only state what the screenshot shows. Add results only when genuine. */
  function gmc(id, title, description, image, alt, featured) {
    return { id: id, title: title, business: '', category: 'Google Merchant Center', service: 'Google Merchant Center', platform: 'Google Merchant Center',
      description: description, result: '', image: image, alt: alt, group: 'google', sub: 'gmc', filters: ['gmc'], featured: !!featured, url: '', caseStudyUrl: '' };
  }
  var GOOGLE = [
    gmc('gmc-product-status', 'Products moved from Not approved to Approved', 'Product status history in Merchant Center: products shown as not approved, then approved.', 'assets/img/projects/gmc-product-status.webp', 'Merchant Center product status chart moving from not approved to approved', true),
    gmc('gmc-overview-7', 'Merchant Center: 7 of 7 products approved', 'Overview showing 7 products approved and 0 not approved.', 'assets/img/projects/gmc-overview-7-approved.webp', 'Merchant Center overview with 7 approved products'),
    gmc('gmc-misrep-flagged', 'Misrepresentation issue flagged', 'The Misrepresentation issue as shown in Merchant Center, limiting visibility of all products in the United Kingdom.', 'assets/img/projects/gmc-misrepresentation-flagged.webp', 'Merchant Center Misrepresentation issue page'),
    gmc('gmc-misrep-complete-1', 'Misrepresentation review completed (1)', 'Google confirmed the requested review was completed and the issue no longer appears in the account.', 'assets/img/projects/gmc-misrep-complete-1.webp', 'Gmail message: Review of Misrepresentation is complete'),
    gmc('gmc-misrep-complete-2', 'Misrepresentation review completed (2)', 'Google confirmed the requested review was completed and the issue no longer appears in the account.', 'assets/img/projects/gmc-misrep-complete-2.webp', 'Gmail message from Google Merchant Center: Misrepresentation review completed'),
    gmc('gmc-misrep-complete-3', 'Misrepresentation review completed (3)', 'Google confirmed the requested review was completed and the issue no longer appears in the account.', 'assets/img/projects/gmc-misrep-complete-3.webp', 'Email: Review of Misrepresentation is complete'),
    gmc('gmc-misrep-complete-4', 'Misrepresentation review completed (4)', 'Google confirmed the requested review was completed and the issue no longer appears in the account.', 'assets/img/projects/gmc-misrep-complete-4.webp', 'Email: Misrepresentation review completed'),
    gmc('gmc-false-info', 'False Information review completed', 'Google confirmed the False Information review was completed and the issue no longer appears in the account.', 'assets/img/projects/gmc-false-info-complete.webp', 'Google Merchant Center email: False Information review completed'),
    gmc('gmc-suspended', 'Account suspended for policy violation', 'Merchant Center showing an account suspended for policy violation, affecting 344 products (100%).', 'assets/img/projects/gmc-account-suspended.webp', 'Merchant Center page showing a suspended account for policy violation'),
    gmc('gmc-192', 'Merchant Center: 184 of 192 products approved', 'Overview showing 192 products: 184 approved, 5 not approved and 3 under review.', 'assets/img/projects/gmc-192-products.webp', 'Merchant Center overview with 192 products'),
    gmc('gmc-194', 'Merchant Center: 165 of 194 products approved', 'Overview showing 194 products: 165 approved, 29 limited and 0 not approved.', 'assets/img/projects/gmc-194-products.webp', 'Merchant Center overview with 194 products'),
    gmc('gmc-2k', 'Merchant Center: 2.04K products approved', 'Overview showing 2.05K products: 2.04K approved and 9 not approved.', 'assets/img/projects/gmc-2k-approved.webp', 'Merchant Center overview with 2.04K approved products'),
    { id: 'gbp-managed-profile', title: 'Business Profile managed on Google', business: '', category: 'Google Business Profile', service: 'Google Business Profile', platform: 'Google Business Profile',
      description: 'A verified Business Profile shown as managed on Google, with profile tools available.', result: '', image: 'assets/img/projects/gbp-managed-profile.webp',
      alt: 'Google search showing a verified Business Profile managed by the owner', group: 'google', sub: 'gmb', filters: ['gmb'], featured: false, url: '', caseStudyUrl: '' }
  ];

  /* Earlier projects: sort them into the groups by platform */
  var earlier = (window.HELENTECH_PROJECTS || []).map(function (p) {
    if (p.group) return p;
    var pf = (p.platform || '');
    if (/Merchant/i.test(pf)) { p.group = 'google'; p.sub = 'gmc'; }
    else if (/Business Profile/i.test(pf)) { p.group = 'google'; p.sub = 'gmb'; }
    else if (/Ads/i.test(pf)) { p.group = 'google'; p.sub = 'ads'; }
    else { p.group = 'website'; p.sub = 'other'; }
    p.filters = [p.sub];
    return p;
  });
  var vic = earlier.filter(function (p) { return p.id === 'victoria-acupuncture'; });
  if (vic[0]) vic[0].featured = true;
  window.HELENTECH_PROJECTS = GOOGLE.concat(earlier.filter(function (p) { return p.group === 'google'; }));
})();

/* ---------- TESTIMONIALS ----------
   HOW TO ADD OR REPLACE A TESTIMONIAL: edit only this list. The layout never changes.
   Fields:
     name     client name                         (optional, hidden when left out)
     company  business name                       (optional, hidden when left out)
     role     client role, e.g. Owner             (optional)
     service  service received                    (optional)
     quote    their words                         (required)
     rating   1 to 5. Leave out unless genuine    (optional)
     photo    path to client photo. Leave out unless you have one (optional)
     draft    true = shows a "Draft example" label. DELETE this line once the
              testimonial is confirmed as real client feedback.
   Example of a real entry:
   { name: 'Jane Doe', company: 'Acme Co.', service: 'Google Business Profile',
     quote: 'Their exact words go here.', rating: 5, photo: 'assets/img/clients/jane.webp' }
   The first 3 entries appear on the homepage. All entries appear on the Testimonials page. */
window.HELENTECH_TESTIMONIALS = [
  { service: 'Google Business Profile',
    quote: 'HelenTech made the process much easier than I expected. They understood the issue with my Google Business Profile, explained what needed to be done, and handled the work professionally. I appreciated the communication throughout the project and the attention to detail.' },
  { service: 'Local SEO',
    quote: 'HelenTech helped improve the way my business appears online and gave me a much clearer understanding of what needed to be optimized. The work was handled professionally, and I was kept informed throughout the process.' },
  { service: 'Google Merchant Center',
    quote: 'HelenTech helped me address issues affecting my online store and Google presence. They explained the process clearly and worked through the problem systematically. I appreciated their professionalism and communication throughout the project.' }
];
