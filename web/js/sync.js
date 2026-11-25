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
        body: JSON.stringify({ title: item.title, body: item.body, labels: item.labels || ['result'] }),
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

const RESULT_BLOCK = /<!-- vietwars-result -->\s*```json\s*([\s\S]*?)\s*```/;

export const QUESTION_MARKER = '<!-- vietwars-question -->';
const QUESTION_BLOCK = /<!-- vietwars-question -->\s*```json\s*([\s\S]*?)\s*```/;
const ANSWER_BLOCK = /<!-- vietwars-answer\s*([\s\S]*?)\s*-->/;

// Queues a question for the editors; it is posted as a GitHub issue like a result.
export function queueQuestion(text, context) {
  const q = { questionId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, askedAt: new Date().toISOString(), text, context: context || null };
  const title = `Question: ${text.replace(/\s+/g, ' ').slice(0, 70)}${text.length > 70 ? '...' : ''}`;
  const body = `${text}${context ? `\n\nContext: ${context}` : ''}\n\n${QUESTION_MARKER}\n\`\`\`json\n${JSON.stringify(q, null, 1)}\n\`\`\`\n`;
  const box = store.outbox();
  box.push({ title, body, resultId: q.questionId, labels: ['question'] });
  store.saveOutbox(box);
  const mine = store.settings().questions || [];
  store.saveSettings({ ...store.settings(), questions: [...mine, { ...q, answer: null }] });
  return q;
}

export const TALK_MARKER = '<!-- vietwars-talk -->';

// Queues the transcript of a live conversation; it is posted as a GitHub issue like a result, for the editors.
export function queueTalk({ context, model, turns, startedAt }) {
  const t = { talkId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, startedAt, endedAt: new Date().toISOString(), device: navigator.userAgent.match(/iPhone|iPad|Macintosh/)?.[0] || 'device', context, model, turns };
  const first = (turns.find((x) => x.who === 'you') || turns[0]).text.replace(/\s+/g, ' ');
  const title = `Talk: ${first.slice(0, 70)}${first.length > 70 ? '...' : ''}`;
  const text = turns.map((x) => `**${x.who === 'you' ? 'Learner' : 'Editor'}:** ${x.text}`).join('\n\n');
  const body = `${text}\n\n${TALK_MARKER}\n\`\`\`json\n${JSON.stringify(t, null, 1)}\n\`\`\`\n`;
  const box = store.outbox();
  box.push({ title, body, resultId: t.talkId, labels: ['talk'] });
  store.saveOutbox(box);
  return t;
}

async function listIssues(token, page) {
  const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) h.Authorization = `Bearer ${token}`;
  return fetch(`${API}/repos/${REPO}/issues?state=all&per_page=100&page=${page}`, { headers: h, cache: 'no-store' });
}

// Results and questions read the same list, so one fetch serves both for a few seconds.
let recent = null;
function allIssues() {
  if (recent && Date.now() - recent.at < 15000) return recent.promise;
  const promise = fetchIssues().catch((err) => {
    recent = null;
    throw err;
  });
  recent = { at: Date.now(), promise };
  return promise;
}

async function fetchIssues() {
  const token = store.settings().token;
  const items = [];
  for (let page = 1; page <= 20; page++) {
    let res = await listIssues(token, page);
    if (res.status === 401 && token) res = await listIssues(null, page);
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch)) throw new Error('Unexpected answer from GitHub');
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

// Reads every result posted from any device. The repository is public, so this works without a token.
export async function pullResults() {
  const results = [];
  for (const it of await allIssues()) {
    const m = (it.body || '').match(RESULT_BLOCK);
    if (!m) continue;
    try {
      const r = JSON.parse(m[1]);
      if (r && r.resultId && r.finishedAt) results.push(r);
    } catch {
      /* A damaged result block is skipped. */
    }
  }
  return results;
}

// Reads the learner's questions and the editors' answers (issue comments with an answer block, or any reply).
// Questions already answered on this device keep their answer, so their comments are not fetched again.
export async function pullQuestions(answered = new Map()) {
  const token = store.settings().token;
  const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) h.Authorization = `Bearer ${token}`;
  const out = [];
  for (const it of await allIssues()) {
    const m = (it.body || '').match(QUESTION_BLOCK);
    if (!m) continue;
    let q;
    try {
      q = JSON.parse(m[1]);
    } catch {
      continue;
    }
    let answer = answered.get(q.questionId) || null;
    if (!answer && it.comments) {
      try {
        const res = await fetch(`${API}/repos/${REPO}/issues/${it.number}/comments`, { headers: h, cache: 'no-store' });
        const comments = res.ok ? await res.json() : [];
        const c = [...comments].reverse().find((x) => ANSWER_BLOCK.test(x.body || '')) || comments[comments.length - 1];
        if (c) {
          const block = (c.body || '').match(ANSWER_BLOCK);
          let phrases = [];
          if (block) {
            try {
              phrases = JSON.parse(block[1]).phrases || [];
            } catch {
              phrases = [];
            }
          }
          answer = { text: (c.body || '').replace(ANSWER_BLOCK, '').trim(), phrases, at: c.created_at };
        }
      } catch {
        /* Answers load next time. */
      }
    }
    out.push({ ...q, number: it.number, answer });
  }
  return out.sort((a, b) => String(b.askedAt).localeCompare(String(a.askedAt)));
}
