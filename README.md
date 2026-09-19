# Dated Folders

Create new notes directly in a date-based folder such as `notes/2026/09/19`, chosen from the creation time. Pick the granularity: year (`YYYY`), month (`YYYY/MM`), week (`YYYY/MM/DD` of the week start, Monday or Sunday), or day (`YYYY/MM/DD`).

## How it works

- **Direct placement.** When the core asks where a new note should go (Ctrl+N, the ribbon, or clicking an unresolved `[[link]]`), the plugin answers with today's dated folder. The note is created there, so there is no move afterwards and no link rewriting.
- **Fallback.** Notes created through other paths (some plugin APIs bypass the question above) are moved into the dated folder right after you open them, but only when they are empty, landed in the core's default location, and were opened within a second of creation. Notes created elsewhere on purpose, such as daily notes, are left alone.
- Dated folders are created ahead of time on startup and at midnight, so the folder always exists when you need it.

## Settings

| Setting | Meaning |
|---|---|
| Base folder | Root of the dated tree. Empty means the vault root. |
| Granularity | year / month / week / day |
| Week starts on | Monday or Sunday (week granularity only) |
| Placement method | Automatic (recommended), direct placement only, or move after creation only |
| Apply to notes created from links | Route `[[link]]`-created notes too. Links containing a folder are always respected. |
| File extensions | Default `md`. Add `canvas` to route new canvases. |
| Remove empty dated folders | Delete empty dated folders the plugin itself created when the date rolls over. |

While enabled, the plugin overrides the core setting "Default location for new notes".

## Development

```
npm install
npm test        # unit tests (vitest)
npm run dev     # watch build → main.js
npm run build   # type-check + minified build
```

Copy `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/dated-folders/` to try it out.
