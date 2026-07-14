# Installation Guide - GoogleFindMy Card Enhanced

## Installation Methods

### Method 1: HACS (Recommended - Coming Soon)

Once this card is registered with HACS, it will appear in HACS → Frontend.

1. Open Home Assistant → HACS → Frontend
2. Click "Explore & Download Repositories"
3. Search for "GoogleFindMy Card Enhanced"
4. Click "Download"
5. Restart Home Assistant

### Method 2: Manual Installation (Current - v0.1.0 Testing)

#### Step 1: Create Directory

```bash
mkdir -p /config/www/community/googlefindmy-card-enhanced
cd /config/www/community/googlefindmy-card-enhanced
```

#### Step 2: Download the Card

**Option A: From Latest GitHub Release**
```bash
wget https://github.com/davicho16/GoogleFindMy-Card-Enhanced/releases/download/latest/googlefindmy-card.js
```

**Option B: Build from Source**
```bash
git clone https://github.com/davicho16/GoogleFindMy-Card-Enhanced.git
cd GoogleFindMy-Card-Enhanced
npm install
npm run build
cp dist/googlefindmy-card.js /config/www/community/googlefindmy-card-enhanced/
```

#### Step 3: Add to Lovelace (YAML Mode)

1. Open Home Assistant → Settings → Dashboards → [Your Dashboard] → Edit Dashboard (⋮ menu)
2. Click **⋮** → **Edit Dashboard**
3. Click **⋮** → **Raw Configuration Editor**
4. Add this to the top level:
   ```yaml
   resources:
     - url: /local/community/googlefindmy-card-enhanced/googlefindmy-card.js
       type: module
   ```
5. Save and close

#### Step 4: Add Card to Dashboard

1. In dashboard edit mode, click **+ Add card**
2. Click **Create custom**
3. Paste this configuration:

```yaml
type: custom:googlefindmy-card-enhanced
entity: device_tracker.your_device_name
title: "Device Tracker"
```

Replace `device_tracker.your_device_name` with your actual device tracker entity.

4. Click **Save**

### Method 3: Visual Configuration (UI Mode)

After adding the card type:

1. Click the card to enter edit mode
2. Use the visual editor to:
   - Select the device_tracker entity
   - Set the title
   - Adjust zoom level

## Troubleshooting Installation

### Card Not Appearing

**Error: "Custom element googlefindmy-card-enhanced is not recognized"**

- ✅ Verify `hacs.json` resources section is added correctly
- ✅ Check file is at `/config/www/community/googlefindmy-card-enhanced/googlefindmy-card.js`
- ✅ Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- ✅ Check browser console for JavaScript errors (F12)
- ✅ Restart Home Assistant if changes were made to resources

### Map Not Displaying

**Error: "Map container not found" or blank map**

- ✅ Verify device_tracker entity exists: Developer Tools → States
- ✅ Ensure entity has `latitude` and `longitude` attributes
- ✅ Check browser console for errors
- ✅ Try increasing card height in dashboard configuration

### Configuration Not Valid

**Error: "Invalid configuration provided"**

- ✅ Check YAML syntax (indentation, quotes)
- ✅ Verify `entity:` matches an existing device_tracker
- ✅ Reload browser after config changes

## Configuration Examples

### Basic - Single Device

```yaml
type: custom:googlefindmy-card-enhanced
entity: device_tracker.phone
title: "My Phone"
```

### With Custom Zoom

```yaml
type: custom:googlefindmy-card-enhanced
entity: device_tracker.iphone
title: "iPhone Location"
zoom: 16
```

### With Custom Center

```yaml
type: custom:googlefindmy-card-enhanced
entity: device_tracker.car
title: "Car Location"
center: [40.4168, -3.7038]  # Madrid
zoom: 14
```

## Finding Your Device Tracker Entity

1. Go to Home Assistant → Developer Tools → States
2. Search for "device_tracker"
3. Look for entities that have `latitude` and `longitude` attributes
4. Use the entity ID in your card config

Examples:
- `device_tracker.john_iphone` (Google Find Hub)
- `device_tracker.phone` (Traccar)
- `device_tracker.ipad_2` (OwnTracks)
- `device_tracker.car` (Generic)

## Supported Data Sources

✅ Google Find Hub  
✅ Traccar  
✅ OwnTracks  
✅ Home Assistant Companion App  
✅ Any device_tracker with latitude/longitude  

## Next Steps

1. ✅ Install the card
2. ✅ Add it to your dashboard
3. ⏳ Verify location displays correctly
4. ⏳ Wait for Phase 2 (route visualization, numbered waypoints, arrows)

## Getting Help

- 📖 Full documentation: [README.md](README.md)
- 🐛 Report issues: [GitHub Issues](https://github.com/davicho16/GoogleFindMy-Card-Enhanced/issues)
- 💬 Discuss: [Home Assistant Community](https://community.home-assistant.io/)

## Manual Update (Before HACS Release)

```bash
cd /config/www/community/googlefindmy-card-enhanced
wget -O googlefindmy-card.js https://github.com/davicho16/GoogleFindMy-Card-Enhanced/releases/download/latest/googlefindmy-card.js
```

Then refresh your browser (Ctrl+Shift+R).
