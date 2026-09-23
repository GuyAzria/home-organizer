<p align="center">
<img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/custom_components/home_organizer/brand/logo.png" alt="Home Organizer (HO) Logo" width="180">
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

Home Organizer is a dedicated full-screen application for your Home Assistant sidebar. It manages your home inventory with nested folders, live stock tracking, receipt scanning with price and expiry tracking, and a powerful **Cloud & Local AI** integration (Gemini, OpenAI, Claude, Ollama, LM Studio).

**Talking to it in plain language happens through Home Assistant's own conversation agent** — set HO-AI as your assistant once (see Step 8) and every device with Assist already talks to it: no separate chat screen inside the panel.

**Developed by Guy Azria.**

---
 ## 📥 Installation (Zero YAML Required! 🎉)
There is absolutely no need to write a single line of code or touch your `configuration.yaml` file. The entire installation and setup process is handled seamlessly through the Home Assistant UI!

**Home Organizer is in the official HACS default store.** For almost everyone, that means installation is two steps:

1. In Home Assistant, go to **HACS**, search for **Home Organizer**, open it, and click **Download**.
2. Restart Home Assistant (see Step 3 below).

No repository URL, no custom repository step — HACS already knows about it.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst3.png" width="80%" alt="Searching for Home Organizer in HACS">
</p>
<p align="center"><i>Search for “Home Organizer” directly in HACS and download it — no custom repository needed.</i></p>

### Prefer to install manually, or want the very latest commit before it reaches HACS?
You can still add the repository by hand:

1. In Home Assistant, go to **HACS**.
2. Open the top right menu (⋮) and select **Custom repositories**.
3. Paste `https://github.com/GuyAzria/home-organizer` into the Repository field, select **Integration** as the category, and click **ADD**.
4. Search for **Home Organizer** in the HACS search bar, click on it, and select **Download**.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst1.png" width="45%" alt="Adding Custom Repository URL">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst2.png" width="45%" alt="Home Organizer in Custom Repositories">
</p>
<p align="center"><i>Only needed for a manual install: paste the GitHub URL and verify Home Organizer is added to your custom repositories list.</i></p>

### Step 3: Restart Home Assistant
Go to **Settings** > **System** (or click the repair notification) and **Restart** Home Assistant to load the new files.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst4.png" width="80%" alt="Restart Home Assistant">
</p>
<p align="center"><i>A restart is required before Home Assistant can recognize the new integration.</i></p>

---

## ⚙️ Setup & Configuration

### Step 4: Add the Integration
Navigate to **Settings** > **Devices & Services**. Click the **+ Add Integration** button in the bottom right corner and search for **Home Organizer**.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst5.png" width="60%" alt="Add Integration Menu">
</p>
<p align="center"><i>Find Home Organizer in the official integrations list.</i></p>

### Step 5: Choose Your Architecture & Storage
The setup wizard will guide you through the initial configuration:
* **Processing Mode & AI Provider:** Choose how you want the AI to process your data—Local Only (for maximum privacy), Cloud Only, or a Hybrid approach.
* **Storage Method:** Choose where to store your database. **Highly Recommended:** Select `media` if your main Home Assistant drive is low on storage space. Because all item photos and scanned receipts are saved directly into the SQLite DB, the file size can grow significantly over time.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst6.png" width="60%" alt="Processing Mode and Storage Selection">
</p>
<p align="center"><i>Select your processing mode, primary AI provider, and preferred storage location.</i></p>

### Step 6: Enter API Keys & Connections
Depending on the AI provider you selected, you need to provide the correct connection details so Home Organizer can communicate with the AI:
* **Cloud Providers (Gemini/OpenAI/Claude):** Paste your secure API Key and the specific Model Name you want to use (e.g., `gemini-1.5-flash-latest`).
* **Local Providers (Ollama/LM Studio):** Enter the exact local URL of your AI server (ensure it ends with `/v1`) and the local API Key (type `ollama` or `local`). Then set **two** model names: a **Local Text Model** for ordinary questions and chat (e.g., `llama3:8b`), and a **Local Vision Model** for receipt and barcode photos — this one *must* support images (e.g., `llama3.2-vision`, `qwen2-vl`, `minicpm-v`). Most compact text models cannot see images at all, so leaving the vision field blank only works if your text model happens to support them too.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst7.png" width="60%" alt="API Keys Configuration - now with separate Local Text and Local Vision model fields">
</p>
<p align="center"><i>Carefully input your respective API keys and model names. Ensure local URLs include the port and end with /v1.</i></p>

### Step 7: Customize Trigger Words & Advanced Settings
Configure the voice keywords that will trigger specific AI actions. 
* **Multilingual Support:** You don't have to use English! You can write these trigger words in your native language (Hebrew, Spanish, etc.) so the assistant perfectly understands your natural speech.
* **⚠️ Danger Zone (`delete_on_remove`):** If you check this box, uninstalling the integration will **permanently delete** your entire Home Organizer database (including all your saved items, rooms, and images). It is highly recommended to leave this unchecked to keep your data safe in case you ever need to reinstall the integration!

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst8.png" width="60%" alt="Trigger Words and Advanced Settings">
</p>
<p align="center"><i>Set your custom wake words and carefully review the delete_on_remove checkbox.</i></p>

### Step 8: Welcome to Home Organizer!
Once the setup is complete, a new **HO-AI** icon will appear in your Home Assistant sidebar. 

**You do not start from nothing.** A brand new install arrives with a starter layout already in place — *Floor A ➔ Kitchen ➔ Fridge*, with its shelves, the door and the freezer — and with two recipes in every chapter of the cookbook. Rename them, delete them, or build around them. They are written once, on a genuinely new database, and never again, so nothing is ever re-created after you have tidied up.

**No Hidden Menus:** There are no complicated settings screens or hidden menus to learn! The entire interface is designed to be completely intuitive. Simply click the **Pencil icon (✏️)** in the top right corner to enter Edit Mode, and all your management options (adding, renaming, deleting, and changing icons) will instantly appear exactly where you need them. 

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst9.png" width="30%" alt="HO-AI Sidebar Icon">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst10.png" width="60%" alt="Home Organizer on first launch">
</p>
<p align="center"><i>Click the new HO-AI sidebar icon. Click the <b>Pencil icon (✏️)</b> in the top right corner to start shaping your rooms and adding items.</i></p>

 ### 2. Setting up Zones and Rooms
To start building your home layout, click the **Pencil Icon (✏️)** in the top right corner of the navigation bar to enter **Edit Mode**.

**Creating a Zone:**
Click the **Add Zone** button at the bottom of the screen to create a broad area. Then, click the small pencil icon next to the zone's title to rename it (for example, "FIRST FLOOR").

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst12.png" width="60%" alt="Adding a new Zone and Renaming">
</p>
<p align="center"><i>Click "Add Zone" (1), then use the pencil icon (2) to give your zone a custom name.</i></p>

**Adding a Room:**
Once your zone is ready, click the large green **+ Add Room** button inside it to create a specific room (like a Kitchen or a Garage).

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst11.png" width="60%" alt="Adding a Room">
</p>
<p align="center"><i>A new "kitchen" room has been added to the FIRST FLOOR zone. The blue and red icons indicate you are still in Edit Mode.</i></p>

### 3. Customizing Icons
While still in **Edit Mode (✏️)**, you can personalize the look of your rooms to make them easily recognizable. Click the small **picture icon** on the corner of any room folder to open the Icon Picker.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst13.png" width="45%" alt="Change Icon Modal">
</p>
<p align="center"><i>Click the picture icon (highlighted in red) to open the menu. Pick a built-in icon, paste an image URL, upload your own picture — or press <b>Draw with AI</b> and describe what you want in your own words.</i></p>
 
### 8. Setting up the Voice Assistant & HO_Mind_AI

**Part A: Set HO-AI as Your HA Conversation Agent**
To make Home Organizer the default "brain" for voice commands across your entire smart home:
1. In your main Home Assistant menu, navigate to **Settings** > **Voice assistants**.
2. Click on the default **Home Assistant** assistant (or click **+ Add Assistant** to create a new one).
3. In the window that opens, scroll down to the **Conversation agent** section and select **HO-AI Agent** from the dropdown menu. Save your changes.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/inst14.png" width="60%" alt="Selecting HO-AI Agent in Voice Assistants">
</p>
<p align="center"><i>Change the Conversation agent to HO-AI Agent so your new AI can process all incoming voice and text commands.</i></p>

**Part B: Install & Configure HO_Mind_AI (Android Users Only)**
1. Open the HO dashboard on your phone, open **Settings** (⚙️) in the top bar, and click **Download Android APK**. Install it.
2. Open the app and tap the Gear icon (⚙️) to open Settings.
3. **URL:** Enter your exact internal HA IP (e.g., `http://192.168.1.100:8123`).
4. **Token:** Generate a Long-Lived Access Token in your HA profile.
5. **Device ID:** Find your phone under HA Settings ➔ Devices. Look at your browser's address bar and copy the long string of characters at the very end of the URL. *(Pro-tip: Do this on a PC and WhatsApp the Token and ID to yourself!)*
6. Enable **Shake to Speak** to activate the Ghost Screen, choose your **Language**, and adjust the **Volume Override** so the assistant speaks aloud even if your phone is on silent!

### 🎙️ The Ultimate Voice Assistant Capabilities
HO can now be configured as your official **Home Assistant Conversation Agent**! You can speak naturally and ask for almost anything:
* **Smart Shopping List:** Say *"Add eggs to the shopping list,"* *"Clear my shopping list,"* or even ***"Send my shopping list to WhatsApp."***
* **Voice Inventory:** Add items directly to locations by saying, *"Add 3 batteries to the kitchen drawer."*
* **Your Personal Sous-Chef:** Want to bake? Ask, *"How do I make a cheesecake?"* The AI will instantly cross-reference your HO inventory, tell you what ingredients you have, offer to add missing ones to your shopping list, and guide you step-by-step. It will even **add automatic Home Assistant reminders and timers** while you cook!
* **Smart Reminders Assistant:** Say, *"Remind me in an hour to pick up the kids."* When the time comes, the reminder will return **as an audio voice message directly to the specific user's phone** who requested it!
* **Calendar Secretary:** Seamlessly manage your schedule. Just say, *"Add a meeting tomorrow morning with Mr. Bean,"* and it's booked.
* **Free-Speech HA Control:** Control your lights, switches, and devices using completely natural language, or ask for the time, weather, and daily news.

### 📱 `HO_Mind_AI` (Native Android Companion App) - Version: "2026.6.16"
Modern browsers often block camera and microphone access over local HTTP connections. We built **HO_Mind_AI**—a native Android companion app that fixes this and adds serious magic:
* **🎧 True Hands-Free Wireless Control (AirPods Supported):** The ultimate smart home experience! Simply click the button on your Bluetooth headset, hear an instant activation beep, speak your command, and get the AI's verbal response directly in your ear. This completely eliminates the need to shout *"Hey Google"* or use any other wake words. Full hardware button interception works seamlessly even when the screen is locked or external music apps (like Spotify) are running.
* **"Ghost Screen" & Shake-to-Speak:** Run the app silently in the background as a transparent overlay. Enable "Shake to Speak" to wake the assistant with a simple physical shake—no need to press any buttons!
* **📺 Live Teleprompter Notification:** The Android Media Player widget (on the lock screen and quick settings) has been repurposed. Instead of showing static song details, it dynamically updates in real-time to display the exact words you are dictating to the Speech-To-Text engine.
* **🔋 Dynamic BT Toggle (Battery Saver):** A realtime `BT: ON/OFF` toggle button on the Ghost Screen. When ON, the app asserts absolute media dominance. When OFF, it completely destroys the internal media session and releases `AudioFocus`, returning full hardware control to your default music players to save battery.
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
* **The iOS Configuration Trick:** AirPods store their tap-gestures locally on their internal chip. For the best experience on Android, connect your AirPods to an iPhone/iPad first, go to Bluetooth settings, and configure the Double-Tap action to **"Play/Pause"** for both ears. Once reconnected to your Android device, the hardware clicks will be captured perfectly by HO-Mind AI.

---

### 🧠 Processing Flexibility
Choose how your AI runs: **Local Only** (for ultimate privacy), **Cloud**, or a **Hybrid API** mode that utilizes the cloud but gracefully falls back to local processing if your connection drops.

**Privacy & External Services:**
While the core inventory database (SQLite) is 100% local and private, please note that the **Barcode Scanner** feature requires an active internet connection to identify scanned retail products. To fetch product names and details, the integration queries the following external public servers:
* **OpenFoodFacts** (`world.openfoodfacts.org`)
* **UPCItemDB** (`api.upcitemdb.com`)
* **DuckDuckGo** (`html.duckduckgo.com` - used strictly as a fallback search if the product is not found in the main databases).
---

## ✨ Core Features

### 🏠 Your Home Screen
* **Spending, a year at a time** — Twelve columns, one per month, with the month you are in drawn in its own colour so you can see whether this one is unusual. Pick a different year from a dropdown that only ever offers years you actually have receipts in.
* **Where the money went** — A breakdown summed from the individual **product lines** on your receipts, not from the receipts themselves. One supermarket trip is food *and* a toy *and* sunscreen, and filing the whole receipt under "Groceries" would be a comfortable lie. A receipt with no products at all — fuel, a hotel, a restaurant — is filed under its own heading instead.
* **Needs attention** — The things that are wrong *right now*: items expiring, scans waiting for approval, things out of stock. Rows showing zero are never drawn, so the strip is always worth reading.
* **Nothing goes missing quietly** — If money is not in the total because a scan is unconfirmed or a receipt has no readable date, the screen says so and how much.

### 👨‍🍳 The Cookbook
* **A real recipe book** — Chapters, pages that turn, and your own photo of the finished dish on the plate.
* **Cooks from your inventory** — Ask what you can make and the assistant builds the dish out of what is actually on your shelves, not a recipe you cannot cook tonight. It tells you what you are missing; water, salt, oil and pepper are assumed to be in the house.
* **Cooks *with* you** — It reads the steps one at a time and **offers** to set a timer when a step has a wait in it. It asks; it never sets timers behind your back.
* **Rewrite, shorten, translate** — Ask for any of them and you are shown the proposal before anything is saved. Your own handwritten notes are never overwritten.

### 🤖 Advanced AI Capabilities
* **Receipt & Invoice Scanning (Visual)** — Snap a photo (multi-page supported) or upload a PDF of your grocery receipt. The AI extracts every item, quantity and price, maps them to your existing home locations, and keeps the receipt itself permanently archived and searchable in the **Receipts** tab.
* **Receipts that add up** — A discount printed on its own line is easy to read past, and then your basket costs more than the till charged. The scanner adds up the product lines, compares them with the total printed on the receipt, and if they disagree it looks again and proposes a correction — which is only accepted if it brings the total **closer** to the printed one.
* **Auto-Categorization** — The AI automatically assigns the correct Main Category, Sub-category and Measurement Unit (Kg, Liter, Units) to every item it processes. It never stops a fifty-line receipt to ask about one odd item, and it never creates a new top-level category on its own — it leaves a suggestion with a button, and pressing it is what creates one.
* **Icons it draws for you** — Instead of picking the nearest thing from a small library, the assistant **draws** each item. Ask for a different one in your own words ("a red electric guitar") and it redraws it. It works for rooms and locations too, and every drawing takes its colours from your theme so it reads in light mode and dark.
* **Smart "Review" Pipeline** — AI-extracted items go into a secure "Review Tab." Check, edit, confirm, or reject the AI's imports before they are permanently added.
* **Native Multilingual Support** — The panel, the AI's replies, and everyday speech through Home Assistant's conversation agent all work in English, Hebrew, Arabic, or any other supported language.

### 📦 Smart Inventory Management
* **Hierarchical Explorer** — Navigate through Rooms, Furniture, Shelves, and Boxes with unlimited depth.
* **Live Stock Tracking & Shopping Mode** — Instantly update stock. When an item hits `0`, it is marked **Out of Stock** and sent directly to your Shopping List.
* **Price History & Expiry Tracking** — Every item remembers what you paid and where you bought it. Expiry dates for food and medicine, and warranty end dates for electronics and tools, are estimated automatically based on the item and its storage location, and are always editable.
* **Management Tools** — Rename, Move (Cut/Paste), Duplicate, and Delete items or entire locations.

### 📸 Camera & Visual Tools
* **AI Background Removal** — Take photos of your items directly in the app. The built-in camera tool automatically filters out messy backgrounds to create clean, professional item thumbnails.
* **Visual Search** — Use photos to identify unknown items and locate where they are stored in your home.

---

## 📖 User Manual & Visual Guide

Welcome to Home Organizer! This step-by-step guide will walk you through setting up your home, managing your items, and unleashing the power of the AI Assistant.

### 0. Finding your way around

The **Home button (🏠)** opens your dashboard — the spending chart, the tiles, and the way to every other screen.

* **Change the year** from the dropdown next to *Spending by month*.
* **On a phone, tap a column** to see that month's exact amount.
* **Every tile is a button.** *Expiring soon* opens a list of the products **and the shelf each one is on** — knowing the yoghurt expires is no use without knowing where it is.
* **The room list is still there.** It is the first, full-width button on the dashboard, and it is in the **⊕** menu as *Locations*. Nothing was taken away; it simply is not the first thing you see any more.

The **⊕ button** in the top bar opens everything else: Shopping list, Search, Locations, Receipts, My Recipes, the Barcode scanner and the Stylist. Drag it somewhere else if it is in your way.

The panel also **remembers the screen you were on**. Refresh the page, or answer a phone call and come back, and you are still where you left off.

### 1. Personalizing Your Settings (Language & Themes)
Click the **Gear Icon (⚙️)** in the top right corner of the navigation bar.
* **Language:** Select your preferred language and the entire interface—including text direction (LTR/RTL)—will instantly adapt.
* **Theme:** Choose between a sleek **Dark Theme** or a clean **Light Theme**.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/16.png" width="48%" alt="Dark Theme View">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/23.png" width="48%" alt="Light Theme View">
</p>

### 2. Setting up Zones and Rooms
Click the **Pencil Icon (✏️)** in the top right to enter **Edit Mode**.
* Click **Add Zone** at the bottom to create broad areas like "First Floor".
* Inside those zones, click the large green **+ Add Room** button to create specific rooms like "Kitchen".
* *Tip: You can use the up (↑) and down (↓) arrows to reorder your zones and rooms!*

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/1.png" width="32%" alt="Empty Root Screen">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/2.png" width="32%" alt="Adding First Floor">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/3.png" width="32%" alt="Multiple Zones Added">
</p>

### 3. Customizing Icons
While still in **Edit Mode (✏️)**, click the picture icon on the corner of your room folders to open the **Icon Picker**.
* Browse the built-in icons, or use the **Upload File** button to paste an image URL directly.
* Or press **Draw with AI**, type what you want in your own words ("a workshop with a bench", "a wine rack"), and the assistant draws it and saves it. This works for rooms, storage locations and individual items alike — useful for anything the built-in set was never going to have.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/4.png" width="48%" alt="Room Editing Options">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/5.png" width="48%" alt="Room Icon Picker Library">
</p>

### 4. Storage Locations & Sublocations
Click on a Room (e.g., Kitchen) to enter it. Add a **Storage Location** (like "Fridge"), click into it, and add a **Sublocation** (like "Top Shelf"). This hierarchy ensures you always know *exactly* where an item is.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/6.png" width="48%" alt="Kitchen Storage Locations">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/7.png" width="48%" alt="Fridge Sublocations">
</p>

### 5. Adding and Managing Items manually
Turn off **Edit Mode**. Navigate to a sublocation and click **+ Add** to create a new item manually.
* Categorize it, assign expiration dates, and use the Camera icon to snap a real photo of the item using the built-in AI Background Removal tool!

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/8.png" width="32%" alt="Item inside Sublocation">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/10.png" width="32%" alt="Expanded Item Details">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/9.png" width="32%" alt="Item Icon Library">
</p>

### 6. Grid View & Live Tracking
Use the **View Toggle** icon in the sub-bar to switch between a detailed List View and a beautiful visual **Grid View**. Hit the **+** or **-** buttons to update how much of an item you have left.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/11.png" width="48%" alt="Sublocation Grid View">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/16.png" width="48%" alt="Populated Fridge Grid View">
</p>

### 7. Scanning Receipts & the Receipts Tab
Home Organizer keeps a permanent record of every receipt you scan — not just the items that came from it.

1. Open the **Receipts** tab and press **Scan receipt** (camera) or **Upload image or PDF**.
2. If the receipt is longer than one photo, keep photographing pages — you'll be asked after each one whether there's another part, and everything is read together as a single receipt.
3. The AI reads the shop name, invoice number, date, total, and every line item, then maps each item to your existing rooms and categories.
4. Extracted items land in the **Review** tab for you to check, correct, or reject before they're added to your inventory. Prices and expiry/warranty dates are editable right there.
5. Once approved, the receipt itself — image or PDF — stays archived and searchable in the **Receipts** tab, grouped by store, with the exact items, quantities and prices from that purchase always one tap away.

**The scan checks its own arithmetic.** A discount is often printed on its own line, or underneath the item, and a reader can take the larger number — then your basket costs more than the till actually charged, and that mistake lives in your price history for good. So the lines are added up and compared with the total printed on the receipt. If they disagree, the document is read again with the sums in front of it and a correction is proposed — and kept **only if it brings the total closer** to the printed one. A "fix" that makes things worse is thrown away.

**It does not interrupt you any more.** A fifty-line receipt used to stop on one odd item to ask where it belonged. Now that item is filed under the nearest category and a suggestion appears on its card in the **Review** tab with a button. Pressing the button is what creates a new top-level category; the scan never creates one by itself.

**Receipts with no products count too.** A tank of fuel, a hotel night, a restaurant bill — there is nothing on them to approve, so they used to sit unconfirmed for ever and never reach a spending total. They are now complete records the moment they are scanned, and they appear on the dashboard under their own heading.

<p align="center">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/22.png" width="24%" alt="Original Receipt/Invoice">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/12.png" width="24%" alt="Receipt ready to scan">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/13.png" width="24%" alt="Sending the receipt for AI processing">
  <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/images/20.png" width="24%" alt="AI Processed Invoice">
</p>

### 7b. The Cookbook

Open the **⊕** menu and choose **My Recipes**. A brand new install already has two recipes in every chapter, so there is something to look at from the first day.

* **Browse** by chapter, and turn pages with the arrows.
* **Ask for a recipe.** Press the assistant button and say what you feel like — *"something for lunch from what I have"*. The dish is built out of your **actual inventory**, so it is something you can cook tonight. It will tell you what you are missing; water, salt, oil and pepper are assumed to be in the house and are never reported missing.
* **Cook along.** The assistant walks you through the steps one at a time. When a step has a wait in it, it **offers** a timer with a yes/no — it never sets one silently.
* **Add your own photo.** Press the plate to put a picture of the finished dish on the recipe, and press the picture to see it full screen. A recipe with no photo gets an emblem the assistant designs for that specific dish.
* **Rewrite, shorten or translate.** Ask, and you are shown the proposal before anything is saved. Your own handwritten notes, prep time and category are never overwritten.

### 8. Setting up the Voice Assistant & HO-Mind AI

**Part A: Set HO as Your HA Voice Assistant**
1. In your main Home Assistant menu, go to **Settings ➔ Voice Assistants**.
2. Click **+ Add Assistant**.
3. Under **Conversation Agent**, select **HO-AI Agent** (`conversation.ho_ai_agent`). Save.

**Part B: Install & Configure HO-Mind AI (Android Users Only)**
1. Open the HO dashboard on your phone, open **Settings** (⚙️) in the top bar, and click **Download Android APK**. Install it.
2. Open the app and tap the Gear icon (⚙️) to open Settings.
3. **URL:** Enter your exact internal HA IP (e.g., `http://192.168.1.100:8123`).
4. **Token:** Generate a Long-Lived Access Token in your HA profile.
5. **Device ID:** Find your phone under HA Settings ➔ Devices. Look at your browser's address bar and copy the long string of characters at the very end of the URL. *(Pro-tip: Do this on a PC and WhatsApp the Token and ID to yourself!)*
6. Enable **Shake to Speak** to activate the Ghost Screen, choose your **Language**, and adjust the **Volume Override** so the assistant speaks aloud even if your phone is on silent!

## 🌍 Languages
Home Organizer is available in **7 languages**: English, Hebrew (עברית), Italian, Spanish, French, Arabic (العربية), and Russian (Русский). This covers the panel itself, the setup wizard, and the AI's own replies — including full right-to-left (RTL) layout for Hebrew and Arabic.

**Want your language added?** Open an issue on GitHub with the language you'd like to see — the translation file is a single spreadsheet-style CSV, so adding a language is usually a quick addition rather than a code change.

---

## 📋 Requirements
* Home Assistant 2024.7.0 or newer
* **AI Provider API Key or Local URL**: Required for AI chat, receipt scanning, and smart categorization (Gemini, OpenAI, Claude, Ollama, or LM Studio).
* **Local Calendar Integration:** Highly recommended! Enable the built-in Home Assistant "Local Calendar" (Settings ➔ Devices & Services ➔ Add Integration ➔ Local Calendar) to use the Calendar Secretary features and to see your voice reminders visually mapped out on your schedule with a ⏰ icon.



---
<p align="center">Made with ❤️ for the Home Assistant community by Guy Azria</p>