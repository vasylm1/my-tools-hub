// Power Automate / Logic Apps flow-definition checker (port of the original Python rules).
import { validateJson, JsonError } from './json.js';

const VALID_STATUSES = new Set(['Succeeded', 'Failed', 'Skipped', 'TimedOut']);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ident = /^[A-Za-z_$][\w$]*$/;
const sub = (parent, key) => (ident.test(key) ? `${parent}.${key}` : `${parent}['${key}']`);

function findDefinition(obj) {
  if (!isObj(obj)) return [null, '$'];
  if (isObj(obj.definition)) return [obj.definition, '$.definition'];
  if (isObj(obj.properties) && isObj(obj.properties.definition)) return [obj.properties.definition, '$.properties.definition'];
  if ('actions' in obj || 'triggers' in obj) return [obj, '$'];
  return [null, '$'];
}

function checkExpression(value, path, out) {
  if (typeof value !== 'string' || !value.includes('@')) return;
  const opens = value.split('@{').length - 1;
  const closes = value.split('}').length - 1;
  if (opens !== closes) out.push({ level: 'error', message: 'Unbalanced @{...} expression.', path });
  let depth = 0;
  let quote = null;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) { out.push({ level: 'error', message: 'Expression has an unexpected closing parenthesis.', path }); return; }
    }
  }
  if (depth) out.push({ level: 'error', message: 'Expression has unbalanced parentheses.', path });
}

function walkExpressions(value, path, out) {
  if (Array.isArray(value)) value.forEach((v, i) => walkExpressions(v, `${path}[${i}]`, out));
  else if (isObj(value)) for (const [k, v] of Object.entries(value)) walkExpressions(v, sub(path, k), out);
  else checkExpression(value, path, out);
}

function checkActions(actions, path, out) {
  if (!isObj(actions)) { out.push({ level: 'error', message: 'Actions must be a JSON object.', path }); return; }
  const names = new Set(Object.keys(actions));
  for (const [name, action] of Object.entries(actions)) {
    const p = sub(path, name);
    if (!isObj(action)) { out.push({ level: 'error', message: 'Action must be a JSON object.', path: p }); continue; }
    if (typeof action.type !== 'string' || !action.type.trim()) out.push({ level: 'error', message: 'Action is missing a non-empty type.', path: p });
    if (action.runAfter !== undefined && action.runAfter !== null) {
      if (!isObj(action.runAfter)) out.push({ level: 'error', message: 'runAfter must be a JSON object.', path: sub(p, 'runAfter') });
      else {
        for (const [dep, statuses] of Object.entries(action.runAfter)) {
          const dp = sub(sub(p, 'runAfter'), dep);
          if (!names.has(dep)) out.push({ level: 'error', message: `runAfter references unknown action '${dep}'.`, path: dp });
          if (dep === name) out.push({ level: 'error', message: 'An action cannot run after itself.', path: dp });
          if (!Array.isArray(statuses) || !statuses.length) out.push({ level: 'error', message: 'runAfter statuses must be a non-empty array.', path: dp });
          else {
            const unknown = statuses.filter((s) => !VALID_STATUSES.has(s));
            if (unknown.length) out.push({ level: 'warning', message: `Unknown runAfter status: ${unknown.join(', ')}.`, path: dp });
          }
        }
      }
    }
    if ('actions' in action) checkActions(action.actions, sub(p, 'actions'), out);
    if (isObj(action.else) && 'actions' in action.else) checkActions(action.else.actions, sub(sub(p, 'else'), 'actions'), out);
    if (isObj(action.cases)) {
      for (const [cn, c] of Object.entries(action.cases)) {
        if (isObj(c) && 'actions' in c) checkActions(c.actions, sub(sub(sub(p, 'cases'), cn), 'actions'), out);
      }
    }
    if (isObj(action.default) && 'actions' in action.default) checkActions(action.default.actions, sub(sub(p, 'default'), 'actions'), out);
  }
  // Circular runAfter chains can never execute.
  const state = new Map();
  const visit = (n, trail) => {
    if (state.get(n) === 2) return;
    if (state.get(n) === 1) { out.push({ level: 'error', message: `Circular runAfter chain: ${[...trail, n].join(' → ')}.`, path: sub(path, n) }); return; }
    state.set(n, 1);
    const ra = actions[n]?.runAfter;
    if (isObj(ra)) for (const d of Object.keys(ra)) if (names.has(d) && d !== n) visit(d, [...trail, n]);
    state.set(n, 2);
  };
  for (const n of names) visit(n, []);
}

/** @returns {{ value: any, findings: {level, message, path, line?, column?}[], errorLine: number|null }} */
export function checkFlow(raw) {
  const findings = [];
  let parsed;
  try {
    parsed = validateJson(raw);
  } catch (e) {
    if (!(e instanceof JsonError)) throw e;
    findings.push({ level: 'error', message: e.message, path: '$', line: e.line, column: e.column });
    return { value: null, findings, errorLine: e.line };
  }
  const { value, duplicates } = parsed;
  for (const key of duplicates) findings.push({ level: 'error', message: `Duplicate key '${key}' overwrites an earlier value.`, path: '$' });
  if (!isObj(value)) {
    findings.push({ level: 'error', message: 'The root value must be a JSON object.', path: '$' });
    return { value, findings, errorLine: null };
  }
  const [def, defPath] = findDefinition(value);
  if (!def) {
    findings.push({ level: 'warning', message: 'Valid JSON, but no Power Automate definition was found.', path: '$' });
    walkExpressions(value, '$', findings);
    return { value, findings, errorLine: null };
  }
  const triggers = def.triggers;
  if (triggers === undefined || triggers === null) findings.push({ level: 'error', message: 'Flow definition is missing triggers.', path: defPath });
  else if (!isObj(triggers) || !Object.keys(triggers).length) findings.push({ level: 'error', message: 'triggers must be a non-empty JSON object.', path: sub(defPath, 'triggers') });
  else {
    for (const [name, t] of Object.entries(triggers)) {
      if (!isObj(t) || typeof t.type !== 'string') findings.push({ level: 'error', message: 'Trigger is missing a type.', path: sub(sub(defPath, 'triggers'), name) });
    }
  }
  if (def.actions === undefined || def.actions === null) findings.push({ level: 'error', message: 'Flow definition is missing actions.', path: defPath });
  else checkActions(def.actions, sub(defPath, 'actions'), findings);
  walkExpressions(def, defPath, findings);
  return { value, findings, errorLine: null };
}
