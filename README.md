# Google FindMy Device (Find Hub) - Home Assistant Lovelace Card <img src="https://github.com/BSkando/GoogleFindMy-HA/blob/main/icon.png" width="30"> 

A beautiful, feature-rich Lovelace card for the Google Find My Device integration with interactive Leaflet maps, location history tracking, and an intuitive visual editor.

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
- Auto-discovery of GPS-enabled device trackers
- Filter keywords to find specific devices (e.g., "googlefindmy")
- Toggle switches for all display options
- No YAML editing required

## Installation

### HACS (Recommended)

1. Click the button below and select 'add'\
[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BSkando&repository=GoogleFindMy-Card&category=plugin)
1. Download the card in HACS
1. Add the card to your Lovelace dashboard

### Manual Installation
In case you don't have [Home Assistant My links 
](https://www.home-assistant.io/integrations/my/) enabled (it is by default).

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
   - Select which devices to display
   - Toggle display options
   - Customize the card title

### YAML Configuration

For advanced users, here's the full YAML configuration:

```yaml
type: custom:googlefindmy-card
title: "My Devices"                    # Optional: Card title
entities:                              # Required: List of device tracker entities
  - device_tracker.iphone
  - device_tracker.airpods
  - entity: device_tracker.keys
    name: "My Keys"                    # Optional: Custom name
    icon: mdi:key                      # Optional: Custom icon

# Display Options (all optional)
show_last_seen: true                   # Show last seen timestamps
show_location_name: true               # Show location names in device cards
enable_actions: true                   # Enable action buttons (Play Sound)
keep_device_list_pinned: false         # Keep device sidebar always open
show_path_lines: true                  # Show path lines connecting history points
use_leaflet_map: true                  # Use Leaflet maps (set false for iframe fallback)
filter_keywords: ""                    # Comma-separated keywords to filter devices
```

## Card Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | "Find My Devices" | Card title displayed in header |
| `entities` | list | **Required** | List of device tracker entities to display |
| `show_last_seen` | boolean | `true` | Show last seen timestamps on device cards |
| `show_location_name` | boolean | `true` | Show location names on device cards |
| `enable_actions` | boolean | `true` | Enable "Play Sound" action button |
| `keep_device_list_pinned` | boolean | `false` | Keep device sidebar permanently open |
| `show_path_lines` | boolean | `true` | Draw lines connecting historical location points |
| `use_leaflet_map` | boolean | `true` | Use Leaflet interactive maps (false = iframe fallback) |
| `filter_keywords` | string | `""` | Comma-separated keywords to filter device entities (e.g., "googlefindmy,iphone") |

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

### Filter Specific Integration
```yaml
type: custom:googlefindmy-card
title: "Google Find My Devices"
filter_keywords: "googlefindmy"  # Only show Google Find My devices
entities:
  - device_tracker.googlefindmy_iphone
  - device_tracker.googlefindmy_airpods
```

## Using the Filter Panel

The card includes a powerful filter panel for controlling location history display:

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
- Recorder integration enabled (for location history)
- Modern browser with ES6 module support
- Internet connection for OpenStreetMap tiles and Leaflet.js CDN

## Troubleshooting

### No devices showing
- Ensure you have GPS-enabled device_tracker entities
- Check that device tracker entities exist in Developer Tools → States
- Verify entity names in card configuration
- Try using `filter_keywords` in the visual editor to find your devices

### Map not loading
- Check browser console for JavaScript errors
- Verify internet connection (Leaflet loads from CDN)
- Ensure device has valid GPS coordinates (latitude/longitude attributes)
- Try disabling browser extensions that might block external resources

### Location history not showing
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
