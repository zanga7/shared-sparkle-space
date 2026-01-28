
# Kawaii Face Overlay System Implementation Plan

## Overview

This plan adds an optional kawaii-style face overlay system to existing avatars, featuring simple eyes and mouths with occasional micro-animations (blink, wink, smile, tongue). The system is designed to be extremely lightweight since many avatars can appear on a page simultaneously.

## Architecture Summary

```text
┌─────────────────────────────────────────────────────────────────┐
│                    KAWAII AVATAR SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  UserAvatar (existing)                                          │
│       │                                                         │
│       ▼                                                         │
│  KawaiiAvatarWrapper (new)                                      │
│       │                                                         │
│       ├── Base Avatar (children, unchanged)                     │
│       │                                                         │
│       └── KawaiiFaceOverlay (absolute positioned SVG)           │
│               │                                                 │
│               ├── Left Eye Group                                │
│               ├── Right Eye Group                               │
│               ├── Mouth Group                                   │
│               └── Tongue Group (hidden by default)              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Animation Scheduler (singleton)                                │
│       │                                                         │
│       ├── IntersectionObserver (visibility tracking)            │
│       ├── Registered avatars map                                │
│       ├── Global animation timer (single setInterval)           │
│       └── Animation state (max 1-3 concurrent)                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Super Admin Controls (app_settings or global_style_settings)   │
│       │                                                         │
│       ├── kawaii_faces_enabled (boolean)                        │
│       ├── kawaii_animations_enabled (boolean)                   │
│       ├── kawaii_default_style (line | round | happy)           │
│       └── kawaii_animation_frequency (slow | normal | fast)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Phase 1: Database Schema Update

Add kawaii face settings to the existing `global_style_settings` table:

**New columns:**
- `kawaii_faces_enabled` (boolean, default: true)
- `kawaii_animations_enabled` (boolean, default: true)  
- `kawaii_face_style` (text, default: 'line')
- `kawaii_animation_frequency` (text, default: 'normal')
- `kawaii_min_animate_size` (integer, default: 30)

### Phase 2: CSS Animations

**File: `src/index.css`**

Add lightweight CSS keyframes using only transforms and opacity:

- **Blink**: `scaleY(1) → scaleY(0.1) → scaleY(1)` (120ms)
- **Wink Left/Right**: Same as blink but targets one eye
- **Smile**: Slight scale/translate on mouth (180ms)
- **Tongue**: Opacity and translateY for tongue reveal (200ms)

Animation classes:
- `.kawaii-do-blink`
- `.kawaii-do-wink-left`
- `.kawaii-do-wink-right`
- `.kawaii-do-smile`
- `.kawaii-do-tongue`

### Phase 3: Face Overlay Component

**File: `src/components/ui/kawaii-face-overlay.tsx`**

Props:
- `size: number` - Pixel size for scaling
- `faceStyle: 'line' | 'round' | 'happy'`
- `animationClass?: string` - Currently active animation

Implementation:
- Pure inline SVG with minimal shapes
- Black/white only (strokes, no heavy fills)
- Uses `vector-effect="non-scaling-stroke"` for consistent line weights
- Positioned absolutely in center of parent
- `pointer-events: none`

**Face Styles:**

| Style | Eyes | Mouth |
|-------|------|-------|
| `line` | Curved lines (^_^) | Small curve |
| `round` | Small filled circles | Small curve |
| `happy` | Upside-down arcs (smiling) | Bigger curve |

### Phase 4: Animation Scheduler Utility

**File: `src/lib/kawaii-scheduler.ts`**

Singleton utility managing all avatar animations:

```text
Scheduler API:
- registerAvatar(el, options) - Add avatar to pool
- unregisterAvatar(el) - Remove avatar from pool
- setEnabled(enabled) - Toggle animations globally

Internal Logic:
1. Single setInterval timer (every 700-1200ms, seeded variability)
2. Filter avatars: visible (IntersectionObserver) + size >= minSize
3. Global cap: max 1-3 animations active at any time
4. Pick random action weighted:
   - Blink: 60%
   - Wink: 25%
   - Smile: 12%
   - Tongue: 3% (very rare)
5. Apply animation class, remove after 250ms
6. Use seed for per-user timing consistency
```

### Phase 5: Kawaii Avatar Wrapper Component

**File: `src/components/ui/kawaii-avatar.tsx`**

A wrapper component that adds kawaii faces to any avatar:

Props:
- `children: ReactNode` - The base avatar element
- `size: number | 'xs' | 'sm' | 'md' | 'lg'` - Avatar size
- `seed?: string | number` - Stable per-user seed for timing
- `faceStyle?: 'line' | 'round' | 'happy'` - Override default style
- `animate?: boolean` - Override animation setting (default: true)
- `enabled?: boolean` - Show face at all (default: from settings)

Behavior:
- Wraps children in relative container
- Renders `KawaiiFaceOverlay` as absolute overlay
- Attaches IntersectionObserver for visibility
- Registers/unregisters with scheduler based on visibility
- Skips animation for size < minAnimateSize (30px default)

### Phase 6: Integration with UserAvatar

**File: `src/components/ui/user-avatar.tsx`**

Update to optionally wrap output in `KawaiiAvatarWrapper`:

- Add optional prop: `kawaiiFace?: boolean` (default: from global settings)
- Add optional prop: `faceStyle?: 'line' | 'round' | 'happy'`
- When enabled, wrap the avatar output in `KawaiiAvatarWrapper`

Size mapping for animation threshold:
| Size | Pixels | Animates |
|------|--------|----------|
| xs | 20px (h-5) | No |
| sm | 24px (h-6) | No |
| md | 32px (h-8) | Yes |
| lg | 40px (h-10) | Yes |

### Phase 7: Context Provider for Settings

**File: `src/contexts/KawaiiContext.tsx`**

Lightweight context for kawaii settings:

```text
KawaiiSettings:
- enabled: boolean
- animationsEnabled: boolean
- defaultStyle: 'line' | 'round' | 'happy'
- animationFrequency: 'slow' | 'normal' | 'fast'
- minAnimateSize: number
```

Fetched from `global_style_settings` with 5-minute cache (same pattern as GlobalStyleContext).

### Phase 8: Super Admin Controls

**File: `src/pages/super-admin/StyleSettings.tsx`**

Add new "Avatar Faces" tab or card:

Controls:
1. **Enable Kawaii Faces** - Toggle (on/off)
2. **Enable Animations** - Toggle (on/off)
3. **Default Face Style** - Select (line/round/happy)
4. **Animation Frequency** - Select (slow/normal/fast)
5. **Min Size for Animation** - Number input (default: 30px)

Include preview section showing sample avatar with each face style.

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/ui/kawaii-face-overlay.tsx` | Face SVG component |
| `src/components/ui/kawaii-avatar.tsx` | Wrapper component |
| `src/lib/kawaii-scheduler.ts` | Animation scheduler singleton |
| `src/contexts/KawaiiContext.tsx` | Settings context provider |

## Files to Modify

| File | Changes |
|------|---------|
| `src/index.css` | Add kawaii animation keyframes |
| `src/components/ui/user-avatar.tsx` | Optional kawaii wrapper |
| `src/pages/super-admin/StyleSettings.tsx` | Add kawaii controls tab |
| `src/contexts/GlobalStyleContext.tsx` | Add kawaii settings to query |
| `src/main.tsx` | Add KawaiiProvider to app tree |

## Database Migration

Add columns to `global_style_settings`:

```sql
ALTER TABLE global_style_settings
ADD COLUMN kawaii_faces_enabled boolean DEFAULT true,
ADD COLUMN kawaii_animations_enabled boolean DEFAULT true,
ADD COLUMN kawaii_face_style text DEFAULT 'line',
ADD COLUMN kawaii_animation_frequency text DEFAULT 'normal',
ADD COLUMN kawaii_min_animate_size integer DEFAULT 30;
```

## Performance Considerations

1. **Single Timer**: One global setInterval, not per-avatar
2. **IntersectionObserver**: Only visible avatars are in animation pool
3. **CSS-only Animations**: Transforms and opacity only, GPU-accelerated
4. **Minimal SVG**: No filters, blurs, or heavy masks
5. **Animation Cap**: Max 1-3 concurrent animations
6. **Size Threshold**: No animations for avatars < 30px
7. **Lazy Registration**: Avatars register only when visible

## Rollout Strategy

1. Feature flag via `kawaii_faces_enabled` - defaults to true
2. All existing avatars automatically enhanced
3. Super admin can disable entirely if performance issues
4. Animation frequency control for fine-tuning

## Expected Visual Result

Small avatars (xs, sm used in lists):
- Show static kawaii face (no animation)
- Face scaled proportionally

Medium/Large avatars (md, lg in headers, columns):
- Show kawaii face with occasional animations
- Blink most common, tongue very rare
- Smooth, delightful micro-interactions
