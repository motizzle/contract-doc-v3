# Version Unsharing: Auto-Switch for Vendors

## Problem
When an editor unshared a version with vendors:
1. The version remained visible in the vendor's version list
2. If a vendor was currently viewing the unshared version, they weren't automatically switched to a different version
3. Vendors had to manually refresh or switch versions to see the change

## Solution

### Server-Side Logic
When a version is unshared (`/api/v1/versions/:n/share` with `shared: false`):

1. **Calculate Fallback Version**
   - Scans all existing versions to find shared ones
   - Selects the most recent shared version (excluding the one being unshared)
   - Falls back to Version 1 if no other shared versions exist
   - Version 1 is always shared (demo document)

2. **Broadcast Enhanced Event**
   - Broadcasts `version:shared` event with:
     - `sharedWithVendor: false`
     - `fallbackVersion: <number>` (for vendors to switch to)

### Client-Side Logic
`VersionsPanel` handles the event differently based on user role:

#### For Vendors
When receiving `version:shared` with `sharedWithVendor: false`:

1. **Remove from List**
   - Filters out the unshared version from the vendor's version list
   - Version disappears immediately

2. **Auto-Switch if Viewing**
   - Checks if vendor is currently viewing the unshared version
   - If yes, automatically calls `/api/v1/versions/view` with `fallbackVersion`
   - Vendor is seamlessly switched to the fallback version

#### For Editors
- Version remains in list (editors see all versions)
- Metadata is updated to reflect unshared state
- No auto-switching (editors control their own view)

## User Experience

### Scenario: Editor Unshares Version 3

**Before (Problem):**
```
Vendor viewing v3 → Editor unshares v3 → Vendor still sees v3 in list and is still viewing it
```

**After (Fixed):**
```
Vendor viewing v3 → Editor unshares v3 → Vendor auto-switched to v2, v3 disappears from list
```

### Fallback Priority
1. Most recent shared version (e.g., v5 → v4 → v3)
2. Version 1 (always shared, demo document)

### Example Scenarios

#### Scenario 1: Multiple Shared Versions
- Versions: v1 (shared), v2 (shared), v3 (shared), v4 (unshared)
- Vendor viewing: v3
- Editor unshares: v3
- **Result:** Vendor switches to v2 (most recent shared)

#### Scenario 2: Only Version 1 Shared
- Versions: v1 (shared), v2 (unshared), v3 (unshared)
- Vendor viewing: v3
- Editor unshares: v3
- **Result:** Vendor switches to v1 (only shared version)

#### Scenario 3: Vendor Not Viewing Unshared Version
- Versions: v1 (shared), v2 (shared), v3 (shared)
- Vendor viewing: v2
- Editor unshares: v3
- **Result:** v3 removed from vendor's list, vendor stays on v2

## Implementation Details

### Files Changed
- `server/src/server.js` (lines 3451-3494)
  - Enhanced share endpoint with fallback calculation
  - Added fallback version to broadcast event

- `shared-ui/components.react.js` (lines 4260-4305)
  - Updated `onVersionShared` handler
  - Added vendor-specific logic for unsharing
  - Auto-switch to fallback if viewing unshared version

### Key Functions

#### `canAccessVersion(userId, versionNumber, versionData)`
Vendors can only access shared versions:
```javascript
if (role === 'vendor') {
  const version = versionData.find(v => v.version === versionNumber);
  return version && version.sharedWithVendor === true;
}
```

#### `filterVersionsForUser(userId, allVersions)`
Vendors only see shared versions:
```javascript
if (role !== 'vendor') return allVersions;
return allVersions.filter(v => v.sharedWithVendor === true);
```

## Testing

### Manual Test Steps
1. Create versions 1, 2, 3 (share all with vendor)
2. As vendor (Hugh), view version 3
3. As editor (Warren), unshare version 3
4. **Verify:** Vendor auto-switches to version 2
5. **Verify:** Version 3 disappears from vendor's list

### Edge Cases
- ✅ Unshare version 1 → Blocked (returns 400 error)
- ✅ Unshare last shared version → Falls back to v1
- ✅ Vendor not viewing unshared version → No switch, just removal from list
- ✅ Editor unshares version → Editor still sees all versions

## Future Enhancements
- Notification toast when auto-switched ("Version 3 was unshared, switched to Version 2")
- Activity log entry for vendor auto-switches
- Bulk unshare with confirmation dialog

