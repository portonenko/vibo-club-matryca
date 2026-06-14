// Creates a Stripe Checkout Session via the REST API directly (no SDK) —
// keeps the function bundle tiny so cold starts stay fast.

// Prices are defined server-side only — the client cannot set the amount.
// Amounts are in the smallest currency unit (grosze / cents).
const PRICES = {
  pl: { currency: 'pln', full: 5500, child: 4500, compat: 4500, month: 2500, star: 3300 },
  en: { currency: 'usd', full: 1400, child: 1100, compat: 1100, month: 700, star: 900 },
  de: { currency: 'eur', full: 1300, child: 1100, compat: 1100, month: 600, star: 800 },
};

// Discounted prices when an item is added as an add-on to a main purchase.
// (star keeps its full price even as an add-on)
const ADDON = {
  pl: { full: 3500, child: 2500, compat: 2500, month: 2500, star: 3300 },
  en: { full: 900, child: 700, compat: 700, month: 700, star: 900 },
  de: { full: 800, child: 600, compat: 600, month: 600, star: 800 },
};

const NAMES = {
  pl: { full: 'Matryca Pełna — raport PDF', child: 'Matryca Dziecka — raport PDF', compat: 'Matryca Zgodności — raport PDF', month: 'Prognoza na miesiąc — PDF', star: 'Gwiazda Szczęścia' },
  en: { full: 'Full Matrix — PDF report', child: 'Child Matrix — PDF report', compat: 'Compatibility Matrix — PDF report', month: 'Monthly forecast — PDF', star: 'Star of Happiness' },
  de: { full: 'Vollständige Matrix — PDF-Bericht', child: 'Kind-Matrix — PDF-Bericht', compat: 'Kompatibilitäts-Matrix — PDF-Bericht', month: 'Monatsprognose — PDF', star: 'Stern des Glücks' },
};

// Flatten a nested object into Stripe's bracket form-encoding.
function encodeForm(obj, prefix, out) {
  out = out || [];
  for (const key in obj) {
    const val = obj[key];
    if (val === undefined || val === null) continue;
    const k = prefix ? `${prefix}[${key}]` : key;
    if (typeof val === 'object') encodeForm(val, k, out);
    else out.push(encodeURIComponent(k) + '=' + encodeURIComponent(val));
  }
  return out.join('&');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'missing key' }) };
  }
  try {
    const body = JSON.parse(event.body || '{}');
    const lang = ['pl', 'en', 'de'].includes(body.lang) ? body.lang : 'pl';
    const ALLOWED = ['full', 'child', 'compat', 'month', 'star'];
    const qOf = q => Math.max(1, Math.min(10, parseInt(q, 10) || 1));
    const p = PRICES[lang], ad = ADDON[lang];
    const origin = event.headers.origin || event.headers.Origin || 'https://vibo.club';

    // primary item (full price, with qty) + optional add-ons (discounted, with qty)
    let primary = ALLOWED.includes(body.primary) ? body.primary : (ALLOWED.includes(body.type) ? body.type : 'full');
    const primaryQty = qOf(body.primaryQty);
    let addons = Array.isArray(body.addons) ? body.addons : [];
    // normalize add-ons to [{type, qty}]
    addons = addons
      .map(a => (typeof a === 'string' ? { type: a, qty: 1 } : a))
      .filter(a => a && ALLOWED.includes(a.type) && a.type !== primary);

    const line_items = [{
      quantity: primaryQty,
      price_data: { currency: p.currency, unit_amount: p[primary], product_data: { name: NAMES[lang][primary] } },
    }].concat(addons.map(a => ({
      quantity: qOf(a.qty),
      price_data: { currency: p.currency, unit_amount: ad[a.type], product_data: { name: NAMES[lang][a.type] } },
    })));

    // order total (major units) for ad-conversion tracking on the success page
    const totalMinor = line_items.reduce((s, li) => s + li.quantity * li.price_data.unit_amount, 0);
    const totalMajor = (totalMinor / 100).toFixed(2);

    const meta = {
      types: [primary + 'x' + primaryQty].concat(addons.map(a => a.type + 'x' + qOf(a.qty))).join(','),
      lang,
      name: String(body.name || '').slice(0, 80),
      email: String(body.email || '').slice(0, 120),
      summary: String(body.summary || '').slice(0, 490),
      people: String(body.people || '').slice(0, 480),
      people2: String(body.people2 || '').slice(0, 480),
    };

    const params = {
      mode: 'payment',
      locale: lang,
      'line_items': line_items,
      metadata: meta,                          // on the Checkout Session
      payment_intent_data: { metadata: meta }, // copied to the Payment (visible in Payments)
      success_url: `${origin}/?paid=1&type=${primary}&val=${totalMajor}&cur=${p.currency.toUpperCase()}`,
      cancel_url: `${origin}/?canceled=1`,
    };
    if (body.email) params.customer_email = String(body.email).slice(0, 120);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let resp;
    try {
      resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + key,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: encodeForm(params),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: (data.error && data.error.message) || 'stripe error' }) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: data.url }) };
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
