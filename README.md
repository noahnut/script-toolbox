# Script Toolbox

A macOS desktop app for organizing and running shell and Python scripts from a clean UI — without opening a terminal.

## Download

Grab the latest `.dmg` from the [Releases](../../releases) page, open it, and drag **Script Toolbox** to your Applications folder.

> **First launch:** macOS may block an unsigned app. Right-click the app icon and choose **Open**, then confirm in the dialog. You only need to do this once.

---

## Features

- Add individual `.sh` / `.py` scripts or import an entire folder at once
- Organize scripts into groups with drag-and-drop (scripts and groups both draggable)
- Search scripts by name
- Run scripts and stream live output (stdout in white, stderr in red)
- Declare parameters in script comments — the app renders a form automatically
- Edit scripts in-place with syntax highlighting (Bash / Python)

---

## Organizing Scripts

### Add a script
Click **+ Script** in the sidebar footer and pick one or more `.sh` or `.py` files.

### Import a folder
Click **+ Folder** to scan a directory. All `.sh` and `.py` files are imported and placed in a new group named after the folder.

### Create a group
Click **+ Group** to add an empty organizational group. Groups can be nested inside other groups.

### Drag to reorganize
- Drag a **script row** onto any group header to move it there. Drop on **All Scripts** to remove it from any group.
- Drag a **group header** onto another group to nest it, or drop on **All Scripts** to make it a root group.

### Rename or delete a group
Right-click any group header for a context menu with **Rename** and **Delete** options. Deleting a group also removes all scripts inside it.

---

## Running Scripts

Select a script from the sidebar to open it. Click **▶ Run** to execute it.

Output streams live into the terminal panel:
- White — standard output
- Red — standard error
- Blue — system messages (start command, exit code)

Click **Clear** to wipe the output.

---

## Script Parameters

Annotate your scripts with special comments and Script Toolbox will render a parameter form automatically.

### Annotation format

```bash
#!/bin/bash
# @description A short description shown in the header
# @param NAME required "What this parameter does"
# @param ENV default:production "Target environment"
# @param DEBUG optional "Enable verbose output"
```

| Mode | Behaviour |
|---|---|
| `required` | Field marked with `*`; Run is blocked until filled |
| `default:VALUE` | Pre-filled with VALUE; user can override |
| `optional` | Empty by default; omitted from the env if left blank |

Parameters are passed to the script as **environment variables**:

```bash
#!/bin/bash
# @param TARGET required "Deployment target"
echo "Deploying to $TARGET"
```

The same syntax works for Python:

```python
# @description Process a data file
# @param INPUT required "Path to input file"
# @param FORMAT default:csv "Output format"

import os
input_path = os.environ["INPUT"]
fmt = os.environ.get("FORMAT", "csv")
```

---

## Editing Scripts

Click **Edit** to open the script in an in-app editor with syntax highlighting. Edit the file, then click **Save** to write it back to disk. Click **Cancel** to discard changes.

After saving, the parameter form and description in the header are automatically refreshed.

---

## Build from Source

**Requirements:** [Node.js 20+](https://nodejs.org), [Rust](https://rustup.rs), Xcode Command Line Tools

```bash
git clone https://github.com/YOUR_USERNAME/script-toolbox
cd script-toolbox
npm install
make dev        # start dev server
make build      # build release DMG
make test       # run all tests
```

The DMG is written to `src-tauri/target/release/bundle/dmg/`.

---

## Tech Stack

- [Tauri 2](https://tauri.app) — Rust backend, native macOS window
- React + TypeScript + Vite — frontend
- Zustand — state management
- CodeMirror 6 — in-app editor
- Vitest — unit tests
