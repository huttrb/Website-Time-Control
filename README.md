# Website Time Control

> A compact Chrome extension for tracking website usage, reviewing trends, and keeping custom time rules under control.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square)](public/manifest.json)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![Storage](https://img.shields.io/badge/Data-local%20storage-7c3aed?style=flat-square)](#privacy)

[Русская версия](README.ru.md)

## Overview

Website Time Control tracks how much time you spend on active browser tabs and stores the statistics locally. The popup includes a quick usage list, date filters, custom tracking rules, settings, and a separate statistics page with summaries and charts.

## Highlights

| Area | What it does |
| --- | --- |
| Tracking | Measures time spent on the active tab and saves it per site or custom rule. |
| Filters | Shows Today, Yesterday, Week, Month, All time, and a custom date range. |
| Statistics | Provides a dedicated page with totals, averages, top sites, domain groups, daily dynamics, best day, streak, and recent activity. |
| Rules | Supports named tracking rules with domain, URL pattern, and enabled state. |
| Favorites | Pins important sites to the top of the main popup list. |
| Privacy | Keeps settings and usage data in `chrome.storage.local`. |

## Screens

### Popup

- Current active tab with favicon and tracked time.
- Sort and time filters.
- Favorite toggle and quick delete actions.
- Date picker with highlighted days that contain statistics.

### Statistics Page

Open it from the chart icon in the top-right toolbar, next to settings.

- Total tracked time and average per active day.
- Time spent on favorite sites.
- Longest active-day streak.
- Horizontal period selector for Today, Yesterday, Week, Month, All time, and a custom date range.
- Activity chart with compact day labels, hover details, and a calendar that highlights days with saved statistics. For longer periods, the chart focuses on the latest 14 days.
- Top sites with percentage bars.
- Domain-level breakdown.
- Best day, top site, tracked site count, and recent activity.

### Settings Page

- Language selection.
- Track all sites or only selected rules.
- Minimum visible time threshold.
- Add, edit, enable, disable, and remove custom tracked sites.
- Clear all saved statistics with confirmation.

## How Tracking Works

The extension listens to active tab changes and saves elapsed time for the current tracked site.

When **Track only selected sites** is disabled:

- Every regular website can be tracked.
- If the current URL matches a custom tracking rule, time is saved under that rule's stable key and displayed using its name.
- If no rule matches, time is saved under the page hostname.

When **Track only selected sites** is enabled:

- Only enabled entries from the tracking list are tracked.
- Tabs that do not match any enabled rule are ignored.

Tracking rules are matched by URL pattern and domain. The display name is only a label, so two different domains can share the same name without merging their statistics.

## Tracking Rules

Each tracked site entry contains:

| Field | Purpose |
| --- | --- |
| `Name` | Label shown in the popup and statistics page. |
| `Domain` | Domain used for favicon lookup and fallback matching. |
| `Pattern` | URL fragment used for more specific matching. |
| `Enabled` | Whether the rule is active. |

More specific URL patterns are checked before broader domain-style matches.

## Language

The extension supports Russian and English.

On first launch, the language is detected automatically from the browser UI language. If the browser language starts with `ru`, Russian is used; otherwise English is used. After you manually select a language in settings, that choice is saved and used on future launches.

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
