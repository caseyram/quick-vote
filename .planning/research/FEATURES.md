# Feature Landscape: Presentation Mode

**Domain:** Presentation-mode audience response / image slides interspersed with voting
**Researched:** 2026-02-10
**Context:** v1.3 milestone extending existing v1.2 real-time voting app with response templates
**Confidence:** MEDIUM-HIGH (based on competitive analysis of Mentimeter, Kahoot, Slido, AhaSlides, Poll Everywhere, SlideLizard, and Canva; verified against official help docs and product pages)

## Existing v1.2 Features (Already Built)

For context, QuickVote already has:
- Session creation with unique admin link (no accounts)
- Question management (add, edit, reorder) with drag-and-drop
- Two vote types: agree/disagree, multiple choice
- QR code join flow with lobby
- Admin voting controls (start, close, reveal, timer)
- Live-updating bar chart results with template-consistent ordering
- Per-question anonymous vs named voting
- Full-screen tactile voting UI with animations (dark theme, participant)
- Admin light theme (projection-friendly)
- Self-paced batch voting mode with progress indicators
- Batch creation with question grouping and activation
- Response templates (reusable option sets, consistent layout)
- Session export/import (JSON with templates, name-based dedup)
- Admin session management (list, reopen, delete)

---

## Table Stakes for Presentation Mode

Features users expect from any tool that mixes content slides with voting. Missing these means the feature feels broken or unfinished.

### Unified Sequence

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Single ordered list of slides + batches | Every competitor (Mentimeter, Kahoot, Slido, AhaSlides) presents polls and content as one unified slide deck. Users think in "deck order," not "two separate lists." This is the defining mental model of presentation mode. | Medium | New `sequence_items` or `slides` entity with polymorphic ordering |
| Drag-and-drop reordering of sequence | Admin must arrange slides and batches freely. Existing dnd-kit infra supports this pattern (already used in BatchList, TemplateEditor). | Low-Medium | Unified sequence model, existing dnd-kit |
| Admin manual advance through sequence | Every presentation tool uses forward/back to control flow. Mentimeter: "use your keyboard's arrow-keys or the arrows in the lower-left corner" ([Mentimeter Help](https://help.mentimeter.com/en/articles/410899-how-the-presentation-mode-affects-your-presentation)). Admin presses Next to move from slide to batch to slide. | Low | Unified sequence, sequence position state |
| Keyboard navigation (arrow keys) | Standard presentation convention. Right/Down arrow = next, Left/Up = previous. PowerPoint, Google Slides, Mentimeter all use this. Expected muscle memory. | Low | Manual advance logic |

### Image Slides

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Image upload to storage | Kahoot: "You can add the image, video, and/or text to your slide" ([Kahoot Help](https://support.kahoot.com/hc/en-us/articles/29644015543315-How-to-use-Kahoot-slides)). Mentimeter supports JPEG, PNG, GIF up to 15 MB. Admin must be able to upload images. | Medium | Supabase Storage bucket, upload API |
| Full-screen image display on admin projection | The core use case: project an image slide between voting rounds. Must fill the screen cleanly, centered, on the admin's projected display. | Low-Medium | Image storage, admin projection view |
| Image aspect ratio handling | Images come in all sizes. Must display without distortion. Standard approach: `object-contain` within viewport bounds. | Low | Image display component |
| Image slide CRUD | Admin creates, views, and deletes image slides. Must integrate with the unified sequence. | Low | Slide entity, storage cleanup |

### Participant Experience

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Participants do NOT see image slides | Project scope explicitly states "images are admin-projection only." Participants see voting UI when a batch is active or a waiting/lobby state when a slide is showing. This matches QuickVote's architecture where admin projects and participants use phones. | Low | Existing participant waiting state |
| Clear waiting state for participants during slides | When admin is on a content slide, participants need to see something sensible -- not a blank screen, not a stale question. "Waiting for next question..." or similar. | Low | Existing lobby/waiting component |

### Admin Projection View

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Full-screen / projector-optimized view | The admin view is projected. Must be clean, large text, no clutter. Admin light theme already supports this. Canva: "display a flawless, uncluttered projection to your audience" ([Canva Live](https://www.canva.com/features/canva-live/)). | Medium | New presentation-mode view or fullscreen toggle |
| Navigation controls visible to admin only | Arrow buttons or a mini control bar that's visible on the admin's laptop screen but not dominating the projected view. PowerPoint Presenter View pattern. | Low-Medium | Conditional rendering based on admin context |

---

## Differentiators

Features that set QuickVote apart. Not universally expected but add competitive value.

### High-Value Differentiators for v1.3

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Session templates in Supabase | Mentimeter allows re-use of presentations; Kahoot has a template library. QuickVote currently has response templates (option sets) but no session blueprints. Saving full session structure (sequence order, slides, batches, questions, templates) as a reusable template in Supabase enables "run this workshop again next month" without re-creation. Upgrades from any localStorage approach to persistent, cross-device storage. | Medium-High | Must serialize full session structure including image URLs. Consider template metadata (name, description, tags). |
| Image slides in session templates | Most competitors let you duplicate a presentation including its media. Including image URLs in saved session templates means the admin can rebuild a session with all slides intact. Key differentiator: not just questions but visual content persists across sessions. | Medium | Dependent on session templates. Images referenced by URL (Supabase Storage), not embedded as binary. |
| Image URLs in JSON export | Extending existing JSON export to include slide image URLs. Enables backup, sharing, migration. Most competitors don't expose clean JSON export at all -- QuickVote already differentiates here. | Low | Existing export infra. Schema extension only. Images remain in storage; export references URLs. |
| Slide preview thumbnails in sequence list | When admin is arranging the sequence, showing small image thumbnails next to slide items helps visual identification. Better than "Slide 1," "Slide 2" labels alone. | Low | Image URLs available from storage |
| Presentation mode keyboard shortcuts beyond arrows | Space bar = advance, Escape = exit presentation mode, B = black screen. PowerPoint conventions users already know. ([PowerPoint shortcuts](https://support.microsoft.com/en-us/office/use-keyboard-shortcuts-to-deliver-powerpoint-presentations-1524ffce-bd2a-45f4-9a7f-f18b992b93a0)) | Low | Keyboard event handler |
| Slide title/label | Optional admin-facing label for each slide ("Introduction", "Results Discussion"). Not displayed on projection -- purely for admin's sequence management. | Low | Text field on slide entity |
| Transition animation between sequence items | Smooth fade or slide transition when admin advances. Enhances perceived quality. QuickVote already uses Motion (framer-motion) for vote animations. | Low-Medium | Motion AnimatePresence, already in stack |
| Fullscreen API integration | One-click button to enter browser fullscreen mode for the projection view. Uses native `requestFullscreen()` API. Multiple React patterns available ([Aha Engineering](https://www.aha.io/engineering/articles/using-the-fullscreen-api-with-react)). | Low | Browser Fullscreen API, custom hook |

### Lower-Priority Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| QR code on content slides | Show session QR code overlaid on content slides so latecomers can join mid-presentation. Nice touch for live events. | Low | Existing QR component, optional overlay |
| Participant count on projection | Show "42 participants" discreetly on projected view during content slides. Social proof for the audience. | Low | Existing ParticipantCount component |
| Image cropping/fitting options | Let admin choose between contain (full image visible) and cover (fill screen, may crop). | Low | CSS object-fit toggle |
| Multiple images per slide | Carousel or grid of images on a single slide. | Medium | Increases slide complexity significantly. Defer. |
| Slide notes for admin | Admin-only notes visible in a presenter view split, not projected. Like PowerPoint speaker notes. | Medium | Requires dual-view architecture. Defer. |

---

## Anti-Features

Features to deliberately NOT build. Common in competitors but wrong for QuickVote v1.3 scope.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| PowerPoint/Google Slides import | Mentimeter, Slido, Kahoot all offer PPT import. Massive complexity (parsing PPTX, converting layouts, handling fonts). QuickVote's value is simplicity, not being a slide editor. | Support image upload only. Admin creates slides in their presentation tool, exports as images, uploads to QuickVote. |
| Video slides | Kahoot and Mentimeter support YouTube/Vimeo embeds. Video playback adds complexity (buffering, autoplay policies, aspect ratios, audio sync). Not needed for voting context. | Image-only slides. If admin needs video, they switch to their video player and then return to QuickVote. |
| Rich text editor on slides | AhaSlides offers text editing with formatting on content slides. Building a rich text editor is a project unto itself. | Image slides only. Text goes on the image (admin creates in Canva/PowerPoint/etc). |
| Slide text/heading content type | Mentimeter has Heading, Paragraph, Bullets slide types. Adds UI complexity for text input, formatting, font sizing. Over-engineering for v1.3. | Image slides only. Keep it simple. If text is needed, it's baked into the image. |
| Participant-visible slides | Some tools show slides to participants on their devices. Doubles the rendering surface, adds bandwidth concerns for images on mobile, complicates the participant experience. | Slides are admin-projection only. Participants see voting or waiting states. This is a deliberate architectural choice that simplifies the participant phone experience. |
| Auto-advance / timed slides | Some tools auto-advance after N seconds. Adds timer management complexity. Admin should control the pace. | Manual advance only. Admin decides when to move. |
| Slide templates / themes | Mentimeter offers slide themes and backgrounds. Building a theming system is scope creep. | Single slide type: full-screen image. Admin controls appearance via the image itself. |
| Image editing / annotation | Cropping, rotating, drawing on images within QuickVote. Scope explosion. | Upload pre-edited images. Admin uses their preferred image editor. |
| Binary image embedding in JSON export | Including base64-encoded images in JSON would balloon file sizes (a 2MB image = ~2.7MB base64). | Export image URLs only. Images remain in Supabase Storage. Document that URLs require storage access. |
| Slide animations / builds | PowerPoint-style bullet-point-by-bullet-point reveals. Massive complexity for minimal value. | Static image slides. One image, full screen. |
| PDF import for slides | Converting PDF pages to slide images. Requires server-side PDF processing. | Admin converts PDF to images themselves (screenshot, export as PNG). |

---

## Feature Dependencies

### Presentation Mode Dependencies

```
Supabase Storage Bucket (new)
  |
  +-- Image Upload API
  |     |
  |     +-- File validation (type, size limits)
  |     +-- Storage path convention (session_id/slide_id.ext)
  |     +-- Public URL generation
  |
  +-- Image Slide Entity (new)
        |
        +-- Slide CRUD (create, read, delete)
        +-- Image URL reference
        +-- Optional title/label

Unified Sequence Model (new)
  |
  +-- Polymorphic Ordered List
  |     |
  |     +-- Slide items (reference image slide)
  |     +-- Batch items (reference existing batch)
  |     +-- Position field for ordering
  |
  +-- Sequence CRUD
  |     |
  |     +-- Add slide to sequence
  |     +-- Add batch to sequence
  |     +-- Reorder items (drag-and-drop)
  |     +-- Remove item from sequence
  |
  +-- Presentation Flow
        |
        +-- Current sequence index (admin state)
        +-- Next/Previous navigation
        +-- Keyboard shortcuts
        +-- Realtime broadcast of current item to participants

Admin Projection View (new or enhanced)
  |
  +-- Full-screen image rendering
  +-- Navigation controls (arrows, keyboard)
  +-- Fullscreen API toggle
  +-- Transition animations (Motion)
  +-- Context-aware display:
        |
        +-- Image slide: show image
        +-- Batch item: show existing batch activation flow
        +-- Results: show existing bar charts

Session Templates in Supabase (new)
  |
  +-- Template Entity
  |     |
  |     +-- Name, description, metadata
  |     +-- Serialized session structure (batches, questions, slides, sequence)
  |     +-- Image URL references
  |
  +-- Template CRUD
  |     |
  |     +-- Save current session as template
  |     +-- Load template into new session
  |     +-- Delete template
  |
  +-- JSON Export Extension
        |
        +-- Include slide image URLs in export
        +-- Include sequence order in export
        +-- Backward-compatible with v1.2 exports
```

### Integration with Existing Features

| Existing Feature | How It Integrates with Presentation Mode |
|------------------|----------------------------------------|
| Batch activation | Batches become items in the sequence. When admin advances to a batch item, existing batch activation flow triggers. |
| Batch voting (self-paced) | Unchanged. Participants vote on batch questions as before. Slide items simply appear between batches in the admin view. |
| Live single-question voting | Can coexist. A sequence could include unbatched questions activated individually (existing live mode) between slides. |
| Response templates | Unchanged. Questions within batches still use templates for consistent option ordering. |
| Session export/import (JSON) | Extended to include `slides` array with image URLs and `sequence` array with ordering. Must remain backward-compatible. |
| QR code | Unchanged. Available in admin view. Could optionally overlay on content slides. |
| Progress dashboard | Unchanged. Shows during batch items in the sequence. |
| dnd-kit drag-and-drop | Reused for sequence reordering. Already proven in BatchList and TemplateEditor. |
| Motion (framer-motion) | Reused for slide transitions in presentation view. Already in the dependency tree. |
| Admin light theme | Presentation view uses light theme (projection-friendly). Already the admin standard. |
| Supabase Realtime | Used to broadcast current sequence position to participants so they know when to show voting vs waiting. |

---

## MVP Recommendation for v1.3

### Must Ship (Table Stakes)

1. **Supabase Storage integration** -- Image upload, storage, public URL generation
2. **Image slide entity** -- Database table for slides with image URL, optional title
3. **Unified sequence model** -- Single ordered list mixing slides and batches
4. **Sequence drag-and-drop reordering** -- Admin arranges the presentation flow
5. **Admin presentation view** -- Full-screen image display when on a slide item, existing batch flow when on a batch item
6. **Manual advance with keyboard** -- Arrow keys + on-screen buttons to navigate sequence
7. **Participant waiting state during slides** -- "Waiting for next question..." when admin is on a content slide
8. **Session templates in Supabase** -- Save/load full session blueprints with slides, batches, questions, sequence order
9. **JSON export extension** -- Include slide image URLs and sequence order (backward-compatible)

### Nice to Have (Differentiators)

- **Fullscreen API toggle** -- One-click browser fullscreen for projection (Low complexity)
- **Slide transition animations** -- Fade/slide between sequence items using Motion (Low-Medium)
- **Slide preview thumbnails** -- Small image previews in sequence management list (Low)
- **QR code overlay on slides** -- Help latecomers join during content slides (Low)
- **Extended keyboard shortcuts** -- Space, Escape, B for black screen (Low)
- **Image contain/cover toggle** -- Admin chooses image fitting behavior (Low)

### Explicitly Defer

- PowerPoint/Google Slides import (massive complexity, tangential to core value)
- Video slides (playback complexity, autoplay policy headaches)
- Rich text / heading slide types (scope creep, image-only is sufficient)
- Participant-visible slides (doubles rendering surface, complicates phone UX)
- Slide templates/themes (theming system is scope creep)
- Image editing/annotation (out of scope, use external tools)
- Auto-advance/timed slides (contradicts manual control model)
- Binary image embedding in export (file size explosion)

---

## Competitor Feature Matrix

How v1.3 QuickVote compares to established tools for the presentation-mode use case.

| Feature | Mentimeter | Kahoot | Slido | AhaSlides | QuickVote v1.3 (planned) |
|---------|-----------|--------|-------|-----------|-------------------------|
| Content/image slides | Yes (Heading, Image, Video, Bullets, Paragraph) | Yes (text, image, video) | No (polling-only, relies on PPT/GSlides integration) | Yes (content slides with canvas editor) | Image slides only (deliberately simple) |
| Unified slide + poll sequence | Yes | Yes | Via PPT plugin (polls inserted as PPT slides) | Yes | Yes |
| Manual presenter advance | Yes | Yes | Yes (within PPT) | Yes | Yes |
| Keyboard navigation | Yes (arrow keys) | Yes | Via PPT | Yes | Yes |
| Participant sees slides | Yes (on their device) | Yes (on their device) | Via PPT projection | Yes | No (admin-projection only -- deliberate) |
| PPT/GSlides import | Yes (PPT integration add-in) | Yes (import slides from PPT/Keynote/PDF) | Yes (native PPT plugin) | Yes (PPT integration) | No (upload images instead) |
| Video slides | Yes (YouTube/Vimeo) | Yes | No | Yes | No |
| Session template save/reuse | Yes (clear results, rerun) | Yes (template library) | Yes (duplicate event) | Yes (templates) | Yes (Supabase-stored blueprints) |
| JSON export | No | No | No | No | Yes (differentiator) |
| Rich text editor | Yes | No | No | Yes | No |
| Fullscreen mode | Yes | Yes | Via PPT | Yes | Yes (Fullscreen API) |
| Self-paced batch voting | Yes (survey mode) | No | No | Yes | Yes (existing v1.1 feature) |
| Real-time results | Yes | Yes | Yes | Yes | Yes (existing v1.0 feature) |
| Free tier available | Limited | Limited | Limited | Yes | Yes (no accounts, fully free) |

**Positioning note:** QuickVote's competitive advantage is NOT feature parity with Mentimeter. It is: (1) zero-friction setup (no accounts), (2) clean JSON export, (3) combined live + batch modes, (4) tactile/immersive participant experience, and (5) simplicity. Presentation mode adds "looks professional on a projector" without trying to become a slide editor.

---

## Complexity Estimates

| Feature Group | Complexity | Rationale |
|---------------|------------|-----------|
| Supabase Storage setup + image upload | Medium | New bucket, RLS policies, upload component, file validation. Well-documented Supabase feature. |
| Image slide entity + CRUD | Low | Simple table, basic form, delete with storage cleanup |
| Unified sequence model | Medium | Polymorphic list (slides + batches), position management, new DB table or approach |
| Sequence drag-and-drop | Low-Medium | Reuses existing dnd-kit patterns from BatchList |
| Admin presentation view | Medium | New full-screen layout, conditional rendering (image vs batch), keyboard handlers |
| Participant waiting state | Low | Simple conditional in existing participant view |
| Session templates (Supabase) | Medium-High | New entity, serialization of full session structure, load/instantiate logic, image URL handling |
| JSON export extension | Low | Schema addition, backward-compatible, no binary data |
| Fullscreen API | Low | Custom hook, one button, well-documented browser API |
| Transition animations | Low | AnimatePresence from Motion, already in stack |

---

## Confidence Assessment

| Finding | Confidence | Reason |
|---------|------------|--------|
| Unified sequence is table stakes | HIGH | Every major competitor (Mentimeter, Kahoot, AhaSlides) uses single ordered deck mixing content and polls |
| Image-only slides (no text/video) sufficient for v1.3 | HIGH | Structural analysis: QuickVote is a voting tool, not a slide editor. Image upload covers 90% of use cases. |
| Participant-invisible slides is correct | HIGH | QuickVote's architecture (admin projects, participants use phones) makes this natural. Reduces mobile bandwidth. |
| Manual advance is correct (no auto-advance) | HIGH | Matches admin-controlled flow in live mode. All competitors default to manual. |
| Session templates need Supabase storage | MEDIUM-HIGH | localStorage is fragile (cleared on browser changes). Supabase aligns with existing data strategy. |
| JSON export extension is low complexity | HIGH | Existing export infra is clean. Adding slides array is additive, not breaking. |
| PPT import is correctly anti-featured | HIGH | Massive scope vs QuickVote's simplicity value. "Upload as images" covers the need. |
| Fullscreen API is well-supported | MEDIUM-HIGH | Verified via MDN docs and React implementation patterns. Cross-browser support is good. |

---

## Sources

### Verified Sources (HIGH-MEDIUM Confidence)
- [Mentimeter: How the presentation mode affects your presentation](https://help.mentimeter.com/en/articles/410899-how-the-presentation-mode-affects-your-presentation)
- [Mentimeter: Content slides](https://help.mentimeter.com/en/articles/410480-content-slides-in-mentimeter)
- [Mentimeter: Content types](https://digi-ed.uk/support/article/content-types-in-mentimeter/)
- [Mentimeter: Text slides](https://help.mentimeter.com/en/articles/9827144-text-slides)
- [Kahoot: How to use slides](https://support.kahoot.com/hc/en-us/articles/29644015543315-How-to-use-Kahoot-slides)
- [Kahoot: Slides with media between questions](https://support.kahoot.com/hc/en-us/community/posts/115000984687-Slides-with-media-or-text-between-questions)
- [Kahoot: Interactive presentations blog](https://kahoot.com/blog/2024/05/28/deliver-engaging-interactive-presentations/)
- [Slido: PowerPoint polling](https://www.slido.com/powerpoint-polling)
- [AhaSlides: Features](https://ahaslides.com/features/)
- [Canva: Presentation modes](https://www.canva.com/help/presentation-modes/)
- [Canva Live: Interactive presentations](https://www.canva.com/features/canva-live/)
- [Supabase: Storage docs](https://supabase.com/docs/guides/storage)
- [Supabase: Storage optimizations](https://supabase.com/docs/guides/storage/production/scaling)
- [MDN: Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)
- [Aha Engineering: Using the Fullscreen API with React](https://www.aha.io/engineering/articles/using-the-fullscreen-api-with-react)
- [PowerPoint keyboard shortcuts](https://support.microsoft.com/en-us/office/use-keyboard-shortcuts-to-deliver-powerpoint-presentations-1524ffce-bd2a-45f4-9a7f-f18b992b93a0)

### WebSearch Sources (MEDIUM Confidence)
- [AhaSlides vs competitors comparison](https://ahaslides.com/compare/)
- [Slido alternatives comparison 2025](https://slideswith.com/blog/apps-like-slido)
- [Option Technologies: Audience polling best practices](https://info.optiontechnologies.com/option-technologies-interactive-blog/audience-polling-at-conferences)
- [Option Technologies: 5 things to look for in polling](https://info.optiontechnologies.com/option-technologies-interactive-blog/real-time-audience-polling-system)

### Project Context
- QuickVote PROJECT.md (existing v1.0-v1.2 features, key decisions)
- QuickVote MILESTONES.md (shipped milestone history)
- QuickVote database.ts (current data model: Session, Question, Batch, Vote, ResponseTemplate)
- QuickVote session-export.ts (current JSON export schema and structure)
- QuickVote session-store.ts (current Zustand state shape)
- QuickVote BatchList.tsx (existing dnd-kit drag-and-drop pattern)
