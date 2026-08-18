# Google FindMy Device (Find Hub) - Home Assistant Dashboard Card <img src="https://github.com/BSkando/GoogleFindMy-HA/blob/main/icon.png" width="30"> 

A beautiful, feature-rich card for the Google Find My Device integration with interactive Leaflet maps, location history tracking, and an intuitive visual editor.

<img width="507" height="407" alt="image" src="https://github.com/user-attachments/assets/fb2bc324-b80a-4be1-987f-3aa8b3e6b455" />
<img width="508" height="409" alt="image" src="https://github.com/user-attachments/assets/826051c2-9a97-42f5-81cd-2c4ff439d2b1" />
<img width="511" height="410" alt="image" src="https://github.com/user-attachments/assets/56ea8cda-114c-4788-a73a-5792370fc938" />

## Features

### 🗺️ **Interactive Leaflet Maps**
- Full-featured Leaflet.js maps with OpenStreetMap tiles
- Real-time map updates with smooth animations
- Zoom controls and pan navigation
- Color-coded markers (Red = current location, Blue = history)
- GPS accuracy circles around each location point
- Interactive popups with detailed location information
- Path visualization connecting historical locations

### 📍 **Location History Tracking**
- Fetch and display location history from Home Assistant recorder
- Configurable time ranges: 1, 3, or 7 days
- Visual path showing device movement over time
- Deduplication of location points
- Timestamp and accuracy information for each point
- Report source detection (Own Device vs Network/Crowd-sourced)

### 🎛️ **Advanced Filtering**
- **Time Range Filter**: Quick selection buttons for 1d, 3d, 7d history
- **Accuracy Filter**: Slider to filter out inaccurate GPS points (0-300m)
- **Marker Transparency**: Adjust historical marker opacity (0-100%)
- **Filter Persistence**: Settings saved in localStorage and persist across sessions
- Collapsible filter panel to maximize map space

### 🎨 **Beautiful Design**
- Modern Google Material Design aesthetic
- Sliding device sidebar with device cards
- Responsive layout that works on all screen sizes
- Status badges with color coding (Home/Away/Unknown)
- Mobile-optimized with compact device cards
- Smooth animations and transitions

### 📱 **Device Management**
- Device list sidebar with toggle button
- Option to pin device list open
- Device selection with highlighted active device
- Status dots showing online/offline state
- Last seen timestamps with smart formatting
- Location names displayed on device cards

### ⚡ **Quick Actions**
- **Refresh All** - Update all device locations
- **Toggle Device List** - Show/hide device sidebar
- **Filter Controls** - Access history and accuracy filters

### 🎛️ **Visual Editor**
- Easy-to-use configuration interface
- Automatically discover GPS-enabled device trackers, including devices added later
- Hide individual automatically discovered devices without removing their configuration
- Filter keywords to limit automatic discovery (e.g., "googlefindmy")
- Toggle switches for all display options
- No YAML editing required

## Installation

### HACS (Recommended)

1. Click the button below and select 'add'\
[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BSkando&repository=GoogleFindMy-Card&category=plugin)
1. Download the card in HACS
1. Add the card to your Home Assistant dashboard

### Manual Installation
In case you don't have [Home Assistant My links](https://www.home-assistant.io/integrations/my/) enabled (it is by default).

1. In Home Assistant → HACS → Frontend
1. Click ⋮ menu → Custom repositories
1. Add `https://github.com/BSkando/GoogleFindMy-Card` repo URL
1. Select category: Dashboard
1. Click Add

## Configuration

### Visual Editor

The card includes a visual configuration editor. Simply:

1. Add the card type "Google Find My Device Card"
2. Use the visual editor to:
   - Enable **Automatically add new GPS devices** for automatic discovery
   - Select which devices to display in manual mode, or hide individual devices in automatic mode
   - Toggle display options
   - Customize the card title

### YAML Configuration

For advanced users, here's the full YAML configuration:

```yaml
type: custom:googlefindmy-card
title: "My Devices"                    # Optional: Card title
auto_discover: true                     # New cards default to true; existing cards remain manual until enabled
filter_keywords: "googlefindmy"         # Optional: Limit automatic discovery by entity ID
hidden_entities:                        # Optional: Automatically discovered devices to hide
  - device_tracker.googlefindmy_airpods
entities:                               # Optional metadata for discovered devices, or manual allowlist when auto_discover is false
  - entity: device_tracker.googlefindmy_phone
    name: "My Phone"                   # Optional: Custom name
    icon: mdi:cellphone                 # Optional: Custom icon

# Display Options (all optional)
show_last_seen: true                   # Show last seen timestamps
show_location_name: true               # Show location names in device cards
enable_actions: true                   # Enable action buttons (Play Sound)
keep_device_list_pinned: false         # Keep device sidebar always open
show_history: true                     # Show historical points; false keeps only the current location
show_path_lines: true                  # Show path lines connecting history points
use_leaflet_map: true                  # Use Leaflet maps (set false for iframe fallback)
```

## Card Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | "Find My Devices" | Card title displayed in header |
| `auto_discover` | boolean | `true` for new cards | Discover eligible GPS `device_tracker` entities from Home Assistant. Existing cards without this option remain in manual mode. |
| `entities` | list | `[]` | Manual-mode allowlist. In automatic mode, matching object entries supply custom names and icons. |
| `hidden_entities` | list | `[]` | Entity IDs to exclude from automatic discovery. Hidden IDs remain stored while an entity is unavailable. |
| `show_last_seen` | boolean | `true` | Show last seen timestamps on device cards |
| `show_location_name` | boolean | `true` | Show location names on device cards |
| `enable_actions` | boolean | `true` | Enable "Play Sound" action button |
| `keep_device_list_pinned` | boolean | `false` | Keep device sidebar permanently open |
| `show_history` | boolean | `true` | Show historical Leaflet points. Set to `false` to display only the current live location without recorder history requests. |
| `show_path_lines` | boolean | `true` | Draw lines connecting historical location points |
| `use_leaflet_map` | boolean | `true` | Use Leaflet interactive maps (false = iframe fallback) |
| `filter_keywords` | string | `""` | Comma-separated entity-ID keywords that limit automatic GPS-device discovery (e.g., "googlefindmy,iphone") |

## Entity Configuration

Each entity can be configured with additional options:

```yaml
entities:
  - entity: device_tracker.iphone
    name: "John's iPhone"              # Custom display name
    icon: mdi:cellphone-iphone         # Custom icon
  - device_tracker.keys               # Simple entity reference
```

## Examples

### Basic Configuration
This legacy/manual configuration displays only the saved `entities` list. Cards created before `auto_discover` was introduced keep this behavior until it is explicitly enabled.

```yaml
type: custom:googlefindmy-card
entities:
  - device_tracker.iphone
  - device_tracker.airpods
```

### Full Featured with Custom Names
```yaml
type: custom:googlefindmy-card
title: "Family Devices"
entities:
  - entity: device_tracker.johns_iphone
    name: "John's iPhone"
    icon: mdi:cellphone-iphone
  - entity: device_tracker.janes_iphone
    name: "Jane's iPhone"
    icon: mdi:cellphone-iphone
  - entity: device_tracker.car_keys
    name: "Car Keys"
    icon: mdi:car-key
show_last_seen: true
show_location_name: true
enable_actions: true
show_path_lines: true
```

### Pinned Device List
```yaml
type: custom:googlefindmy-card
title: "Device Tracker"
entities:
  - device_tracker.iphone
  - device_tracker.ipad
  - device_tracker.airpods
keep_device_list_pinned: true
show_path_lines: true
```

### Automatically Discover and Hide Devices
```yaml
type: custom:googlefindmy-card
title: "Google Find My Devices"
auto_discover: true
filter_keywords: "googlefindmy"  # Only discover Google Find My devices
hidden_entities:
  - device_tracker.googlefindmy_airpods
entities:
  - device_tracker.googlefindmy_iphone
    name: "My Phone"              # Optional metadata for an auto-discovered device
    icon: mdi:cellphone
```

### Filter Specific Integration (Manual)
```yaml
type: custom:googlefindmy-card
title: "Google Find My Devices"
filter_keywords: "googlefindmy"  # Used by the editor; manual mode uses the explicit allowlist
entities:
  - device_tracker.googlefindmy_iphone
  - device_tracker.googlefindmy_airpods
```

## Using the Filter Panel

When `show_history` is enabled, the card includes a filter panel for controlling location history display. The panel is hidden when `show_history: false`; saved filter settings remain available if history is enabled again.

1. **Access Filters**: Click the device list toggle button to show devices, select a device
2. **Open Filter Panel**: The filter panel appears in the top-right corner with a "📅 Filters" button
3. **Time Range**: Select 1d, 3d, or 7d to control how much history is shown
4. **Accuracy Filter**: Drag the slider to filter out inaccurate GPS points (0 = disabled, max 300m)
5. **Marker Transparency**: Adjust the transparency of historical markers (0-100%)
6. **Persistence**: All filter settings are automatically saved and restored on page reload

## Map Features

- **Current Location**: Marked with a large red pin
- **Historical Locations**: Marked with smaller blue pins at 75% size
- **Path Lines**: Blue lines connect historical points in chronological order
- **Accuracy Circles**: Semi-transparent circles show GPS accuracy
- **Current-Location-Only Mode**: Set `show_history: false` to render only the live red marker and its accuracy circle. This applies to the card's Leaflet map and does not control content in an external `configuration_url` iframe.
- **Popup Information**: Click any marker to see:
  - Coordinates
  - GPS accuracy
  - Timestamp
  - Report source (Own Device vs Network)
  - Entity state

## Styling

The card uses CSS custom properties for theming and will automatically adapt to your Home Assistant theme:

```css
--primary-color: Card accents and buttons
--card-background-color: Card background
--primary-text-color: Main text
--secondary-text-color: Secondary text
--divider-color: Borders and dividers
```

## Requirements

- Home Assistant 2023.1 or newer
- Google Find My Device integration (or any GPS-enabled device_tracker)
- Recorder integration enabled when `show_history` is enabled (not required for current-location-only mode)
- Modern browser with ES6 module support
- Internet connection for OpenStreetMap tiles and Leaflet.js CDN

## Troubleshooting

### No devices showing
- Ensure you have GPS-enabled device_tracker entities
- Check that device tracker entities exist in Developer Tools → States
- In manual mode, verify entity names in the `entities` allowlist
- In automatic mode, verify `filter_keywords` matches the entity ID and the device is not in `hidden_entities`

### Map not loading
- Check browser console for JavaScript errors
- Verify internet connection (Leaflet loads from CDN)
- Ensure device has valid GPS coordinates (latitude/longitude attributes)
- Try disabling browser extensions that might block external resources

### Location history not showing
- Confirm `show_history` is enabled
- Verify Home Assistant recorder integration is enabled
- Check that your device has historical location data in Developer Tools → History
- Try selecting a longer time range (7 days instead of 1 day)
- Clear browser cache and reload the page

### Filters not persisting
- Check browser localStorage is enabled
- Ensure you're using the same browser/device
- Try clearing site data and reconfiguring filters

### Actions not working
- Ensure Google Find My Device integration services are available
- Check Home Assistant logs for service call errors
- Verify device IDs match entity naming (e.g., `device_tracker.phone` → device_id: `phone`)

### Mobile display issues
- The card is optimized for mobile with responsive breakpoints at 768px
- Device sidebar has adjusted spacing to avoid overlapping zoom controls
- Try rotating device to landscape for larger map view

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/BSkando/GoogleFindMy-Card).
