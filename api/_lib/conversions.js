// Records a COMPLETED enquiry. Called by /api/contact only after the enquiry email was accepted (or safely backed up).
// Stores no names, emails, phone numbers or message text.
import { configured, insert } from './supabase.js';

const ID = /^[A-Za-z0-9-]{8,64}$/;
const SOURCES = ['popup', 'contact_page', 'faq_page'];
export async function recordConversion({ sid, vid, path, service, enquiryType, formSource }) {
  if (!configured()) return false;
  try {
    const p = typeof path === 'string' && path.startsWith('/') ? path.split('?')[0].replace(/\/index\.html$/, '/').slice(0, 200) : null;
    await insert('analytics_conversions', [{
      session_id: ID.test(sid || '') ? sid : null, visitor_id: ID.test(vid || '') ? vid : null, name: 'enquiry_submitted', path: p,
      service: typeof service === 'string' ? service.slice(0, 120) || null : null, enquiry_type: typeof enquiryType === 'string' ? enquiryType.slice(0, 60) : null,
      form_source: SOURCES.includes(formSource) ? formSource : null,
    }]);
    return true;
  } catch (e) { console.error('conversion write failed:', e && e.message); return false; }
}
