// Usuwa opinię (strona moderacji #moderacja). Chronione hasłem.
const { getStore } = require('@netlify/blobs');
function reviewsStore() {
  if (process.env.BLOBS_TOKEN && process.env.BLOBS_SITE_ID) {
    return getStore({ name: 'reviews', siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
  }
  return getStore('reviews');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, body: 'bad json' }; }

  const adminPw = process.env.REVIEWS_ADMIN_PW || '';
  if (!adminPw || b.password !== adminPw) return { statusCode: 401, body: 'unauthorized' };
  if (!b.id) return { statusCode: 400, body: 'no id' };

  const store = reviewsStore();
  await store.delete(String(b.id));
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
