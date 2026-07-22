import { describe, expect, it } from 'vitest';
import { computeReport, countCommitsByStory, parseFrontmatter, parseGitLog } from './status.mjs';

const story = (id, status, depends_on = []) => ({
  id,
  title: `Story ${id}`,
  epic: 'A Foundations',
  status,
  depends_on,
});

describe('parseFrontmatter', () => {
  it('reads scalar fields', () => {
    const fm = parseFrontmatter(['---', 'id: STORY-001', 'title: Scaffolding', 'status: done', '---', '# body'].join('\n'));

    expect(fm.id).toBe('STORY-001');
    expect(fm.title).toBe('Scaffolding');
    expect(fm.status).toBe('done');
  });

  it('reads inline array fields', () => {
    const fm = parseFrontmatter('---\nid: STORY-004\ndepends_on: [STORY-002, STORY-003]\n---\n');

    expect(fm.depends_on).toEqual(['STORY-002', 'STORY-003']);
  });

  it('treats an empty array as no dependencies', () => {
    const fm = parseFrontmatter('---\nid: STORY-001\ndepends_on: []\n---\n');

    expect(fm.depends_on).toEqual([]);
  });

  it('returns an empty object when there is no frontmatter', () => {
    expect(parseFrontmatter('# just a heading')).toEqual({});
  });
});

describe('countCommitsByStory', () => {
  it('matches the story id case-insensitively in subject or body', () => {
    const counts = countCommitsByStory([
      { subject: 'feat(story-001): scaffold', body: '' },
      { subject: 'fix: tidy up', body: 'Relates to STORY-001' },
    ]);

    expect(counts.get('STORY-001')).toBe(2);
  });

  it('counts a commit once even if it names the same story twice', () => {
    const counts = countCommitsByStory([
      { subject: 'feat(story-002): data layer', body: 'Completes STORY-002.' },
    ]);

    expect(counts.get('STORY-002')).toBe(1);
  });

  it('counts distinct stories separately', () => {
    const counts = countCommitsByStory([{ subject: 'chore(story-001): x', body: 'also STORY-003' }]);

    expect(counts.get('STORY-001')).toBe(1);
    expect(counts.get('STORY-003')).toBe(1);
  });

  it('ignores commits with no story reference', () => {
    expect(countCommitsByStory([{ subject: 'docs: readme', body: '' }]).size).toBe(0);
  });

  it('normalises unpadded ids', () => {
    expect(countCommitsByStory([{ subject: 'feat(story-7): x', body: '' }]).get('STORY-007')).toBe(1);
  });
});

describe('parseGitLog', () => {
  const US = String.fromCharCode(31); // unit separator, between fields
  const RS = String.fromCharCode(30); // record separator, between commits

  it('splits records into subject and body', () => {
    const raw = [
      ['abc', 'subject one', 'body one'].join(US),
      ['def', 'subject two', 'body two'].join(US),
    ].join(RS);

    expect(parseGitLog(raw)).toEqual([
      { subject: 'subject one', body: 'body one' },
      { subject: 'subject two', body: 'body two' },
    ]);
  });

  it('returns nothing for an empty log', () => {
    expect(parseGitLog('')).toEqual([]);
  });
});

describe('computeReport', () => {
  it('buckets stories by status', () => {
    const report = computeReport(
      [story('STORY-001', 'done'), story('STORY-002', 'in-progress'), story('STORY-003', 'not-started')],
      new Map([
        ['STORY-001', 2],
        ['STORY-002', 1],
      ])
    );

    expect(report.totals).toMatchObject({ done: 1, inProgress: 1, notStarted: 1, total: 3 });
  });

  it('picks the lowest-numbered not-started story whose dependencies are done', () => {
    const report = computeReport(
      [
        story('STORY-001', 'done'),
        story('STORY-002', 'not-started', ['STORY-001']),
        story('STORY-003', 'not-started', ['STORY-001']),
      ],
      new Map([['STORY-001', 1]])
    );

    expect(report.next?.id).toBe('STORY-002');
  });

  it('skips a story whose dependencies are not yet done', () => {
    const report = computeReport(
      [
        story('STORY-001', 'done'),
        story('STORY-002', 'not-started', ['STORY-009']),
        story('STORY-003', 'not-started', ['STORY-001']),
      ],
      new Map([['STORY-001', 1]])
    );

    expect(report.next?.id).toBe('STORY-003');
    expect(report.blocked.map((s) => s.id)).toContain('STORY-002');
  });

  it('reports no next story when everything is done', () => {
    const report = computeReport([story('STORY-001', 'done')], new Map([['STORY-001', 1]]));

    expect(report.next).toBeNull();
  });

  it('warns when a story is marked done but has no commits', () => {
    const report = computeReport([story('STORY-001', 'done')], new Map());

    expect(report.warnings).toContainEqual(
      expect.objectContaining({ storyId: 'STORY-001', type: 'done-without-commits' })
    );
  });

  it('warns when commits exist for a story still marked not-started', () => {
    const report = computeReport([story('STORY-005', 'not-started')], new Map([['STORY-005', 3]]));

    expect(report.warnings).toContainEqual(
      expect.objectContaining({ storyId: 'STORY-005', type: 'commits-without-status' })
    );
  });

  it('warns when a story is in progress with no commits', () => {
    const report = computeReport([story('STORY-002', 'in-progress')], new Map());

    expect(report.warnings).toContainEqual(
      expect.objectContaining({ storyId: 'STORY-002', type: 'in-progress-without-commits' })
    );
  });

  it('warns when a commit references an unknown story', () => {
    const report = computeReport([story('STORY-001', 'done')], new Map([['STORY-001', 1], ['STORY-042', 1]]));

    expect(report.warnings).toContainEqual(
      expect.objectContaining({ storyId: 'STORY-042', type: 'unknown-story' })
    );
  });

  it('handles a repo with zero commits', () => {
    const report = computeReport(
      [story('STORY-001', 'not-started'), story('STORY-002', 'not-started', ['STORY-001'])],
      new Map()
    );

    expect(report.totals).toMatchObject({ done: 0, inProgress: 0, notStarted: 2 });
    expect(report.next?.id).toBe('STORY-001');
    expect(report.warnings).toEqual([]);
  });
});
