# Status Values - Single Source of Truth

## Valid Status Values (6 total)

1. **working draft** - Initial state
2. **staff review** - Internal review stage
3. **external review** - External party review
4. **final approval** - Pre-signature approval
5. **pending signature** - Awaiting signatures
6. **fully executed** - Fully signed and complete ✨ (triggers confetti)

## Implementation Status

### ✅ Frontend (components.react.js)
- StatusBadge component: Uses dropdown with all 6 statuses
- Default value: `'working draft'`
- Line 4454: `const allStatuses = ['working draft', 'staff review', 'external review', 'final approval', 'pending signature', 'fully executed'];`

### ✅ Backend (server.js)
- **POST /api/v1/status/set** - Direct status selection (preferred)
- **POST /api/v1/status/cycle** - Cycle through statuses (backward compat)
- Default value: `'working draft'`
- All initialization code uses `'working draft'`

### ✅ Presets
- **empty**: status = `'working draft'`
- **nearly-done**: status = `'external review'`

### ✅ Tests
- All 137 tests passing
- Status cycle test verifies all 6 statuses are reachable
- Line 903: `const allStatuses = ['working draft', 'staff review', 'external review', 'final approval', 'pending signature', 'fully executed'];`

## Migration Notes

### Old Values (REMOVED)
- ❌ `'draft'` → replaced with `'working draft'`
- ❌ `'in progress'` → replaced with `'working draft'`
- ❌ `'review'` → replaced with `'staff review'` or `'external review'`
- ❌ `'final'` → replaced with `'final approval'` or `'fully executed'`

### What Changed
- **Server**: All 7 instances of `'draft'` → `'working draft'`
- **Presets**: empty/state.json updated
- **API**: `/api/v1/status/set` accepts only the 6 new values
- **Tests**: Confirmed all statuses work end-to-end

## Special Behavior

### Confetti Celebration 🎉
Only triggers on status change to `'fully executed'` (line 2164 in components.react.js)

### Status Badge Styling
- **Working Draft**: Gray medium
- **Staff Review**: Gray medium
- **External Review**: Gray dark
- **Final Approval**: Gray dark
- **Pending Signature**: Gray very dark
- **Fully Executed**: Gray very dark

## Verification
```bash
cd server && npm test
# ✅ All 137 tests passing
```

