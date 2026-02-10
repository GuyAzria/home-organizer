# ⚠️ Beta Version — Use at your own risk

<p align="center">
  <img src=".github/branding/logo.png" alt="Home Organizer Logo" width="180">
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

Home Organizer is a dedicated full-screen application for your Home Assistant sidebar. It allows you to manage home inventory with ease using nested folders, stock tracking, and advanced AI features powered by OpenAI and Google Gemini.

**Developed by Guy Azaria.**

## ✨ Features

### 📦 Smart Inventory Management
* **Hierarchical Explorer** — Navigate through Rooms, Furniture, Shelves, and Boxes with unlimited depth.
* **Live Stock Tracking** — Instantly update stock levels with quick-action buttons.
* **Shopping Mode** — A dedicated view for out-of-stock items, organized by location.
* **Date Tracking** — Track when items were added and filter by day, week, month, or year.
* **Management Tools** — Easy Rename, Move (Cut/Paste), and Delete functions.

### 💬 AI Chat Interface
* **Natural Language Queries** — Ask "Where are the winter blankets?" or "What's in the garage?"
* **AI-Driven Actions** — Add items via chat: "Add 3 AA batteries to the kitchen drawer."
* **Inventory Reports** — Request summaries like "Show me everything in the kids' room."
* **Debug Mode** — Expandable panels to see the AI's step-by-step logic.

### 🤖 Camera and AI Recognition
* **Auto-Naming** — Snap a photo and let AI identify and name the item automatically.
* **Visual Search** — Use photos to locate where specific objects are stored in your home.

### 🎨 User Experience
* **Sidebar Integration** — Installs as a native panel for easy access.
* **Theme Support** — Full support for Light and Dark modes.
* **Privacy First** — All inventory data is stored locally in a SQLite database.

## 📋 Requirements

* Home Assistant 2024.1.0 or newer
* **OpenAI API Key**: Required for AI chat and logic.
* **Google Gemini API Key**: Optional, required for advanced image recognition features.

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
3. Enter your API keys when prompted.
4. The **Organizer** icon will appear in your sidebar.

## 📄 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---
<p align="center">Made with ❤️ for the Home Assistant community</p>
