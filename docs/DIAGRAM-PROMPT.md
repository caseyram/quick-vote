# Documentation Diagram Generation Prompt

Use this prompt with an AI assistant to generate self-contained HTML documentation diagrams. Replace `[DOCUMENT TYPE]` with one of: Architecture, Threat Model, User Journeys, Coverage Report.

---

```
Analyze my entire codebase thoroughly — read every source file, migration,
config, type, route, and component — then generate the requested document as
a SINGLE self-contained .html file. All CSS and SVG must be inline. No
external dependencies, no JavaScript, no images, no CDN links.

═══════════════════════════════════════════════════════════════════
                        DESIGN SYSTEM
═══════════════════════════════════════════════════════════════════

COLOR PALETTE (CSS custom properties on :root):
  --bg-primary:    #0f172a   (page background)
  --bg-secondary:  #1e293b   (section card backgrounds)
  --bg-tertiary:   #334155   (code blocks, table headers, nested cards)
  --text-primary:  #f1f5f9   (headings, primary text)
  --text-secondary:#94a3b8   (body text, captions)
  --accent-blue:   #3b82f6   --accent-green:  #22c55e
  --accent-yellow: #eab308   --accent-red:    #ef4444
  --accent-purple: #a855f7   --accent-cyan:   #06b6d4
  --border:        #475569

TYPOGRAPHY:
  - Font stack: 'Segoe UI', system-ui, -apple-system, sans-serif
  - Code font: 'Consolas', 'Monaco', monospace
  - Base line-height: 1.6
  - H1: 2.5rem, gradient text (linear-gradient 135deg blue→purple,
    using -webkit-background-clip:text / -webkit-text-fill-color:transparent)
  - H2: 1.5rem, accent-blue, flex row with ::before pseudo-element
    (4px wide × 1.5rem tall blue bar, border-radius 2px)
  - H3: 1.2rem, text-primary
  - Body paragraphs: text-secondary

LAYOUT:
  - body: padding 2rem, bg-primary
  - .container: max-width varies by doc type (1000px arch, 1200px journeys,
    1400px threat), margin 0 auto
  - header: text-align center, margin-bottom 3rem, padding-bottom 2rem,
    border-bottom 1px solid border
  - footer: text-align center, margin-top 3rem, padding-top 2rem,
    border-top 1px solid border, text-secondary, includes version/date,
    navigation links to other docs (styled as accent-blue, no underline,
    underline on hover)

SECTION CARDS (.section):
  - bg-secondary, border-radius 12px, padding 1.5rem, margin-bottom 1.5rem,
    border 1px solid border

TABLES:
  - width 100%, border-collapse collapse
  - th: bg-tertiary, text-primary, font-weight 600
  - td: text-secondary
  - th/td: padding 0.75rem 1rem, border-bottom 1px solid border
  - tr:hover td: background rgba(59,130,246,0.1)

CODE:
  - Inline <code>: bg-tertiary, padding 0.2rem 0.5rem, border-radius 4px,
    accent-cyan color
  - Block <pre>: bg-tertiary, border-radius 8px, padding 1rem,
    border 1px solid border, overflow-x auto, font-size 0.85rem

BADGES (pill-shaped labels):
  - display inline-block, padding 0.25rem 0.75rem, border-radius 9999px,
    font-size 0.75rem, font-weight 600, text-transform uppercase
  - .badge-red:    bg rgba(239,68,68,0.2),   color accent-red
  - .badge-orange: bg rgba(249,115,22,0.2),  color #f97316
  - .badge-yellow: bg rgba(234,179,8,0.2),   color accent-yellow
  - .badge-green:  bg rgba(34,197,94,0.2),   color accent-green
  - .badge-blue:   bg rgba(59,130,246,0.2),  color accent-blue
  - .badge-purple: bg rgba(168,85,247,0.2),  color accent-purple

LISTS:
  - margin 0.5rem 0 1rem 1.5rem, text-secondary
  - li: margin-bottom 0.5rem

═══════════════════════════════════════════════════════════════════
                 DOCUMENT TYPE: ARCHITECTURE
═══════════════════════════════════════════════════════════════════

Container max-width: 1000px. H1 gradient: blue→purple.

REQUIRED SECTIONS (each in a .section card):

1. SYSTEM OVERVIEW
   - 1-2 paragraph description derived from actual codebase analysis
   - Inline SVG diagram (~600×300) showing:
     - Boxes for each system actor/component (Admin Browser, Participant,
       Backend services) using rect with rx=8, fill bg-secondary,
       colored stroke per role (purple=admin, cyan=participant, green=backend)
     - Text labels inside boxes (two lines: name + subtitle)
     - Connecting arrows using <path> with orthogonal routing and
       arrowhead markers defined in <defs>
     - Arrow marker: <marker id="arrow" markerWidth="10" markerHeight="7"
       refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker>
     - Labeled connections (e.g., "WebSocket", "HTTPS")
     - Nested sub-components inside backend box as smaller bg-tertiary rects

2. DATA MODEL
   - H3 "Core Entities" → table with columns: Entity (in <code> tags),
     Key Fields, Description
   - One row per database table discovered in migrations
   - H3 "Entity Relationships" → bulleted list of foreign key / logical
     relationships (bold entity names, describe cardinality)

3. APPLICATION STRUCTURE
   - <pre> block showing the actual project file tree
   - Group by directory (components/, pages/, hooks/, stores/, lib/, types/)
   - Include brief inline comments for each file's purpose
   - Reflect the REAL files found in the codebase, not generic placeholders

4. KEY WORKFLOWS
   - H3 per workflow discovered in the code
   - Flow diagrams using styled divs:
     .diagram-box: bg-tertiary, border-radius 8px, padding 1.5rem, text-align center
     .flow-diagram: inline-block, monospace font, white-space pre
     Format: "state1 ──► state2 ──► state3" with indented annotations below
   - Ordered lists (<ol>) for step-by-step processes

5. REAL-TIME ARCHITECTURE (if applicable)
   - Table of communication patterns: Pattern (badge-styled), Direction, Purpose
   - <pre> block showing event→response mapping in aligned columns

6. STATE MANAGEMENT
   - Description of state management approach
   - <pre> block showing actual store interface/shape from the code

7. SECURITY MODEL
   - H3 subsections for auth, authorization, access control
   - Bulleted lists of actual security measures found in the codebase

8. ENVIRONMENT VARIABLES
   - Table: Variable (in <code>), Required (Yes/No), Description
   - Only list variables actually referenced in the codebase

═══════════════════════════════════════════════════════════════════
               DOCUMENT TYPE: THREAT MODEL
═══════════════════════════════════════════════════════════════════

Container max-width: 1400px. H1 gradient: blue→purple.
Header includes emoji lock icon and metadata row:
  .metadata: flex, justify-content center, gap 2rem, margin-top 1rem,
  font-size 0.9rem — shows date, version, classification

ADDITIONAL CSS CLASSES:
  - .risk-critical: accent-red, font-weight 600
  - .risk-high: #f97316, font-weight 600
  - .risk-medium: accent-yellow, font-weight 600
  - .risk-low: accent-green, font-weight 600
  - .data-flow: flex, flex-wrap, gap 1rem
  - .flow-item: bg-tertiary, padding 1rem, border-radius 8px, flex 1,
    min-width 200px, border-left 3px solid accent-blue, with H4 + <p>
  - .trust-boundary: border 2px dashed accent-red, border-radius 8px,
    padding 1rem (green variant for trusted zone)
  - .threat-card: bg-tertiary, border-radius 8px, padding 1rem, margin 1rem 0,
    border-left 4px solid (red=high, yellow=medium via .medium, green=low via .low)
  - .threat-header: flex, space-between, align-items center, margin-bottom 0.5rem
  - .threat-title: font-weight 600, text-primary
  - .mitigation: bg rgba(34,197,94,0.1), border-radius 6px, padding 0.75rem,
    margin-top 0.75rem, border 1px solid rgba(34,197,94,0.3)
  - .mitigation-label: accent-green, font-weight 600, font-size 0.85rem
  - .legend: flex, flex-wrap, gap 1.5rem, padding 1rem, bg-tertiary,
    border-radius 8px
  - .legend-item: flex, align-items center, gap 0.5rem
  - .legend-color: 20×20px, border-radius 4px, inline color swatch

REQUIRED SECTIONS:

1. EXECUTIVE SUMMARY
   - Paragraph describing the application and its security profile
   - .data-flow grid with 4 .flow-item cards: Application Type, Backend,
     Authentication, Hosting

2. ARCHITECTURE DIAGRAM
   - Large inline SVG (~1100×750) showing:
     - Background grid pattern (subtle 20px grid using <pattern>)
     - Trust boundary rectangles: dashed stroke (stroke-dasharray="8,4"),
       red for untrusted zone, green for trusted zone, with labeled text
     - Actor icons: circle + trapezoid body shape, colored per role
     - Component boxes: nested bg-secondary rects with colored strokes
       containing smaller bg-tertiary sub-component rects
     - Data flow arrows: orthogonal routing (right-angle paths using <path>),
       each with colored arrowhead markers defined in <defs>
       (separate marker per color: arrowhead, arrowhead-red, arrowhead-green, etc.)
     - Labeled arrows with small text along paths
     - Attack surface callout box: bg rgba(red,0.1), stroke red,
       listing threat IDs (T1, T2, etc.)
     - API key warning box: bg rgba(yellow,0.1), stroke yellow
     - Data channels legend box listing connection types with colored dots
     - Full legend box explaining all line colors and boundary types
   - Below SVG: .legend div with colored swatches explaining each actor/system

3. SYSTEM COMPONENTS
   - H3 "Frontend" → table: Component, Technology, Security Role
   - H3 "Backend" → table: Service, Purpose, Security Controls
   - Flag weak controls with .risk-medium styled text

4. DATA FLOW ANALYSIS
   - .data-flow grid of .flow-item cards, one per major data flow
   - Each card: H4 numbered title + <p> describing the flow as:
     "Actor → Action → System → Result → Outcome"

5. TRUST BOUNDARIES
   - .trust-boundary div (red dashed border) for untrusted zone with
     bulleted list of client-side risks
   - .trust-boundary div (green dashed border) for trusted zone with
     bulleted list of server-side controls

6. STRIDE THREAT ANALYSIS
   - H3 for each STRIDE category:
     • Spoofing — identity-related threats
     • Tampering — data modification threats
     • Repudiation — accountability threats
     • Information Disclosure — data exposure threats
     • Denial of Service — availability threats
     • Elevation of Privilege — authorization escalation threats
   - Under each H3, one .threat-card per threat found in the codebase:
     - .threat-header row: .threat-title (descriptive name with STRIDE
       prefix like "S1:", "T1:") + risk badge (badge-orange for HIGH,
       badge-yellow for MEDIUM, badge-green for LOW)
     - <p> describing the specific threat scenario
     - .mitigation div(s) with:
       - .mitigation-label: "Existing Mitigation" | "Recommended" | "Design Decision"
       - <p> describing the control
     - Border-left color matches severity (red=high, yellow=medium, green=low)
   - EVERY threat must be derived from ACTUAL code patterns found in the
     codebase, not generic boilerplate

7. RISK SUMMARY MATRIX
   - Table: Threat ID, Threat Name, Likelihood, Impact, Risk Level
     (styled with .risk-* classes), Status (badge: Mitigated/Partial/
     Accepted/By Design)

8. EXISTING SECURITY CONTROLS
   - Table: Control, Type, Description, Effectiveness
     (badge-green=Strong, badge-yellow=Moderate, badge-red=Weak)

9. SECURITY RECOMMENDATIONS
   - H3 "High Priority" / "Medium Priority" / "Low Priority"
   - Bulleted lists with <strong> bold action titles + description
   - Recommendations must address gaps found in the STRIDE analysis

10. DATA CLASSIFICATION
    - Table: Data Element, Classification (Public/Internal/Sensitive),
      Storage location, Protection measures

═══════════════════════════════════════════════════════════════════
              DOCUMENT TYPE: USER JOURNEYS
═══════════════════════════════════════════════════════════════════

Container max-width: 1200px. H1 gradient: blue→cyan (not purple).

ADDITIONAL CSS CLASSES:
  - .journey-card: bg-secondary, border-radius 12px, padding 1.5rem,
    margin-bottom 2rem, border 1px solid border
  - .journey-header: flex, align-items center, gap 1rem, margin-bottom 1rem
  - .journey-icon: 48×48px circle div with linear-gradient background
    (unique gradient per journey), display flex, align-items/justify center,
    font-size 1.5rem (contains an emoji)
  - .journey-title: font-size 1.3rem, font-weight 600
  - .journey-badge: same .badge styles, used for importance:
    badge-critical (red) = "Critical Path"
    badge-important (yellow) = "Important"
    badge-standard (green) = "Standard"
  - .flow-container: display flex, align-items flex-start, gap 0.5rem,
    flex-wrap wrap, padding 1rem, bg-tertiary, border-radius 8px,
    margin 0.5rem 0
  - .flow-step: bg-secondary, border-radius 8px, padding 0.75rem,
    min-width 140px, max-width 180px, border 1px solid border
  - .flow-step .step-number: font-size 0.7rem, text-secondary,
    text-transform uppercase, margin-bottom 0.25rem
  - .flow-step .step-actor: font-size 0.75rem, accent-blue (or accent-purple
    for admin, accent-cyan for participant), font-weight 600
  - .flow-step .step-action: font-size 0.85rem, text-primary, margin-top 0.25rem
  - .flow-arrow: font-size 1.5rem, text-secondary, self-center,
    displays "→" character
  - .alt-paths: margin-top 1rem
  - .alt-paths h4: font-size 0.95rem, text-secondary, margin-bottom 0.5rem

REQUIRED SECTIONS:

1. JOURNEY CARDS
   - One .journey-card per critical user journey discovered in the codebase
   - Each card contains:
     a) .journey-header with: emoji icon in gradient circle, journey title,
        importance badge
     b) .flow-container showing the step-by-step flow as a horizontal
        sequence of .flow-step boxes connected by .flow-arrow (→) divs
     c) Each .flow-step contains: step number (e.g., "STEP 1"),
        actor label (e.g., "Admin" in purple or "Participant" in cyan),
        action description
     d) .alt-paths section with H4 "Alternative Paths" + bulleted list
        of edge cases and variations
   - Identify journeys by tracing actual routes, components, and user
     interactions in the codebase

2. JOURNEY SUMMARY TABLE
   - Table: Journey, Primary Actor, Steps, Key Touchpoints, Importance

3. TOUCHPOINTS TABLE
   - Table: Component/Page, Journeys (comma-separated list),
     Interaction Count
   - Derived from which components appear across multiple journeys

═══════════════════════════════════════════════════════════════════
              DOCUMENT TYPE: COVERAGE REPORT
═══════════════════════════════════════════════════════════════════

Container max-width: 1000px.

ADDITIONAL CSS CLASSES:
  - .progress-bar: height 8px, bg-tertiary, border-radius 4px, overflow hidden
  - .progress-fill: height 100%, border-radius 4px
    (green if >80%, yellow if 40-80%, red if <40%)
  - .stats-grid: display grid, grid-template-columns repeat(auto-fit,
    minmax(200px, 1fr)), gap 1rem, margin 1rem 0
  - .stat-card: bg-tertiary, border-radius 8px, padding 1rem, text-align center
  - .stat-value: font-size 2rem, font-weight 700, accent-blue
  - .stat-label: font-size 0.85rem, text-secondary

REQUIRED SECTIONS:

1. SUMMARY STATS
   - .stats-grid with cards: Total Files, Average Coverage,
     Files with Tests, Files Needing Tests

2. FILE COVERAGE BY CATEGORY
   - H3 per directory group (Components, Pages, Hooks, Lib, Stores)
   - Table per group: File, Coverage %, Progress Bar, Status Badge
   - Progress bar: inline div with .progress-bar containing .progress-fill
     at the file's coverage width percentage
   - Status badge: "Covered" (green), "Partial" (yellow), "None" (red)
   - Coverage percentages derived from actual test files found in the
     codebase (0% if no corresponding test file exists)

═══════════════════════════════════════════════════════════════════
                      CRITICAL RULES
═══════════════════════════════════════════════════════════════════

1. SINGLE FILE — Everything (CSS, SVG, HTML) must be in ONE .html file.
   No <script> tags, no external resources, no images.

2. DERIVED FROM CODE — Every table entry, threat, journey, file path,
   component name, and data flow must come from actually reading the
   codebase. Do not invent features or files that don't exist.

3. SVG DIAGRAMS — All diagrams use inline <svg> elements with:
   - Explicit width/height and viewBox
   - <defs> for reusable markers, gradients, patterns
   - Orthogonal arrow routing (right-angle <path> elements, not diagonal)
   - Consistent font sizing (10-14px) and the same color palette
   - Text positioned with text-anchor="middle" for centering

4. RESPONSIVE — Container max-width constrains on large screens.
   Flex-wrap on flow layouts. overflow-x:auto on wide SVGs and tables.

5. CROSS-LINKING — Footer includes links to other doc pages
   (architecture.html, threat-model.html, user-journeys.html,
   coverage.html) and a "Back to Documentation" link.

6. VERSIONING — Include the current version number and date in the
   header metadata and/or footer.
```
