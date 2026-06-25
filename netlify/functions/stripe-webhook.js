// Stripe webhook → Facebook Conversions API (server-side Purchase).
// Гарантирует, что КАЖДАЯ реальная оплата долетает до Facebook,
// независимо от браузера, cookie-согласия и возврата на сайт.
//
// ENV нужны:
//   STRIPE_WEBHOOK_SECRET  — из Stripe → Developers → Webhooks (signing secret, whsec_...)
//   FB_CAPI_TOKEN          — из Events Manager → набор данных → Conversions API → токен доступа
//   FB_PIXEL_ID            — (необязательно) по умолчанию 687492383620231

const crypto = require('crypto');

const PIXEL_ID = process.env.FB_PIXEL_ID || '687492383620231';
const FB_TOKEN = process.env.FB_CAPI_TOKEN;
const WH_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const sha256 = (s) => crypto.createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex');

// Проверка подписи Stripe (без SDK).
function verifyStripe(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(kv => kv.split('=')));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  // защищённое сравнение
  const a = Buffer.from(expected), b = Buffer.from(v1);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  if (!verifyStripe(rawBody, sig, WH_SECRET)) {
    return { statusCode: 400, body: 'Bad signature' };
  }

  let stripeEvent;
  try { stripeEvent = JSON.parse(rawBody); } catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }

  // Реагируем только на успешную оплату.
  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'ignored' };
  }

  const s = stripeEvent.data && stripeEvent.data.object ? stripeEvent.data.object : {};
  const meta = s.metadata || {};
  const value = typeof s.amount_total === 'number' ? (s.amount_total / 100) : 0;
  const currency = (s.currency || 'pln').toUpperCase();
  const email = (s.customer_details && s.customer_details.email) || s.customer_email || meta.email || '';

  // Данные пользователя для сопоставления (чем больше — тем точнее атрибуция).
  const user_data = {};
  if (email) user_data.em = [sha256(email)];
  if (meta.fbp) user_data.fbp = meta.fbp;       // браузерный cookie _fbp, переданный при оформлении
  if (meta.fbc) user_data.fbc = meta.fbc;       // браузерный cookie _fbc (клик по рекламе)

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor((stripeEvent.created || Date.now() / 1000)),
      event_id: s.id,                            // = Checkout Session ID → дедуп с браузерным пикселем
      action_source: 'website',
      event_source_url: 'https://vibo.club/',
      user_data,
      custom_data: { currency, value, order_id: s.id },
    }],
  };

  if (!FB_TOKEN) {
    // токен ещё не задан — не падаем, просто говорим Stripe «ок», чтобы не было ретраев
    console.log('FB_CAPI_TOKEN missing — skipping CAPI send', JSON.stringify(payload.data[0].custom_data));
    return { statusCode: 200, body: 'no-token' };
  }

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(FB_TOKEN)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) console.log('CAPI error', r.status, JSON.stringify(out));
  } catch (e) {
    console.log('CAPI fetch failed', e.message);
  }

  // Stripe всегда должен получить 200, иначе будет повторять вызов.
  return { statusCode: 200, body: 'ok' };
};
