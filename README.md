# starfox-viewing-submitter

Chrome Extension (Manifest V3) that auto-selects an available viewing date on Flatfox and submits it.

## What it does

- Runs automatically on `https://flatfox.ch/en/viewing/*`
- Scans `input[type="radio"]` options for a valid viewing date
- Ignores:
  - disabled options
  - options containing `Cannot attend`
  - options containing `Date is fully booked`
- If a valid option exists:
  - selects it with a small randomized click delay
  - waits 1-3 seconds
  - clicks `button[aria-label="Save"]`
- If no valid option exists:
  - waits a random 1-5 minutes
  - reloads the page

Console output includes:

- `[StarfoxViewingSubmitter] Available viewing found`
- `[StarfoxViewingSubmitter] Refreshing in X seconds`
- `[StarfoxViewingSubmitter] Submitting booking`

The extension also shows a small floating status panel at the bottom-right of the viewing page so you can see current state without opening DevTools.
You can set the refresh `Min` and `Max` minutes directly in that panel and click `Save` (the value is persisted locally).

## Install (local)

1. Clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the `starfox-viewing-submitter` folder.

## Usage

1. Open a Flatfox viewing page, for example:
   - `https://flatfox.ch/en/viewing/<your-viewing-id>`
2. Keep the tab open.
3. Open DevTools Console to watch bot logs.

## Notes

- This extension intentionally avoids deterministic timings to reduce bot-like behavior.
- The script is defensive and exits safely when target elements are missing.
