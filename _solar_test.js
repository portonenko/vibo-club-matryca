// Repro of kosmogram.html buildSolarReturn — fill env vars and run with node.
// node: Y MO D H MI BTZ (birth tz) YEAR  [HTZ here-tz, default Europe/Warsaw]
const A = require('./site/astronomy.browser.min.js');
const norm = l => ((l % 360) + 360) % 360;
function localToUTC(y, mo, d, h, mi, tz) {
  let guess = new Date(Date.UTC(y, mo - 1, d, h, mi, 0));
  for (let k = 0; k < 4; k++) {
    const s = guess.toLocaleString('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const m = s.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+)/);
    const shown = Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4] === 24 ? 0 : +m[4], +m[5]);
    const diff = Date.UTC(y, mo - 1, d, h, mi) - shown;
    if (Math.abs(diff) < 30000) break;
    guess = new Date(guess.getTime() + diff);
  }
  return guess;
}
const fmt = (date, tz) => date.toLocaleString('pl-PL', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function solar(birth, year) {
  const sunNatal = norm(A.Ecliptic(A.GeoVector('Sun', birth, true)).elon);
  const approx = new Date(Date.UTC(year, birth.getUTCMonth(), Math.max(1, birth.getUTCDate() - 25)));
  const sr = A.SearchSunLongitude(sunNatal, A.MakeTime(approx), 60);
  return { date: sr.date, sunNatal };
}
const E = process.env;
const birth = localToUTC(+E.Y, +E.MO, +E.D, +E.H, +E.MI, E.BTZ);
const HTZ = E.HTZ || 'Europe/Warsaw';
console.log('birth UTC:', birth.toISOString(), '| natal Sun lon will be computed');
const s = solar(birth, +E.YEAR);
console.log('natal Sun longitude:', s.sunNatal.toFixed(4), '°');
console.log('SOLAR moment UTC:', s.date.toISOString());
console.log('  в Warszawa:', fmt(s.date, 'Europe/Warsaw'));
console.log('  в GMT+3 (Moscow):', fmt(s.date, 'Europe/Moscow'));
console.log('  в here-tz', HTZ + ':', fmt(s.date, HTZ));
