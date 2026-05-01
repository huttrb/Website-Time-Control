# Website Time Control

A Chrome extension for tracking how much time you spend on websites. It shows per-site usage time, supports favorites, date filters, custom tracked site rules, and a compact popup UI designed for quick checks.

[Russian version](README.ru.md)

## Features

- Tracks time spent on active browser tabs.
- Shows usage by Today, Yesterday, Week, Month, All time, or a custom date range.
- Highlights available dates in the calendar when statistics exist for them.
- Lets you mark sites as favorites and keeps them at the top of the list.
- Supports tracking all websites or only selected sites.
- Supports custom tracking rules with name, domain, pattern, and enabled state.
- Uses stable tracking keys so different domains can share the same display name without merging their statistics.
- Stores settings and statistics locally with `chrome.storage.local`.
- Runs as a Manifest V3 extension.

## How Tracking Works

The extension listens to active tab changes and saves elapsed time for the current tracked site.

When **Track only selected sites** is disabled:

- Every regular website can be tracked.
- If the current URL matches a custom tracking rule, time is saved under that rule's stable key and displayed using its name.
- If no rule matches, time is saved under the page hostname.

When **Track only selected sites** is enabled:

- Only enabled entries from the tracking list are tracked.
- Tabs that do not match any enabled rule are ignored.

Tracking rules are matched by pattern/domain. The display name is only a label, so two different domains may use the same name without conflicts.

## Tracking Rules

Each tracked site entry contains:

- **Name**: label shown in the popup.
- **Domain**: domain used for favicon lookup and fallback matching.
- **Pattern**: URL fragment used for more specific matching.
- **Enabled**: whether the rule is active.

More specific URL patterns are checked before broader domain-style matches.

## Loading in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the generated `dist/` folder.

## Tech Stack

- Vue 3
- TypeScript
- Pinia
- Vue Router
- Tailwind CSS
- Vite
- Chrome Extensions Manifest V3

## Permissions

The extension uses:

- `tabs`: to detect the active tab, URL, title, and favicon.
- `storage`: to save settings and usage statistics locally.

## Privacy

Website usage data is stored locally in the browser using `chrome.storage.local`. The extension does not define any external backend or sync service in this project.
