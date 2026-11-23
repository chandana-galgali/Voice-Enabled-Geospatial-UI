import { loadTranscriber } from './speech.js';
import { parse, correctPlace, matchMarkers } from './commands.js';

// ==========================================
// 1. MAP INITIALIZATION & MANUAL LAYER CONTROLS
// ==========================================
const map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 5);
L.control.zoom({ position: 'bottomright' }).addTo(map);

const layers = {
  road: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
  terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png')
};
layers.road.addTo(map);
let currentLayer = layers.road;

// NEW: Manual UI control to switch layers in the top right
const baseMaps = {
  "Road Map": layers.road,
  "Satellite View": layers.satellite,
  "Terrain View": layers.terrain
};
L.control.layers(baseMaps, null, { position: 'bottomleft' }).addTo(map);

const markersGroup = L.layerGroup().addTo(map);
let activeMarkers = []; 
let voiceFeedbackEnabled = true;

// ==========================================
// 2. DOM ELEMENTS & EVENT LISTENERS
// ==========================================
const elements = {
  micBtn: document.getElementById('mic-btn'),
  btnText: document.getElementById('btn-text'),
  transcript: document.getElementById('transcript'),
  statusTag: document.getElementById('status-tag'),
  cmdInput: document.getElementById('cmd-input'),
  sendBtn: document.getElementById('send-btn'),
  ttsToggle: document.getElementById('tts-toggle'),
  markerList: document.getElementById('marker-list'),
  exportBtn: document.getElementById('export-btn'),
  leftCollapse: document.getElementById('left-collapse'),
  rightCollapse: document.getElementById('right-collapse'),
  leftPanel: document.getElementById('left-panel'),
  rightPanel: document.getElementById('right-panel'),
  interpretation: document.getElementById('interpretation'),
  modelToggle: document.getElementById('model-toggle')
};

elements.leftCollapse.addEventListener('click', () => {
  elements.leftPanel.classList.toggle('collapsed');
  elements.leftCollapse.innerText = elements.leftPanel.classList.contains('collapsed') ? '🔽' : '🔼';
});

elements.rightCollapse.addEventListener('click', () => {
  elements.rightPanel.classList.toggle('collapsed');
  elements.rightCollapse.innerText = elements.rightPanel.classList.contains('collapsed') ? '🔽' : '🔼';
});

document.querySelectorAll('.cmd-chip').forEach(chip => {
  chip.addEventListener('click', (e) => {
    const cmd = e.target.innerText;
    elements.cmdInput.value = cmd;
    handleInput(cmd);
  });
});

elements.sendBtn.addEventListener('click', () => handleInput(elements.cmdInput.value));
elements.cmdInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleInput(elements.cmdInput.value));
elements.exportBtn.addEventListener('click', exportPDF);

elements.ttsToggle.addEventListener('click', () => {
  voiceFeedbackEnabled = !voiceFeedbackEnabled;
  elements.ttsToggle.innerText = voiceFeedbackEnabled ? '🔊' : '🔇';
  updateStatus(voiceFeedbackEnabled ? 'Audio On' : 'Audio Off', '#a18cd1');
});

function handleInput(text) {
  if (text.trim()) {
    elements.transcript.innerText = `"${text}"`;
    processVoiceCommand(text);
    elements.cmdInput.value = '';
  }
}

function updateStatus(text, color = '#a18cd1') {
  elements.statusTag.innerText = text;
  elements.statusTag.style.color = color;
}

function speak(text) {
  if (voiceFeedbackEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }
}

// ==========================================
// 3. ON-DEVICE WHISPER AI (Web Worker, CPU/WebAssembly)
// ==========================================
let speech = null;              // { transcriber, model, label, worker }
let isRecording = false;
let isBusy = false;             // true while a command is being transcribed
let mediaRecorder = null;
let audioChunks = [];
let audioContext;
let vad = null;                 // voice-activity detection state while recording

const savedModel = (() => { try { return localStorage.getItem('whisperModel'); } catch { return null; } })();
let currentModel = savedModel === 'tiny' ? 'tiny' : 'base';

function setMicReady(ready) {
  elements.micBtn.disabled = !ready;
  elements.btnText.innerText = ready ? 'Listen' : 'Loading AI...';
}

async function loadWhisperModel(model = currentModel) {
  setMicReady(false);
  elements.modelToggle.disabled = true;
  speech?.worker.terminate();
  speech = null;
  try {
    speech = await loadTranscriber(model, msg => updateStatus(msg, '#f59e0b'));
    currentModel = speech.model;
    updateStatus('AI Ready · on-device', '#10b981');
    setMicReady(true);
  } catch (error) {
    console.error('Failed to load model:', error);
    updateStatus('AI Load Failed (check your connection and reload)', '#ef4444');
  }
  elements.modelToggle.disabled = false;
  elements.modelToggle.innerText = currentModel === 'tiny' ? '⚡ Fast' : '🎯 Accurate';
  elements.modelToggle.title = currentModel === 'tiny'
    ? 'Fast mode (Whisper tiny): quicker, less accurate. Click for Accurate mode.'
    : 'Accurate mode (Whisper base). Click for Fast mode (Whisper tiny).';
}

elements.modelToggle.addEventListener('click', () => {
  if (isRecording || isBusy) return;
  const next = currentModel === 'tiny' ? 'base' : 'tiny';
  try { localStorage.setItem('whisperModel', next); } catch {}
  loadWhisperModel(next);
});

loadWhisperModel();

function toggleRecording() {
  if (!speech || isBusy) return;
  if (!isRecording) startRecording();
  else stopRecording();
}
elements.micBtn.addEventListener('click', toggleRecording);

// Space bar = push to talk (when not typing in the text box)
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  e.preventDefault();
  toggleRecording();
});

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { noiseSuppression: true, echoCancellation: true }
    });
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = processAudioData;
    mediaRecorder.start();

    isRecording = true;
    elements.micBtn.classList.add('listening');
    elements.btnText.innerText = 'Stop';
    elements.interpretation.innerText = '';
    updateStatus('Listening… (stops automatically when you pause)', '#f43f5e');
    startVoiceDetection(stream);

  } catch (err) {
    console.error('Microphone access denied:', err);
    updateStatus('Mic Access Denied', '#ef4444');
  }
}

// Live mic level + automatic stop: once speech has been heard, 1.2 s of silence ends the
// recording; nothing heard for 6 s, or 10 s in total, also ends it.
function startVoiceDetection(stream) {
  // Separate context at the device's native rate: some browsers refuse to attach a mic stream
  // to the 16 kHz context used for decoding.
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const t0 = performance.now();
  vad = { ctx, analyser, heardSpeech: false, lastLoud: t0, noiseFloor: 0.01, timer: null };

  vad.timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    const rms = Math.sqrt(buf.reduce((a, x) => a + x * x, 0) / buf.length);
    const now = performance.now();
    if (now - t0 < 300) vad.noiseFloor = Math.max(vad.noiseFloor, rms);   // calibrate on the first 300 ms
    const threshold = Math.max(0.02, vad.noiseFloor * 2.5);
    if (rms > threshold) { vad.heardSpeech = true; vad.lastLoud = now; }
    elements.micBtn.style.setProperty('--level', Math.min(1, rms / 0.15).toFixed(2));

    const silentFor = now - vad.lastLoud, elapsed = now - t0;
    if ((vad.heardSpeech && silentFor > 1200) || (!vad.heardSpeech && elapsed > 6000) || elapsed > 10000) stopRecording();
  }, 50);
}

function stopVoiceDetection() {
  if (vad?.timer) clearInterval(vad.timer);
  vad?.ctx.close().catch(() => {});
  vad = null;
  elements.micBtn.style.setProperty('--level', 0);
}

function stopRecording() {
  if (!isRecording) return;
  const heardSpeech = vad?.heardSpeech ?? true;
  stopVoiceDetection();
  isRecording = false;
  elements.micBtn.classList.remove('listening');

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    if (!heardSpeech) mediaRecorder.onstop = null;     // nothing said: skip transcription
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }

  if (!heardSpeech) {
    elements.btnText.innerText = 'Listen';
    updateStatus('No speech heard. Try again', '#f43f5e');
    return;
  }
  isBusy = true;
  elements.micBtn.disabled = true;
  elements.btnText.innerText = 'Processing...';
}

async function processAudioData() {
  const t0 = performance.now();
  const tick = setInterval(() => updateStatus(`Transcribing on your device… ${((performance.now() - t0) / 1000).toFixed(0)} s`, '#f59e0b'), 500);
  updateStatus('Transcribing on your device…', '#f59e0b');
  try {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const audioBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
    const output = await speech.transcriber(audioBuffer.getChannelData(0));
    // Whisper emits tags like "[BLANK_AUDIO]" or "(music)" for silence/noise: treat those as no speech
    const transcript = output.text.replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim();
    clearInterval(tick);

    if (transcript) {
      elements.transcript.innerText = `"${transcript}"`;
      processVoiceCommand(transcript);
    } else {
      updateStatus('No speech detected', '#f43f5e');
      speak('I did not catch that.');
    }
  } catch (err) {
    clearInterval(tick);
    console.error('Transcription error:', err);
    updateStatus('Transcription Error', '#ef4444');
  } finally {
    isBusy = false;
    setMicReady(true);
  }
}

// ==========================================
// 4. GEOCODING & POI DATABASE (OSM)
// ==========================================
async function geocode(placeName) {
  updateStatus('Searching...');
  try {
    // viewbox (without bounded=1) prefers results inside India but still finds places elsewhere
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=1&viewbox=68.1,37.1,97.4,6.5`);
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
    throw new Error('Not found');
  } catch (err) {
    updateStatus('Location Not Found', '#ef4444');
    speak(`I couldn't find ${placeName}`);
    return null;
  }
}

// Public Overpass servers are often overloaded, so try several mirrors in turn.
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

async function queryOverpass(query) {
  let lastErr;
  for (const [i, url] of OVERPASS_SERVERS.entries()) {
    if (i > 0) updateStatus(`Map server busy, trying mirror ${i + 1}/${OVERPASS_SERVERS.length}...`, '#f59e0b');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.warn('Overpass mirror failed:', url, err.message);
    }
  }
  throw lastErr;
}

async function findPOIs(queryType, tag, lat, lon, emoji) {
  updateStatus(`Scanning OSM database...`, '#f59e0b');
  
  // FIX: Reduced radius to 3km, capped results at 25, strict 10s timeout to prevent crash
  const query = `[out:json][timeout:10];nwr["${queryType}"="${tag}"](around:3000,${lat},${lon});out center 25;`;
  
  try {
    const data = await queryOverpass(query);
    
    if (data.elements && data.elements.length > 0) {
      data.elements.forEach(el => {
        const pLat = el.center ? el.center.lat : el.lat;
        const pLon = el.center ? el.center.lon : el.lon;
        const pName = el.tags && el.tags.name ? el.tags.name : tag;
        addCustomMarker(pLat, pLon, pName, emoji);
      });
      map.setView([lat, lon], 12); 
      updateStatus(`Found ${data.elements.length} locations`, '#10b981');
      speak(`Found nearby locations`);
    } else {
      updateStatus(`No results found`, '#f43f5e');
      speak(`No locations found nearby`);
    }
  } catch (e) {
    console.error("OVERPASS ERROR:", e.message);
    updateStatus('Map data servers busy. Try again in a minute', '#f59e0b');
    speak('The map data servers are busy right now. Please try again in a minute.');
  }
}

// ==========================================
// 5. MARKER ENGINE & PDF EXPORT
// ==========================================
function addCustomMarker(lat, lon, name, emoji = '📍') {
  const icon = L.divIcon({ className: 'emoji-pin', html: `<div>${emoji}</div>`, iconSize: [36, 36], iconAnchor: [18, 36] });
  const marker = L.marker([lat, lon], { icon }).addTo(markersGroup);
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  
  marker.id = id;
  marker.placeName = name.toLowerCase();
  
  marker.bindPopup(`<div style="text-align:center; font-family:'Outfit',sans-serif;">
                      <span style="font-size:24px;">${emoji}</span><br>
                      <b>${name}</b>
                    </div>`).openPopup();
                    
  activeMarkers.push({ id, lat, lon, name, emoji });
  updateDrawer();
}

function removeMarker(id) {
  markersGroup.eachLayer(layer => { if (layer.id === id) markersGroup.removeLayer(layer); });
  activeMarkers = activeMarkers.filter(m => m.id !== id);
  updateDrawer();
}

window.removeMarker = removeMarker;
window.flyToLocation = (lat, lon) => map.flyTo([lat, lon], 15);

function updateDrawer() {
  elements.markerList.innerHTML = '';
  if (activeMarkers.length === 0) {
    elements.markerList.innerHTML = '<li class="empty-state">No markers on the map yet.</li>';
    return;
  }
  
  [...activeMarkers].reverse().forEach(m => {
    const li = document.createElement('li');
    li.className = 'marker-item';
    li.innerHTML = `
      <div class="marker-info" onclick="window.flyToLocation(${m.lat}, ${m.lon})">
        <h4>${m.emoji} ${m.name.split(',')[0]}</h4>
        <p>${m.lat.toFixed(4)}, ${m.lon.toFixed(4)}</p>
      </div>
      <button class="delete-btn" onclick="window.removeMarker('${m.id}')">✕</button>
    `;
    elements.markerList.appendChild(li);
  });
}

function exportPDF() {
  if (activeMarkers.length === 0) {
    alert("No markers to export!");
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape'); 
  
  doc.setFontSize(22);
  doc.text("Exported Map Data", 14, 22);
  doc.setFontSize(11);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
  
  const tableColumn = ["Category", "Location Name", "Coordinates (Lat, Lon)", "Google Maps Link"];
  const tableRows = [];

  // NEW: Dictionary to convert emojis to clean text for the PDF
  const pdfCategoryMap = {
    '☕': 'Cafe', '🍽️': 'Restaurant', '🥐': 'Bakery', '🏥': 'Hospital', 
    '🩺': 'Clinic', '💊': 'Pharmacy', '🚓': 'Police', '🚒': 'Fire Dept', 
    '🏧': 'ATM', '🏦': 'Bank', '⚡': 'EV Station', '🚌': 'Bus Stop', 
    '✈️': 'Airport', '🌳': 'Park', '🌷': 'Garden', '🎢': 'Theme Park', 
    '🏨': 'Hotel', '🛍️': 'Mall', '🛒': 'Supermarket', '🍻': 'Pub', 
    '🍺': 'Bar', '📍': 'Pinned Location'
  };

  activeMarkers.forEach(m => {
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lon}`;
    
    // Safely map the emoji to text, fallback to 'Custom POI' if missing
    const cleanCategory = pdfCategoryMap[m.emoji] || 'Custom POI'; 
    
    tableRows.push([ cleanCategory, m.name, `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}`, mapLink ]);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 40,
    theme: 'grid',
    styles: { overflow: 'linebreak', cellWidth: 'wrap', font: 'helvetica' },
    columnStyles: { 
      0: { cellWidth: 35, halign: 'center' }, // Made this slightly wider for the text
      1: { cellWidth: 65 }, 
      2: { cellWidth: 50 }, 
      3: { cellWidth: 'auto', textColor: [37, 99, 235] } 
    },
    didDrawCell: function(data) {
      if (data.section === 'body' && data.column.index === 3) {
        doc.textWithLink(data.cell.text[0], data.cell.x + 2, data.cell.y + 5, { url: data.cell.text[0] });
        data.cell.text = [""]; 
      }
    }
  });
  
  doc.save('Voice_GIS_Markers.pdf');
}

// ==========================================
// 6. COMMAND ENGINE (parsing lives in commands.js)
// ==========================================
function setLayer(name, label) {
  map.removeLayer(currentLayer); layers[name].addTo(map); currentLayer = layers[name];
  updateStatus(label, '#10b981'); speak(`${label} on`);
}

// Shows the user what the app understood, so a misheard command is obvious at a glance
const title = s => (s || '').replace(/\b\w/g, c => c.toUpperCase());
function showInterpretation(r, place) {
  const fixed = place && r.slot && place !== r.slot ? ` (heard "${r.slot}")` : '';
  const what = {
    POI: () => `Search ${r.tag?.replace(/_/g, ' ')} near ${title(place)}${fixed}`,
    NAVIGATE: () => `Go to ${title(place)}${fixed}`,
    ADD_MARKER: () => `Add marker at ${title(place)}${fixed}`,
    REMOVE_MARKER: () => `Remove marker: ${title(r.slot)}`,
    CLEAR_ALL: () => 'Clear all markers',
    LAYER: () => `Switch to ${r.slot} view`,
    ZOOM_IN: () => 'Zoom in',
    ZOOM_OUT: () => 'Zoom out',
    UNSUPPORTED_POI: () => `Can't search for "${r.slot}" yet`,
  }[r.intent];
  elements.interpretation.innerText = what ? `→ ${what()}` : '→ Not understood. Try e.g. "Find hospitals in Pune"';
  elements.interpretation.classList.toggle('bad', !what || r.intent === 'UNSUPPORTED_POI');
}

async function processVoiceCommand(text) {
  const r = parse(text);
  // Repair near-miss Indian place names ("Puna" -> Pune, "Surad" -> Surat) before geocoding
  const place = r.slot && ['POI', 'NAVIGATE', 'ADD_MARKER'].includes(r.intent) ? correctPlace(r.slot) : r.slot;
  showInterpretation(r, place);

  switch (r.intent) {
    case 'REMOVE_MARKER': {
      const markersToKill = matchMarkers(r.slot, activeMarkers);
      if (markersToKill.length > 0) {
        const label = markersToKill[0].name.split(',')[0];
        markersToKill.forEach(m => removeMarker(m.id));
        updateStatus(`Removed ${label}`, '#10b981');
        speak(`Removed marker from ${label}`);
      } else {
        updateStatus(`Not found: ${r.slot}`, '#f43f5e');
        speak(`I couldn't find a marker for ${r.slot}`);
      }
      return;
    }

    case 'CLEAR_ALL':
      markersGroup.clearLayers();
      activeMarkers = [];
      updateDrawer();
      updateStatus('Map Cleared', '#10b981');
      speak('Cleared all markers');
      return;

    case 'LAYER':
      if (r.slot === 'satellite') return setLayer('satellite', 'Satellite View');
      if (r.slot === 'terrain') return setLayer('terrain', 'Terrain View');
      return setLayer('road', 'Road Map');

    case 'ZOOM_IN': map.zoomIn(); updateStatus('Zoomed In', '#10b981'); speak('Zooming in'); return;
    case 'ZOOM_OUT': map.zoomOut(); updateStatus('Zoomed Out', '#10b981'); speak('Zooming out'); return;

    case 'POI': {
      const locData = await geocode(place);
      if (!locData) return;
      findPOIs(r.type, r.tag, locData.lat, locData.lon, r.emoji);
      return;
    }

    case 'UNSUPPORTED_POI':
      updateStatus('Unsupported search', '#f43f5e');
      speak(`Sorry, I don't know how to search for ${r.slot} yet.`);
      return;

    case 'ADD_MARKER': {
      const loc = await geocode(place);
      if (loc) {
        map.flyTo([loc.lat, loc.lon], 12);
        addCustomMarker(loc.lat, loc.lon, loc.name);
        updateStatus(`Marked ${place}`, '#10b981');
        speak(`Marker added at ${place}`);
      }
      return;
    }

    case 'NAVIGATE': {
      const loc = await geocode(place);
      if (loc) {
        map.flyTo([loc.lat, loc.lon], 13);
        updateStatus(`Navigating to ${place}`, '#10b981');
        speak(`Navigating to ${place}`);
      }
      return;
    }

    default:
      updateStatus('Command not recognized', '#f43f5e');
      speak("I didn't understand that command. Please try again.");
  }
}

// ==========================================
// MANUAL CLICK-TO-DROP MARKER LOGIC
// ==========================================
let isPlacingMarker = false;
const manualBtn = document.getElementById('manual-marker-btn');

manualBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // FIX: Prevents the button click from instantly triggering a map click
  isPlacingMarker = !isPlacingMarker;
  
  if (isPlacingMarker) {
    manualBtn.classList.add('active');
    manualBtn.innerText = '❌ Cancel Pin Drop';
    
    // FIX: Literally turns your mouse cursor into a map pin!
    map.getContainer().style.cursor = "url('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png') 12 41, crosshair";
    
    updateStatus('Click anywhere on map to drop pin', '#f59e0b');
  } else {
    cancelManualMarker();
  }
});

function cancelManualMarker() {
  isPlacingMarker = false;
  manualBtn.classList.remove('active');
  manualBtn.innerText = '📍 Add Pin manually';
  map.getContainer().style.cursor = ''; // Resets the cursor back to normal pointer
  if (!elements.statusTag.innerText.includes('Error')) {
    updateStatus('Ready', '#10b981');
  }
}

map.on('click', async (e) => {
  if (!isPlacingMarker) return; 
  
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  
  // Reset the UI and cursor immediately after they click the map
  cancelManualMarker();
  updateStatus('Identifying location...', '#f59e0b');
  
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    const data = await res.json();
    
    let placeName = "Custom Location";
    if (data.name) placeName = data.name;
    else if (data.address && data.address.city) placeName = data.address.city;
    else if (data.address && data.address.town) placeName = data.address.town;
    else if (data.address && data.address.village) placeName = data.address.village;
    
    addCustomMarker(lat, lon, placeName, '📍');
    updateStatus(`Marked ${placeName}`, '#10b981');
    speak('Marker placed.');
  } catch (err) {
    addCustomMarker(lat, lon, "Custom Location", '📍');
    updateStatus('Marked Custom Location', '#10b981');
  }
});