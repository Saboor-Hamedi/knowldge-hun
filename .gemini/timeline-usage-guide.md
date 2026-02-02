# 📜 Git Timeline - How to Use

## Overview

The Git Timeline feature allows you to view the version history of your files directly within Knowledge Hub, similar to VS Code's Timeline view.

## How It Works

### 1. **Accessing Timeline View**

- Click the **History** icon (📜) in the Activity Bar (left sidebar)
- The Timeline panel will replace the file explorer sidebar

### 2. **Viewing File History**

When you have the Timeline view active:

- **Open any file** from your vault
- The Timeline will **automatically update** to show that file's Git commit history
- You'll see:
  - **Commit message** (subject line)
  - **Author name** (in blue)
  - **Timestamp** (when the commit was made)
  - **Visual timeline** with connecting lines and bullet points

### 3. **Interacting with Commits**

- **Hover** over any commit to see hover effects
- **Click** on a commit to view its content (triggers `timeline:compare` event)
- The most recent commits appear at the top

### 4. **Empty States**

If you see:

- **"Open a file to view its history"** - No file is currently open
- **"No history found for this file"** - The file has no Git commits yet
- **"Failed to load version history"** - There was an error fetching the history

### 5. **Switching Back**

- Click the **Files** icon (📄) in the Activity Bar to return to the file explorer
- Your file will remain open in the editor

## Requirements

✅ **Git repository must be initialized** in your vault

- If not initialized, click "Initialize" in the status bar
- This creates a `.git` folder and a default `.gitignore`

✅ **Files must be committed** to Git

- Only committed files will show history
- New/uncommitted files will show "No history found"

## Visual Design

The Timeline uses:

- **Vertical line** connecting all commits
- **Bullet points** for each commit (hover to see glow effect)
- **Same width** as the sidebar (300px by default)
- **Premium glassmorphism** aesthetic matching the app theme

## Auto-Refresh

The Timeline automatically refreshes when:

- ✅ You **open a different file** (while in History view)
- ✅ You **save a file** (Git status updates)
- ✅ You **switch to History view** (shows current file's history)

## Tips

💡 **Best Practice**: Commit your notes regularly to build up a meaningful history
💡 **Performance**: Shows last 50 commits per file (configurable in `git.ts`)
💡 **Cross-platform**: Works on Windows, macOS, and Linux

---

**Enjoy tracking your knowledge evolution! 🚀**
