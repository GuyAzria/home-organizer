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
  <a href="https://github.com/hacs/integration"><img src="https://img.shields.io/badge/HACS-Default-blue.svg?style=flat-square" alt="HACS Default"></a>
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

**Talking to it in plain language happens through Home Assistant's own conversation agent** — set HO-AI as your assistant once (see [Part 3 of the installation](#part-3-make-ho-ai-your-assistant)) and every device with Assist already talks to it: no separate chat screen inside the panel.

**Developed by Guy Azria.**

---
## 📥 Installation (Zero YAML Required! 🎉)

<!-- Installation video, in the repository root - outside custom_components, so HACS never downloads them:
     HO_Install.gif plays here; HO_Install.mp4 is the full-quality copy it links to, through jsDelivr,
     which serves it as video/mp4 so the browser plays it - GitHub's own file page only offers a download.
     Absolute URLs, because HACS shows this README too and a relative path breaks there. -->
<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/GuyAzria/home-organizer@main/HO_Install.mp4">
    <img src="https://raw.githubusercontent.com/GuyAzria/home-organizer/main/HO_Install.gif" width="360" alt="Installing Home Organizer, step by step">
  </a>
</p>
<p align="center"><i>The whole installation in five parts (about 5 minutes). Click for the full-quality video.</i></p>


No YAML, no code, no `configuration.yaml` - everything is done in the Home Assistant UI. The video above walks through the whole installation in five parts; the same steps are written out below.

### Part 1: Download from HACS
Home Organizer is in the official HACS default store - no repository URL, no custom repository.

1. Open **HACS** in the sidebar.
2. Search for **Home Organizer**.
3. Open **Home Organizer**.
4. Open the menu (⋮) ▸ **Download**.
5. Confirm with **Download**.
6. A restart is needed: go to **Settings**.
7. On **Restart required**, press **Submit**.
8. Home Assistant restarts. Wait about a minute.

### Part 2: Set up HO-AI
1. **Settings ▸ Devices & services ▸ Add Integration**.
2. Search for **Home Organizer**.
3. The first form:
   * **AI Processing Mode** - *Local*: your own Ollama · *Cloud*: Gemini, OpenAI or Claude · *Hybrid*: local for chat, cloud for photos.
   * **Cloud AI Provider** - Google Gemini has a free tier.
   * **Virtual Try-On Stylist** - optional. Leave it off for now.
   * **Image storage location** - `www` is recommended. `media` keeps the files in `/media`.
   * **Submit**.
4. **API Keys and Models**:
   * **Cloud API Key** - free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey): sign in ▸ **Create API key** ▸ copy ▸ paste.
   * **Cloud model name** - type `gemini-3.5-flash-lite`.
   * **Local AI URL** - your Ollama server: `http://YOUR-IP:11434/v1`. It must end in `/v1`, lowercase.
   * **Local API Key** - Ollama ignores it, but it must not be empty. Type `ollama`.
   * **Local text model** - run `ollama list` and copy the exact name, e.g. `gemma4:31b-cloud`.
   * **Local vision model (photos)** - in Hybrid mode photos go to the cloud, so it can stay empty.
   * **Submit**.
5. **Trigger Words and Permissions**:
   * **Trigger words** - already in your language. Leave them as they are.
   * **Allow scripts and scenes** - off by default. Turn it on only if the assistant should start your scripts.
   * **Delete all data when removed** - leave it off.
   * **Submit**, then **Finish**.
6. **HO-AI** is now in the sidebar.

### Part 3: Make HO-AI your assistant
1. **Settings ▸ Voice assistants**.
2. Open the **Home Assistant** assistant.
3. **Conversation agent** - choose **HO-AI Agent**.
4. **Prefer handling commands locally** - on: Home Assistant tries simple commands first, the rest go to HO-AI.
5. Save with **Update**.
6. Open **HO-AI** from the sidebar. Done - ask HO-AI from Assist on any device.

### Part 4: Set up your home - the locations wizard
> **Tip:** the more precisely you set up your rooms and storage here, the easier it is for the AI to place your items. You can add or remove places later.

1. Open **HO-AI** from the sidebar.
2. **Locations** - the set-up wizard opens.
3. **Language** - for the whole app.
4. **Appearance** - light or dark, for the whole app.
5. **Your home** - apartment, house or house with units, and how many floors. **What else does the home have?** Tick the attic, the garden... ▸ **Next**.
6. **Rooms** - tap a room to add it, **+** and **-** for more. Two bedrooms become Bedroom 1 and Bedroom 2. ▸ **Next**.
7. **Storage** - what stands in each room; the common ones are already ticked. Every room has its own list: untick what you do not have. ▸ **Next**.
8. **Inside the fridge** - shelves with a suggested shelf life in days. Rename or remove what you do not have. ▸ **Next**.
9. **Review** - nothing is written yet, and the wizard only adds, it never deletes. Check everything that will be created ▸ **Create these locations**.
10. Done: every room is ready for your items - the kitchen with its cabinets, the fridge and the pantry shelf; the fridge with its top, middle and bottom shelf, vegetable drawer and door shelf.

### Part 5: HO_Mind_AI, the Android app (optional)
**Optional · Android only** - everything in Home Organizer works without it. Open-source software, no ads, no charges.

Why install it:
* **Talk freely** - tap a wireless earbud, or shake the phone. No "Hey Google" needed.
* **Free speech recognition** - Google's engine, excellent in other languages too. No paid Whisper.
* **100% local** - plain `http` on your home network or VPN. Receipt and item photos, barcodes - no HTTPS needed.

1. Download the APK from the [Releases page](https://github.com/GuyAzria/HO_Mind_AI/releases/latest) - or in the Home Organizer panel: **Settings ▸ HO_Mind_AI**.
2. **Install**. Android warns about apps from outside the Play Store - tap **Install anyway**, then **Open**.
3. Allow **Appear on top** - for the floating voice screen.
4. Allow the **microphone** and **nearby devices** (for Bluetooth earbuds).
5. **⋮ ▸ HO Settings**.
6. **HA URL** - as you open it in the browser: `http://YOUR-HA-IP:8123` at home or on a VPN, `https://name.duckdns.org:8123` with a certificate. Write the `http://` and the port `:8123`.
7. **The access token** - in Home Assistant: your name ▸ **Security** ▸ **Long-lived access tokens** ▸ **Create token**, and give it a name. Copy it at once - it is shown only once - and paste it into **Access Token**. Keep your token private.
8. **"Home Assistant did not answer"?** Using a VPN? Add HO_Mind_AI to the VPN's allowed apps, then disconnect and reconnect the VPN.
9. **Load household** adds every phone in the house in one tap. Tap a phone field: every device with the Home Assistant app, by owner and name. Remove what you do not need - the TV, old phones. Name each person the way you say it, and pick their phone.
10. **Shake to Speak**, language and volume - then **Save**.
11. Ask by typing... or by voice: shake the phone or tap your earbud, and just talk.

---

### 🎙️ The Ultimate Voice Assistant Capabilities
HO can now be configured as your official **Home Assistant Conversation Agent**! You can speak naturally and ask for almost anything:
* **Smart Shopping List:** Say *"Add eggs to the shopping list,"* *"Clear my shopping list,"* or even ***"Send my shopping list to WhatsApp."***
* **Voice Inventory:** Add items directly to locations by saying, *"Add 3 batteries to the kitchen drawer,"* or name the place by its catalog ID — *"Add face cream to D2.1."* If the thing you named is already sitting on a receipt you have not reviewed, it asks whether you meant that one instead of quietly making a second row for it.
* **Voice Boxes:** *"Put M6 and M8 screws in box 1."* *"Empty box 2."* *"Put the whole Super-Pharm receipt in box 4."* *"Delete everything in box 4"* — which tells you how many items are in there and waits for a real answer before it deletes anything, and never deletes a receipt line that is still waiting for review.
* **Voice Housekeeping:** *"Take everything off the top shelf in the pantry"* moves the loose items up one level and leaves any box standing there alone — taking everything off a shelf means moving the carton, not unpacking it.
* **Your Personal Sous-Chef:** Want to bake? Ask, *"How do I make a cheesecake?"* The AI will instantly cross-reference your HO inventory, tell you what ingredients you have, offer to add missing ones to your shopping list, and guide you step-by-step. It will even **add automatic Home Assistant reminders and timers** while you cook!
* **Smart Reminders Assistant:** Say, *"Remind me in an hour to pick up the kids."* When the time comes, the reminder will return **as an audio voice message directly to the specific user's phone** who requested it!
* **Calendar Secretary:** Seamlessly manage your schedule. Just say, *"Add a meeting tomorrow morning with Mr. Bean,"* and it's booked.
* **Free-Speech HA Control:** Control your lights, switches, and devices using completely natural language, or ask for the time, weather, and daily news.

### 📱 `HO_Mind_AI` (Native Android Companion App) - Version: "2026.10.21"
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
Your inventory database (SQLite) is 100% local and private. The one feature that reaches outside your house is the **Barcode Scanner**: a barcode is only a number, and turning it into *"Heinz tomato ketchup 500g"* means asking somebody who keeps that list. These are the servers it may ask, and **you decide which of them, and in what order**:

| Source | Server | What it knows |
|---|---|---|
| **Open Food Facts** | `world.openfoodfacts.org` | Food, drink, toiletries, cleaning products and pet food — an open, community-run catalogue. |
| **UPCitemdb** | `api.upcitemdb.com` | General retail. Keyless, and the free endpoint allows about 100 lookups a day — when that runs out you are told so, rather than being shown "unknown product". |
| **Open Library** | `openlibrary.org` | Books. Only ever asked for a barcode starting `978` or `979`, because that is what an ISBN looks like — a tin of beans is never sent there. |
| **Web search** | `html.duckduckgo.com` | A last-resort text search. |
| **Your own AI** | whatever you configured | The same provider you already set up for receipts and chat — Gemini, OpenAI, Claude, Ollama or LM Studio. Nothing new leaves your network that was not already going there, and on a local model nothing leaves at all. |

Open the **spanner** on the Barcode page to see the list. Each row has a number: **type a different number into it and the two rows swap places**, so you can put the one you trust first. **Untick anything you would rather was never contacted** — and if you untick all five, no barcode lookup leaves your house at all; you can still type the product name in yourself. The first source that answers is the one used, so the order is also what makes a scan fast.

---

## ✨ Core Features

### 🪄 Set up your home in two minutes
* **The wizard builds the house for you** — Rooms, the cupboards and wardrobes in them, and the shelves inside the fridge. Answer a handful of questions and the whole structure is created in one go, instead of fifty folders made one at a time, each with its own rename and icon.
* **It knows what rooms contain** — 24 kinds of room, from Kitchen and Nursery to Workshop, Attic and Garden. Pick one and you are offered the storage that room actually has: a kitchen suggests cabinets, a fridge, a pantry shelf and a spice rack; a bedroom suggests a wardrobe, nightstands and a place under the bed. The common ones are already ticked — untick what you do not have.
* **Two bathrooms stay two bathrooms** — The floor becomes part of the room's name, so *Floor 1 Bathroom* and *Floor 2 Bathroom* never get confused with each other.
* **Nothing is written until you say so** — The last screen shows you exactly what will be created, with anything that already exists marked so and left alone. **The wizard only ever adds.** It never deletes a room, a cupboard or an item, so running it again later to add the garage is safe.
* **Run it again whenever you like** — It is in the **gear menu (⚙️)** under the magic-wand icon, and it remembers every tick. Put the kitchen on the wrong floor and you can correct that one answer instead of starting over.

### 🏠 Your Home Screen
* **Spending, a year at a time** — The twelve months drawn as one smooth wave, with the month you are in marked in its own colour so you can see whether this one is unusual. The curve never invents money: between two months it never rises above the higher one or dips below zero, so the shape is honest. Pick a different year from a dropdown that only ever offers years you actually have receipts in.
* **Where the money went** — A breakdown summed from the individual **product lines** on your receipts, not from the receipts themselves. One supermarket trip is food *and* a toy *and* sunscreen, and filing the whole receipt under "Groceries" would be a comfortable lie. A receipt with no products at all — fuel, a hotel, a restaurant — is filed under its own heading instead.
* **Needs attention** — The things that are wrong *right now*: items expiring, scans waiting for approval, things out of stock. Rows showing zero are never drawn, so the strip is always worth reading.
* **Nothing goes missing quietly** — If money is not in the total because a scan is unconfirmed or a receipt has no readable date, the screen says so and how much.
* **Tap a category to see what is in it** — Every row of *Where the money went* is a button. It opens the items filed under that category, with a filter for its sub-categories, and every item opens the full editor — fix a quantity, a price or a category without leaving the page.
* **The chart follows your categories** — Rename a category, or remove one and choose where its items go, and past purchases move with it, so an old name never lingers in the breakdown. Fixing the category of a single item moves its purchase history too.

### 👨‍🍳 The Cookbook
* **A real recipe book** — Chapters, pages that turn, and your own photo of the finished dish on the plate.
* **Cooks from your inventory** — Ask what you can make and the assistant builds the dish out of what is actually on your shelves, not a recipe you cannot cook tonight. It tells you what you are missing; water, salt, oil and pepper are assumed to be in the house.
* **Cooks *with* you** — It reads the steps one at a time and **offers** to set a timer when a step has a wait in it. It asks; it never sets timers behind your back.
* **Rewrite, shorten, translate** — Ask for any of them and you are shown the proposal before anything is saved. Your own handwritten notes are never overwritten.
* **Every change is kept** — Double the quantities, make it kosher, swap an ingredient: each change becomes a new version, and the ones before it stay. Show an older version with one tap, or delete one you no longer want.
* **It knows which recipe you mean** — With a recipe open, what you say to the assistant is about that recipe. *"Make it two teaspoons of sugar"* works without saying the word *recipe*.

### 🤖 Advanced AI Capabilities
* **Receipt & Invoice Scanning (Visual)** — Snap a photo (multi-page supported) or upload a PDF of your grocery receipt. The AI extracts every item, quantity and price, maps them to your existing home locations, and keeps the receipt itself permanently archived and searchable in the **Receipts** tab.
* **Receipts that add up** — A discount printed on its own line is easy to read past, and then your basket costs more than the till charged. The scanner adds up the product lines, compares them with the total printed on the receipt, and if they disagree it looks again and proposes a correction — which is only accepted if it brings the total **closer** to the printed one.
* **Auto-Categorization** — The AI automatically assigns the correct Main Category, Sub-category and Measurement Unit (Kg, Liter, Units) to every item it processes. It never stops a fifty-line receipt to ask about one odd item, and it never creates a new top-level category on its own — it leaves a suggestion with a button, and pressing it is what creates one.
* **Icons it draws for you** — Instead of picking the nearest thing from a small library, the assistant **draws** each item. Ask for a different one in your own words ("a red electric guitar") and it redraws it. It works for rooms and locations too, and every drawing takes its colours from your theme so it reads in light mode and dark.
* **Smart "Review" Pipeline** — AI-extracted items go into a secure "Review Tab." Check, edit, confirm, or reject the AI's imports before they are permanently added.
* **Native Multilingual Support** — The panel, the AI's replies, and everyday speech through Home Assistant's conversation agent all work in English, Hebrew, Arabic, or any other supported language.

### 📦 Smart Inventory Management
* **Hierarchical Explorer** — Zones ▸ Rooms ▸ Storage Locations ▸ Sublocations. Every place gets a short catalog ID (`D2.1`) you can say out loud or type into the search bar.
* **📦 Boxes** — The carton on the shelf, with a number written on it. A box holds items, has its own page, and **moves with everything inside it** in one operation. Deleting a box never deletes what was in it. Receipt lines you have not reviewed yet can be filed into one before you approve them.
* **Live Stock Tracking & Shopping Mode** — Instantly update stock. When an item hits `0`, it is marked **Out of Stock** and sent directly to your Shopping List.
* **Price History & Expiry Tracking** — Every item remembers what you paid and where you bought it. Expiry dates for food and medicine, and warranty end dates for electronics and tools, are estimated automatically based on the item and its storage location, and are always editable.
* **Management Tools** — Rename, Move (Cut/Paste), Duplicate, and Delete items or entire locations.
* **Categories are yours to edit** — **Gear menu (⚙️) ▸ Categories** lists every category and sub-category with the number of items in it. Add one with **+**, fix a typo with the pencil, or remove one — and when you remove one you choose where its items go first, so **nothing is ever deleted along with the label**. Renaming moves the items with the name in a single step; they are never left pointing at a category that no longer exists.

### 📸 Camera & Visual Tools
* **AI Background Removal** — Take photos of your items directly in the app. The built-in camera tool automatically filters out messy backgrounds to create clean, professional item thumbnails.
* **Visual Search** — Use photos to identify unknown items and locate where they are stored in your home.

---

## 📖 User Manual & Visual Guide

Welcome to Home Organizer! This step-by-step guide will walk you through setting up your home, managing your items, and unleashing the power of the AI Assistant.

### 0. Your first five minutes

A brand-new installation has no rooms in it — it does not invent somebody else's kitchen for you. What you get instead is a card offering to build yours: **"Set up your home in 2 minutes"**, with the magic wand on it.

* Press **Set up my home** and the wizard opens. See [section 2](#2-setting-up-your-home).
* Press **Not now** and the card goes away and stays away, on this browser.
* Either way the card stops appearing the moment your home has rooms in it — whether the wizard made them or you did, with the pencil.

Nothing on that card is required. If you would rather lay the house out by hand, skip it entirely; the wizard writes nothing you cannot change afterwards, and changes nothing you have already made.

### 0b. Finding your way around

The **Home button (🏠)** opens your dashboard — the spending chart, the tiles, and the way to every other screen.

* **Change the year** from the dropdown next to *Spending by month*.
* **On a phone, tap a month** on the wave to see its exact amount.
* **Tap a row of *Where the money went*** to see the items behind it, filter them by sub-category, and open any one of them to edit it.
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

### 2. Setting up your home

There are two ways to do this, and they produce the same thing. Use the wizard for the whole house at once, and the pencil for a single room you thought of later. Neither one locks you out of the other.

#### The quick way: the wizard 🪄

Press **Set up my home** on the first-run card, or open it any time from the **gear menu (⚙️) ▸ Locations wizard**. Seven screens on a first run, each of which tells you what it is for, with **Back**, **Next** and **Exit** at the bottom. **Exit changes nothing in your home** — but it does keep your answers, so you can walk away halfway through and carry on later from where you stopped.

| Screen | What it asks |
|---|---|
| **Language** | The language for the whole app. The same choice as in the settings menu, so everything from here on is in it. |
| **Appearance** | Light or dark, again for the whole app. The rest of the wizard follows it immediately. |
| **Your home** | Apartment, house, or house with units — and how many floors. |
| **Rooms** | Tap the rooms you have. **+** and **−** set how many of the same kind — two bedrooms are numbered for you, and you can rename either on the next screen. |
| **Storage** | For each room, what stands in it. The usual ones are pre-ticked. |
| **Inside the fridge** | How many doors, whether there is a freezer, and which shelves and drawers it has. |
| **Tidy what is there** | The eighth screen, and you will not see it the first time — only once the wizard has built something at least once. It reports anything inconsistent in the locations you already have, and touches nothing you do not tick. |
| **Review** | Everything that is about to be created, with **EXISTS** against anything already there. Nothing has been written until you press the button on this screen. |

**The fridge is the only place a shelf life is suggested**, because it is the only place food goes off on a shelf rather than when you open it. Everywhere else the assistant works out the expiry date when you add the item. Every suggested name is editable and any shelf you do not have can be removed.

**Your rooms are stored in your own language.** If you set the app to Hebrew, the wizard offers you Hebrew room names and that is what is saved — nothing is stored in English behind your back and translated back for you.

**Every room gets a sensible icon**, and you can change any of them afterwards in the usual Icon Picker (section 3) — including **Draw with AI** if the built-in set has nothing for your pottery studio.

#### The manual way: Edit Mode ✏️

Unchanged, and still the right way to add one room to a house you already laid out.

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

### 4b. Boxes
A **Box** is the carton that stands on a shelf. It is not another level of the hierarchy — it is a thing in a location, the same way an item is — and that is what lets it move with its contents.

Turn on **Edit Mode** and press the box button beside the pencil. Give it a title (*M8 screws*) and choose which place on the page it goes in. It opens onto its own page straight away.

**The number.** Every box gets one — `box1`, `box2`, `box3`. Write it on the carton. It reads the same in every language because it is an identifier, not a word, and it is never reused: delete box3 and the next box is box5, so a label you wrote last year still means what it meant.

**On the box's page** you can add items by hand without limit, pull in lines from a receipt you have not approved yet, edit anything inside it, and take items back out. The three-dot menu holds the rest: change its location with the room ▸ location ▸ sublocation pickers, set what kind of box it is, rename it in place, cut it to paste in another room, or delete it.

**Deleting a box does not delete what was in it.** The items stay exactly where the box was standing. Getting rid of a carton is not the same as getting rid of its contents.

**Finding one.** On a shelf, a box is a card showing its number, title, type and count. On the heading of any sublocation that holds one you get a box icon with a count — **tap** it to open the box, **hold** it to move the box to another place on that page. In the search bar, a toggle narrows results to boxes only; typing *screws* finds *box3 — M8 screws*, and so does typing *box3*.

**Filing a receipt line into a box does not approve it.** It stays in the review queue and the page marks it unreviewed. The box only records where it is going, so that when you do approve it, it is filed in the box.

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
* **Just say what to change.** With a recipe open, everything you ask the assistant is about that recipe — *"two teaspoons of sugar instead of three"* or *"for ten people"* — without having to say *recipe*.
* **Versions.** Every change you approve becomes a new version of the recipe, and the versions before it are kept. The save button says which one it will create — *Save as V4* — and the **V** button after *Check my inventory* shows the version on screen and opens the list: each version with what was changed in it, so *V2 — kosher version* is easy to find again. Tap one to show it. The bin deletes a version you no longer want; it is not offered while a recipe has only one, because a recipe always keeps at least one. Going back to an older version brings back everything it said — name, ingredients, steps, timers, prep time and notes — but keeps today's photo, chapter and cook count, which belong to the recipe rather than to a version.

### 8. Setting up the Voice Assistant & HO-Mind AI

Both are shown in the installation video and written out step by step there: [Part 3: Make HO-AI your assistant](#part-3-make-ho-ai-your-assistant) and [Part 5: HO_Mind_AI, the Android app](#part-5-ho_mind_ai-the-android-app-optional).

## 🌍 Languages
Home Organizer is available in **7 languages**: English, Hebrew (עברית), Italian, Spanish, French, Arabic (العربية), and Russian (Русский). This covers the panel itself, the locations wizard, and the AI's own replies — including full right-to-left (RTL) layout for Hebrew and Arabic.

**Your own room names are never translated.** The language setting changes the app; it does not rewrite what you called your rooms. Whatever language you were in when a room was created is the language it keeps.

**Want your language added?** Open an issue on GitHub with the language you'd like to see — the translations are two spreadsheet-style CSV files (one for the panel, one for the wizard), so adding a language is usually a quick addition rather than a code change.

---

## 📋 Requirements
* Home Assistant 2024.7.0 or newer
* **AI Provider API Key or Local URL**: Required for AI chat, receipt scanning, and smart categorization (Gemini, OpenAI, Claude, Ollama, or LM Studio).
* **Local Calendar Integration:** Highly recommended! Enable the built-in Home Assistant "Local Calendar" (Settings ➔ Devices & Services ➔ Add Integration ➔ Local Calendar) to use the Calendar Secretary features and to see your voice reminders visually mapped out on your schedule with a ⏰ icon.



---
<p align="center">Made with ❤️ for the Home Assistant community by Guy Azria</p>