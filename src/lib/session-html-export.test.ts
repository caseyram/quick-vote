import { describe, it, expect } from 'vitest';
import { sessionToHTML, escapeHtml } from './session-html-export';
import type { SessionExport } from './session-export';

function makeFixture(): SessionExport {
  return {
    session_name: 'Q1 Planning',
    created_at: '2026-04-01T12:00:00Z',
    teams: ['Alpha Squad', 'Beta Crew'],
    templates: [],
    session_template_name: null,
    batches: [
      {
        type: 'batch',
        name: 'Roadmap',
        position: 0,
        questions: [
          {
            text: 'Should we ship feature X?',
            type: 'agree_disagree',
            options: null,
            anonymous: false,
            template_id: null,
            votes: [
              { participant_id: 'p-alice-1234', value: 'Agree', reason: 'great idea', team_id: 't-alpha-1' },
              { participant_id: 'p-bob-5678', value: 'Disagree', reason: 'too risky', team_id: 't-beta-2' },
              { participant_id: 'p-eve-9999', value: 'Agree', reason: '<script>alert(1)</script>', team_id: 't-alpha-1' },
              // Moderated vote — should still appear, with no badge
              { participant_id: 'p-flagged', value: 'Disagree', reason: 'spam vote here', team_id: 't-beta-2' },
            ],
          },
          {
            text: 'Pick a color',
            type: 'multiple_choice',
            options: ['Red', 'Green', 'Blue'],
            anonymous: true,
            template_id: null,
            votes: [
              { participant_id: 'p-1', value: 'Red', reason: null, team_id: null },
              { participant_id: 'p-2', value: 'Green', reason: null, team_id: null },
            ],
          },
          {
            text: 'Empty question',
            type: 'agree_disagree',
            options: null,
            anonymous: false,
            template_id: null,
            votes: [],
          },
        ],
      },
      {
        type: 'slide',
        position: 1,
        image_path: 'slides/cover.png',
        caption: 'Slide caption that must not appear',
        notes: null,
      },
    ] as SessionExport['batches'],
  };
}

describe('sessionToHTML', () => {
  const html = sessionToHTML(makeFixture());

  it('produces a valid HTML document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Q1 Planning — Results</title>');
  });

  it('includes the session title', () => {
    expect(html).toContain('Q1 Planning');
  });

  it('renders each non-slide question', () => {
    expect(html).toContain('Should we ship feature X?');
    expect(html).toContain('Pick a color');
    expect(html).toContain('Empty question');
  });

  it('renders an SVG chart for questions with votes', () => {
    const svgCount = (html.match(/<svg /g) || []).length;
    expect(svgCount).toBe(2); // two non-empty questions; the empty one has no chart
  });

  it('shows "No votes recorded" for empty questions', () => {
    expect(html).toContain('No votes recorded');
  });

  it('includes the reason text for non-empty reasons', () => {
    expect(html).toContain('great idea');
    expect(html).toContain('too risky');
    expect(html).toContain('spam vote here');
  });

  it('escapes HTML in reason text', () => {
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('anonymizes — never leaks participant_id, team_id, or team names', () => {
    expect(html).not.toContain('p-alice-1234');
    expect(html).not.toContain('p-bob-5678');
    expect(html).not.toContain('p-eve-9999');
    expect(html).not.toContain('p-flagged');
    expect(html).not.toContain('t-alpha-1');
    expect(html).not.toContain('t-beta-2');
    expect(html).not.toContain('Alpha Squad');
    expect(html).not.toContain('Beta Crew');
  });

  it('does not show a "Moderated" badge', () => {
    expect(html).not.toContain('Moderated');
  });

  it('skips slide entries', () => {
    expect(html).not.toContain('Slide caption that must not appear');
    expect(html).not.toContain('slides/cover.png');
  });

  it('renders the batch name on each card', () => {
    const matches = html.match(/Roadmap/g) || [];
    // One per question card (3 non-slide questions)
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('renames _unbatched to "Unbatched"', () => {
    const fixture: SessionExport = {
      session_name: 'X',
      created_at: '2026-04-01T12:00:00Z',
      batches: [
        {
          type: 'batch',
          name: '_unbatched',
          position: 0,
          questions: [
            { text: 'Q', type: 'agree_disagree', options: null, anonymous: false, template_id: null, votes: [] },
          ],
        },
      ] as SessionExport['batches'],
    };
    const out = sessionToHTML(fixture);
    expect(out).toContain('Unbatched');
    expect(out).not.toContain('_unbatched');
  });

  it('orders agree_disagree columns as Agree, Sometimes, Disagree', () => {
    // The reason "great idea" (Agree) should appear before "too risky" (Disagree) in the reasons grid
    const idxAgree = html.indexOf('great idea');
    const idxDisagree = html.indexOf('too risky');
    expect(idxAgree).toBeGreaterThan(-1);
    expect(idxDisagree).toBeGreaterThan(idxAgree);
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});
