# 🚀 Voice-Enabled User Interface for Geospatial Web Applications

**Built By:** Chandana Galgali 

---

## 📜 Official Problem Statement
Develop a library or proof-of-concept for voice-enabled user-interface for geospatial map based web applications. The solution should be lightweight and scalable and preferably leverage GPUs/NPUs available on modern devices rather than online libraries for voice command recognition.

### Objectives
* Develop a voice-activated system that can accurately interpret and execute user commands related to user interface of map based web application.
* Demonstrate integration/compatibility with existing web GIS applications using libraries such as Leaflet and OpenLayers.
* Ensure the system is user-friendly and accessible, even for non-technical users.
* Utilize the computational power of GPUs/NPUs to enhance the performance and responsiveness of the system.

### Expected Outcomes
* A fully functional prototype of a voice-activated geospatial web GIS system.
* Demonstration of the system's ability to process voice commands and execute geospatial queries. For e.g. Please zoom to Ahmedabad, please show me the road layer, please show me the highways.
* An evaluation report detailing the system's performance, including speed, accuracy.

### Dataset Required
* Open access WMS services and their descriptions for e.g. OSM layers, WMS Services from Bhoonidhi/Bhuvan, NASA Worldview. Copernicus etc

---

## ✨ Key Technical Innovations & Highlights

1. **True On-Device Offline AI (Whisper Model):** Powered by Hugging Face `transformers.js` running OpenAI's quantized `Whisper-tiny.en` model directly in the browser. Audio transcription runs entirely on the client-side using local GPU acceleration (WebGL), guaranteeing full offline functionality and maximum privacy.
2. **Intent-Driven POI Engine:** Uses an extensive NLP dictionary mapping natural speech variations (e.g., "coffee", "cafes", "espresso") to OpenStreetMap tags (`amenity=cafe`) via the **OSM Overpass API**.
3. **Data Export & Portability:** Custom **PDF Exporter** (`jsPDF`) generates downloadable map summary reports with coordinates and clickable Google Maps links.
4. **Adaptive Glassmorphic UI:** Mobile-responsive, collapsible floating control panels with text fallback options, live speech transcription displays, and Text-to-Speech (TTS) voice responses.
5. **Multi-Modal Input & Feedback:** Users can interact via Voice or Text, and the system responds with both visual status tags and optional audio speech feedback.

## 🛠️ Tools and Technology Used
| Category | Technology |
| :--- | :--- |
| **Languages** | HTML5, CSS3, JavaScript (ES6 Modules) |
| **AI / Speech Engine** | Hugging Face Transformers.js (`Xenova/whisper-tiny.en` via WebGL) |
| **GIS Libraries** | Leaflet.js |
| **Data & APIs** | OpenStreetMap WMS, Nominatim Geocoding API, Overpass API |
| **Export Engine** | jsPDF, jsPDF-AutoTable |

## 🚀 How to Run the Project
1. Clone this repository to your local machine.
2. Serve `index.html` via a local web server (e.g., VS Code *Live Server* or `python -m http.server`).
3. Allow microphone access when prompted.
4. Wait for the status indicator to show **"AI Ready (Offline)"**.
5. Click **"Listen"** and speak commands like:
   * *"Zoom to Mumbai"*
   * *"Find hospitals near Delhi"*
   * *"Add marker at Bangalore"*
   * *"Show satellite view"*
   * *"Clear all markers"*

## 📂 Project Structure
* `index.html` - Core layout, UI components, and Leaflet map container.
* `style.css` - Custom glassmorphism styling, animations, and mobile-responsive media queries.
* `app.js` - Contains the GIS map initialization, TensorFlow.js voice integration, NLP intent dictionary, Overpass API querying, and PDF generation logic.