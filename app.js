import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0';

// ==========================================
// 1. MAP INITIALIZATION & LAYERS
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
  rightPanel: document.getElementById('right-panel')
};

// Panel Collapse Logic (Corrected Arrows)
elements.leftCollapse.addEventListener('click', () => {
  elements.leftPanel.classList.toggle('collapsed');
  elements.leftCollapse.innerText = elements.leftPanel.classList.contains('collapsed') ? '🔽' : '🔼';
});

elements.rightCollapse.addEventListener('click', () => {
  elements.rightPanel.classList.toggle('collapsed');
  elements.rightCollapse.innerText = elements.rightPanel.classList.contains('collapsed') ? '🔽' : '🔼';
});

// Clickable Sample Commands Logic
document.querySelectorAll('.cmd-chip').forEach(chip => {
  chip.addEventListener('click', (e) => {
    const cmd = e.target.innerText;
    elements.cmdInput.value = cmd; // Fills the input box visually
    handleInput(cmd); // Immediately processes it
  });
});

// Input & Controls
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
    processVoiceCommand(text.toLowerCase().trim());
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
// 3. OFFLINE WHISPER AI (TRANSFORMERS.JS)
// ==========================================
env.allowLocalModels = false; // Fetch quantized model from Hugging Face

let transcriber = null;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let audioContext;

async function loadWhisperModel() {
  updateStatus('Loading Offline AI...', '#f59e0b');
  elements.micBtn.disabled = true;
  elements.btnText.innerText = 'Loading AI...';
  
  try {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
    updateStatus('AI Ready (Offline)', '#10b981');
    elements.micBtn.disabled = false;
    elements.btnText.innerText = 'Listen';
  } catch (error) {
    console.error("Failed to load model:", error);
    updateStatus('AI Load Failed', '#ef4444');
  }
}

// Start loading the AI model immediately
loadWhisperModel();

elements.micBtn.addEventListener('click', async () => {
  if (!transcriber) return;
  if (!isRecording) startRecording();
  else stopRecording();
});

async function startRecording() {
  try {
    // Inside startRecording(), change the getUserMedia line to this:
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
    updateStatus('Recording...', '#f43f5e');

  } catch (err) {
    console.error("Microphone access denied:", err);
    updateStatus('Mic Access Denied', '#ef4444');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
  
  isRecording = false;
  elements.micBtn.classList.remove('listening');
  elements.btnText.innerText = 'Processing...';
  updateStatus('Transcribing Locally...', '#f59e0b');
}

async function processAudioData() {
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const audioData = audioBuffer.getChannelData(0);

  try {
    const output = await transcriber(audioData);
    const transcript = output.text.trim();
    
    // Reset button text
    elements.btnText.innerText = 'Listen';

    if (transcript) {
      elements.transcript.innerText = `"${transcript}"`;
      processVoiceCommand(transcript.toLowerCase());
    } else {
      updateStatus('No speech detected', '#f43f5e');
      speak('I did not catch that.');
    }
  } catch (err) {
    console.error("Transcription error:", err);
    updateStatus('Transcription Error', '#ef4444');
    elements.btnText.innerText = 'Listen';
  }
}

// ==========================================
// 4. GEOCODING & POI DATABASE (OSM)
// ==========================================
async function geocode(placeName) {
  updateStatus('Searching...');
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=1`);
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
    throw new Error('Not found');
  } catch (err) {
    updateStatus('Location Not Found', '#ef4444');
    speak(`I couldn't find ${placeName}`);
    return null;
  }
}

async function findPOIs(queryType, tag, lat, lon, emoji) {
  updateStatus(`Scanning OSM database...`, '#f59e0b');
  
  // FIX: Using 'nwr' (node, way, relation) to catch massive buildings like airports
  // FIX: Added 'out center' so polygons are reduced to a single latitude/longitude pin
  const query = `[out:json][timeout:15];nwr["${queryType}"="${tag}"](around:5000,${lat},${lon});out center 15;`;
  
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error('Rate Limited. Wait a minute.');
      throw new Error(`API Error`);
    }
    
    const data = await res.json();
    
    if (data.elements && data.elements.length > 0) {
      data.elements.forEach(el => {
        // Extract center lat/lon for polygons, or normal lat/lon for nodes
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
    // Graceful error handling instead of technical jargon
    updateStatus('Not available in database', '#f59e0b');
    speak('This data is currently unavailable or too large to fetch.');
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

// Expose these to the global window so HTML buttons can trigger them
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

  activeMarkers.forEach(m => {
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lon}`;
    tableRows.push([ m.emoji, m.name, `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}`, mapLink ]);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 40,
    theme: 'grid',
    styles: { overflow: 'linebreak', cellWidth: 'wrap', font: 'helvetica' },
    columnStyles: { 
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 70 },
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
// 6. COMMAND ENGINE & NLP DICTIONARY
// ==========================================
const poiDictionary = {
  'coffee': { type: 'amenity', tag: 'cafe', emoji: '☕' },
  'cafe': { type: 'amenity', tag: 'cafe', emoji: '☕' },
  'restaurant': { type: 'amenity', tag: 'restaurant', emoji: '🍽️' },
  'food': { type: 'amenity', tag: 'restaurant', emoji: '🍽️' },
  'bakery': { type: 'shop', tag: 'bakery', emoji: '🥐' },
  'hospital': { type: 'amenity', tag: 'hospital', emoji: '🏥' },
  'clinic': { type: 'amenity', tag: 'clinic', emoji: '🩺' },
  'pharmac': { type: 'amenity', tag: 'pharmacy', emoji: '💊' }, 
  'medical': { type: 'amenity', tag: 'pharmacy', emoji: '💊' },
  'police': { type: 'amenity', tag: 'police', emoji: '🚓' },
  'cop': { type: 'amenity', tag: 'police', emoji: '🚓' },
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
  'amusement': { type: 'tourism', tag: 'theme_park', emoji: '🎢' },
  'theme park': { type: 'tourism', tag: 'theme_park', emoji: '🎢' },
  'hotel': { type: 'tourism', tag: 'hotel', emoji: '🏨' },
  'mall': { type: 'shop', tag: 'mall', emoji: '🛍️' },
  'supermarket': { type: 'shop', tag: 'supermarket', emoji: '🛒' },
  'grocery': { type: 'shop', tag: 'supermarket', emoji: '🛒' }
};

async function processVoiceCommand(cmd) {
  // 1. Specific Marker Deletion
  const removeSpecific = cmd.match(/(?:remove|clear|delete) marker (?:from|at|in) (.+)/);
  if (removeSpecific) {
    const target = removeSpecific[1].trim();
    const markerToKill = activeMarkers.find(m => m.name.toLowerCase().includes(target));
    if (markerToKill) {
      removeMarker(markerToKill.id);
      updateStatus(`Removed: ${target}`, '#10b981');
      speak(`Removed marker from ${target}`);
    } else {
      updateStatus(`Not found: ${target}`, '#f43f5e');
      speak(`I couldn't find a marker for ${target}`);
    }
    return;
  }

  // 2. Clear All Markers
  if (/(?:clear|remove|delete) (?:all )?marker(?:s)?/.test(cmd) || cmd.includes('clear map')) {
    markersGroup.clearLayers();
    activeMarkers = [];
    updateDrawer();
    updateStatus('Map Cleared', '#10b981');
    speak('Cleared all markers');
    return;
  }

  // 3. POI Discovery Engine
  const poiMatch = cmd.match(/(?:find|show|search for) (.+) (?:near|in|around|at) (.+)/);
  if (poiMatch) {
    const rawIntent = poiMatch[1].toLowerCase();
    const location = poiMatch[2];
    
    let mappedCategory = null;
    for (const key in poiDictionary) {
      if (rawIntent.includes(key)) {
        mappedCategory = poiDictionary[key];
        break;
      }
    }

    if (!mappedCategory) {
      updateStatus(`Unsupported search`, '#f43f5e');
      speak(`Sorry, I don't know how to search for ${rawIntent} yet.`);
      return;
    }

    const locData = await geocode(location);
    if (!locData) return;
    
    findPOIs(mappedCategory.type, mappedCategory.tag, locData.lat, locData.lon, mappedCategory.emoji);
    return;
  }

  // 4. Add Custom Marker
  if (cmd.includes('add marker') || cmd.includes('mark')) {
    const place = cmd.replace(/add marker (?:at|in)|add marker|mark/g, '').trim();
    if (!place) return;
    const loc = await geocode(place);
    if (loc) {
      map.flyTo([loc.lat, loc.lon], 12);
      addCustomMarker(loc.lat, loc.lon, loc.name);
      updateStatus(`Marked ${place}`, '#10b981');
      speak(`Marker added at ${place}`);
    }
    return;
  }

  // 5. Standard Navigation
  if (cmd.includes('zoom to') || cmd.includes('go to') || cmd.includes('navigate to')) {
    const place = cmd.replace(/zoom to|go to|navigate to/g, '').trim();
    const loc = await geocode(place);
    if (loc) {
      map.flyTo([loc.lat, loc.lon], 13);
      updateStatus(`Navigating to ${place}`, '#10b981');
      speak(`Navigating to ${place}`);
    }
    return;
  }

  // 6. Map Layer Controls (Fixed with returns)
  if (cmd.includes('satellite')) { 
    map.removeLayer(currentLayer); layers.satellite.addTo(map); currentLayer = layers.satellite; 
    updateStatus('Satellite View', '#10b981'); speak('Satellite view on'); return; 
  }
  if (cmd.includes('road')) { 
    map.removeLayer(currentLayer); layers.road.addTo(map); currentLayer = layers.road; 
    updateStatus('Road Map', '#10b981'); speak('Road map on'); return; 
  }
  if (cmd.includes('terrain')) { 
    map.removeLayer(currentLayer); layers.terrain.addTo(map); currentLayer = layers.terrain; 
    updateStatus('Terrain View', '#10b981'); speak('Terrain view on'); return; 
  }
  
  // 7. Zoom Controls (Fixed with returns)
  if (cmd.includes('zoom in')) { map.zoomIn(); updateStatus('Zoomed In', '#10b981'); speak('Zooming in'); return; }
  if (cmd.includes('zoom out')) { map.zoomOut(); updateStatus('Zoomed Out', '#10b981'); speak('Zooming out'); return; }

  // 8. The Absolute Fallback
  // If the command reaches this line, it truly matched absolutely nothing above.
  updateStatus('Command not recognized', '#f43f5e');
  speak("I didn't understand that command. Please try again.");
}