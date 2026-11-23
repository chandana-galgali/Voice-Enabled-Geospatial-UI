// ==========================================
// COMMAND PARSER (pure, no DOM / map access)
// Shared by app.js, benchmarks/bench.html and benchmarks/intent-test.mjs
// ==========================================

// keyword -> OSM tag. Longer keywords are tried first, and matching is on whole words
// (with plurals), so "theme parks" -> theme_park, "barbers" does not hit "bar".
export const poiDictionary = {
  'coffee': { type: 'amenity', tag: 'cafe', emoji: '☕' },
  'coffee shop': { type: 'amenity', tag: 'cafe', emoji: '☕' },
  'cafe': { type: 'amenity', tag: 'cafe', emoji: '☕' },
  'restaurant': { type: 'amenity', tag: 'restaurant', emoji: '🍽️' },
  'food': { type: 'amenity', tag: 'restaurant', emoji: '🍽️' },
  'bakery': { type: 'shop', tag: 'bakery', emoji: '🥐' },
  'hospital': { type: 'amenity', tag: 'hospital', emoji: '🏥' },
  'clinic': { type: 'amenity', tag: 'clinic', emoji: '🩺' },
  'medical': { type: 'amenity', tag: 'clinic', emoji: '🩺' },
  'doctor': { type: 'amenity', tag: 'clinic', emoji: '🩺' },
  'pharmacy': { type: 'amenity', tag: 'pharmacy', emoji: '💊' },
  'chemist': { type: 'amenity', tag: 'pharmacy', emoji: '💊' },
  'medical store': { type: 'amenity', tag: 'pharmacy', emoji: '💊' }, // Indian English for pharmacy
  'medical shop': { type: 'amenity', tag: 'pharmacy', emoji: '💊' },
  'police': { type: 'amenity', tag: 'police', emoji: '🚓' },
  'cop': { type: 'amenity', tag: 'police', emoji: '🚓' },
  'fire station': { type: 'amenity', tag: 'fire_station', emoji: '🚒' },
  'fire': { type: 'amenity', tag: 'fire_station', emoji: '🚒' },
  'atm': { type: 'amenity', tag: 'atm', emoji: '🏧' },
  'bank': { type: 'amenity', tag: 'bank', emoji: '🏦' },
  'ev': { type: 'amenity', tag: 'charging_station', emoji: '⚡' },
  'charging': { type: 'amenity', tag: 'charging_station', emoji: '⚡' },
  'bus': { type: 'highway', tag: 'bus_stop', emoji: '🚌' },
  'airport': { type: 'aeroway', tag: 'aerodrome', emoji: '✈️' },
  'flight': { type: 'aeroway', tag: 'aerodrome', emoji: '✈️' },
  'park': { type: 'leisure', tag: 'park', emoji: '🌳' },
  'garden': { type: 'leisure', tag: 'garden', emoji: '🌷' },
  'amusement park': { type: 'tourism', tag: 'theme_park', emoji: '🎢' },
  'theme park': { type: 'tourism', tag: 'theme_park', emoji: '🎢' },
  'hotel': { type: 'tourism', tag: 'hotel', emoji: '🏨' },
  'mall': { type: 'shop', tag: 'mall', emoji: '🛍️' },
  'shopping center': { type: 'shop', tag: 'mall', emoji: '🛍️' },
  'shopping centre': { type: 'shop', tag: 'mall', emoji: '🛍️' },
  'supermarket': { type: 'shop', tag: 'supermarket', emoji: '🛒' },
  'grocery': { type: 'shop', tag: 'supermarket', emoji: '🛒' },
  'store': { type: 'shop', tag: 'supermarket', emoji: '🛒' },
  'pub': { type: 'amenity', tag: 'pub', emoji: '🍻' },
  'bar': { type: 'amenity', tag: 'bar', emoji: '🍺' }
};

const forms = kw => {
  const f = [kw, kw + 's', kw + 'es'];
  if (kw.endsWith('y')) f.push(kw.slice(0, -1) + 'ies');
  return f;
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const POI_MATCHERS = Object.keys(poiDictionary)
  .sort((a, b) => b.length - a.length)
  .map(kw => ({ re: new RegExp(`\\b(?:${forms(kw).map(esc).join('|')})\\b`), cat: poiDictionary[kw] }));

export function findCategory(text) {
  for (const m of POI_MATCHERS) if (m.re.test(text)) return m.cat;
  return null;
}

// Whisper returns "Go to Delhi." / "Search for ATM's around Surat." -> "go to delhi" / "search for atms around surat"
export function normalize(raw) {
  let s = (raw || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  s = s.replace(/['’`]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  let prev;
  do {
    prev = s;
    s = s.replace(/^(?:hey|hi|ok|okay|please|can you|could you|would you|i want to|i wanna|lets|let us)\s+/, '')
         .replace(/\s+(?:please|now|for me)$/, '');
  } while (s !== prev);
  return s;
}

const cleanSlot = s => s.replace(/^(?:the|a)\s+/, '').trim();

export function parse(raw) {
  const cmd = normalize(raw);
  let m;

  // 1. Remove one marker ("unmarked" is a common Whisper mishearing of "unmark")
  if ((m = cmd.match(/^(?:remove|clear|delete|erase)\s+(?:the\s+|a\s+)?(?:marker|pin)s?\s+(?:from|at|in|on|for)\s+(.+)$|^unmark(?:ed)?\s+(.+)$/)))
    return { intent: 'REMOVE_MARKER', slot: cleanSlot(m[1] || m[2]) };

  // 2. Clear everything
  if (/^(?:clear|remove|delete|erase)\s+(?:all\s+)?(?:the\s+)?(?:markers?|pins?)$/.test(cmd) || /\b(?:clear|reset)\s+(?:the\s+)?map\b/.test(cmd))
    return { intent: 'CLEAR_ALL' };

  // 3. Layers: only when the whole command is about a view, so "Go to Mira Road" still navigates
  if ((m = cmd.match(/^(?:(?:show|switch to|change to|use|enable|turn on|open|show me)\s+)?(?:the\s+)?(satellite|road|street|terrain|topographic|topo)(?:\s+(?:view|map|mode|layer))?$/))) {
    const layer = { satellite: 'satellite', road: 'road', street: 'road', terrain: 'terrain', topographic: 'terrain', topo: 'terrain' }[m[1]];
    return { intent: 'LAYER', slot: layer };
  }

  // 4. Zoom
  if (/^zoom\s+in\b/.test(cmd)) return { intent: 'ZOOM_IN' };
  if (/^zoom\s+out\b/.test(cmd)) return { intent: 'ZOOM_OUT' };

  // 5. POI search. " and " is accepted as a connector because Whisper often hears "in" as "and".
  //    The first group is greedy, so "cafes and bars in Pune" still splits at the last connector.
  if ((m = cmd.match(/^(?:find|show me|show|search for|search|look for|locate|list)\s+(.+)\s+(?:near|nearby|close to|in|around|at|and)\s+(.+)$/))) {
    const cat = findCategory(m[1]);
    if (cat) return { intent: 'POI', type: cat.type, tag: cat.tag, emoji: cat.emoji, slot: cleanSlot(m[2]) };
    return { intent: 'UNSUPPORTED_POI', slot: m[1] };
  }

  // 6. Add a marker
  if ((m = cmd.match(/^(?:add|drop|put|place|set)\s+(?:a\s+|the\s+)?(?:marker|pin)\s+(?:at|in|on|to|for)\s+(.+)$|^(?:mark|pin)\s+(.+)$/)))
    return { intent: 'ADD_MARKER', slot: cleanSlot(m[1] || m[2]) };

  // 7. Navigate
  if ((m = cmd.match(/^(?:zoom to|zoom into|go to|navigate to|take me to|fly to|move to|head to|jump to|show me|show|find|locate|where is|search for|search)\s+(.+)$/)))
    return { intent: 'NAVIGATE', slot: cleanSlot(m[1]) };

  return { intent: 'UNKNOWN' };
}

// ==========================================
// FUZZY MATCHING for misheard place names
// ==========================================
export function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const compact = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const distRatio = (a, b) => levenshtein(compact(a), compact(b)) / Math.max(compact(a).length, compact(b).length, 1);

// Major Indian cities and well-known localities. Used only to repair near-misses
// such as "Puna" -> Pune or "Surad" -> Surat before geocoding.
export const GAZETTEER = [
  'mumbai','delhi','new delhi','bengaluru','bangalore','hyderabad','ahmedabad','chennai','kolkata','pune','surat','jaipur',
  'lucknow','kanpur','nagpur','indore','thane','bhopal','visakhapatnam','patna','vadodara','ghaziabad','ludhiana','agra',
  'nashik','faridabad','meerut','rajkot','varanasi','srinagar','aurangabad','dhanbad','amritsar','navi mumbai','prayagraj',
  'ranchi','howrah','coimbatore','jabalpur','gwalior','vijayawada','jodhpur','madurai','raipur','kota','guwahati',
  'chandigarh','solapur','mysuru','mysore','tiruchirappalli','bareilly','aligarh','moradabad','gurgaon','gurugram','noida',
  'jalandhar','bhubaneswar','salem','warangal','thiruvananthapuram','kochi','dehradun','udaipur','goa','panaji','shimla',
  'mangaluru','mangalore','puducherry','ajmer','jammu','belagavi','kolhapur','tirupati','nellore','vellore','gaya',
  'andheri','bandra','dadar','powai','juhu','borivali','colaba','worli','kurla','ghatkopar','malad','goregaon','chembur',
  'vashi','koramangala','indiranagar','whitefield','jayanagar','electronic city','connaught place','dwarka','saket',
  'karol bagh','hauz khas','gachibowli','hitech city','salt lake','t nagar','anna nagar','velachery','hinjewadi','kothrud'
];
const ALIASES = { poona: 'pune', bombay: 'mumbai', madras: 'chennai', calcutta: 'kolkata', baroda: 'vadodara' };

// Returns a corrected place name, or the input unchanged if nothing is close enough.
export function correctPlace(name, maxRatio = 0.34) {
  const n = (name || '').trim();
  const key = compact(n);
  if (key.length < 4) return n;
  if (ALIASES[key]) return ALIASES[key];
  if (GAZETTEER.some(g => compact(g) === key)) return n;
  let best = null, bestR = Infinity, tie = false;
  for (const g of GAZETTEER) {
    const r = distRatio(n, g);
    if (r < bestR) { best = g; bestR = r; tie = false; } else if (r === bestR) tie = true;
  }
  return best && !tie && bestR <= maxRatio ? best : n;
}

// Which markers should "remove marker from <target>" hit? Substring first, then closest fuzzy match.
export function matchMarkers(target, markers, maxRatio = 0.4) {
  const t = (target || '').toLowerCase().trim();
  const exact = markers.filter(m => m.name.toLowerCase().includes(t));
  if (exact.length) return exact;
  let best = null, bestR = Infinity;
  for (const m of markers) {
    const r = distRatio(t, m.name.split(',')[0]);
    if (r < bestR) { best = m; bestR = r; }
  }
  return best && bestR <= maxRatio ? markers.filter(m => m.name.split(',')[0] === best.name.split(',')[0]) : [];
}
