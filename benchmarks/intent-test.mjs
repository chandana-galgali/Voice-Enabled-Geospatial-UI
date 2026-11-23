// Text-level intent accuracy test. Run: node benchmarks/intent-test.mjs
import { parse, poiDictionary } from './parser.mjs';

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
];

const clean = s => (s || '').replace(/[.,!?]+$/,'').replace(/,? please$/,'').trim();
const groups = { A: 'README / UI examples', B: 'Natural paraphrases', C: 'Whisper-style punctuation', D: 'Place names with trigger words' };
const stats = {}; const fails = [];
for (const [g, u, ei, ev] of T) {
  const r = parse(u);
  const val = r.intent === 'POI' ? r.tag : r.slot;
  const intentOk = r.intent === ei;
  const fullOk = intentOk && (ev === undefined || (r.intent === 'POI' ? r.tag === ev
      // REMOVE_MARKER does a substring match on marker names, so stray punctuation breaks it;
      // the geocoder (NAVIGATE / ADD_MARKER) tolerates "delhi." so those are compared after cleaning.
      : r.intent === 'REMOVE_MARKER' ? r.slot === ev : clean(r.slot) === ev));
  stats[g] ??= { n: 0, intent: 0, full: 0 };
  stats[g].n++; stats[g].intent += intentOk; stats[g].full += fullOk;
  if (!fullOk) fails.push(`[${g}] "${u}" -> got ${r.intent}${val ? ' (' + val + ')' : ''}, expected ${ei}${ev ? ' (' + ev + ')' : ''}`);
}
let N = 0, I = 0, F = 0;
console.log('Group                              n   intent-acc   intent+slot-acc');
for (const g of Object.keys(stats)) {
  const s = stats[g]; N += s.n; I += s.intent; F += s.full;
  console.log(`${(g + '. ' + groups[g]).padEnd(34)} ${String(s.n).padStart(2)}   ${(100*s.intent/s.n).toFixed(1).padStart(6)}%     ${(100*s.full/s.n).toFixed(1).padStart(6)}%`);
}
console.log(`${'OVERALL'.padEnd(34)} ${N}   ${(100*I/N).toFixed(1).padStart(6)}%     ${(100*F/N).toFixed(1).padStart(6)}%`);
console.log('\nFailures:'); fails.forEach(f => console.log('  ' + f));
const tags = new Set(Object.values(poiDictionary).map(v => v.type + '=' + v.tag));
console.log(`\nDictionary: ${Object.keys(poiDictionary).length} keywords -> ${tags.size} unique OSM tags`);
