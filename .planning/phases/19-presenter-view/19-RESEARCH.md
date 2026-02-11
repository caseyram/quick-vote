# Phase 19: Presenter View - Research

**Researched:** 2026-02-11
**Domain:** Multi-window presenter UI, Realtime cross-device sync, window management, QR overlay control, keyboard shortcuts
**Confidence:** HIGH

## Summary

Phase 19 implements a dual-window presenter experience: an admin control view that manages the presentation and a separate presentation window showing clean projected output. The phase leverages existing Supabase Realtime Broadcast for cross-device synchronization, native `window.open()` for window management, the Fullscreen API for browser fullscreen, and established patterns from Phase 18 for slide/batch display.

Research confirms the project already has the necessary primitives:
- Motion.dev (v12.29.2) for black screen fade transitions
- Supabase Realtime Broadcast already syncs across different browser windows via WebSocket channels
- QRCode.react (v4.2.0) for QR display with overlay support
- Native keyboard event handling patterns from Phase 18
- Existing BarChart component for results visualization

The control view architecture requires splitting the current admin session into control-specific UI (sequence list, navigation, preview panels, QR toggles) and projection display components. Broadcast events enable the presentation window to stay synchronized even when admin and projection are on different physical devices.

**Primary recommendation:** Use `window.open()` with a dedicated `/presentation/:sessionId` route, leverage existing Realtime Broadcast (NOT BroadcastChannel API) for cross-device sync, implement control view as a layout mode switch in AdminSession, and use native Fullscreen API with keyboard shortcuts for presentation controls.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.93.1 | Realtime Broadcast cross-device sync | Already in use, works across different devices/networks |
| motion | 12.29.2 | Black screen fade animation | Already in use for slide transitions |
| qrcode.react | 4.2.0 | QR code generation and display | Already in use, supports SVG rendering |
| zustand | 5.0.5 | State management | Project standard for session state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Window.open() | Native | Launch presentation window | Built-in browser API, no library needed |
| Fullscreen API | Native | Browser fullscreen control | Modern browser API, no polyfill needed for 2026 browsers |
| React Router | 7.6.1 | Presentation route `/presentation/:sessionId` | Already in use for routing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Broadcast | BroadcastChannel API | BroadcastChannel only works same-origin, same-browser; can't sync across devices |
| Supabase Broadcast | postMessage between windows | postMessage only works same-origin browser windows; can't sync across devices |
| Native window.open | react-new-window library | Library adds 2KB+ for functionality already available in native API |
| Native Fullscreen API | react-full-screen library | Library adds complexity for simple fullscreen toggle use case |

**Installation:**
```bash
# No new dependencies needed - all capabilities already available
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── pages/
│   ├── AdminSession.tsx          # Switch between normal/control mode
│   └── PresentationView.tsx      # NEW: Standalone presentation window
├── components/
│   ├── PresentationControls.tsx  # NEW: Control view UI (sequence, nav, preview)
│   ├── PresentationContent.tsx   # NEW: Projection display (slide/batch/black)
│   ├── QROverlay.tsx             # NEW: Corner + fullscreen QR modes
│   ├── KeyboardShortcutHelp.tsx  # NEW: ? key help overlay
│   └── ResultsView.tsx           # NEW: Admin-controlled result reveal
```

### Pattern 1: Dedicated Presentation Route
**What:** Separate route with minimal UI that works standalone or via window.open
**When to use:** For cross-device presenter view support
**Example:**
```typescript
// Source: React Router v7 routing + window.open MDN docs
// In App.tsx routes
<Route path="/presentation/:sessionId" element={<PresentationView />} />

// In AdminSession control view
function openPresentation() {
  const url = `${window.location.origin}/presentation/${sessionId}`;

  // Open in new window with chrome disabled
  const presentationWindow = window.open(
    url,
    'QuickVotePresentation',
    'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no'
  );

  // Store reference for later communication (optional)
  windowRef.current = presentationWindow;
}
```

### Pattern 2: Realtime Broadcast for Cross-Device Sync
**What:** Use existing Broadcast channel for presentation control events
**When to use:** For syncing presentation state across devices/windows
**Example:**
```typescript
// Source: Existing AdminSession.tsx broadcast pattern + Supabase docs
// Control view sends broadcast events
channel.send({
  type: 'broadcast',
  event: 'presentation_qr_toggle',
  payload: { mode: 'corner' | 'fullscreen' | 'hidden' },
});

channel.send({
  type: 'broadcast',
  event: 'presentation_black_screen',
  payload: { active: true },
});

channel.send({
  type: 'broadcast',
  event: 'result_reveal',
  payload: { questionId: string, revealed: boolean },
});

channel.send({
  type: 'broadcast',
  event: 'reason_highlight',
  payload: { questionId: string, reasonId: string | null },
});

// Presentation view listens for these events
channel.on('broadcast', { event: 'presentation_qr_toggle' }, ({ payload }) => {
  setQrMode(payload.mode);
});
```

### Pattern 3: Fullscreen API with Keyboard Toggle
**What:** Native requestFullscreen/exitFullscreen with F key handler
**When to use:** For presentation window fullscreen control
**Example:**
```typescript
// Source: MDN Fullscreen API + existing keyboard pattern
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error('Fullscreen request failed:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// Keyboard handler (works in both windows per requirements)
useEffect(() => {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.repeat) return;

    // Don't trigger if typing in input
    if (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch(event.key) {
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case 'Escape':
        // Exit fullscreen only, not presentation
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        break;
      case 'b':
      case 'B':
        toggleBlackScreen();
        break;
      case '?':
        toggleShortcutHelp();
        break;
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Pattern 4: Black Screen Toggle with Fade Animation
**What:** Overlay that fades in/out to hide presentation content
**When to use:** For "B key" black screen pause functionality
**Example:**
```typescript
// Source: Motion.dev AnimatePresence + existing fade patterns
const [blackScreenActive, setBlackScreenActive] = useState(false);

<AnimatePresence>
  {blackScreenActive && (
    <motion.div
      className="fixed inset-0 bg-black z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    />
  )}
</AnimatePresence>
```

### Pattern 5: Admin-Controlled Result Reveal
**What:** Admin sees full results, chooses what to reveal to projection
**When to use:** For batch result display with progressive reveal
**Example:**
```typescript
// Source: Existing BarChart component + broadcast pattern
interface ResultRevealState {
  revealedQuestions: Set<string>;
  highlightedReasons: Map<string, string>; // questionId -> reasonId
}

// Admin control view
function ResultsControlPanel({ batchQuestions }: Props) {
  const [revealState, setRevealState] = useState<ResultRevealState>({
    revealedQuestions: new Set(),
    highlightedReasons: new Map(),
  });

  function toggleReveal(questionId: string) {
    const revealed = !revealState.revealedQuestions.has(questionId);

    // Update local state
    setRevealState(prev => {
      const next = new Set(prev.revealedQuestions);
      if (revealed) next.add(questionId);
      else next.delete(questionId);
      return { ...prev, revealedQuestions: next };
    });

    // Broadcast to presentation window
    channel.send({
      type: 'broadcast',
      event: 'result_reveal',
      payload: { questionId, revealed },
    });
  }

  function highlightReason(questionId: string, reasonId: string | null) {
    setRevealState(prev => {
      const next = new Map(prev.highlightedReasons);
      if (reasonId) next.set(questionId, reasonId);
      else next.delete(questionId);
      return { ...prev, highlightedReasons: next };
    });

    channel.send({
      type: 'broadcast',
      event: 'reason_highlight',
      payload: { questionId, reasonId },
    });
  }
}
```

### Pattern 6: QR Overlay Modes
**What:** Two QR display modes controllable from admin
**When to use:** For join-now moments and persistent QR availability
**Example:**
```typescript
// Source: Existing SessionQRCode component pattern
type QRMode = 'hidden' | 'corner' | 'fullscreen';

function QROverlay({ mode, sessionUrl }: { mode: QRMode; sessionUrl: string }) {
  if (mode === 'hidden') return null;

  if (mode === 'fullscreen') {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center">
        <QRCodeSVG
          value={sessionUrl}
          size={Math.min(window.innerWidth, window.innerHeight) * 0.6}
          level="M"
        />
        <p className="text-4xl text-gray-600 text-center mt-8 font-medium">
          Scan to join
        </p>
      </div>
    );
  }

  // Corner mode
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white p-3 rounded-xl shadow-lg">
      <QRCodeSVG value={sessionUrl} size={120} level="M" />
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Don't use BroadcastChannel API for cross-window sync:** Only works same-origin, same-browser instance — can't sync across devices
- **Don't use postMessage for presentation sync:** Only works between windows in same browser — requirements specify cross-device support
- **Don't poll for state updates:** Use Supabase Realtime Broadcast for real-time events
- **Don't auto-advance slides on batch completion:** Admin controls all navigation explicitly
- **Don't show slide images to participants:** Requirements specify participants see "Waiting for next question..." during slides

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Custom QR rendering algorithm | qrcode.react (already in project) | QR spec is complex, library handles error correction levels |
| Cross-device state sync | Custom WebSocket server | Supabase Realtime Broadcast | Already in use, handles reconnection, presence |
| Window fullscreen | Custom CSS hacks or fake fullscreen | Fullscreen API (document.documentElement.requestFullscreen) | Native API handles browser chrome, escape key, security |
| Keyboard shortcut manager | Custom event aggregator library | Native addEventListener with event.repeat check | Simple use case, no library needed |
| Window communication | Custom polling or SharedWorker | Supabase Realtime Broadcast | Works across devices, not just same-browser tabs |

**Key insight:** The requirements explicitly state "supports cross-device operation" — this rules out browser-only solutions like BroadcastChannel, postMessage, or SharedWorker. Supabase Realtime is the only existing solution that meets this requirement.

## Common Pitfalls

### Pitfall 1: Using BroadcastChannel Instead of Supabase Broadcast
**What goes wrong:** BroadcastChannel only syncs tabs in the same browser instance, fails for cross-device requirement
**Why it happens:** BroadcastChannel API looks perfect for "cross-tab" communication, but doesn't work across devices
**How to avoid:** Use Supabase Realtime Broadcast (already in use for voting_closed, batch_activated events)
**Warning signs:** Presentation works when admin and projection are in same browser, fails on different devices

### Pitfall 2: Trying to Control Presentation Window via window.opener Reference
**What goes wrong:** window.opener only works same-origin, same-browser; breaks cross-device requirement
**Why it happens:** Natural to try using the window reference from window.open() to call methods
**How to avoid:** Use Broadcast events exclusively for control commands, not direct window references
**Warning signs:** "Cannot read property of null" errors when presentation is on different device

### Pitfall 3: Forgetting Fullscreen Permission Requirements
**What goes wrong:** requestFullscreen() fails silently or with DOMException
**Why it happens:** Fullscreen API requires user gesture (click, keypress) to initiate
**How to avoid:** Only call requestFullscreen() inside event handler from user interaction (keyboard, button click)
**Warning signs:** F key doesn't trigger fullscreen, no error messages in console

### Pitfall 4: Not Handling Presentation Window Reconnection
**What goes wrong:** Presentation window shows stale content after network interruption
**Why it happens:** Realtime connection drops and reconnects, but component state isn't reset
**How to avoid:** Listen for Realtime connection status changes, show reconnecting indicator, refresh state on reconnect
**Warning signs:** Presentation stuck on old slide after wifi reconnection

### Pitfall 5: QR Overlay Blocking Interactive Content
**What goes wrong:** User can't interact with batch voting UI because QR overlay has higher z-index
**Why it happens:** Fixed position overlays with high z-index values block pointer events
**How to avoid:** Ensure QR overlay only appears during slides (non-interactive moments) or use pointer-events: none on QR container
**Warning signs:** Clicking on batch results does nothing when QR corner is visible

### Pitfall 6: Black Screen State Not Syncing Across Windows
**What goes wrong:** B key in control window doesn't black out presentation window
**Why it happens:** Black screen state only stored in local component state, not broadcast
**How to avoid:** Broadcast black_screen_toggle event, presentation window subscribes to event
**Warning signs:** Black screen works in control view but not in presentation view

### Pitfall 7: Keyboard Shortcuts Firing During Text Input
**What goes wrong:** Typing "b" in a reason text field toggles black screen
**Why it happens:** Keyboard event listener doesn't check event.target
**How to avoid:** Check if event.target is HTMLInputElement or HTMLTextAreaElement before handling shortcuts (pattern from Phase 18)
**Warning signs:** User reports unexpected behavior while typing feedback

## Code Examples

Verified patterns from official sources and existing project code:

### Presentation Route Component
```typescript
// Source: React Router v7 + Supabase Broadcast + existing patterns
export default function PresentationView() {
  const { sessionId } = useParams();
  const {
    activeSessionItemId,
    sessionItems,
    batches,
    navigationDirection
  } = useSessionStore();
  const [qrMode, setQrMode] = useState<QRMode>('hidden');
  const [blackScreenActive, setBlackScreenActive] = useState(false);
  const [revealedQuestions, setRevealedQuestions] = useState<Set<string>>(new Set());
  const [highlightedReason, setHighlightedReason] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initialize Realtime channel
  const setupChannel = useCallback((channel: RealtimeChannel) => {
    // Listen for slide/batch activations (Phase 18 events)
    channel.on('broadcast', { event: 'slide_activated' }, ({ payload }) => {
      useSessionStore.getState().setActiveSessionItemId(payload.itemId);
    });

    channel.on('broadcast', { event: 'batch_activated' }, ({ payload }) => {
      useSessionStore.getState().setActiveBatchId(payload.batchId);
      // Reset reveal state when new batch activates
      setRevealedQuestions(new Set());
      setHighlightedReason(null);
    });

    // Listen for presentation control events (Phase 19)
    channel.on('broadcast', { event: 'presentation_qr_toggle' }, ({ payload }) => {
      setQrMode(payload.mode);
    });

    channel.on('broadcast', { event: 'black_screen_toggle' }, ({ payload }) => {
      setBlackScreenActive(payload.active);
    });

    channel.on('broadcast', { event: 'result_reveal' }, ({ payload }) => {
      setRevealedQuestions(prev => {
        const next = new Set(prev);
        if (payload.revealed) next.add(payload.questionId);
        else next.delete(payload.questionId);
        return next;
      });
    });

    channel.on('broadcast', { event: 'reason_highlight' }, ({ payload }) => {
      setHighlightedReason(payload.reasonId);
    });

    channelRef.current = channel;
  }, []);

  const { connectionStatus } = useRealtimeChannel(
    `session:${sessionId}`,
    setupChannel,
    !!sessionId
  );

  // Keyboard shortcuts (F for fullscreen, Escape to exit fullscreen)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;

      if (event.key === 'f' || event.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(console.error);
        } else {
          document.exitFullscreen();
        }
      } else if (event.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentItem = sessionItems.find(item => item.id === activeSessionItemId);
  const sessionUrl = `${window.location.origin}/join/${sessionId}`;

  return (
    <div className="fixed inset-0 bg-[#1a1a1a] flex items-center justify-center">
      {/* Reconnecting indicator */}
      {connectionStatus === 'reconnecting' && (
        <div className="fixed top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm animate-pulse">
          Reconnecting...
        </div>
      )}

      {/* Main projection content */}
      <AnimatePresence mode="wait">
        {currentItem?.item_type === 'slide' && (
          <SlideDisplay
            key={currentItem.id}
            imagePath={currentItem.image_path!}
            caption={currentItem.caption}
            direction={navigationDirection}
          />
        )}
        {currentItem?.item_type === 'batch' && (
          <BatchResultsDisplay
            key={currentItem.batch_id}
            batchId={currentItem.batch_id!}
            revealedQuestions={revealedQuestions}
            highlightedReason={highlightedReason}
          />
        )}
      </AnimatePresence>

      {/* QR overlay */}
      <QROverlay mode={qrMode} sessionUrl={sessionUrl} />

      {/* Black screen overlay */}
      <AnimatePresence>
        {blackScreenActive && (
          <motion.div
            className="fixed inset-0 bg-black z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* First-time fullscreen hint */}
      <FirstTimeFullscreenHint />
    </div>
  );
}
```

### Admin Control View Layout
```typescript
// Source: Existing AdminSession.tsx + requirements
interface ControlViewProps {
  sessionId: string;
  onOpenPresentation: () => void;
}

function PresentationControlView({ sessionId, onOpenPresentation }: ControlViewProps) {
  const {
    sessionItems,
    activeSessionItemId,
    batches,
    navigationDirection
  } = useSessionStore();
  const [qrMode, setQrMode] = useState<QRMode>('hidden');
  const [blackScreenActive, setBlackScreenActive] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const currentIndex = sessionItems.findIndex(item => item.id === activeSessionItemId);
  const currentItem = sessionItems[currentIndex];
  const nextItem = sessionItems[currentIndex + 1];

  function handleQrToggle(mode: QRMode) {
    setQrMode(mode);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'presentation_qr_toggle',
      payload: { mode },
    });
  }

  function handleBlackScreenToggle() {
    const nextState = !blackScreenActive;
    setBlackScreenActive(nextState);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'black_screen_toggle',
      payload: { active: nextState },
    });
  }

  // Keyboard shortcuts (work in control view too)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;

      if (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch(event.key) {
        case 'b':
        case 'B':
          handleBlackScreenToggle();
          break;
        case 'f':
        case 'F':
          // Toggle fullscreen in presentation window via broadcast
          // (Fullscreen API can only affect current window)
          break;
        case '?':
          setShowShortcutHelp(prev => !prev);
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blackScreenActive]);

  return (
    <div className="flex h-screen bg-white">
      {/* Left sidebar: Sequence list */}
      <div className="w-80 border-r border-gray-200 overflow-y-auto">
        <div className="p-4">
          <button
            onClick={onOpenPresentation}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-4"
          >
            Open Presentation
          </button>

          <SequenceManager
            sessionId={sessionId}
            isLive={true}
            activeSessionItemId={activeSessionItemId}
            onActivateItem={handleActivateItem}
            {...otherProps}
          />
        </div>
      </div>

      {/* Center: Current + next preview */}
      <div className="flex-1 flex flex-col p-6">
        <div className="flex gap-6 mb-6 flex-1">
          {/* Current (live mirror) */}
          <div className="flex-1 flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Current (Live)</h2>
            <div className="flex-1 bg-[#1a1a1a] rounded-lg overflow-hidden">
              <ProjectionPreview item={currentItem} scale={0.5} />
            </div>
          </div>

          {/* Next (preview) */}
          <div className="flex-1 flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Next</h2>
            <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden">
              {nextItem ? (
                <ProjectionPreview item={nextItem} scale={0.5} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  End of sequence
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation controls */}
        <NavigationControls
          currentIndex={currentIndex}
          totalItems={sessionItems.length}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      </div>

      {/* Right sidebar: QR + controls */}
      <div className="w-64 border-l border-gray-200 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">QR Code</h3>
          <div className="space-y-2">
            <button
              onClick={() => handleQrToggle('hidden')}
              className={`w-full px-3 py-2 rounded ${qrMode === 'hidden' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Hidden
            </button>
            <button
              onClick={() => handleQrToggle('corner')}
              className={`w-full px-3 py-2 rounded ${qrMode === 'corner' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Corner
            </button>
            <button
              onClick={() => handleQrToggle('fullscreen')}
              className={`w-full px-3 py-2 rounded ${qrMode === 'fullscreen' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Full Screen
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Presentation</h3>
          <button
            onClick={handleBlackScreenToggle}
            className={`w-full px-3 py-2 rounded ${blackScreenActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {blackScreenActive ? 'Show Content' : 'Black Screen'}
          </button>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowShortcutHelp(true)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Keyboard Shortcuts (?)
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Batch Results with Admin-Controlled Reveal
```typescript
// Source: Existing BarChart component + broadcast pattern
interface BatchResultsDisplayProps {
  batchId: string;
  revealedQuestions: Set<string>;
  highlightedReason: string | null;
}

function BatchResultsDisplay({
  batchId,
  revealedQuestions,
  highlightedReason
}: BatchResultsDisplayProps) {
  const { batchQuestions } = useSessionStore();
  const questions = batchQuestions.filter(q => q.batch_id === batchId);

  // One question at a time - find the first revealed question
  const currentRevealedQuestion = questions.find(q => revealedQuestions.has(q.id));

  if (!currentRevealedQuestion) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-2xl">
        Results ready (admin controlled)
      </div>
    );
  }

  const chartData = buildConsistentBarData(
    currentRevealedQuestion,
    aggregateVotes(currentRevealedQuestion.id, sessionVotes)
  );

  return (
    <div className="flex h-full p-12">
      {/* Chart - left side or full width */}
      <div className={highlightedReason ? 'w-1/2 pr-6' : 'w-full'}>
        <h2 className="text-3xl font-bold text-white mb-6">
          {currentRevealedQuestion.question_text}
        </h2>
        <BarChart
          data={chartData}
          size="fill"
          theme="dark"
        />
      </div>

      {/* Highlighted reason - right side */}
      {highlightedReason && (
        <motion.div
          className="w-1/2 pl-6 border-l-4 flex items-center"
          style={{ borderColor: getReasonColor(highlightedReason) }}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
        >
          <div className="bg-white/10 rounded-lg p-6 backdrop-blur">
            <p className="text-white text-xl leading-relaxed">
              {getReasonText(highlightedReason)}
            </p>
            <div className="mt-4 text-sm text-gray-400">
              — {getReasonAuthor(highlightedReason)}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
```

### Keyboard Shortcut Help Overlay
```typescript
// Source: QuestionMark.js pattern + Motion.dev AnimatePresence
function KeyboardShortcutHelp({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!visible) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' || event.key === '?') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-[301] pointer-events-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Keyboard Shortcuts
              </h2>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <ShortcutRow keys={['Space', '→']} description="Next item" />
                <ShortcutRow keys={['←']} description="Previous item" />
                <ShortcutRow keys={['F']} description="Toggle fullscreen" />
                <ShortcutRow keys={['Esc']} description="Exit fullscreen" />
                <ShortcutRow keys={['B']} description="Black screen" />
                <ShortcutRow keys={['?']} description="Show/hide this help" />
              </div>

              <div className="mt-6 text-center text-sm text-gray-500">
                Press Esc or ? to close
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {keys.map(key => (
          <kbd
            key={key}
            className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono"
          >
            {key}
          </kbd>
        ))}
      </div>
      <span className="text-gray-700">{description}</span>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BroadcastChannel API for cross-tab | Supabase Realtime for cross-device | 2021+ (WebSocket maturity) | Enables true cross-device presenter view |
| vendor-prefixed fullscreen | Standard Fullscreen API | 2022+ (all modern browsers) | No polyfill needed, cleaner code |
| Custom QR generation | Dedicated libraries (qrcode.react) | 2018+ | Reliable error correction, smaller bundles |
| postMessage for window communication | Realtime Broadcast for all sync | Project Phase 4 | Consistent sync pattern, works cross-device |

**Deprecated/outdated:**
- `webkitRequestFullscreen`: Use `requestFullscreen()` (standardized in all 2026 browsers)
- BroadcastChannel for presenter view: Use Supabase Realtime Broadcast (cross-device requirement)
- window.opener for control: Use Broadcast events (more reliable, cross-device)

## Open Questions

1. **Control view as separate route vs. layout mode in AdminSession**
   - What we know: Control view is admin-only, needs auth check, shares most AdminSession data
   - What's unclear: Better UX as dedicated route or mode toggle within AdminSession?
   - Recommendation: Layout mode toggle in AdminSession — simpler auth, easier to share Realtime channel setup, natural "exit presentation mode" flow

2. **Presentation window auto-refresh on network restore**
   - What we know: Realtime connection drops/reconnects, useRealtimeChannel tracks connectionStatus
   - What's unclear: Should we auto-reload presentation window state from database on reconnect?
   - Recommendation: Yes — on reconnect, fetch current activeSessionItemId from session store to ensure sync, show reconnecting indicator during fetch

3. **Batch result reveal default state**
   - What we know: Admin controls reveal, one question at a time
   - What's unclear: When batch activates, should first question auto-reveal or all hidden by default?
   - Recommendation: All hidden by default — gives admin time to review results before projecting

4. **Keyboard shortcut conflicts with browser defaults**
   - What we know: F key is uncommon, B and ? are safe, Escape already used for fullscreen exit
   - What's unclear: Any browser extensions or OS shortcuts that conflict?
   - Recommendation: Document known conflicts in help overlay, allow users to remember "B blacks out screen" viscerally through use

5. **Presentation window title and favicon**
   - What we know: window.open() creates new window with default title
   - What's unclear: Should we customize title/favicon to help identify window?
   - Recommendation: Set `<title>QuickVote Presentation</title>` in PresentationView, distinct from admin "QuickVote Admin"

## Sources

### Primary (HIGH confidence)
- Supabase Realtime Broadcast docs - https://supabase.com/docs/guides/realtime/broadcast
- MDN Window.open() - https://developer.mozilla.org/en-US/docs/Web/API/Window/open
- MDN Fullscreen API - https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
- Project codebase: AdminSession.tsx (broadcast patterns), BatchVotingCarousel.tsx (keyboard nav), QRCode.tsx (overlay modes), BarChart.tsx (results display)
- React Router v7 - https://reactrouter.com/ (already in package.json 7.6.1)

### Secondary (MEDIUM confidence)
- [Broadcast | Supabase Docs](https://supabase.com/docs/guides/realtime/broadcast)
- [Window: open() method - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)
- [Using the Fullscreen API with React](https://www.aha.io/engineering/articles/using-the-fullscreen-api-with-react)
- [Exploring the Broadcast Channel API for cross-tab communication | MDN Blog](https://developer.mozilla.org/en-US/blog/exploring-the-broadcast-channel-api-for-cross-tab-communication/)
- [Popout Windows in React](https://blog.scottlogic.com/2019/10/29/popout-windows-in-react.html)
- [QuestionMark.js – Shortcut Keys Displayed with a Shortcut Key](https://www.impressivewebs.com/questionmark-js-shortcut-keys-displayed/)

### Tertiary (LOW confidence)
- [React Multi-Screen Projection: Building Stunning Display Systems](https://medium.com/@awwwesssooooome/react-multi-screen-projection-building-stunning-display-systems-with-the-obscure-window-management-150e401a09f9) - Window Management API (experimental, not needed for this use case)
- [Step-by-step guide — open a popup window in React](https://medium.com/@harish.chirati/step-by-step-guide-open-a-popup-window-in-react-and-keep-data-in-sync-with-the-parent-c4522516cc3b) - General popup patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use (Supabase, Motion, qrcode.react), native APIs well-documented
- Architecture: HIGH - Patterns verified in existing codebase (Realtime Broadcast, keyboard nav, AnimatePresence), native window.open and Fullscreen API are standard
- Pitfalls: MEDIUM - Cross-device sync requirement is well-understood (rules out BroadcastChannel/postMessage), but battle-testing will surface edge cases

**Research date:** 2026-02-11
**Valid until:** ~30 days (stable APIs and libraries, unlikely to change)
