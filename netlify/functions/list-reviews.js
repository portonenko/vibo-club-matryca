// Zwraca opublikowane opinie (dla strony „Opinie”).
// ?all=<hasło> zwraca też nieopublikowane — używane przez stronę moderacji.
const { getStore } = require('@netlify/blobs');
function reviewsStore() {
  if (process.env.BLOBS_TOKEN && process.env.BLOBS_SITE_ID) {
    return getStore({ name: 'reviews', siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
  }
  return getStore('reviews');
}

exports.handler = async (event) => {
  const store = reviewsStore();
  const q = event.queryStringParameters || {};
  const adminPw = process.env.REVIEWS_ADMIN_PW || '';
  const isAdmin = adminPw && q.all && q.all === adminPw;

  const { blobs } = await store.list();
  const items = [];
  for (const blob of blobs) {
    const r = await store.get(blob.key, { type: 'json' });
    if (r && (isAdmin || r.published)) items.push(r);
  }
  items.sort((a, b) => (b.created || 0) - (a.created || 0));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(items),
  };
};
