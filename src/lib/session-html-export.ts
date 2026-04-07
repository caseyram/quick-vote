import type { SessionExport } from './session-export';
import { AGREE_DISAGREE_COLORS, MULTI_CHOICE_COLORS } from '../components/BarChart';
import { getTextColor } from './color-contrast';

/**
 * Builds a fully self-contained HTML document from a SessionExport.
 *
 * The output mirrors the SessionReview page (one chart per question, with
 * collapsible reasons grouped by vote option) and contains zero references
 * to external assets, fonts, or APIs — it can be opened from disk or shared
 * by file like the JSON export.
 *
 * Identity is always anonymized: participant_id, team_id, and team names are
 * never written into the output, regardless of each question's `anonymous` flag.
 * Slide entries are skipped (slide images live in Storage and cannot be embedded
 * without a network fetch).
 */
export function sessionToHTML(data: SessionExport): string {
  // Flatten questions across batches in display order, tagging each with its
  // batch name so we can render batch headers when the boundary changes.
  type FlatQuestion = {
    batchName: string;
    text: string;
    type: 'agree_disagree' | 'multiple_choice';
    options: string[] | null;
    bars: BarDatum[];
    /** Reasons grouped into the same column order as `bars`. */
    reasonsByColumn: { label: string; color: string; reasons: string[] }[];
    totalVotes: number;
  };

  const flat: FlatQuestion[] = [];

  for (const entry of data.batches) {
    // Skip slides — they have no chart/comments and the image cannot be embedded.
    if (entry.type !== 'batch') continue;

    const batchName = entry.name === '_unbatched' ? 'Unbatched' : entry.name;

    for (const q of entry.questions) {
      const bars = buildBars(q.type, q.options, q.votes);
      const reasonsByColumn = bars.map(bar => ({
        label: bar.label,
        color: bar.color,
        reasons: q.votes
          .filter(v => v.value.toLowerCase() === bar.label.toLowerCase() && v.reason && v.reason.trim())
          .map(v => v.reason as string),
      }));

      flat.push({
        batchName,
        text: q.text,
        type: q.type,
        options: q.options,
        bars,
        reasonsByColumn,
        totalVotes: q.votes.length,
      });
    }
  }

  const cards: string[] = flat.map((q, i) => renderQuestionCard(q, i, flat.length));

  const title = escapeHtml(data.session_name) + ' — Results';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="page">
  <header class="page-header">
    <h1>${escapeHtml(data.session_name)}</h1>
    <p class="subtitle">Session results</p>
  </header>
  ${flat.length > 1 ? `
  <div class="nav-bar">
    <button type="button" class="nav-btn" data-nav="prev" aria-label="Previous question">&larr;</button>
    <span class="nav-indicator">Question <span id="nav-current">1</span> of ${flat.length} <span class="nav-hint">(use &larr; / &rarr; to navigate)</span></span>
    <button type="button" class="nav-btn" data-nav="next" aria-label="Next question">&rarr;</button>
  </div>` : ''}
  <main id="questions">
    ${cards.join('\n')}
  </main>
  ${flat.length === 0 ? '<p class="empty">No questions in this session.</p>' : ''}
</div>
${flat.length > 1 ? `<script>${SCRIPT}</script>` : ''}
</body>
</html>`;
}

// ============================================================================
// Bar building (mirrors SessionReview's buildBarData + buildConsistentBarData)
// ============================================================================

interface BarDatum {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

function buildBars(
  type: 'agree_disagree' | 'multiple_choice',
  options: string[] | null,
  votes: { value: string }[]
): BarDatum[] {
  let expectedOrder: string[];
  if (type === 'agree_disagree') {
    expectedOrder = ['Agree', 'Sometimes', 'Disagree'];
  } else if (options && options.length > 0) {
    expectedOrder = options;
  } else {
    // Fallback: use observed values in insertion order
    const seen = new Set<string>();
    expectedOrder = [];
    for (const v of votes) {
      if (!seen.has(v.value)) {
        seen.add(v.value);
        expectedOrder.push(v.value);
      }
    }
  }

  const total = votes.length;

  return expectedOrder.map((value, index) => {
    const count = votes.filter(v => v.value.toLowerCase() === value.toLowerCase()).length;
    const percentage = total === 0 ? 0 : Math.round((count / total) * 100);

    let color: string;
    if (type === 'agree_disagree') {
      const key = value.toLowerCase() as 'agree' | 'disagree' | 'sometimes';
      color = AGREE_DISAGREE_COLORS[key] ?? MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    } else {
      color = MULTI_CHOICE_COLORS[index % MULTI_CHOICE_COLORS.length];
    }

    return { label: value, count, percentage, color };
  });
}

// ============================================================================
// Rendering
// ============================================================================

function renderQuestionCard(
  q: {
    batchName: string;
    text: string;
    type: 'agree_disagree' | 'multiple_choice';
    bars: BarDatum[];
    reasonsByColumn: { label: string; color: string; reasons: string[] }[];
    totalVotes: number;
  },
  index: number,
  total: number
): string {
  const totalReasons = q.reasonsByColumn.reduce((sum, c) => sum + c.reasons.length, 0);
  const typeLabel = q.type === 'agree_disagree' ? 'Agree/Disagree' : 'Multiple Choice';
  const typeClass = q.type === 'agree_disagree' ? 'badge-indigo' : 'badge-emerald';

  return `<section class="question-card" data-question-index="${index}" ${index === 0 ? '' : 'hidden'}>
  <p class="batch-label">${escapeHtml(q.batchName)}</p>
  <div class="q-head">
    <span class="q-num">${index + 1} / ${total}</span>
    <div class="q-meta">
      <span class="badge ${typeClass}">${typeLabel}</span>
      <p class="q-text">${escapeHtml(q.text)}</p>
    </div>
  </div>
  ${q.totalVotes === 0
    ? '<p class="no-votes">No votes recorded</p>'
    : renderChart(q.bars, q.totalVotes)}
  ${totalReasons > 0 ? `
  <details class="reasons">
    <summary>Show Reasons (${totalReasons})</summary>
    <div class="reasons-grid">
      ${q.reasonsByColumn.map(col => `
        <div class="reasons-col">
          <p class="reasons-col-label" style="color:${col.color}">${escapeHtml(col.label)} (${col.reasons.length})</p>
          ${col.reasons.map(r => `
            <div class="reason" style="border-left-color:${col.color}">${escapeHtml(r)}</div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  </details>` : ''}
</section>`;
}

function renderChart(bars: BarDatum[], totalVotes: number): string {
  // Fixed viewBox; the SVG scales responsively via CSS width:100%.
  const VB_W = 600;
  const VB_H = 320;
  const PADDING_X = 20;
  const TOP_LABEL_H = 40;   // space above bars for count + percentage
  const BOTTOM_LABEL_H = 60; // space below bars for option label
  const BAR_AREA_H = VB_H - TOP_LABEL_H - BOTTOM_LABEL_H;
  const BAR_AREA_TOP = TOP_LABEL_H;
  const BAR_AREA_BOTTOM = TOP_LABEL_H + BAR_AREA_H;

  const colWidth = (VB_W - PADDING_X * 2) / bars.length;
  const barWidth = colWidth * 0.7;

  const maxCount = Math.max(1, ...bars.map(b => b.count));

  const cols = bars.map((bar, i) => {
    const cx = PADDING_X + colWidth * i + colWidth / 2;
    const barX = cx - barWidth / 2;
    const h = (bar.count / maxCount) * BAR_AREA_H;
    const barY = BAR_AREA_BOTTOM - h;

    // Count + percentage above the bar
    const labelY = barY - 8;

    // Option label below the bar — wrap long text by splitting on whitespace
    const labelLines = wrapLabel(bar.label, 14);
    const labelStartY = BAR_AREA_BOTTOM + 18;

    // On-bar text contrast (only render if bar tall enough)
    const onBarText = h >= 36
      ? `<text x="${cx}" y="${barY + 22}" text-anchor="middle" font-size="14" font-weight="600" fill="${getTextColor(bar.color) === 'dark' ? '#1f2937' : '#ffffff'}">${bar.percentage}%</text>`
      : '';

    return `
      <g>
        <rect x="${barX}" y="${barY}" width="${barWidth}" height="${h}" rx="4" fill="${bar.color}"/>
        <text x="${cx}" y="${labelY}" text-anchor="middle" font-size="14" font-weight="600" fill="#374151">${bar.count} (${bar.percentage}%)</text>
        ${onBarText}
        ${labelLines.map((line, li) => `<text x="${cx}" y="${labelStartY + li * 16}" text-anchor="middle" font-size="13" fill="#4b5563">${escapeHtml(line)}</text>`).join('')}
      </g>`;
  }).join('');

  return `
  <div class="chart-wrap">
    <svg viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Bar chart of vote counts">
      <line x1="${PADDING_X}" y1="${BAR_AREA_BOTTOM}" x2="${VB_W - PADDING_X}" y2="${BAR_AREA_BOTTOM}" stroke="#e5e7eb" stroke-width="1"/>
      ${cols}
    </svg>
    <p class="total">${totalVotes} total vote${totalVotes === 1 ? '' : 's'}</p>
  </div>`;
}

/**
 * Naive label wrapping by character count. Keeps the SVG simple — long option
 * names get broken at word boundaries into up to 3 lines.
 */
function wrapLabel(text: string, maxCharsPerLine: number): string[] {
  if (text.length <= maxCharsPerLine) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= maxCharsPerLine) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === 2) break;
    }
  }
  if (current && lines.length < 3) lines.push(current);
  // Truncate if we have more text than we can show
  if (lines.length === 3 && words.join(' ').length > lines.join(' ').length) {
    lines[2] = lines[2].slice(0, Math.max(0, maxCharsPerLine - 1)) + '…';
  }
  return lines;
}

// ============================================================================
// HTML escape
// ============================================================================

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// Inline CSS
// ============================================================================

const STYLES = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;color:#111827;line-height:1.5}
.page{max-width:768px;margin:0 auto;padding:32px 16px}
.page-header h1{margin:0 0 4px;font-size:28px;font-weight:700;color:#111827}
.page-header .subtitle{margin:0;color:#6b7280;font-size:14px}
.nav-bar{display:flex;align-items:center;justify-content:center;gap:16px;margin:24px 0 16px;color:#6b7280;font-size:14px}
.nav-btn{background:#fff;border:1px solid #e5e7eb;border-radius:9999px;width:40px;height:40px;font-size:18px;cursor:pointer;color:#374151;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
.nav-btn:hover{background:#f3f4f6}
.nav-btn:disabled{opacity:0.3;cursor:not-allowed}
.nav-hint{color:#9ca3af}
.question-card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:16px}
.batch-label{margin:0 0 10px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280}
.q-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}
.q-num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#6b7280;margin-top:2px}
.q-meta{flex:1;min-width:0}
.badge{display:inline-block;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:500;margin-bottom:6px}
.badge-indigo{background:#e0e7ff;color:#4338ca}
.badge-emerald{background:#d1fae5;color:#047857}
.q-text{margin:0;font-weight:500;color:#111827}
.no-votes{margin:8px 0 0;color:#9ca3af;font-size:14px;padding-left:28px}
.chart-wrap{padding:8px 0 0}
.chart-wrap svg{display:block;width:100%;height:auto;max-height:340px}
.total{margin:4px 0 0;text-align:center;color:#6b7280;font-size:12px}
.reasons{margin-top:16px}
.reasons summary{cursor:pointer;font-size:14px;font-weight:500;color:#4f46e5;list-style:none;padding:4px 0}
.reasons summary::-webkit-details-marker{display:none}
.reasons summary::after{content:" \\25BC";font-size:10px}
.reasons[open] summary::after{content:" \\25B2"}
.reasons-grid{display:flex;gap:16px;margin-top:8px;flex-wrap:wrap}
.reasons-col{flex:1 1 0;min-width:120px}
.reasons-col-label{margin:0 0 6px;font-size:12px;font-weight:600;text-align:center}
.reason{background:#f9fafb;border-left:3px solid #ccc;border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:14px;color:#374151;word-wrap:break-word;overflow-wrap:anywhere}
.empty{text-align:center;color:#6b7280;padding:48px 0}
@media print {
  body{background:#fff}
  .nav-bar{display:none}
  .question-card[hidden]{display:block !important}
  .reasons[open] .reasons-grid,.reasons:not([open]) .reasons-grid{display:flex}
  .reasons:not([open])>summary{display:none}
}
`;

// ============================================================================
// Inline JS — keyboard nav + prev/next buttons
// ============================================================================

const SCRIPT = `
(function(){
  var cards = Array.prototype.slice.call(document.querySelectorAll('.question-card'));
  var indicator = document.getElementById('nav-current');
  var prevBtn = document.querySelector('[data-nav="prev"]');
  var nextBtn = document.querySelector('[data-nav="next"]');
  if (!cards.length) return;
  var current = 0;

  function show(i) {
    if (i < 0 || i >= cards.length) return;
    cards.forEach(function(c, idx){ if (idx === i) c.removeAttribute('hidden'); else c.setAttribute('hidden',''); });
    if (indicator) indicator.textContent = String(i + 1);
    if (prevBtn) prevBtn.disabled = (i === 0);
    if (nextBtn) nextBtn.disabled = (i === cards.length - 1);
    current = i;
  }

  document.addEventListener('keydown', function(e){
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
  });
  if (prevBtn) prevBtn.addEventListener('click', function(){ show(current - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function(){ show(current + 1); });
  show(0);
})();
`;
