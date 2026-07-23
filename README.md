# 🚀 Voice-Enabled User Interface for Geospatial Web Applications

**ISRO Bharatiya Antariksh Hackathon 2024**

## 📜 Official Problem Statement
Develop a library or proof-of-concept for a voice-enabled user-interface for geospatial map-based web applications. The solution should be lightweight and scalable and preferably leverage GPUs/NPUs available on modern devices rather than online libraries for voice command recognition.

## 🎯 Objectives
* Develop a voice-activated system that can accurately interpret and execute user commands related to the user interface of a map-based web application.
* Demonstrate integration/compatibility with existing web GIS applications using libraries such as Leaflet and OpenLayers.
* Ensure the system is user-friendly and accessible, even for non-technical users.
* Utilize the computational power of GPUs/NPUs to enhance the performance and responsiveness of the system.

## ✨ Key Features Implemented
* **Real-Time Navigation:** Navigate to a specific location on the map via voice commands (e.g., "Zoom to Ahmedabad").
* **Layer Control:** Show or hide specific layers, such as satellite or terrain views (e.g., "Show road layer").
* **Zoom Controls:** Zoom in and out seamlessly using voice.
* **Marker Management:** Add markers dynamically based on voice inputs.
* **On-Device Processing:** Voice recognition is handled entirely on-device utilizing TensorFlow.js, maximizing privacy and minimizing reliance on online APIs.

## 🛠️ Tools and Technology Used
| Category | Technology |
| :--- | :--- |
| **Languages** | Python, JavaScript |
| **ML Frameworks** | TensorFlow.js (lightweight JS port of TensorFlow) |
| **GIS Libraries** | Leaflet |
| **Hardware** | GPU/NPU via WebGL libraries |

## 🚀 How to Run the Project
1. Clone this repository to your local machine.
2. Open the `index.html` file in any modern web browser.
3. Allow microphone permissions when prompted by the browser.
4. Click the "Start Listening" button.
5. Speak commands to interact with the map in real-time.