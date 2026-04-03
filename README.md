# Ultimate Light Card

A custom Lovelace card for Home Assistant that provides an elegant glass-style light control.

## Features

- **Auto-detection** — automatically detects whether your light is switchable, dimmable, has color temperature, or has RGB color support
- **Brightness slider** — drag horizontally across the card to set brightness
- **Tap to toggle** — tap (without dragging) to toggle the light on/off
- **Color temperature** — slider shown when the light supports color temp
- **Color picker** — native color picker shown when the light supports RGB/HS/XY
- **Glass morphism style** — frosted glass design with smooth gradients
- **GUI Editor** — configure entity and name directly in the Lovelace UI

## Installation

### HACS (recommended)

1. Open HACS in Home Assistant
2. Go to **Frontend** → click the **⋮** menu → **Custom repositories**
3. Add `https://github.com/JOUW-USERNAME/ultimate-light-card` with category **Dashboard**
4. Click **Install**
5. Refresh your browser (hard refresh: Ctrl+Shift+R)

### Manual

1. Download `ultimate-light-card.js` from the [latest release](https://github.com/Sven2410/ultimate-light-card/releases/latest)
2. Copy it to `/config/www/ultimate-light-card.js`
3. Add the resource in **Settings → Dashboards → ⋮ → Resources**:
   - URL: `/local/ultimate-light-card.js`
   - Type: JavaScript Module

## Configuration

### Visual Editor

1. Add a card to your dashboard
2. Search for **Ultimate Light Card**
3. Select your light entity and give it a name

### YAML

```yaml
type: custom:ultimate-light-card
entity: light.living_room
name: Spots
```

| Option   | Type   | Required | Description                          |
|----------|--------|----------|--------------------------------------|
| `entity` | string | **Yes**  | A `light.*` entity ID                |
| `name`   | string | No       | Display name (falls back to friendly name) |

## Screenshots

_Coming soon_

## License

MIT
