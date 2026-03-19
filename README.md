# 🐝 TabBee

**The Busy Bee that Organizes Your Tabs!**

TabBee is a Chrome extension that automatically groups your browser tabs based on domain rules you configure. Stop hunting through dozens of open tabs — let TabBee keep them organized for you.

## Features

- **Automatic Tab Grouping** — Tabs are grouped as soon as they load, based on your rules
- **Custom Rules** — Map any domain pattern (e.g. `github.com`) to a named group with a color
- **Merge Groups** — Merge tab groups with the same name from different windows into one
- **8 Group Colors** — Blue, red, yellow, green, pink, purple, cyan, and orange
- **Multi-Window Support** — Groups are managed per window; use the Merge feature to consolidate
- **Real-Time Updates** — Rule changes apply immediately without reloading

## Installation

TabBee is not yet on the Chrome Web Store. Install it in developer mode:

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the `TabBee` folder
5. The extension is now active — open its settings to add rules

## Usage

### Adding Rules

1. Click the TabBee icon in your toolbar, or go to `chrome://extensions` → TabBee → **Details** → **Extension options**
2. Enter a **Website Pattern** (domain, e.g. `github.com`)
3. Enter a **Group Name** (e.g. `Work`)
4. Pick a **Color** for the group
5. Click **Add Rule**, then **Save All Rules**

From now on, any tab matching that domain will be automatically placed in that group.

### Merging Groups Across Windows

If the same site is open in two Chrome windows, TabBee creates a separate group in each window (this is a Chrome limitation). To consolidate them:

1. Open TabBee settings
2. Scroll to the **Merge Tab Groups** section
3. Click **Refresh** to see groups that exist in multiple windows
4. Click **Merge into this window** on the group you want to keep — all matching tabs from other windows will be moved into that group

### Editing and Deleting Rules

- Click **Edit** on a rule to change its pattern, group name, or color
- Click **Delete** and confirm to remove a rule

## How It Works

TabBee listens for tab creation and navigation events. When a tab finishes loading, its URL is checked against your saved rules. If a match is found, the tab is added to the matching group in that window (or a new group is created if none exists).

Rules are stored in Chrome's local storage and loaded by the background service worker on startup.

## Permissions

| Permission | Why it's needed |
|---|---|
| `tabs` | Read tab URLs and move tabs between groups/windows |
| `tabGroups` | Create, update, and query tab groups |
| `storage` | Save and load your grouping rules |
| `<all_urls>` | Read the URL of any tab to apply rules |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Submit a pull request

Bug reports and feature requests are welcome via GitHub Issues.

## License

MIT
