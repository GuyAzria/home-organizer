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
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Cloud_AI-Google_Gemini-blue.svg?style=flat-square" alt="Google Gemini">
  <img src="https://img.shields.io/badge/Cloud_AI-OpenAI-412991.svg?style=flat-square" alt="OpenAI">
  <img src="https://img.shields.io/badge/Cloud_AI-Claude-D97757.svg?style=flat-square" alt="Claude">
  <img src="https://img.shields.io/badge/Local_AI-Ollama-black.svg?style=flat-square" alt="Ollama">
  <img src="https://img.shields.io/badge/Local_AI-LM_Studio-5A32FA.svg?style=flat-square" alt="LM Studio">
</p>

---

Home Organizer is a dedicated full-screen application for your Home Assistant sidebar. It allows you to manage your home inventory with ease using nested folders, live stock tracking, and a powerful **Cloud & Local AI** integration (Gemini, OpenAI, Claude, Ollama, LM Studio) that acts as your personal home assistant.

**Developed by Guy Azria.**

---

## 🚀 What's New in the Latest Update

Our latest update transforms Home Organizer from a smart inventory manager into a fully interactive **Personal Home Assistant**.

### 🎙️ The Ultimate Voice Assistant Capabilities
HO can now be configured as your official **Home Assistant Conversation Agent**! You can speak naturally and ask for almost anything:
* **Smart Shopping List:** Say *"Add eggs to the shopping list,"* *"Clear my shopping list,"* or even ***"Send my shopping list to WhatsApp."***
* **Voice Inventory:** Add items directly to locations by saying, *"Add 3 batteries to the kitchen drawer."*
* **Your Personal Sous-Chef:** Want to bake? Ask, *"How do I make a cheesecake?"* The AI will instantly cross-reference your HO inventory, tell you what ingredients you have, offer to add missing ones to your shopping list, and guide you step-by-step. It will even **add automatic Home Assistant reminders and timers** while you cook!
* **Smart Reminders Assistant:** Say, *"Remind me in an hour to pick up the kids."* When the time comes, the reminder will return **as an audio voice message directly to the specific user's phone** who requested it!
* **Calendar Secretary:** Seamlessly manage your schedule. Just say, *"Add a meeting tomorrow morning with Mr. Bean,"* and it's booked.
* **Free-Speech HA Control:** Control your lights, switches, and devices using completely natural language, or ask for the time, weather, and daily news.

### 📱 `HOCameraApp` (Native Android Companion App) - Version: "2026.6.16"
Modern browsers often block camera and microphone access over local HTTP connections. We built **HOCameraApp**—a native Android companion app that fixes this and adds serious magic:
* **"Ghost Screen" & Shake-to-Speak:** Run the app silently in the background as a transparent overlay. Enable "Shake to Speak" to wake the assistant with a simple shake—no need to say *"Hey Google"* or press any buttons!
* **🎧 Universal Bluetooth Control (AirPods Supported):** Full hardware button interception allows you to trigger the voice assistant using any Bluetooth headset (single/double clicks), even when the screen is locked or external music apps (like Spotify) are installed.
* **📺 Live Teleprompter Notification:** The Android Media Player widget (on the lock screen and quick settings) has been repurposed. Instead of showing static song details, it dynamically updates in real-time to display the exact words you are dictating to the Speech-To-Text engine.
* **🔋 Dynamic BT Toggle (Battery Saver):** A realtime `BT: ON/OFF` toggle button on the Ghost Screen. When ON, the app asserts absolute media dominance. When OFF, it completely destroys the internal media session and releases `AudioFocus`, returning full hardware control to your default music players to save battery.
* **🖖 Star Trek-Style Audio Cues:** Replaced standard system beeps with precise, generative `ToneGenerator` sequences. Opening the mic triggers a fast "Double-Chirp" (mimicking a Star Trek Combadge), and closing it plays a single acknowledgment blip.
* **🎙️ Continuous Smart Transcription:** The STT engine now operates in a continuous loop, automatically handling silence timeouts and seamlessly restarting itself to allow for long, uninterrupted dictation sessions.
* **Native Google STT:** Uses Google's highly accurate native Speech-to-Text engine, drastically outperforming local Whisper models.
* **Unblocked Camera:** Flawless, instant camera access for visual tasks (like barcode and invoice scanning) on local networks. *(Note: Invoice and barcode scanning are visual features performed via the camera button, not via voice commands).*

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
Choose how your AI runs: **Local Only** (for ultimate privacy), **Cloud**, or a **Hybrid API** mode that utilizes the cloud but gracefully falls back to local processing if your connection drops.

---

## ✨ Core Features

### 🤖 Advanced AI Capabilities
* **Receipt & Invoice Scanning (Visual)** — Snap a photo or upload a PDF of your grocery receipt using the camera interface. The AI will automatically extract all items, quantities, and intelligently map them to your existing home locations.
* **Auto-Categorization & Icons** — The AI automatically assigns the correct Main Category, Sub-category, Measurement Unit (Kg, Liter, Units), and a beautiful 3D icon to every item it processes.
* **Smart "Review" Pipeline** — AI-extracted items go into a secure "Review Tab." Check, edit, confirm, or reject the AI's imports before they are permanently added.
* **Native Multilingual Support** — Chat and interact in English, Hebrew, Arabic, or any other language.

### 📦 Smart Inventory Management
* **Hierarchical Explorer** — Navigate through Rooms, Furniture, Shelves, and Boxes with unlimited depth.
* **Live Stock Tracking & Shopping Mode** — Instantly update stock. When an item hits `0`, it is marked **Out of Stock** and sent directly to your Shopping List.
* **Date Tracking & Management Tools** — Track expiration dates, Rename, Move (Cut/Paste), Duplicate, and Delete functions.

### 📸 Camera & Visual Tools
* **AI Background Removal** — Take photos of your items directly in the app. The built-in camera tool automatically filters out messy backgrounds to create clean, professional item thumbnails.
* **Visual Search** — Use photos to identify unknown items and locate where they are stored in your home.

---

## 📖 User Manual & Visual Guide

Welcome to Home Organizer! This step-by-step guide will walk you through setting up your home, managing your items, and unleashing the power of the AI Assistant.

### 1. Personalizing Your Settings (Language & Themes)
Click the **Gear Icon (⚙️)** in the top right corner of the navigation bar.
* **Language:** Select your preferred language and the entire interface—including text direction (LTR/RTL)—will instantly adapt.
* **Theme:** Choose between a sleek **Dark Theme** or a clean **Light Theme**.

<p align="center">
  <img src="images/16.png" width="48%" alt="Dark Theme View">
  <img src="images/23.png" width="48%" alt="Light Theme View">
</p>

### 2. Setting up Zones and Rooms
Click the **Pencil Icon (✏️)** in the top right to enter **Edit Mode**.
* Click **Add Zone** at the bottom to create broad areas like "First Floor".
* Inside those zones, click the large green **+ Add Room** button to create specific rooms like "Kitchen".
* *Tip: You can use the up (↑) and down (↓) arrows to reorder your zones and rooms!*

<p align="center">
  <img src="images/1.png" width="32%" alt="Empty Root Screen">
  <img src="images/2.png" width="32%" alt="Adding First Floor">
  <img src="images/3.png" width="32%" alt="Multiple Zones Added">
</p>

### 3. Customizing Icons
While still in **Edit Mode (✏️)**, click the picture icon on the corner of your room folders to open the **Icon Picker**.
* Browse through hundreds of beautiful 3D icons, or use the **Upload File** button to paste an image URL directly!

<p align="center">
  <img src="images/4.png" width="48%" alt="Room Editing Options">
  <img src="images/5.png" width="48%" alt="Room Icon Picker Library">
</p>

### 4. Storage Locations & Sublocations
Click on a Room (e.g., Kitchen) to enter it. Add a **Storage Location** (like "Fridge"), click into it, and add a **Sublocation** (like "Top Shelf"). This hierarchy ensures you always know *exactly* where an item is.

<p align="center">
  <img src="images/6.png" width="48%" alt="Kitchen Storage Locations">
  <img src="images/7.png" width="48%" alt="Fridge Sublocations">
</p>

### 5. Adding and Managing Items manually
Turn off **Edit Mode**. Navigate to a sublocation and click **+ Add** to create a new item manually.
* Categorize it, assign expiration dates, and use the Camera icon to snap a real photo of the item using the built-in AI Background Removal tool!

<p align="center">
  <img src="images/8.png" width="32%" alt="Item inside Sublocation">
  <img src="images/10.png" width="32%" alt="Expanded Item Details">
  <img src="images/9.png" width="32%" alt="Item Icon Library">
</p>

### 6. Grid View & Live Tracking
Use the **View Toggle** icon in the sub-bar to switch between a detailed List View and a beautiful visual **Grid View**. Hit the **+** or **-** buttons to update how much of an item you have left.

<p align="center">
  <img src="images/11.png" width="48%" alt="Sublocation Grid View">
  <img src="images/16.png" width="48%" alt="Populated Fridge Grid View">
</p>

### 7. Invoice Scanning & AI Chat
Click the **Robot Icon (🤖)** in the top bar to open your personal AI Chat Assistant. 
1. Click the **Camera Icon** or the **Upload Icon** to attach a grocery receipt.
2. The AI will read the receipt, translate it, map the items to your existing rooms, apply icons, and send them to your **Review Tab** (inside the Shopping Cart menu) for approval.
3. You can also chat naturally via text or voice to manage your inventory and HA devices.

<p align="center">
  <img src="images/22.png" width="24%" alt="Original Receipt/Invoice">
  <img src="images/12.png" width="24%" alt="AI Chat Ready with Attached File">
  <img src="images/13.png" width="24%" alt="Sending Prompt with File">
  <img src="images/20.png" width="24%" alt="AI Processed Invoice">
</p>

### 8. Setting up the Voice Assistant & HOCameraApp

**Part A: Set HO as Your HA Voice Assistant**
1. In your main Home Assistant menu, go to **Settings ➔ Voice Assistants**.
2. Click **+ Add Assistant**.
3. Under **Conversation Agent**, select **HO-AI Agent** (`conversation.ho_ai_agent`). Save.

**Part B: Install & Configure HOCameraApp (Android Users Only)**
1. Open the HO dashboard on your phone. Go to the Chat screen, tap the Camera icon (📸), then the Gear icon (⚙️). Click **Download Android APK** and install.
2. Open the app and tap the Gear icon (⚙️) to open Settings.
3. **URL:** Enter your exact internal HA IP (e.g., `http://192.168.1.100:8123`).
4. **Token:** Generate a Long-Lived Access Token in your HA profile.
5. **Device ID:** Find your phone under HA Settings ➔ Devices. Look at your browser's address bar and copy the long string of characters at the very end of the URL. *(Pro-tip: Do this on a PC and WhatsApp the Token and ID to yourself!)*
6. Enable **Shake to Speak** to activate the Ghost Screen, choose your **Language**, and adjust the **Volume Override** so the assistant speaks aloud even if your phone is on silent!

---

## 📋 Requirements
* Home Assistant 2024.1.0 or newer
* **AI Provider API Key or Local URL**: Required for AI chat, receipt scanning, and smart categorization (Gemini, OpenAI, Claude, Ollama, or LM Studio).

## 📥 Installation

### Option 1: HACS (Recommended)
1. In Home Assistant, go to **HACS** > **Integrations**.
2. Open the menu (top right) and select **Custom repositories**.
3. Add `https://github.com/GuyAzria/home-organizer` as an **Integration**.
4. Click **Add**, find **Home Organizer**, select **Download**, and **Restart Home Assistant**.

### Option 2: Manual
1. Download the `custom_components/home_organizer` folder.
2. Copy it to your `config/custom_components/` directory and Restart Home Assistant.

## ⚙️ Setup
1. Navigate to **Settings** > **Devices & Services**.
2. Click **Add Integration** and search for **Home Organizer**.
3. Select your preferred **AI Provider** (Cloud or Local) and enter the relevant API Key or local URL when prompted. The Organizer icon will appear in your sidebar.

## 📄 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---
<p align="center">Made with ❤️ for the Home Assistant community by Guy Azria</p>