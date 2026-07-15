# Deployment Notes

## Recommended target

- Static hosting, ideally GitHub Pages.

## Entry points

- `Japonais/index.html` redirects to the dashboard.
- `Japonais/jlpt-quest-dashboard/index.html` is the dashboard itself.

## Data flow

- Morning and evening automation both write to `Japonais/progression.json`.
- The dashboard reads the same file and reflects the latest state.

## Manual verify

- Open `Japonais/index.html` locally or on the hosted site.
- Confirm the dashboard loads.
- Confirm the JSON path resolves relative to `jlpt-quest-dashboard/index.html`.
