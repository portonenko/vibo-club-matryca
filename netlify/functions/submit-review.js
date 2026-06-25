// Przyjmuje opinię z formularza (#ocena) i zapisuje w Netlify Blobs.
// Bez bazy danych — magazyn jest wbudowany w Netlify.
const { getStore } = require('@netlify/blobs');
// При ручном деплое контекст Blobs не подставляется автоматически — задаём явно.
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

  const name = String(b.name || '').trim().slice(0, 40);
  const text = String(b.text || '').trim().slice(0, 1500);
  const rating = parseInt(b.rating, 10);
  const lang = ['pl', 'en', 'de'].includes(b.lang) ? b.lang : 'pl';

  if (!name || text.length < 5 || !(rating >= 1 && rating <= 5)) {
    return { statusCode: 422, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'invalid' }) };
  }

  const store = reviewsStore();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await store.setJSON(id, { id, name, text, rating, lang, published: true, created: Date.now() });

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
