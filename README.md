<p align="center">
  <img src="https://github.com/GuyAzria/home-organizer/blob/main/logo.png" alt="Home Organizer (HO) Logo" width="180">
</p>

<h1 align="center">Home Organizer (HO) </h1>

<p align="center">
  <strong>The complete AI-powered home inventory system for Home Assistant</strong>
</p>

<p align="center">
  <a href="https://github.com/GuyAzria/home-organizer/releases"><img src="https://img.shields.io/github/v/release/GuyAzria/home-organizer?style=flat-square" alt="Release"></a>
  <a href="https://github.com/GuyAzria/home-organizer/blob/main/LICENSE"><img src="https://img.shields.io/github/license/GuyAzria/home-organizer?style=flat-square&cacheSeconds=3600" alt="License"></a>
  <a href="https://github.com/hacs/integration"><img src="https://img.shields.io/badge/HACS-Custom-orange.svg?style=flat-square" alt="HACS"></a>
  <img src="https://img.shields.io/badge/Powered%20by-Google%20Gemini%20AI-blue.svg?style=flat-square" alt="AI API option">
</p>

---

Home Organizer is a dedicated full-screen application for your Home Assistant sidebar. It allows you to manage your home inventory with ease using nested folders, live stock tracking, and a powerful **Google Gemini AI** integration that can read receipts, auto-categorize items, and chat with you in natural language.

**Developed by Guy Azaria.**

## ✨ Features

### 🤖 Advanced AI Capabilities
* **Receipt & Invoice Scanning** — Snap a photo or upload a PDF of your grocery receipt. The AI will automatically extract all items, quantities, and intelligently map them to your existing home locations.
* **Auto-Categorization & Icons** — The AI automatically assigns the correct Main Category, Sub-category, Measurement Unit (Kg, Liter, Units), and a beautiful 3D icon to every item it processes.
* **Smart "Review" Pipeline** — AI-extracted items go into a secure "Review Tab." You can check, edit, confirm, or reject the AI's imports before they are permanently added to your inventory.
* **Conversational Assistant** — Ask the AI questions based on your actual inventory: *"What can I make for breakfast?"*, *"Where are the winter blankets?"*, or *"Do we have any AAA batteries?"*
* **Native Multilingual Support** — Chat with the AI in English, Hebrew, Arabic, or any other language. The AI auto-detects your language and replies in the exact same language seamlessly.

### 📦 Smart Inventory Management
* **Hierarchical Explorer** — Navigate through Rooms, Furniture, Shelves, and Boxes with unlimited depth.
* **Live Stock Tracking** — Instantly update stock levels with quick-action buttons.
* **Shopping Mode** — A dedicated view for out-of-stock items, organized by location, with collapsible categories and badge counters.
* **Date Tracking** — Track when items were added and filter by day, week, month, or year.
* **Management Tools** — Easy Rename, Move (Cut/Paste), Duplicate, and Delete functions.

### 📸 Camera & Visual Tools
* **AI Background Removal** — Take photos of your items directly in the app. The built-in camera tool automatically filters out messy backgrounds to create clean, professional item thumbnails.
* **Visual Search** — Use photos to identify unknown items and locate where they are stored in your home.

### 🎨 User Experience
* **Sidebar Integration** — Installs as a native panel for easy access.
* **Theme Support** — Full support for Light and Dark modes matching your Home Assistant theme.
* **Privacy First** — All inventory data is stored locally in a fast SQLite database.

---

## 📘 How to Use the AI Features

The AI Assistant in Home Organizer is designed to do the heavy lifting for you. Here is how to get the most out of it:

### 1. Scanning a Grocery Receipt (Bulk Add)
Instead of manually typing out 30 items from a shopping trip, let the AI do it:
1. Click the **Robot Icon** in the top navigation bar to open the AI Chat.
2. Click the **Camera Icon** to take a picture of your receipt, or the **Upload Icon** to attach a saved photo/PDF.
3. Press **Send**. 
4. The AI will analyze the receipt, map the items to your existing rooms (e.g., `Kitchen > Fridge`), assign icons, and place them in the **Review Tab**.
5. Navigate to the **Shopping Cart Icon** > **Review Tab** to quickly confirm (✅) or reject (🗑️) the imported items.

### 2. Adding Items via Text
You can quickly add items just by telling the AI what to do.
* **Example:** Type *"Add 3 packs of pasta and 2 cans of tuna to the Kitchen Pantry."*
* The AI will instantly create the items, assign the correct "Carbs" and "Canned Goods" categories, pick the exact icons, and place them directly into your database.

### 3. Querying Your Inventory
Treat the AI like a personal home manager. It can see your entire database.
* *"I have a headache, where is the Acamol/Ibuprofen?"*
* *"What ingredients do we have in the fridge to make a salad?"*
* *"Show me everything we have stored in the Garage."*

---

## 📋 Requirements

* Home Assistant 2024.1.0 or newer
* **Google Gemini API Key**: Required for all AI text chat, receipt scanning, and auto-categorization features. (Get a free API key from Google AI Studio).

## 📥 Installation

### Option 1: HACS (Recommended)
1. In Home Assistant, go to **HACS** > **Integrations**.
2. Open the menu (top right) and select **Custom repositories**.
3. Add `https://github.com/GuyAzria/home-organizer` as an **Integration**.
4. Click **Add**, find **Home Organizer**, and select **Download**.
5. **Restart Home Assistant**.

### Option 2: Manual
1. Download the `custom_components/home_organizer` folder.
2. Copy it to your `config/custom_components/` directory.
3. Restart Home Assistant.

## ⚙️ Setup

1. Navigate to **Settings** > **Devices & Services**.
2. Click **Add Integration** and search for **Home Organizer**.
3. Enter your **Google Gemini API Key** when prompted.
4. The **Organizer** icon will appear in your sidebar.

## 📄 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---
<p align="center">Made with ❤️ for the Home Assistant community</p>
