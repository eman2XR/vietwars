// Sends saved results to the repository as GitHub issues, so the lesson-planning agents can read them.

import { store } from './store.js';

export const REPO = 'eman2XR/vietwars';
export const RESULT_MARKER = '<!-- vietwars-result -->';
const API = 'https://api.github.com';

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function issueFor(result) {
  const s = result.summary;
  const pct = Math.round((s.firstTryAccuracy ?? 0) * 100);
  const title = `Result: ${result.lessonTitle} (${result.kind}) ${result.finishedAt.slice(0, 10)} ${pct}%`;
  const fb = result.feedback || {};
  const lines = [
    `**${result.lessonTitle}** (${result.kind}) on ${result.device}, ${Math.round(result.durationSec / 60)} min`,
    `First-try accuracy ${pct}% over ${s.exercises} exercises, ${s.xp} XP` +
      (s.speedAnswered ? `, speed round ${s.speedCorrect}/${s.speedAnswered}` : ''),
  ];
  if (fb.difficulty || fb.fun) lines.push(`Felt: ${fb.difficulty || 'n/a'}, fun: ${fb.fun || 'n/a'}`);
  if (fb.hardest?.length) lines.push(`Hardest: ${fb.hardest.join(', ')}`);
  if (fb.wantNext) lines.push(`Wants next: ${fb.wantNext}`);
  if (fb.note) lines.push(`Note: ${fb.note}`);
  const body = `${lines.join('\n\n')}\n\n${RESULT_MARKER}\n\`\`\`json\n${JSON.stringify(result, null, 1)}\n\`\`\`\n`;
  return { title, body, resultId: result.resultId };
}

export function queue(result) {
  const box = store.outbox();
  if (!box.some((x) => x.resultId === result.resultId)) box.push(issueFor(result));
  store.saveOutbox(box);
}

// Sends everything in the outbox; returns the number sent and any error message.
export async function flush() {
  const token = store.settings().token;
  const box = store.outbox();
  if (!box.length) return { sent: 0, left: 0 };
  if (!token) return { sent: 0, left: box.length, error: 'No GitHub token set' };
  let sent = 0;
  let error;
  const left = [];
  for (const item of box) {
    if (error) {
      left.push(item);
      continue;
    }
    try {
      const res = await fetch(`${API}/repos/${REPO}/issues`, {
        method: 'POST',
        headers: { ...headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.title, body: item.body, labels: ['result'] }),
      });
      if (res.ok) sent += 1;
      else {
        error = `GitHub answered ${res.status}`;
        left.push(item);
      }
    } catch {
      error = 'No connection';
      left.push(item);
    }
  }
  store.saveOutbox(left);
  return { sent, left: left.length, error };
}

export async function testToken(token) {
  try {
    const res = await fetch(`${API}/repos/${REPO}`, { headers: headers(token) });
    if (!res.ok) return `GitHub answered ${res.status}`;
    return null;
  } catch {
    return 'No connection';
  }
}
