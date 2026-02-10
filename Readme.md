# ⚠️ Beta Version — Use at your own risk

<p align="center">
  <img src="https://github.com/GuyAzria/home-organizer/raw/main/logo.png" alt="Home Organizer Logo" width="180">
</p>

<h1 align="center">Home Organizer</h1>

<p align="center">
  <strong>The complete AI-powered home inventory system for Home Assistant</strong>
</p>

<p align="center">
  <a href="https://github.com/GuyAzria/home-organizer/releases"><img src="https://img.shields.io/github/v/release/GuyAzria/home-organizer?style=flat-square" alt="Release"></a>
  <a href="https://github.com/GuyAzria/home-organizer/blob/main/LICENSE"><img src="https://img.shields.io/github/license/GuyAzria/home-organizer?style=flat-square" alt="License"></a>
  <a href="https://github.com/hacs/integration"><img src="https://img.shields.io/badge/HACS-Custom-orange.svg?style=flat-square" alt="HACS"></a>
</p>

---

This integration adds a dedicated full screen app to your Home Assistant sidebar. Organize your home items in unlimited nested folders, manage stock levels, take photos, generate smart shopping lists, chat with your inventory using AI, and let Google AI automatically recognize items from photos.

**Written by Guy Azaria with AI help.**

## ✨ Features

### 📦 Smart Inventory Management
- **Hierarchical Explorer** — Navigate through Rooms, Furniture, Shelves, Boxes with no depth limit
- **Live Stock** — Plus and minus buttons update stock immediately in the database
- **Shopping Mode** — A dedicated view showing only items that are out of stock, grouped by location
- **Date Tracking** — Track when items were added, search by Day, Week, Month or Year
- **Edit Tools** — Rename, Cut and Paste to move items, Delete, and image updates

### 💬 AI Chat Interface
- **Natural Language Chat** — Ask questions like "where did I put the winter blankets?" or "what's in the garage?" and get instant answers
- **Smart Search** — The AI queries your inventory database and returns relevant results
- **Add Items by Chat** — Tell the AI "add 3 AA batteries to the kitchen drawer" and it handles everything
- **Inventory Reports** — Ask "how many light bulbs do I have?" or "show me everything in the kids room"
- **Verbose Debug Mode** — See exactly what the AI is doing step by step with expandable debug panels

### 🤖 Camera and AI Recognition
- **Auto Name** — Take a picture, click the sparkles icon, and let AI name the item for you
- **Visual Search** — Take a picture of an object to find where it is stored in your house
- **Item Photos** — Attach photos to items for easy identification

### 🎨 User Experience
- **Sidebar App** — Installs as a native panel in Home Assistant, no Lovelace configuration required
- **Dark Mode** — Full support for both light and dark themes
- **Zero Config** — Truly plug and play
- **Local Database** — All inventory data stored locally in SQLite, no cloud dependency

## 📋 Requirements

- Home Assistant 2024.1.0 or newer
- OpenAI API key (for AI chat functionality)
- Google Gemini API key (optional, for camera AI features)

## 📥 Installation

### Option 1: HACS (Recommended)

1. Open **HACS** then **Integrations**
2. Click the **Menu** then **Custom repositories**
3. Paste the URL: `https://github.com/GuyAzria/home-organizer`
4. Select Category: **Integration**
5. Click **Add**, then find **Home Organizer** in the list and click **Download**
6. **Restart Home Assistant**

### Option 2: Manual

1. Download the `custom_components/home_organizer` folder from this repository
2. Copy it to your Home Assistant `config/custom_components/` directory
3. Restart Home Assistant

## ⚙️ Setup

1. Go to **Settings** then **Devices & Services**
2. Click **Add Integration**
3. Search for **Home Organizer**
4. Enter your **OpenAI API Key** for the AI chat features
5. Optionally enter your **Google Gemini API Key** for camera AI features
6. Click **Submit**

A new icon named **Organizer** will appear in your Home Assistant sidebar. Click it to start.

## 📖 User Guide

### Navigation Bar

- **Up Arrow** — Navigate back to the parent folder
- **Title Area** — Displays your current location path
- **Cart Icon** — Toggles Shopping List Mode
- **Magnifying Glass** — Toggles Search Mode
- **Pencil Icon** — Toggles Edit and Add Mode
- **Chat Icon** — Opens the AI Chat interface

### Adding Items

Click the Pencil icon to reveal the Add Panel at the bottom of the screen.

**Manual:** Type the name, check the date, click Folder to create a location or Item to create a product.

**Camera AI:** Click the Camera icon, take a picture, then click the Sparkles icon. The AI will analyze the image and fill in the name automatically.

**Chat:** Open the chat and type something like "add coffee filters to the kitchen cabinet". The AI will create the item in the right location.

### Managing Inventory

Use the minus and plus buttons on any item row to adjust stock. The database updates immediately.

Expand an item by clicking on it to access rename, date change, photo update, cut and paste to move, or delete.

### Shopping List Mode

Click the Cart icon. The view changes to show only missing items with quantity zero, grouped by location. Click plus on an item you just bought and it returns to normal inventory.

### Search

**Text Search:** Type a name and see results within the current folder and sub folders.

**AI Visual Search:** Click the Camera icon inside the search bar, take a picture, and the AI will identify the object and search your inventory.

**Date Filters:** Use the chips below the search bar to filter by Week, Month or Year.

### AI Chat

Open the chat panel and talk to your inventory naturally. Examples:

- "Where did I put the camping gear?"
- "What do I have in the garage?"
- "Add 2 bottles of olive oil to the pantry"
- "Move the winter blankets from the bedroom to the storage room"
- "Show me everything I added this week"

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ for the Home Assistant community
</p>
