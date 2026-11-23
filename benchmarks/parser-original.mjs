// FROZEN copy of the ORIGINAL (hackathon) parser from app.js, kept only to compare before/after. Do not edit.
// parse() mirrors processVoiceCommand() in app.js branch-for-branch, but returns
// the decision instead of touching the map, so it can be scored.

export const poiDictionary = {
  'coffee': { type: 'amenity', tag: 'cafe' }, 'cafe': { type: 'amenity', tag: 'cafe' },
  'restaurant': { type: 'amenity', tag: 'restaurant' }, 'food': { type: 'amenity', tag: 'restaurant' },
  'bakery': { type: 'shop', tag: 'bakery' }, 'hospital': { type: 'amenity', tag: 'hospital' },
  'medical': { type: 'amenity', tag: 'clinic' }, 'clinic': { type: 'amenity', tag: 'clinic' },
  'pharmac': { type: 'amenity', tag: 'pharmacy' }, 'chemist': { type: 'amenity', tag: 'pharmacy' },
  'police': { type: 'amenity', tag: 'police' }, 'cop': { type: 'amenity', tag: 'police' },
  'fire': { type: 'amenity', tag: 'fire_station' }, 'atm': { type: 'amenity', tag: 'atm' },
  'bank': { type: 'amenity', tag: 'bank' }, 'ev ': { type: 'amenity', tag: 'charging_station' },
  'charging': { type: 'amenity', tag: 'charging_station' }, 'bus': { type: 'highway', tag: 'bus_stop' },
  'airport': { type: 'aeroway', tag: 'aerodrome' }, 'flight': { type: 'aeroway', tag: 'aerodrome' },
  'park': { type: 'leisure', tag: 'park' }, 'garden': { type: 'leisure', tag: 'garden' },
  'amusement': { type: 'tourism', tag: 'theme_park' }, 'theme park': { type: 'tourism', tag: 'theme_park' },
  'hotel': { type: 'tourism', tag: 'hotel' }, 'mall': { type: 'shop', tag: 'mall' },
  'center': { type: 'shop', tag: 'mall' }, 'supermarket': { type: 'shop', tag: 'supermarket' },
  'grocery': { type: 'shop', tag: 'supermarket' }, 'store': { type: 'shop', tag: 'supermarket' },
  'pub': { type: 'amenity', tag: 'pub' }, 'bar': { type: 'amenity', tag: 'bar' }
};

export function parse(raw) {
  const cmd = raw.toLowerCase().trim(); // exactly what app.js does: no punctuation stripping
  const rm = cmd.match(/(?:remove|clear|delete|erase) (?:a )?marker (?:from|at|in) (.+)|unmark (.+)/);
  if (rm) return { intent: 'REMOVE_MARKER', slot: (rm[1] || rm[2]).trim() };
  if (/(?:clear|remove|delete) (?:all )?marker(?:s)?/.test(cmd) || cmd.includes('clear map')) return { intent: 'CLEAR_ALL' };
  const poi = cmd.match(/(?:find|show me|show|search for) (.+) (?:near|in|around|at) (.+)/);
  if (poi) {
    let cat = null;
    for (const k in poiDictionary) if (poi[1].includes(k)) { cat = poiDictionary[k]; break; }
    if (!cat) return { intent: 'UNSUPPORTED_POI' };
    return { intent: 'POI', tag: cat.tag, slot: poi[2] };
  }
  const add = cmd.match(/(?:add|drop|put|place) (?:a )?marker (?:at|in|on) (.+)/) || cmd.match(/mark (.+)/);
  if (add) return { intent: 'ADD_MARKER', slot: add[1].trim() };
  if (cmd.includes('satellite')) return { intent: 'LAYER', slot: 'satellite' };
  if (cmd.includes('road')) return { intent: 'LAYER', slot: 'road' };
  if (cmd.includes('terrain')) return { intent: 'LAYER', slot: 'terrain' };
  const nav = cmd.match(/(?:zoom to|go to|navigate to|show me|show|find) (.+)/);
  if (nav) return { intent: 'NAVIGATE', slot: nav[1].trim() };
  if (cmd.includes('zoom in')) return { intent: 'ZOOM_IN' };
  if (cmd.includes('zoom out')) return { intent: 'ZOOM_OUT' };
  return { intent: 'UNKNOWN' };
}

