# Google Find My Device Card

A beautiful, feature-rich Lovelace card for tracking devices with interactive maps and location history.

## ✨ Key Features

- 🗺️ **Interactive Leaflet Maps** - Full-featured maps with zoom, pan, and OpenStreetMap tiles
- 📍 **Location History** - View device movement over 1, 3, or 7 days with visual paths
- 🎛️ **Advanced Filtering** - Filter by time range, GPS accuracy, and adjust marker transparency
- 💾 **Persistent Settings** - Filter preferences saved automatically in browser
- 📱 **Mobile Optimized** - Responsive design with compact device cards
- 🎨 **Modern Design** - Google Material Design with smooth animations
- ⚡ **Quick Actions** - Refresh devices, toggle device list
- 🎯 **Visual Editor** - Easy configuration with auto-discovery of GPS devices

## 🗺️ Map Capabilities

- Color-coded markers (🔴 Red = current location, 🔵 Blue = history)
- GPS accuracy circles around each point
- Interactive popups with detailed location information
- Path lines connecting historical locations
- Report source detection (Own Device vs Network/Crowd-sourced)

## 📊 Location History

Fetches location data from Home Assistant recorder and displays:
- Configurable time ranges (1d, 3d, 7d)
- Accuracy filtering to hide inaccurate GPS points
- Deduplication of location points
- Timestamp and accuracy for each historical marker

## 🎛️ Filter Panel

- **Time Range**: Quick buttons for common time periods
- **Accuracy Filter**: Slider from 0-300m to filter GPS points
- **Marker Transparency**: Adjust opacity of historical markers (0-100%)
- **Persistence**: All settings saved in localStorage

## 💡 Perfect For

- Google Find My Device integration users
- Anyone with GPS-enabled device_tracker entities
- Tracking family member locations
- Finding lost devices (phones, tablets, AirTags, etc.)
- Monitoring device movement patterns

## 📋 Requirements

- Home Assistant 2023.1+
- Recorder integration enabled
- GPS-enabled device_tracker entities
- Modern browser with ES6 support
