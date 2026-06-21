<p align="center">
  <img src="https://github.com/GuyAzria/home-organizer/blob/main/logo.png" alt="Home Organizer (HO) Logo" width="180">
</p>

<h1 align="center">Home Organizer (HO)</h1>

<p align="center">
  <strong>The complete AI-powered home inventory & smart voice assistant system for Home Assistant</strong>
</p>

<p align="center">
  <a href="https://github.com/GuyAzria/home-organizer/releases"><img src="https://img.shields.io/github/v/release/GuyAzria/home-organizer?style=flat-square" alt="Release"></a>
  <a href="https://github.com/GuyAzria/home-organizer/blob/main/LICENSE"><img src="https://img.shields.io/github/license/GuyAzria/home-organizer?style=flat-square&cacheSeconds=3600" alt="License"></a>
  <a href="https://github.com/hacs/integration"><img src="https://img.shields.io/badge/HACS-Custom-orange.svg?style=flat-square" alt="HACS"></a>
  <img src="https://img.shields.io/badge/Powered%20by-Google%20Gemini%20AI-blue.svg?style=flat-square" alt="AI API option">
</p>

---

Home Organizer is a dedicated full-screen application for your Home Assistant sidebar[cite: 1]. It allows you to manage your home inventory with ease using nested folders, live stock tracking, and a powerful **Google Gemini AI** integration that acts as your personal home assistant[cite: 1].

**Developed by Guy Azria.**[cite: 1]

---

## 🚀 What's New in the Latest Update

Our latest update transforms Home Organizer from a smart inventory manager into a fully interactive **Personal Home Assistant**[cite: 1].

### 🎙️ The Ultimate Voice Assistant Capabilities
HO can now be configured as your official **Home Assistant Conversation Agent**![cite: 1] You can speak naturally and ask for almost anything[cite: 1]:
* **Smart Shopping List:** Say *"Add eggs to the shopping list,"* *"Clear my shopping list,"* or even ***"Send my shopping list to WhatsApp."***[cite: 1]
* **Voice Inventory:** Add items directly to locations by saying, *"Add 3 batteries to the kitchen drawer."*[cite: 1]
* **Your Personal Sous-Chef:** Want to bake? Ask, *"How do I make a cheesecake?"*[cite: 1] The AI will instantly cross-reference your HO inventory, tell you what ingredients you have, offer to add missing ones to your shopping list, and guide you step-by-step[cite: 1]. It will even **add automatic Home Assistant reminders and timers** while you cook![cite: 1]
* **Smart Reminders Assistant:** Say, *"Remind me in an hour to pick up the kids."*[cite: 1] When the time comes, the reminder will return **as an audio voice message directly to the specific user's phone** who requested it![cite: 1]
* **Calendar Secretary:** Seamlessly manage your schedule. Just say, *"Add a meeting tomorrow morning with Mr. Bean,"* and it's booked[cite: 1].
* **Free-Speech HA Control:** Control your lights, switches, and devices using completely natural language, or ask for the time, weather, and daily news[cite: 1].

### 📱 `HOCameraApp` (Native Android Companion App) - Version: "2026.6.16"
Modern browsers often block camera and microphone access over local HTTP connections[cite: 1]. We built **HOCameraApp**—a native Android companion app that fixes this and adds serious magic[cite: 1]:
* **"Ghost Screen" & Shake-to-Speak:** Run the app silently in the background as a transparent overlay[cite: 1]. Enable "Shake to Speak" to wake the assistant with a simple shake—no need to say *"Hey Google"* or press any buttons![cite: 1]
* **🎧 Universal Bluetooth Control (AirPods Supported):** Full hardware button interception allows you to trigger the voice assistant using any Bluetooth headset (single/double clicks), even when the screen is locked or external music apps (like Spotify) are installed.
* **📺 Live Teleprompter Notification:** The Android Media Player widget (on the lock screen and quick settings) has been repurposed. Instead of showing static song details, it dynamically updates in real-time to display the exact words you are dictating to the Speech-To-Text engine.
* **🔋 Dynamic BT Toggle (Battery Saver):** A realtime `BT: ON/OFF` toggle button on the Ghost Screen. When ON, the app asserts absolute media dominance. When OFF, it completely destroys the internal media session and releases `AudioFocus`, returning full hardware control to your default music players to save battery.
* **🖖 Star Trek-Style Audio Cues:** Replaced standard system beeps with precise, generative `ToneGenerator` sequences. Opening the mic triggers a fast "Double-Chirp" (mimicking a Star Trek Combadge), and closing it plays a single acknowledgment blip.
* **🎙️ Continuous Smart Transcription:** The STT engine now operates in a continuous loop, automatically handling silence timeouts and seamlessly restarting itself to allow for long, uninterrupted dictation sessions.
* **Native Google STT:** Uses Google's highly accurate native Speech-to-Text engine, drastically outperforming local Whisper models[cite: 1].
* **Unblocked Camera:** Flawless, instant camera access for visual tasks (like barcode and invoice scanning) on local networks[cite: 1]. *(Note: Invoice and barcode scanning are visual features performed via the camera button, not via voice commands).*[cite: 1]

---

## 🛠️ Under the Hood: The Android Audio Architecture Hacks

Intercepting Bluetooth hardware buttons on modern Android devices (12+) requires complex workarounds. This release implements several "Production-Grade" hacks used by professional PTT (Push-To-Talk) apps like Zello:

1. **The "KeepAlive" A2DP Silence Loop:** Android OS and smart headsets will disable hardware media buttons if no audio is actively playing. To force the OS to recognize our app as the primary media client, we run a continuous `AudioTrack` loop playing absolute silence at `44.1kHz Stereo`. This keeps the Bluetooth A2DP channel open and locks routing to our app.
2. **Fake Media Metadata Injection:** Smart headsets (specifically Apple AirPods) will completely disable their physical touch controls on Android if they don't receive active Song/Artist metadata. We spoof this `MediaMetadata` via the `MediaSession` to trick the headset firmware into transmitting physical clicks.
3. **Android 12+ Background Launch Bypass:** Modern Android versions silently kill `BroadcastReceivers` attempting to launch a `ForegroundService` from the background. We bypassed this by routing the `ACTION_MEDIA_BUTTON` intent via `PendingIntent.GetService()` *directly* into the already-running Foreground Service's `OnStartCommand`.
4. **AVRCP Transport Control Catch-All:** Different smartphone manufacturers (especially Samsung) translate raw Bluetooth headset clicks (`KeyEvents`) into `TransportControls` before sending them to the app. We implemented explicit overrides for `OnPlay`, `OnPause`, `OnSkipToNext`, and `OnRewind` to ensure no matter how the OS translates the physical click, the Voice Assistant is triggered.

---

## 💡 Notes for Apple AirPods Users (on Android)

If you are using Apple AirPods with this app on an Android device, please note the following hardware limitations:
* **In-Ear Detection:** AirPods will not transmit hardware clicks unless they detect they are physically inside your ear.
* **The iOS Configuration Trick:** AirPods store their tap-gestures locally on their internal chip. For the best experience on Android, connect your AirPods to an iPhone/iPad first, go to Bluetooth settings, and configure the Double-Tap action to **"Play/Pause"** for both ears. Once reconnected to your Android device, the hardware clicks will be captured perfectly by HOCameraApp.

---

### 🧠 Processing Flexibility
Choose how your AI runs: **Local Only** (for ultimate privacy), **Cloud**, or a **Hybrid API** mode that utilizes the cloud but gracefully falls back to local processing if your connection drops[cite: 1].

---

## ✨ Core Features

### 🤖 Advanced AI Capabilities
* **Receipt & Invoice Scanning (Visual)** — Snap a photo or upload a PDF of your grocery receipt using the camera interface[cite: 1]. The AI will automatically extract all items, quantities, and intelligently map them to your existing home locations[cite: 1].
* **Auto-Categorization & Icons** — The AI automatically assigns the correct Main Category, Sub-category, Measurement Unit (Kg, Liter, Units), and a beautiful 3D icon to every item it processes[cite: 1].
* **Smart "Review" Pipeline** — AI-extracted items go into a secure "Review Tab."[cite: 1] Check, edit, confirm, or reject the AI's imports before they are permanently added[cite: 1].
* **Native Multilingual Support** — Chat and interact in English, Hebrew, Arabic, or any other language[cite: 1].

### 📦 Smart Inventory Management
* **Hierarchical Explorer** — Navigate through Rooms, Furniture, Shelves, and Boxes with unlimited depth[cite: 1].
* **Live Stock Tracking & Shopping Mode** — Instantly update stock[cite: 1]. When an item hits `0`, it is marked **Out of Stock** and sent directly to your Shopping List[cite: 1].
* **Date Tracking & Management Tools** — Track expiration dates, Rename, Move (Cut/Paste), Duplicate, and Delete functions[cite: 1].

### 📸 Camera & Visual Tools
* **AI Background Removal** — Take photos of your items directly in the app[cite: 1]. The built-in camera tool automatically filters out messy backgrounds to create clean, professional item thumbnails[cite: 1].
* **Visual Search** — Use photos to identify unknown items and locate where they are stored in your home[cite: 1].

---

## 📖 User Manual & Visual Guide

Welcome to Home Organizer![cite: 1] This step-by-step guide will walk you through setting up your home, managing your items, and unleashing the power of the AI Assistant[cite: 1].

### 1. Personalizing Your Settings (Language & Themes)
Click the **Gear Icon (⚙️)** in the top right corner of the navigation bar[cite: 1].
* **Language:** Select your preferred language and the entire interface—including text direction (LTR/RTL)—will instantly adapt[cite: 1].
* **Theme:** Choose between a sleek **Dark Theme** or a clean **Light Theme**[cite: 1].

<p align="center">
  <img src="images/16.png" width="48%" alt="Dark Theme View">
  <img src="images/23.png" width="48%" alt="Light Theme View">
</p>

### 2. Setting up Zones and Rooms
Click the **Pencil Icon (✏️)** in the top right to enter **Edit Mode**[cite: 1].
* Click **Add Zone** at the bottom to create broad areas like "First Floor"[cite: 1].
* Inside those zones, click the large green **+ Add Room** button to create specific rooms like "Kitchen"[cite: 1].
* *Tip: You can use the up (↑) and down (↓) arrows to reorder your zones and rooms!*[cite: 1]

<p align="center">
  <img src="images/1.png" width="32%" alt="Empty Root Screen">
  <img src="images/2.png" width="32%" alt="Adding First Floor">
  <img src="images/3.png" width="32%" alt="Multiple Zones Added">
</p>

### 3. Customizing Icons
While still in **Edit Mode (✏️)**, click the picture icon on the corner of your room folders to open the **Icon Picker**[cite: 1].
* Browse through hundreds of beautiful 3D icons, or use the **Upload File** button to paste an image URL directly![cite: 1]

<p align="center">
  <img src="images/4.png" width="48%" alt="Room Editing Options">
  <img src="images/5.png" width="48%" alt="Room Icon Picker Library">
</p>

### 4. Storage Locations & Sublocations
Click on a Room (e.g., Kitchen) to enter it[cite: 1]. Add a **Storage Location** (like "Fridge"), click into it, and add a **Sublocation** (like "Top Shelf")[cite: 1]. This hierarchy ensures you always know *exactly* where an item is[cite: 1].

<p align="center">
  <img src="images/6.png" width="48%" alt="Kitchen Storage Locations">
  <img src="images/7.png" width="48%" alt="Fridge Sublocations">
</p>

### 5. Adding and Managing Items manually
Turn off **Edit Mode**[cite: 1]. Navigate to a sublocation and click **+ Add** to create a new item manually[cite: 1].
* Categorize it, assign expiration dates, and use the Camera icon to snap a real photo of the item using the built-in AI Background Removal tool![cite: 1]

<p align="center">
  <img src="images/8.png" width="32%" alt="Item inside Sublocation">
  <img src="images/10.png" width="32%" alt="Expanded Item Details">
  <img src="images/9.png" width="32%" alt="Item Icon Library">
</p>

### 6. Grid View & Live Tracking
Use the **View Toggle** icon in the sub-bar to switch between a detailed List View and a beautiful visual **Grid View**[cite: 1]. Hit the **+** or **-** buttons to update how much of an item you have left[cite: 1].

<p align="center">
  <img src="images/11.png" width="48%" alt="Sublocation Grid View">
  <img src="images/16.png" width="48%" alt="Populated Fridge Grid View">
</p>

### 7. Invoice Scanning & AI Chat
Click the **Robot Icon (🤖)** in the top bar to open your personal AI Chat Assistant[cite: 1]. 
1. Click the **Camera Icon** or the **Upload Icon** to attach a grocery receipt[cite: 1].
2. The AI will read the receipt, translate it, map the items to your existing rooms, apply icons, and send them to your **Review Tab** (inside the Shopping Cart menu) for approval[cite: 1].
3. You can also chat naturally via text or voice to manage your inventory and HA devices[cite: 1].

<p align="center">
  <img src="images/22.png" width="24%" alt="Original Receipt/Invoice">
  <img src="images/12.png" width="24%" alt="AI Chat Ready with Attached File">
  <img src="images/13.png" width="24%" alt="Sending Prompt with File">
  <img src="images/20.png" width="24%" alt="AI Processed Invoice">
</p>

### 8. Setting up the Voice Assistant & HOCameraApp

**Part A: Set HO as Your HA Voice Assistant**
1. In your main Home Assistant menu, go to **Settings ➔ Voice Assistants**[cite: 1].
2. Click **+ Add Assistant**[cite: 1].
3. Under **Conversation Agent**, select **HO-AI Agent** (`conversation.ho_ai_agent`)[cite: 1]. Save[cite: 1].

**Part B: Install & Configure HOCameraApp (Android Users Only)**
1. Open the HO dashboard on your phone[cite: 1]. Go to the Chat screen, tap the Camera icon (📸), then the Gear icon (⚙️)[cite: 1]. Click **Download Android APK** and install[cite: 1].
2. Open the app and tap the Gear icon (⚙️) to open Settings[cite: 1].
3. **URL:** Enter your exact internal HA IP (e.g., `http://192.168.1.100:8123`)[cite: 1].
4. **Token:** Generate a Long-Lived Access Token in your HA profile[cite: 1].
5. **Device ID:** Find your phone under HA Settings ➔ Devices[cite: 1]. Look at your browser's address bar and copy the long string of characters at the very end of the URL[cite: 1]. *(Pro-tip: Do this on a PC and WhatsApp the Token and ID to yourself!)*[cite: 1]
6. Enable **Shake to Speak** to activate the Ghost Screen, choose your **Language**, and adjust the **Volume Override** so the assistant speaks aloud even if your phone is on silent![cite: 1]

---

## 📋 Requirements
* Home Assistant 2024.1.0 or newer[cite: 1]
* **Google Gemini API Key**: Required for AI chat, receipt scanning, and smart categorization[cite: 1].

## 📥 Installation

### Option 1: HACS (Recommended)
1. In Home Assistant, go to **HACS** > **Integrations**[cite: 1].
2. Open the menu (top right) and select **Custom repositories**[cite: 1].
3. Add `https://github.com/GuyAzria/home-organizer` as an **Integration**[cite: 1].
4. Click **Add**, find **Home Organizer**, select **Download**, and **Restart Home Assistant**[cite: 1].

### Option 2: Manual
1. Download the `custom_components/home_organizer` folder[cite: 1].
2. Copy it to your `config/custom_components/` directory and Restart Home Assistant[cite: 1].

## ⚙️ Setup
1. Navigate to **Settings** > **Devices & Services**[cite: 1].
2. Click **Add Integration** and search for **Home Organizer**[cite: 1].
3. Enter your **Google Gemini API Key** when prompted[cite: 1]. The Organizer icon will appear in your sidebar[cite: 1].

## 📄 License
This project is licensed under the MIT License[cite: 1]. See [LICENSE](LICENSE) for details[cite: 1].

---
<p align="center">Made with ❤️ for the Home Assistant community by Guy Azria</p>