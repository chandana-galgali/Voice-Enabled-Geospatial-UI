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

const elements = {
  micBtn: document.getElementById('mic-btn'),
  btnText: document.getElementById('btn-text'),
  transcript: document.getElementById('transcript'),
  statusTag: document.getElementById('status-tag'),
  cmdInput: document.getElementById('cmd-input'),
  sendBtn: document.getElementById('send-btn'),
  ttsToggle: document.getElementById('tts-toggle'),
  markerList: document.getElementById('marker-list'),
  exportBtn: document.getElementById('export-btn')
};

// --- LIGHTWEIGHT NLP INTENT DICTIONARY ---
// Maps user keywords to official OSM tags (queryType and tag value)
const poiDictionary = {
  // Food & Drink
  'coffee': { type: 'amenity', tag: 'cafe', emoji: '☕' },
  'cafe': { type: 'amenity', tag: 'cafe', emoji: '☕' },
  'restaurant': { type: 'amenity', tag: 'restaurant', emoji: '🍽️' },
  'food': { type: 'amenity', tag: 'restaurant', emoji: '🍽️' },
  
  // Medical
  'hospital': { type: 'amenity', tag: 'hospital', emoji: '🏥' },
  'clinic': { type: 'amenity', tag: 'clinic', emoji: '🩺' },
  'pharmacy': { type: 'amenity', tag: 'pharmacy', emoji: '💊' },
  'medical': { type: 'amenity', tag: 'pharmacy', emoji: '💊' },

  // Emergency & Services
  'police': { type: 'amenity', tag: 'police', emoji: '🚓' },
  'cop': { type: 'amenity', tag: 'police', emoji: '🚓' },
  'fire': { type: 'amenity', tag: 'fire_station', emoji: '🚒' },
  'atm': { type: 'amenity', tag: 'atm', emoji: '🏧' },
  
  // Transport
  'ev': { type: 'amenity', tag: 'charging_station', emoji: '⚡' },
  'charging': { type: 'amenity', tag: 'charging_station', emoji: '⚡' },
  'bus': { type: 'highway', tag: 'bus_stop', emoji: '🚌' },
  'airport': { type: 'aeroway', tag: 'aerodrome', emoji: '✈️' },
  'flight': { type: 'aeroway', tag: 'aerodrome', emoji: '✈️' },

  // Leisure & Tourism
  'park': { type: 'leisure', tag: 'park', emoji: '🌳' },
  'garden': { type: 'leisure', tag: 'garden', emoji: '🌷' },
  'amusement': { type: 'tourism', tag: 'theme_park', emoji: '🎢' },
  'theme park': { type: 'tourism', tag: 'theme_park', emoji: '🎢' },
  'hotel': { type: 'tourism', tag: 'hotel', emoji: '🏨' }
};

// Event Listeners
elements.sendBtn.addEventListener('click', () => handleInput(elements.cmdInput.value));
elements.cmdInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleInput(elements.cmdInput.value));
elements.ttsToggle.addEventListener('click', () => {
  voiceFeedbackEnabled = !voiceFeedbackEnabled;
  elements.ttsToggle.innerText = voiceFeedbackEnabled ? '🔊' : '🔇';
  updateStatus(voiceFeedbackEnabled ? 'Audio On' : 'Audio Off', '#a18cd1');
});
elements.exportBtn.addEventListener('click', exportPDF);

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

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  let isListening = false;

  elements.micBtn.addEventListener('click', () => isListening ? recognition.stop() : recognition.start());
  
  recognition.onstart = () => {
    isListening = true;
    elements.micBtn.classList.add('listening');
    elements.btnText.innerText = 'Stop';
    updateStatus('Listening...', '#f43f5e');
  };
  
  recognition.onend = () => {
    isListening = false;
    elements.micBtn.classList.remove('listening');
    elements.btnText.innerText = 'Listen';
    updateStatus('Ready', '#10b981');
  };
  
  recognition.onresult = (e) => {
    let transcript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) transcript += e.results[i][0].transcript;
    }
    if(transcript) handleInput(transcript);
  };
} else {
  elements.micBtn.disabled = true;
  updateStatus('Browser Unsupported', '#ef4444');
}

// Geocoding Helper
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

// Robust Overpass API for POIs
async function findPOIs(queryType, tag, lat, lon, emoji) {
  updateStatus(`Scanning OSM database...`);
  
  // Reduced radius to 8000m to prevent timeouts, added timeout:15 parameter to force API stability
  const query = `[out:json][timeout:15];node["${queryType}"="${tag}"]["name"](around:8000,${lat},${lon});out 10;`;
  
  try {
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('API Rate Limit or Timeout');
    
    const data = await res.json();
    if (data.elements && data.elements.length > 0) {
      data.elements.forEach(el => addCustomMarker(el.lat, el.lon, el.tags.name, emoji));
      map.setView([lat, lon], 12); 
      updateStatus(`Found ${data.elements.length} locations`, '#10b981');
      speak(`Found nearby locations`);
    } else {
      updateStatus(`No results found`, '#f43f5e');
      speak(`No locations found nearby`);
    }
  } catch (e) {
    console.error(e);
    updateStatus('Database Timeout/Error', '#ef4444');
    speak('The mapping database took too long to respond. Please try again.');
  }
}

// Marker Engine
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

function updateDrawer() {
  const markerList = document.getElementById('marker-list');
  markerList.innerHTML = '';
  if (activeMarkers.length === 0) {
    markerList.innerHTML = '<li class="empty-state">No markers on the map yet.</li>';
    return;
  }
  
  [...activeMarkers].reverse().forEach(m => {
    const li = document.createElement('li');
    li.className = 'marker-item';
    li.innerHTML = `
      <div class="marker-info" onclick="map.flyTo([${m.lat}, ${m.lon}], 15)">
        <h4>${m.emoji} ${m.name.split(',')[0]}</h4>
        <p>${m.lat.toFixed(4)}, ${m.lon.toFixed(4)}</p>
      </div>
      <button class="delete-btn" onclick="removeMarker('${m.id}')">✕</button>
    `;
    markerList.appendChild(li);
  });
}

// Export to PDF Function
function exportPDF() {
  if (activeMarkers.length === 0) {
    alert("No markers to export!");
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape'); 
  
  doc.setFontSize(22);
  doc.text("Exported Map Data - Chandana Galgali", 14, 22);
  doc.setFontSize(11);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
  
  const tableColumn = ["Category", "Location Name", "Coordinates (Lat, Lon)", "Google Maps Link"];
  const tableRows = [];

  activeMarkers.forEach(m => {
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lon}`;
    tableRows.push([
      m.emoji,
      m.name,
      `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}`,
      mapLink
    ]);
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

// Core Command Engine
async function processVoiceCommand(cmd) {
  
  // 1. Remove SPECIFIC Marker
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
    }
    return;
  }

  // 2. Clear All Markers
  if (/(?:clear|remove|delete) (?:all )?marker(?:s)?/.test(cmd) || cmd.includes('clear map')) {
    markersGroup.clearLayers();
    activeMarkers = [];
    updateDrawer();
    updateStatus('Map Cleared');
    speak('Cleared all markers');
    return;
  }

  // 3. Find POIs via Intent Dictionary
  const poiMatch = cmd.match(/(?:find|show|search for) (.+) (?:near|in|around|at) (.+)/);
  if (poiMatch) {
    const rawIntent = poiMatch[1].toLowerCase();
    const location = poiMatch[2];
    
    // Check if the requested word exists in our dictionary
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

  // 4. Add Marker
  if (cmd.includes('add marker') || cmd.includes('mark')) {
    const place = cmd.replace(/add marker (?:at|in)|add marker|mark/g, '').trim();
    if (!place) return;
    const loc = await geocode(place);
    if (loc) {
      map.flyTo([loc.lat, loc.lon], 12);
      addCustomMarker(loc.lat, loc.lon, loc.name);
      speak(`Marker added at ${place}`);
    }
    return;
  }

  // 5. Navigate / Zoom To
  if (cmd.includes('zoom to') || cmd.includes('go to')) {
    const place = cmd.replace(/zoom to|go to/g, '').trim();
    const loc = await geocode(place);
    if (loc) {
      map.flyTo([loc.lat, loc.lon], 13);
      updateStatus(`Navigating to ${place}`);
      speak(`Navigating to ${place}`);
    }
    return;
  }

  // 6. Layer Controls
  if (cmd.includes('satellite')) { map.removeLayer(currentLayer); layers.satellite.addTo(map); currentLayer = layers.satellite; updateStatus('Satellite View'); speak('Satellite view on'); }
  else if (cmd.includes('road')) { map.removeLayer(currentLayer); layers.road.addTo(map); currentLayer = layers.road; updateStatus('Road Map'); speak('Road map on'); }
  else if (cmd.includes('terrain')) { map.removeLayer(currentLayer); layers.terrain.addTo(map); currentLayer = layers.terrain; updateStatus('Terrain View'); speak('Terrain view on'); }
  
  // 7. Zoom Controls
  else if (cmd.includes('zoom in')) { map.zoomIn(); updateStatus('Zoomed In'); speak('Zooming in'); }
  else if (cmd.includes('zoom out')) { map.zoomOut(); updateStatus('Zoomed Out'); speak('Zooming out'); }
}