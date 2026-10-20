import fs from 'fs';

const mc = JSON.parse(fs.readFileSync('translations/review/master-changed.json', 'utf8'));
const tr = JSON.parse(fs.readFileSync('translations/tr.partial.json', 'utf8'));

function getNested(obj, keyPath) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur) return undefined;
    cur = cur[p];
  }
  return cur;
}

function extractTokens(str) {
  if (!str) return { vars: [], brackets: [], uppercase: [] };
  const vars = str.match(/\{\{[^}]+\}\}/g) || [];
  const brackets = str.match(/\[[^\]]+\]/g) || [];
  let cleaned = str.replace(/\{\{[^}]+\}\}/g, ' ').replace(/\[[^\]]+\]/g, ' ');
  const uppercase = (cleaned.match(/\b[A-Z][A-Z0-9_]+\b/g) || []).filter(t => t !== 'KO' && t !== 'TM');
  return { vars, brackets, uppercase };
}

function normalizeBracket(b) {
  const inner = b.slice(1, -1);
  const parts = inner.split(',').map(s => s.trim());
  const normalizedParts = parts.map(p => {
    if (/^\d+(\.\d+)?$/.test(p)) return p;
    if (p === 'LK' || p === 'SP' || p.startsWith('ND=')) return p;
    return 'WORD';
  });
  return '[' + normalizedParts.join(',') + ']';
}

function multisetEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  const s1 = [...arr1].sort();
  const s2 = [...arr2].sort();
  return s1.every((val, idx) => val === s2[idx]);
}

let mismatches = 0;
for (const item of mc) {
  const trVal = getNested(tr, item.key);
  if (trVal === undefined) {
    console.error(`Key missing in tr.partial.json: ${item.key}`);
    mismatches++;
    continue;
  }

  const enTok = extractTokens(item.en_new);
  const trTok = extractTokens(trVal);

  const enBracketsNorm = enTok.brackets.map(normalizeBracket);
  const trBracketsNorm = trTok.brackets.map(normalizeBracket);

  const varsMatch = multisetEqual(enTok.vars, trTok.vars);
  const bracketsMatch = multisetEqual(enBracketsNorm, trBracketsNorm);
  const upperMatch = multisetEqual(enTok.uppercase, trTok.uppercase);

  if (!varsMatch || !bracketsMatch || !upperMatch) {
    mismatches++;
    console.error(`MISMATCH on ${item.key}:`);
    if (!varsMatch) console.error(`  Vars: EN=${JSON.stringify(enTok.vars)} TR=${JSON.stringify(trTok.vars)}`);
    if (!bracketsMatch) console.error(`  Brackets: EN=${JSON.stringify(enBracketsNorm)} TR=${JSON.stringify(trBracketsNorm)}`);
    if (!upperMatch) console.error(`  Uppercase: EN=${JSON.stringify(enTok.uppercase)} TR=${JSON.stringify(trTok.uppercase)}`);
  }
}

if (mismatches === 0) {
  console.log(`Validation PASSED: All ${mc.length} entries in master-changed.json match en_new token multisets.`);
} else {
  console.error(`Validation FAILED: ${mismatches} mismatches found.`);
  process.exit(1);
}
