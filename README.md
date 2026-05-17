<div align="center">
  <img src="src/icon.png" width="128" alt="FileTagz Logo" />
  <h1>FileTagz</h1>
  <p><b>Premium color file-tagging & secure vault utility for Windows</b></p>
</div>

## 🌟 Overview
**FileTagz** is a modern, glassmorphic Windows utility that brings macOS-style color tagging to the native Windows File Explorer. Beyond just organizing files visually, FileTagz features a powerful **Secure Vault** mechanism that can completely hide tagged files at the OS level, keeping them safe behind a user-defined password.

Built with an **Electron** frontend and robust **Windows Shell integration**, FileTagz offers a seamless context menu experience right where you need it.

---

## ✨ Key Features
- 🎨 **Visual Color Tags**: Tag your files and folders with customizable color indicators.
- 🖱️ **Shell Extension**: Full integration into the Windows Right-Click Context Menu for quick tagging.
- 🔒 **Secure Vault**: Hide tagged files using OS-level system attributes. Access is protected by a custom master password.
- 🛡️ **UAC Integration**: Secure password-recovery and system-level operations backed by Windows User Account Control.
- 💫 **Premium Interface**: A sleek, fully responsive, glassmorphic tag manager UI.
- 🗄️ **Local Database**: Fast, lightweight tracking of tagged files using a normalized JSON database.

## 🚀 What's New in v1.0.2 (May 17, 2026)

### 🌟 Features & Enhancements
- **Native Windows Context Menu Drop-Down:** Completely rewrote the Windows Explorer integration. Right-clicking a file in Windows now displays the FileTagz logo alongside a cascading drop-down menu containing all your custom tags.
- **Dynamic Registry Syncing:** The Windows context menu now automatically rebuilds and syncs itself in the background whenever you create, rename, or delete a tag inside the app.
- **Silent External Tagging:** Tagging a file via the Windows right-click menu now applies the tag silently in the background and instantly live-reloads the UI if the application is currently open.
- **Tactile UI Sounds:** Introduced a premium 0.1-second tactile click sound that plays on all interactive UI elements. Custom audio `.mp3`/`.wav` upload support was added in settings!
- **New Themes:** Added two highly requested aesthetic themes: **Hacker (Matrix)** and **Rose Pine**.
- **Branded Tray Icon:** Replaced the default taskbar icon with a custom Blue-to-Purple gradient icon matching the premium FileTagz branding.
- **"Open With..." Support:** Added a functional `Open With...` button inside the app's right-click menu that invokes the native Windows application chooser.
- **Smart Self-Cleaning Installer:** The installer performs a clean, one-click upgrade and automatically deletes its own setup file from the desktop once finished.

### ⚡ Performance Optimizations
- **Ultra-Lightweight Architecture:** Disabled Chromium hardware acceleration, site isolation, and redundant background threads. This drastically reduces the application's memory footprint and eliminates unnecessary sub-processes in the Task Manager.
- **Single Instance Lock:** Enforced a single-instance lock to prevent the app from spawning duplicate background processes.

### 🐛 Bug Fixes
- **Context Menu Duplication:** Fixed a UI bug where repeatedly right-clicking a file inside the app would stack and duplicate the custom context menu.
- **Ghost Folders Fixed:** Implemented strict physical existence checks when scanning directories. The app will no longer display deleted or non-existent "ghost" folders in the file grid.
- **Vault Desync & Password Hang Fix:** The Vault securely reads the password hash directly from disk to fix caching bugs. Also replaced the unreliable PowerShell UAC script with a secure native confirmation dialog.

---

## 📥 Download & Install

You don't need to be a developer to use FileTagz! You can simply download and run the installer.

### Minimum Requirements
- **OS:** Windows 10 or Windows 11 (64-bit)
- **Permissions:** Administrator privileges (for the initial context menu setup and Vault UAC features)
- **Storage:** ~100MB of free space

### Installation Steps
1. Navigate to the **[Releases](https://github.com/Ayaan3216/FileTagz/releases)** page on GitHub.
2. Under the latest release, click to download the `FileTagz Setup <version>.exe` file.
3. Double-click the downloaded `.exe` to run the installer.
4. Once installed, FileTagz will be available on your machine, and the color-tagging option will immediately become active in your native Windows Right-Click Context Menu!

---

## 💻 Developer Setup

If you want to view the code, build from source, or contribute to FileTagz, follow the steps below.

### Prerequisites (For Developers)
- Windows 10 or 11
- [Node.js](https://nodejs.org/) (v16+)
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ayaan3216/FileTagz.git
   cd FileTagz
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Register Windows Context Menu:**
   For right-click functionality in File Explorer, run the registry setup:
   - You can execute `register_context_menu.ps1` to integrate with the shell.
   - To remove it later, run `unregister_context_menu.ps1`.

### Running the App Locally
Start the Electron development server:
```bash
npm start
```
*(Or run `npm run dev` for dev-mode)*

---

## 🛠️ Building for Production

FileTagz can be built into standalone Windows installers or AppX packages.

```bash
# Build an AppX package (Windows Store format)
npm run build

# Build a standard Windows NSIS installer (.exe)
npm run build:exe

# Build both AppX and NSIS
npm run build:all
```
Your compiled applications will be available in the `/dist` directory.

---

## 📂 Project Structure
- `src/` - The frontend HTML/CSS/JS for the glassmorphic manager UI.
- `main.js` - The main Electron process handling OS-level interactions, vault logic, and database operations.
- `preload.js` - Secure IPC bridge between the UI and backend logic.
- `context_menu.reg` / `*.ps1` - Scripts for adding/removing Windows Explorer shell extensions.
- `repair_db.js` / `normalize_db.js` - Utilities for fixing and maintaining the local `tags.json` state.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Ayaan3216/FileTagz/issues).

## 📄 License
This project is licensed under the MIT License - see the [package.json](package.json) file for details.

---
<div align="center">
  <i>Developed with ❤️ by Ayaan4uThere</i>
</div>
