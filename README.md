# GoogleFindMy Card Enhanced

🗺️ **Universal device tracking card for Home Assistant** - works with Google Find Hub, Traccar, OwnTracks, and any device_tracker entity with latitude/longitude.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Lit](https://img.shields.io/badge/Lit-3.1+-blue.svg)](https://lit.dev/)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1+-blue)](https://www.home-assistant.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features - Phase 1 (Current: v0.1.0)

✅ **Core Features**
- Interactive Leaflet maps with OpenStreetMap tiles
- Real-time device location tracking
- Support for any GPS-enabled device_tracker entity
- Current location display with accuracy information
- Responsive design for desktop and mobile

🚀 **Planned Features**

| Phase | Features |
|-------|----------|
| **Phase 2** | Route visualization with numbered points, arrow indicators, start/end markers |
| **Phase 3** | Playback animation with play/pause, timeline scrubber |
| **Phase 4** | Statistics (distance, time, speed), export to GPX/KML/GeoJSON |
| **Phase 5** | Multi-device support, advanced clustering, altitude visualization |

## Quick Start

### Installation

1. **Copy the card file to Home Assistant:**
   ```bash
   mkdir -p /config/www/community/googlefindmy-card-enhanced
   cd /config/www/community/googlefindmy-card-enhanced
   # Download dist/googlefindmy-card.js from releases
   ```

2. **Add to Lovelace dashboard:**
   ```yaml
   type: custom:googlefindmy-card-enhanced
   entity: device_tracker.your_device
   title: "My Location"
   ```

### Basic Configuration

```yaml
type: custom:googlefindmy-card-enhanced
entity: device_tracker.phone
title: "Location"
```

### Advanced Configuration

```yaml
type: custom:googlefindmy-card-enhanced
entity: device_tracker.phone
title: "Device Tracker"
zoom: 15
center: [40.4168, -3.7038]  # [lat, lon]
```

## Supported Data Sources

| Source | Latitude | Longitude | Accuracy | Speed | Bearing | Altitude |
|--------|----------|-----------|----------|-------|---------|----------|
| **Google Find Hub** | ✅ | ✅ | ✅ | ⏳ | ⏳ | ⏳ |
| **Traccar** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **OwnTracks** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **HA Companion** | ✅ | ✅ | ✅ | ⏳ | ⏳ | ⏳ |
| **Generic device_tracker** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

⏳ = Planned support, ❌ = Not applicable

## Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/GoogleFindMy-Card-Enhanced.git
cd GoogleFindMy-Card-Enhanced
npm install
```

### Development Workflow

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure

```
src/
├── googlefindmy-card.ts           # Main web component & card registration
├── components/
│   ├── map.ts                    # Leaflet map implementation
│   ├── history.ts                # (TBD) History tracking
│   ├── popup.ts                  # (TBD) Location popup
│   └── animation.ts              # (TBD) Route playback
├── services/
│   └── ha-api.ts                # (TBD) Home Assistant API integration
├── utils/
│   └── helpers.ts               # (TBD) Helper functions
├── animation/
│   └── playback.ts              # (TBD) Timeline playback
├── styles/
│   └── global.css               # (TBD) Global styles
└── types/
    └── ha.ts                    # TypeScript definitions

dist/
└── googlefindmy-card.js         # Compiled output (IIFE)
```

### Build Output

The build process compiles TypeScript + Lit into a single IIFE bundle:

```bash
npm run build
# → dist/googlefindmy-card.js (169 KB gzipped to 50 KB)
```

Ready to install in Home Assistant!

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

## Requirements

- Home Assistant 2024.1+
- ES2020+ compatible browser
- Recorder integration enabled (for history features in Phase 3+)
- Internet connection for OpenStreetMap tiles

## Configuration Reference

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `entity` | string | **required** | Device tracker entity ID |
| `title` | string | "Tracker" | Card title |
| `zoom` | number | 12 | Initial map zoom level (1-19) |
| `center` | `[lat, lon]` | auto | Initial map center |

## Contributing

We welcome contributions! 

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add your feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Open a Pull Request

### Development Branches

- `main` — Production releases (stable)
- `develop` — Active development (integration point)
- `feature/*` — Feature branches (create from develop)

## Troubleshooting

### Map not displaying
- Check browser console for errors
- Verify entity exists in Developer Tools → States
- Ensure device has valid latitude/longitude attributes

### Location not updating
- Check entity last_updated timestamp
- Verify Home Assistant can access the device
- Try manual refresh in Home Assistant UI

## License

MIT License - See [LICENSE](LICENSE) for details

## Acknowledgments

- Original [GoogleFindMy-Card](https://github.com/BSkando/GoogleFindMy-Card) project
- [Leaflet.js](https://leafletjs.com/) mapping library
- [Home Assistant](https://www.home-assistant.io/) community
- [Lit](https://lit.dev/) web components framework

## Support

Found a bug? Have a feature idea? 
[Open an issue on GitHub](https://github.com/YOUR_USERNAME/GoogleFindMy-Card-Enhanced/issues)

---

**Current Phase:** 1️⃣ Basic map display (Active Development)
**Next Phase:** 2️⃣ Route visualization with numbered waypoints and arrows
