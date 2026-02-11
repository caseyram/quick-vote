# Phase 21: Export/Import + Polish - Research

**Researched:** 2026-02-11
**Domain:** JSON schema evolution, Storage validation, UI thumbnails, QR overlay
**Confidence:** HIGH

## Summary

Phase 21 extends the existing JSON export/import system to handle slides and sequence order alongside batches/questions/votes. The codebase already has robust patterns in place:
- Zod-based validation with backward compatibility (v1.2 imports)
- SessionBlueprint format includes slides (Phase 20)
- Storage path patterns (relative paths, not URLs)
- QR overlay infrastructure (Phase 19)
- browser-image-compression for client-side resize

Key technical decisions:
1. **Interleave slides in batches array** rather than separate top-level sequence field
2. **Validate Storage existence upfront** before importing to catch missing images early
3. **CSS-resized thumbnails** using existing Storage URLs (no separate thumbnail generation)
4. **Extend existing QR toggle** to work on slides (already works on batches)

The implementation is straightforward schema extension work, not new architectural territory.

**Primary recommendation:** Extend existing SessionExportSchema with slide entries in batches array, validate Storage paths before import, add thumbnail display in sequence editor using CSS object-fit.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 3.25.76 | Schema validation | Used throughout for import/export validation |
| browser-image-compression | 2.0.2 | Image resize | Already used for slide uploads |
| qrcode.react | 4.2.0 | QR code rendering | Already used for session join QR codes |
| Supabase Storage | - | File hosting | Project's blob storage backend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/core | - | Drag-and-drop | Already used in BatchList, SequenceManager for reordering |
| Motion/React | - | Animations | Already used in PresentationView for slide transitions |

### Alternatives Considered
None needed — all required infrastructure already exists in the codebase.

**Installation:**
No new dependencies required. All libraries already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
├── session-export.ts     # Export logic (extend with slides)
├── session-import.ts     # Import logic (extend with slides)
├── slide-api.ts          # Storage operations (validation)
└── session-template-api.ts # Blueprint serialization (already handles slides)

src/components/
├── SequenceManager.tsx   # Add thumbnail display
├── QROverlay.tsx         # Already works, needs opacity tweak
└── PresentationView.tsx  # Already renders slides with QR
```

### Pattern 1: Schema Evolution with Backward Compatibility
**What:** Extend existing schemas to include new fields while maintaining v1.2 compatibility
**When to use:** Adding slides to export format
**Example:**
```typescript
// Current v1.2 format:
const BatchExportSchema = z.object({
  name: z.string(),
  position: z.number(),
  questions: z.array(QuestionExportSchema),
});

// Extended format (Phase 21):
const SessionItemExportSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('batch'),
    name: z.string(),
    position: z.number(),
    questions: z.array(QuestionExportSchema),
  }),
  z.object({
    type: z.literal('slide'),
    position: z.number(),
    image_path: z.string(), // relative path
    caption: z.string().nullable(),
  }),
]);

// v1.2 importers silently skip type:'slide' entries (unknown field)
```
**Source:** Existing session-export.ts pattern (lines 1-74)

### Pattern 2: Storage Path Validation
**What:** Validate Storage object existence before creating database records
**When to use:** Import flow with slide references
**Example:**
```typescript
// Validate all slide images exist before importing
async function validateSlideImages(
  slidePaths: string[]
): Promise<{ valid: string[]; missing: string[] }> {
  const valid: string[] = [];
  const missing: string[] = [];

  for (const path of slidePaths) {
    const { data, error } = await supabase.storage
      .from('session-images')
      .list(getFolderPath(path), {
        search: getFilename(path),
      });

    if (error || !data || data.length === 0) {
      missing.push(path);
    } else {
      valid.push(path);
    }
  }

  return { valid, missing };
}
```
**Source:** Derived from slide-api.ts uploadSlideImage pattern (lines 117-138)

### Pattern 3: CSS-Resized Thumbnails
**What:** Use full Storage URL with CSS object-fit instead of separate thumbnail generation
**When to use:** Sequence editor slide previews
**Example:**
```typescript
// In SequenceManager or similar component
function SlideThumbnail({ imagePath }: { imagePath: string }) {
  const url = getSlideImageUrl(imagePath);

  return (
    <div className="w-16 h-16 bg-gray-800 rounded overflow-hidden">
      <img
        src={url}
        alt="Slide preview"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
```
**Source:** Existing SlideDisplay pattern (SlideDisplay.tsx lines 1-18)

### Pattern 4: QR Overlay Extension
**What:** Extend existing QR toggle to work on both batch and slide content types
**When to use:** Presentation view QR overlay
**Example:**
```typescript
// In QROverlay component, corner mode already exists
if (mode === 'corner') {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white/90 rounded-xl shadow-lg p-3">
      {/* Semi-transparent background for scannability on any slide */}
      <QRCodeSVG
        value={sessionUrl}
        size={120}
        level="M"
        marginSize={1}
      />
    </div>
  );
}
```
**Source:** Existing QROverlay.tsx (lines 15-25), add /90 opacity for semi-transparency

### Anti-Patterns to Avoid
- **Separate thumbnail Storage upload:** Browser already resizes images with CSS, don't generate server-side thumbnails
- **Full URLs in export:** Store relative paths (session-images/abc.jpg), construct URLs at display time
- **Importing missing images as broken refs:** Validate upfront and skip missing slides entirely
- **Custom QR positioning logic:** Reuse existing QR overlay component, just adjust opacity

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation | Custom validators | Zod with safeParse | Already used in session-import.ts, handles errors gracefully |
| Image thumbnails | Server-side resize/crop | CSS object-fit on full image | Browser-native, no storage overhead, already compressed by browser-image-compression |
| Storage file existence check | HEAD request loops | Supabase Storage list() with search filter | RLS-aware, batched queries possible |
| QR code overlay | Custom SVG/canvas | Existing QROverlay component | Already positioned, sized, and tested |
| Export filename generation | Manual string manipulation | Existing generateExportFilename | Handles special chars, date stamping (session-export.ts lines 222-235) |

**Key insight:** The codebase already has 90% of infrastructure needed. Extension, not invention.

## Common Pitfalls

### Pitfall 1: Full URLs in Export Break Portability
**What goes wrong:** Exporting full Storage URLs (https://...) instead of relative paths
**Why it happens:** getSlideImageUrl returns full URL, easy to accidentally export that
**How to avoid:** Store only the relative path (slide_image_path field) in export, not constructed URL
**Warning signs:** Import fails across environments, URLs contain domain names in JSON

### Pitfall 2: Missing Image Import Creates Broken Refs
**What goes wrong:** Creating session_items with slide_image_path pointing to non-existent Storage objects
**Why it happens:** No upfront validation, importing JSON from different environment
**How to avoid:** Validate all slide paths exist in Storage BEFORE creating any database records
**Warning signs:** Slides appear in sequence but show broken image icons in UI

### Pitfall 3: Schema Breaking Changes in Export
**What goes wrong:** Changing export format in non-backward-compatible way (e.g., replacing batches array with sequence array)
**Why it happens:** Trying to make export "cleaner" without considering v1.2 importers
**How to avoid:** Extend existing batches array with slide entries (discriminated union), don't restructure top-level schema
**Warning signs:** Old imports fail with validation errors instead of gracefully ignoring slides

### Pitfall 4: Session Template Reference Lost
**What goes wrong:** Exporting session template ID instead of name, or not including template reference at all
**Why it happens:** SessionBlueprint uses template_id (UUID), but export should use template name for portability
**How to avoid:** Look up template names from IDs before export, include in top-level templates array with name only
**Warning signs:** Re-importing loses template provenance, can't trace where session structure came from

### Pitfall 5: Thumbnail Load Overhead
**What goes wrong:** Fetching full-size images for every thumbnail causes slow sequence editor
**Why it happens:** Not using lazy loading, loading all images immediately
**How to avoid:** Use img loading="lazy" attribute, rely on browser caching (images already compressed to ~200KB max)
**Warning signs:** Sequence editor lags when scrolling, network tab shows MB of image downloads

## Code Examples

Verified patterns from existing codebase:

### Export Format Extension
```typescript
// Extend SessionExportSchema to include slides in batches array
// Based on: session-export.ts lines 39-44
export const SessionExportSchema = z.object({
  session_name: z.string(),
  created_at: z.string(),
  batches: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('batch'),
        name: z.string(),
        position: z.number(),
        questions: z.array(QuestionExportSchema),
      }),
      z.object({
        type: z.literal('slide'),
        position: z.number(),
        image_path: z.string(), // relative path, e.g. "sessionId/uuid.webp"
        caption: z.string().nullable(),
      }),
    ])
  ),
  templates: z.array(TemplateExportSchema).optional(),
  session_template_name: z.string().nullable().optional(), // Phase 21: template provenance
});
```

### Storage Path Validation
```typescript
// Validate slide image existence in Storage before import
// Pattern from: slide-api.ts uploadSlideImage (lines 117-138)
async function validateSlideImageExists(imagePath: string): Promise<boolean> {
  // Extract folder and filename
  const pathParts = imagePath.split('/');
  const filename = pathParts[pathParts.length - 1];
  const folder = pathParts.slice(0, -1).join('/');

  const { data, error } = await supabase.storage
    .from('session-images')
    .list(folder, { search: filename });

  if (error) {
    console.warn('Storage validation error:', error);
    return false;
  }

  return data && data.length > 0;
}
```

### Thumbnail Display
```typescript
// Display slide thumbnail in sequence editor
// Based on: SlideDisplay.tsx (lines 1-18) + ImageUploader preview (lines 174-183)
function SlideItemPreview({ imagePath, caption }: { imagePath: string; caption: string | null }) {
  const url = getSlideImageUrl(imagePath);

  return (
    <div className="flex items-center gap-3 p-2">
      <div className="w-16 h-16 bg-gray-800 rounded overflow-hidden flex-shrink-0">
        <img
          src={url}
          alt={caption || 'Slide'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">
          {caption || 'Untitled Slide'}
        </p>
      </div>
    </div>
  );
}
```

### QR Overlay on Slides
```typescript
// Extend existing QR overlay for slides (already works, just needs opacity)
// Source: QROverlay.tsx (lines 15-25)
if (mode === 'corner') {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white/90 rounded-xl shadow-lg p-3">
      {/* /90 = 90% opacity, semi-transparent for scannability on slides */}
      <QRCodeSVG
        value={sessionUrl}
        size={120}
        level="M"
        marginSize={1}
      />
    </div>
  );
}
```

### Import with Missing Image Handling
```typescript
// Import session with upfront slide validation
// Pattern from: session-import.ts importSessionData (lines 299-465)
export async function importSessionDataWithSlides(
  sessionId: string,
  data: SessionImportWithSlides
): Promise<{
  batchCount: number;
  questionCount: number;
  slideCount: number;
  missingSlideCount: number;
}> {
  // Extract all slide paths from import data
  const slidePaths = data.batches
    .filter(b => b.type === 'slide')
    .map(b => b.image_path);

  // Validate all slides exist upfront
  const { valid, missing } = await validateSlideImages(slidePaths);

  if (missing.length > 0) {
    // Require user confirmation if some slides missing
    const proceed = window.confirm(
      `${missing.length} of ${slidePaths.length} slides have missing images and will be skipped. Proceed anyway?`
    );
    if (!proceed) {
      throw new Error('Import cancelled by user');
    }
  }

  // Import only valid slides (skip missing ones entirely)
  // ... rest of import logic
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate slides table | session_items unified table | Phase 16 (2025-02-10) | Sequence order is single source of truth |
| Full Storage URLs in data | Relative paths + getPublicUrl at display | Phase 16 (2025-02-10) | Portability across environments |
| Server-side thumbnails | CSS object-fit on compressed images | Phase 16 (2025-02-10) | No thumbnail storage overhead |
| Template content duplication | Template reference by name | Phase 20 (2025-02-11) | Export includes provenance, not full content |

**Deprecated/outdated:**
- Separate slides table: Removed in Phase 16, now unified in session_items
- Response templates in export content: Phase 20 changed to reference-only (name, not full content)

## Open Questions

None — all technical decisions are locked in CONTEXT.md.

**Implementation questions (Claude's discretion):**
1. **Batch item visual treatment:** Add icons next to batch names in sequence editor? (Recommended: small chart icon for visual consistency with slide thumbnails)
2. **Import progress UX:** Show loading spinner during Storage validation? (Recommended: Yes, validation can take 1-2s for sessions with many slides)
3. **QR card opacity:** Exact opacity level for semi-transparent background (Recommended: bg-white/90 for 90% opacity, ensures scannability)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: session-export.ts, session-import.ts, slide-api.ts, session-template-api.ts
- Database schema: supabase/migrations/20250210_030_session_items.sql, 20250211_050_session_templates.sql
- Existing components: QROverlay.tsx, SlideDisplay.tsx, ImageUploader.tsx, PresentationView.tsx
- Test patterns: session-import.test.ts (525 tests across 37 files)

### Secondary (MEDIUM confidence)
- Zod documentation for discriminated unions (standard pattern)
- Supabase Storage list() API for file existence checks (official docs)

### Tertiary (LOW confidence)
None — all research based on existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used
- Architecture: HIGH - Patterns already exist in codebase, extension is straightforward
- Pitfalls: HIGH - Derived from existing code patterns and migration history

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days - stable libraries, no major version changes expected)
