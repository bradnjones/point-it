#!/usr/bin/env node
/**
 * "Where are we at?" / "what's next?"
 *
 * Reconciles two sources of truth:
 *   1. docs/stories/STORY-*.md frontmatter (the documented status)
 *   2. git history (what has actually been committed)
 *
 * Divergence between the two is reported as a warning, so the backlog can't
 * quietly drift away from the code. See docs/PLAN.md ("Progress tracking").
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STORIES_DIR = path.join(REPO_ROOT, 'docs', 'stories');

const US = String.fromCharCode(31); // separates fields within a commit record
const RS = String.fromCharCode(30); // separates commit records
const ESC = String.fromCharCode(27);

const STATUS = { DONE: 'done', IN_PROGRESS: 'in-progress', NOT_STARTED: 'not-started' };

// --- parsing -------------------------------------------------------------

/**
 * Minimal frontmatter reader: scalars and inline arrays are all the story
 * files use, so this avoids a YAML dependency.
 */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return {};

  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!field) continue;

    const [, key, rawValue] = field;
    const value = rawValue.trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      out[key] = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      out[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
  return out;
}

/** Splits the record-separated `git log` output into {subject, body} objects. */
export function parseGitLog(raw) {
  return raw
    .split(RS)
    .map((record) => record.replace(/^[\r\n]+/, ''))
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [, subject = '', body = ''] = record.split(US);
      return { subject: subject.trim(), body: body.trim() };
    });
}

const normaliseStoryId = (digits) => `STORY-${String(Number(digits)).padStart(3, '0')}`;

/**
 * Counts commits per story. A commit that names the same story more than once
 * still counts once, so the number means "commits touching this story".
 */
export function countCommitsByStory(commits) {
  const counts = new Map();

  for (const { subject = '', body = '' } of commits) {
    const referenced = new Set();
    for (const [, digits] of `${subject} ${body}`.matchAll(/story[-_\s]?(\d{1,4})/gi)) {
      referenced.add(normaliseStoryId(digits));
    }
    for (const id of referenced) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

const storyNumber = (id) => Number(String(id).replace(/^STORY-/i, '')) || 0;

// --- reporting -----------------------------------------------------------

export function computeReport(stories, commitCounts) {
  const sorted = [...stories].sort((a, b) => storyNumber(a.id) - storyNumber(b.id));
  const withCommits = sorted.map((s) => ({ ...s, commits: commitCounts.get(s.id) ?? 0 }));

  const byStatus = (status) => withCommits.filter((s) => s.status === status);
  const done = byStatus(STATUS.DONE);
  const inProgress = byStatus(STATUS.IN_PROGRESS);
  const notStarted = byStatus(STATUS.NOT_STARTED);

  const doneIds = new Set(done.map((s) => s.id));
  const depsSatisfied = (s) => (s.depends_on ?? []).every((dep) => doneIds.has(dep));

  const ready = notStarted.filter(depsSatisfied);
  const blocked = notStarted.filter((s) => !depsSatisfied(s));

  const warnings = [];
  for (const s of withCommits) {
    if (s.status === STATUS.DONE && s.commits === 0) {
      warnings.push({
        type: 'done-without-commits',
        storyId: s.id,
        message: 'marked done but no commit references it',
      });
    }
    if (s.status === STATUS.IN_PROGRESS && s.commits === 0) {
      warnings.push({
        type: 'in-progress-without-commits',
        storyId: s.id,
        message: 'marked in-progress but no commit references it yet',
      });
    }
    if (s.status === STATUS.NOT_STARTED && s.commits > 0) {
      warnings.push({
        type: 'commits-without-status',
        storyId: s.id,
        message: `${s.commits} commit(s) reference it but status is still not-started`,
      });
    }
  }

  const knownIds = new Set(withCommits.map((s) => s.id));
  for (const id of commitCounts.keys()) {
    if (!knownIds.has(id)) {
      warnings.push({
        type: 'unknown-story',
        storyId: id,
        message: 'commits reference a story with no file in docs/stories',
      });
    }
  }

  return {
    totals: {
      done: done.length,
      inProgress: inProgress.length,
      notStarted: notStarted.length,
      total: withCommits.length,
    },
    done,
    inProgress,
    notStarted,
    blocked,
    next: ready[0] ?? null,
    warnings,
  };
}

// --- I/O -----------------------------------------------------------------

export function loadStories(dir = STORIES_DIR) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => /^STORY-\d+.*\.md$/i.test(file))
    .map((file) => {
      const fm = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
      return {
        id: fm.id,
        title: fm.title ?? '(untitled)',
        epic: fm.epic ?? '',
        status: fm.status ?? STATUS.NOT_STARTED,
        depends_on: fm.depends_on ?? [],
        file,
      };
    })
    .filter((s) => Boolean(s.id));
}

export function readCommits(cwd = REPO_ROOT) {
  try {
    const raw = execFileSync(
      'git',
      ['log', `--pretty=format:%H${US}%s${US}%b${RS}`],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return parseGitLog(raw);
  } catch {
    // No repo yet, or no commits yet — both mean "nothing committed".
    return [];
  }
}

// --- rendering -----------------------------------------------------------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (useColor ? `${ESC}[${code}m${text}${ESC}[0m` : text);
const dim = (t) => paint('2', t);
const bold = (t) => paint('1', t);
const green = (t) => paint('32', t);
const yellow = (t) => paint('33', t);
const cyan = (t) => paint('36', t);
const grey = (t) => paint('90', t);

function bar(done, total, width = 24) {
  if (total === 0) return '';
  const filled = Math.round((done / total) * width);
  return green('█'.repeat(filled)) + grey('░'.repeat(width - filled));
}

const line = (s, note = '') => `  ${s.id}  ${s.title}${note ? ' ' + dim(note) : ''}`;

function render(report) {
  const { totals } = report;
  const out = [];

  out.push('');
  out.push(bold('point-it — where are we at?'));
  out.push('');
  out.push(`  ${bar(totals.done, totals.total)}  ${totals.done}/${totals.total} done`);
  out.push(
    `  ${green(`${totals.done} done`)}   ${yellow(`${totals.inProgress} in progress`)}   ${grey(`${totals.notStarted} not started`)}`
  );

  if (report.done.length) {
    out.push('', bold('Done'));
    for (const s of report.done) out.push(green(line(s, `(${s.commits} commit${s.commits === 1 ? '' : 's'})`)));
  }

  if (report.inProgress.length) {
    out.push('', bold('In progress'));
    for (const s of report.inProgress) out.push(yellow(line(s, `(${s.commits} commits)`)));
  }

  out.push('', bold("What's next"));
  if (report.next) {
    out.push(cyan(`  → ${report.next.id}  ${report.next.title}`));
    out.push(dim(`     epic: ${report.next.epic} · file: docs/stories/${report.next.file}`));
  } else if (totals.notStarted === 0) {
    out.push(green('  Everything is done.'));
  } else {
    out.push(yellow('  Nothing is unblocked — every remaining story is waiting on a dependency.'));
  }

  if (report.blocked.length) {
    out.push('', bold('Blocked'), dim('  (waiting on dependencies)'));
    for (const s of report.blocked) {
      const pending = s.depends_on.filter((d) => !report.done.some((x) => x.id === d));
      out.push(grey(line(s, `needs ${pending.join(', ')}`)));
    }
  }

  if (report.warnings.length) {
    out.push('', bold(yellow('Warnings')));
    for (const w of report.warnings) out.push(yellow(`  ⚠ ${w.storyId}  ${w.message}`));
  }

  out.push('');
  return out.join('\n');
}

// --- entrypoint ----------------------------------------------------------

export function main(argv = process.argv.slice(2)) {
  const stories = loadStories();
  const report = computeReport(stories, countCommitsByStory(readCommits()));

  if (argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(render(report));
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main();
}
