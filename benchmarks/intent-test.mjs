// Intent-accuracy test. Run from the repo root: node benchmarks/intent-test.mjs
// Usage of the REAL parser: imports ../commands.js, the same module app.js uses.
import { parse, poiDictionary, correctPlace, matchMarkers } from '../commands.js';

// [group, utterance, expected intent, expected tag-or-slot]
// Slots are what the app needs to work: the place name with no stray punctuation.
const T = [
  // A. The app's own README / chip examples
  ['A','Zoom to Mumbai','NAVIGATE','mumbai'], ['A','Go to Delhi','NAVIGATE','delhi'], ['A','Find Bangalore','NAVIGATE','bangalore'],
  ['A','Find cafes near Pune','POI','cafe'], ['A','Show hospitals in Chennai','POI','hospital'], ['A','Search for ATMs around Surat','POI','atm'],
  ['A','Show satellite view','LAYER','satellite'], ['A','Show terrain view','LAYER','terrain'], ['A','Show road view','LAYER','road'],
  ['A','Drop a marker at Hyderabad','ADD_MARKER','hyderabad'], ['A','Put a marker in Ahmedabad','ADD_MARKER','ahmedabad'], ['A','Mark Jaipur','ADD_MARKER','jaipur'],
  ['A','Unmark Hyderabad','REMOVE_MARKER','hyderabad'], ['A','Remove marker from Pune','REMOVE_MARKER','pune'], ['A','Clear all markers','CLEAR_ALL'],
  ['A','Clear map','CLEAR_ALL'], ['A','Zoom in','ZOOM_IN'], ['A','Zoom out','ZOOM_OUT'], ['A','Find bus stops in Bengaluru','POI','bus_stop'],
  ['A','Show parks in Mumbai','POI','park'], ['A','Go to Chennai','NAVIGATE','chennai'],
  // B. Natural paraphrases a real user would say
  ['B','Show me pharmacies near Thane','POI','pharmacy'], ['B','Find coffee shops in Indiranagar','POI','cafe'], ['B','Find police stations near Andheri','POI','police'],
  ['B','Search for hotels in Goa','POI','hotel'], ['B','Find EV charging stations in Noida','POI','charging_station'], ['B','Show banks around Connaught Place','POI','bank'],
  ['B','Find restaurants near Bandra','POI','restaurant'], ['B','Find supermarkets in Powai','POI','supermarket'], ['B','Show me malls in Gurgaon','POI','mall'],
  ['B','Find theme parks near Mumbai','POI','theme_park'], ['B','Find amusement parks in Bangalore','POI','theme_park'], ['B','Find medical stores near Dadar','POI','pharmacy'],
  ['B','Find fire stations in Kolkata','POI','fire_station'], ['B','Find bakeries near Koramangala','POI','bakery'], ['B','Find the airport in Chennai','POI','aerodrome'],
  ['B','Navigate to Kolkata','NAVIGATE','kolkata'], ['B','Take me to Lucknow','NAVIGATE','lucknow'], ['B','Switch to satellite','LAYER','satellite'],
  ['B','Place a marker on Nagpur','ADD_MARKER','nagpur'], ['B','Delete all markers','CLEAR_ALL'], ['B','Remove all markers','CLEAR_ALL'],
  ['B','Find barbers near Pune','UNSUPPORTED_POI'], ['B','Find schools in Delhi','UNSUPPORTED_POI'], ['B','Find gardens in Bangalore','POI','garden'],
  // C. Whisper-style output: capitalised, with trailing punctuation
  ['C','Find cafes near Pune.','POI','cafe'], ['C','Go to Delhi.','NAVIGATE','delhi'], ['C','Zoom in.','ZOOM_IN'], ['C','Clear map.','CLEAR_ALL'],
  ['C','Unmark Hyderabad.','REMOVE_MARKER','hyderabad'], ['C','Mark Jaipur.','ADD_MARKER','jaipur'], ['C','Show satellite view.','LAYER','satellite'],
  ['C','Find hospitals in Chennai.','POI','hospital'], ['C','Zoom out.','ZOOM_OUT'], ['C','Remove marker from Pune.','REMOVE_MARKER','pune'],
  ['C','Go to Mumbai, please.','NAVIGATE','mumbai'], ['C',' Find ATMs near Surat.','POI','atm'],
  // D. Real Indian place names that contain trigger words
  ['D','Go to Mira Road','NAVIGATE','mira road'], ['D','Go to Charni Road','NAVIGATE','charni road'], ['D','Find cafes near Grant Road','POI','cafe'],
  ['D','Go to Marine Drive','NAVIGATE','marine drive'], ['D','Mark Bandra','ADD_MARKER','bandra'], ['D','Zoom to Delhi Cantonment','NAVIGATE','delhi cantonment'],
  // E. Exactly what Whisper transcribed in a real bench.html run (Indian-accented speech), scored against what was said
  ['E','Go to Delhi.','NAVIGATE','delhi'], ['E','Find cafes near Puna.','POI','cafe','pune'], ['E','Show satellite view.','LAYER','satellite'],
  ['E','Zoom in.','ZOOM_IN'], ['E','Rock and Jet board.','ADD_MARKER','jaipur'], ['E','Show hospitals in Chennai.','POI','hospital','chennai'],
  ['E','Unmarked Jaipur','REMOVE_MARKER','jaipur'], ['E',"Search for ATM's around Surad.",'POI','atm','surat'], ['E','Show terrain view.','LAYER','terrain'],
  ['E','Zoom out.','ZOOM_OUT'], ['E','Find bus stops in Bengaluru.','POI','bus_stop','bengaluru'], ['E','Drop a marker at Hyderabad.','ADD_MARKER','hyderabad'],
  ['E','Show me pharmacies near Thane.','POI','pharmacy','thane'], ['E','Navigate to Kolkata.','NAVIGATE','kolkata'], ['E','Clear map.','CLEAR_ALL'],
  ['E','Find police stations near Endere.','POI','police','andheri'], ['E','Show Road View.','LAYER','road'], ['E','Find hotels in Goa.','POI','hotel','goa'],
  ['E','Show parks and Mumbai.','POI','park','mumbai'], ['E','Remove marker from hydro bed.','REMOVE_MARKER','hyderabad'],
  ['E','Find restaurants near Bandra.','POI','restaurant','bandra'], ['E','Zoom to Mumbai.','NAVIGATE','mumbai'],
  ['E','Find EV charging stations in Noida.','POI','charging_station','noida'], ['E','Clear all markers.','CLEAR_ALL'],
  // F. Held-out: written after the parser fixes and run once, never tuned against
  ['F','Where is Mysore','NAVIGATE','mysore'], ['F','Can you show me ATMs near Vashi?','POI','atm','vashi'], ['F','Locate Shimla','NAVIGATE','shimla'],
  ['F','Show me the satellite map','LAYER','satellite'], ['F','Switch to terrain mode','LAYER','terrain'], ['F','Street view please','LAYER','road'],
  ['F','Find grocery stores near Malad','POI','supermarket','malad'], ['F','Look for chemists in Kothrud','POI','pharmacy','kothrud'],
  ['F','Search for pubs around Koramangala','POI','pub','koramangala'], ['F','Find a hospital near Whitefield','POI','hospital','whitefield'],
  ['F','Show gardens in Mysuru','POI','garden','mysuru'], ['F','Find bus stops near Dwarka','POI','bus_stop','dwarka'],
  ['F','Pin Udaipur','ADD_MARKER','udaipur'], ['F','Add a marker at Amritsar','ADD_MARKER','amritsar'], ['F','Delete the marker from Pune','REMOVE_MARKER','pune'],
  ['F','Erase all pins','CLEAR_ALL'], ['F','Reset the map','CLEAR_ALL'], ['F','Zoom in a bit','ZOOM_IN'], ['F','Fly to Guwahati','NAVIGATE','guwahati'],
  ['F','Head to Hitech City','NAVIGATE','hitech city'], ['F','Find banks near Salt Lake','POI','bank','salt lake'], ['F','Find cops near Colaba','POI','police','colaba'],
  ['F','Show me EV chargers in Gurugram','POI','charging_station','gurugram'], ['F','Find shopping malls in Noida','POI','mall','noida'],
  ['F','Find the nearest petrol pump in Delhi','UNSUPPORTED_POI'], ['F','Go to Bombay','NAVIGATE','mumbai'], ['F','Find cafes and bars in Pune','POI','cafe','pune'],
  ['F','Okay, go to Nagpur.','NAVIGATE','nagpur'], ['F','Find a place to eat near Juhu','UNSUPPORTED_POI'], ['F','Show roads in Kochi','UNSUPPORTED_POI'],
];


// Markers that exist on the map when a REMOVE_MARKER command is scored
const MAP = [{ name: 'Jaipur, Rajasthan, India' }, { name: 'Hyderabad, Telangana, India' }, { name: 'Pune, Maharashtra, India' }];

function check(r, ei, ev, place) {
  if (r.intent !== ei) return false;
  if (ev === undefined) return true;
  if (r.intent === 'POI') return r.tag === ev && (place === undefined || correctPlace(r.slot) === place);
  if (r.intent === 'REMOVE_MARKER') { const hit = matchMarkers(r.slot, MAP); return hit.length > 0 && hit.every(m => m.name.toLowerCase().startsWith(ev)); }
  if (r.intent === 'LAYER') return r.slot === ev;
  return correctPlace(r.slot) === ev;           // NAVIGATE / ADD_MARKER: after place correction
}

const groups = { A: 'README / UI examples', B: 'Natural paraphrases', C: 'Whisper-style punctuation', D: 'Place names with trigger words', E: 'Real accented Whisper output', F: 'Held-out (never tuned on)' };
const stats = {}; const fails = [];
for (const [g, u, ei, ev, place] of T) {
  const r = parse(u);
  const intentOk = r.intent === ei, fullOk = check(r, ei, ev, place);
  stats[g] ??= { n: 0, intent: 0, full: 0 };
  stats[g].n++; stats[g].intent += intentOk; stats[g].full += fullOk;
  if (!fullOk) fails.push(`[${g}] "${u}" -> got ${r.intent}${r.tag ? ' ' + r.tag : ''}${r.slot ? ' (' + r.slot + ')' : ''}, expected ${ei}${ev ? ' ' + ev : ''}${place ? ' (' + place + ')' : ''}`);
}
let N = 0, I = 0, F = 0;
console.log('Group                              n   intent-acc   intent+slot-acc');
for (const g of Object.keys(stats)) {
  const s = stats[g]; if (g < 'E') { N += s.n; I += s.intent; F += s.full; }
  console.log(`${(g + '. ' + groups[g]).padEnd(34)} ${String(s.n).padStart(2)}   ${(100*s.intent/s.n).toFixed(1).padStart(6)}%     ${(100*s.full/s.n).toFixed(1).padStart(6)}%`);
}
console.log(`${'OVERALL A-D (typed text)'.padEnd(34)} ${N}   ${(100*I/N).toFixed(1).padStart(6)}%     ${(100*F/N).toFixed(1).padStart(6)}%`);
console.log('\nFailures:'); fails.forEach(f => console.log('  ' + f));
const tags = new Set(Object.values(poiDictionary).map(v => v.type + '=' + v.tag));
console.log(`\nDictionary: ${Object.keys(poiDictionary).length} keywords -> ${tags.size} unique OSM tags`);
