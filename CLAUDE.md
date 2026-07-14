# GoogleFindMy Card Enhanced - Project Documentation

## Overview

**GoogleFindMy Card Enhanced** is a modern, modular Home Assistant custom card for universal device tracking. It supports Google Find Hub, Traccar, OwnTracks, and any device_tracker with latitude/longitude attributes.

The project uses **TypeScript + Lit + Leaflet + Vite** following Home Assistant dashboard card standards.

## Project Status

- **Current Version:** 0.1.0
- **Current Phase:** 1 - Basic map display ✅
- **Branch:** `develop` (development), `main` (stable releases)

## Architecture

### Tech Stack

- **TypeScript 5.3+** — Type safety
- **Lit 3.1+** — Web components framework
- **Leaflet 1.9+** — Interactive maps
- **Vite 5.0+** — Build tool (IIFE bundle)
- **Terser** — Minification

### Build System

```
src/                    # TypeScript source
  └── .ts files
    ↓ TypeScript
build/dist/
  └── googlefindmy-card.js    # Single IIFE bundle
    ↓ copied to
/config/www/community/googlefindmy-card-enhanced/
  └── googlefindmy-card.js    # Installed in Home Assistant
```

### Component Structure

```
googlefindmy-card.ts (Main)
  ├── Lit Web Component
  ├── Handles Home Assistant integration
  └── Manages config & state

components/map.ts (MapComponent)
  ├── Leaflet map initialization
  ├── Marker rendering
  ├── Polyline drawing
  └── Event handling

types/ha.ts
  └── TypeScript definitions
```

## Development Workflow

### Branch Strategy

- **main** — Production releases. Only merge release tags.
- **develop** — Integration branch. All PRs target this.
- **feature/*** — Feature branches. Branch from `develop`, PR back to `develop`.

### Commit Convention

Commits follow a pattern like:

```
<type>: <description>

<body (optional)>

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

Types: `chore`, `feat`, `fix`, `refactor`, `test`, `docs`

### Build & Test

```bash
npm run build       # TypeScript + Vite → dist/googlefindmy-card.js
npm run dev         # Start Vite dev server (port 5173)
npm run preview     # Preview production build locally
```

## Implementation Roadmap

### Phase 1 ✅ (v0.1.0 - Current)
- [x] Vite + TypeScript + Lit setup
- [x] Leaflet map display
- [x] Single device location marker
- [x] Home Assistant integration basics
- [ ] Test in Home Assistant

### Phase 2 (v0.2.0)
- [ ] Route polyline from location history
- [ ] Numbered waypoint markers (①②③④)
- [ ] Arrow decorators (→) on polyline
- [ ] Start 🏁 and End 🔴 markers
- [ ] Location popup with details

### Phase 3 (v0.3.0)
- [ ] Playback animation system
- [ ] Play/Pause/Reset controls
- [ ] Timeline scrubber
- [ ] Speed adjustment
- [ ] Current playback marker

### Phase 4 (v0.4.0)
- [ ] Statistics panel (distance, time, speed)
- [ ] Export to GPX
- [ ] Export to KML
- [ ] Export to GeoJSON
- [ ] Copy to clipboard

### Phase 5 (v0.5.0+)
- [ ] Multi-device tracking
- [ ] Marker clustering
- [ ] Altitude/elevation profile
- [ ] Heatmap visualization
- [ ] Custom tile layers

## Key Files

| File | Purpose |
|------|---------|
| `src/googlefindmy-card.ts` | Main Lit web component, Home Assistant card registration |
| `src/components/map.ts` | Leaflet map, markers, polylines |
| `src/types/ha.ts` | TypeScript interfaces for HA types |
| `vite.config.ts` | Build configuration (IIFE output) |
| `tsconfig.json` | TypeScript configuration |
| `package.json` | Dependencies and build scripts |

## Home Assistant Integration

### Custom Element Registration

```typescript
@customElement('googlefindmy-card-enhanced')
export class GoogleFindMyCardEnhanced extends LitElement { ... }

window.customCards.push({
  type: 'googlefindmy-card-enhanced',
  name: 'GoogleFindMy Card Enhanced',
  description: '...'
});
```

### Entity Access

```typescript
// In Lit component
@property() hass!: HomeAssistantExtended;
@property() config: CardConfig = {};

// Access entity state
const entity = this.hass.states[this.config.entity];
const lat = entity.attributes.latitude;
const lon = entity.attributes.longitude;
```

### Card Configuration

```yaml
type: custom:googlefindmy-card-enhanced
entity: device_tracker.phone
title: "My Location"
zoom: 15
center: [40.4168, -3.7038]
```

## Styling Notes

- Uses Lit's `@customElement` decorator
- Shadow DOM isolation (`LitElement` + `css` template literal)
- Home Assistant theme integration via CSS custom properties

## Testing Strategy

Currently manual testing in Home Assistant:
1. Build: `npm run build`
2. Copy `dist/googlefindmy-card.js` → Home Assistant www/community folder
3. Refresh dashboard
4. Add card with entity configuration
5. Verify map displays and markers appear

Automated tests (Jest/Vitest) planned for Phase 3+.

## Common Tasks

### Add a new feature
```bash
git checkout -b feature/your-feature develop
# ... make changes ...
npm run build
npm run dev  # test locally
git commit ...
git push origin feature/your-feature
# Create PR to develop
```

### Update dependencies
```bash
npm update
npm run build
# Test changes
git commit -am "chore: update dependencies"
```

### Prepare a release
```bash
git checkout develop
# Verify all tests pass, features complete
git checkout main
git merge develop
git tag v0.2.0
git push origin main --tags
# Create GitHub release
```

## Notes for Future Work

- When implementing Phase 2 (arrows + numbered markers), use `leaflet-polylinedecorator` library
- History data can come from:
  1. Home Assistant History API (recorder)
  2. Custom provider (Google Find Hub specific data)
  3. Entity attributes (if stored there)
- Animation Phase 3 should be frame-based (requestAnimationFrame) for smooth playback
- Consider performance with 1000+ historical points → implement clustering/simplification

## Related Links

- [Lit Documentation](https://lit.dev/)
- [Leaflet Documentation](https://leafletjs.com/)
- [Home Assistant Custom Card Development](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card)
- [Vite Documentation](https://vitejs.dev/)
