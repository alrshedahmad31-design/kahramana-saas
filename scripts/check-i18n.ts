#!/usr/bin/env tsx
/**
 * check-i18n.ts — CLAUDE.md gate 8
 *
 * Two checks:
 *   1. PARITY  — every key in messages/ar.json exists in messages/en.json (and vice versa).
 *   2. USAGE   — every t('foo.bar') / tAlias('baz') call in src/ resolves to a key
 *                that exists in BOTH messages files. Missing-key calls cause
 *                next-intl to render the raw key string to users in production.
 *
 * Out of scope: hardcoded bilingual literals (`isAr ? 'AR' : 'EN'` is a deliberate
 * convention in this codebase — scanning for it is a separate, noisier check).
 *
 * Usage:
 *   tsx scripts/check-i18n.ts            # human-readable report
 *   tsx scripts/check-i18n.ts --json     # machine-parseable JSON
 *
 * Exit codes: 0 clean, 1 violations found, 2 script error.
 */

import { promises as fs } from 'node:fs'
import * as path           from 'node:path'

// ── Types ─────────────────────────────────────────────────────────────────────

type Finding =
  | { type: 'parity_missing_en'; key: string }
  | { type: 'parity_missing_ar'; key: string }
  | { type: 'unresolved_key';    key: string; file: string; line: number; identifier: string }

interface Report {
  ok:           boolean
  arKeyCount:   number
  enKeyCount:   number
  findings:     Finding[]
  scannedFiles: number
}

// ── Helpers: messages files ───────────────────────────────────────────────────

/**
 * Walks the JSON tree and emits BOTH leaf keys and intermediate (branch) keys.
 *   leaf=true  → only paths whose value is a primitive
 *   leaf=false → also paths whose value is an object (legitimate target of t.raw)
 */
function collectKeys(obj: unknown, opts: { leavesOnly: boolean }, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return []
  const out: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k
    const isObj = v !== null && typeof v === 'object' && !Array.isArray(v)
    if (isObj) {
      if (!opts.leavesOnly) out.push(next)        // intermediate node
      out.push(...collectKeys(v, opts, next))     // recurse
    } else {
      out.push(next)                              // leaf
    }
  }
  return out
}

async function loadMessages(file: string): Promise<{ leaves: Set<string>; all: Set<string> }> {
  const raw    = await fs.readFile(file, 'utf8')
  const parsed = JSON.parse(raw)
  return {
    leaves: new Set(collectKeys(parsed, { leavesOnly: true })),
    all:    new Set(collectKeys(parsed, { leavesOnly: false })),
  }
}

// ── Helpers: source file walker ───────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'public', 'coverage'])

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      out.push(...await walk(path.join(dir, e.name)))
    } else if (e.isFile() && /\.(tsx?|jsx?|mts|cts)$/.test(e.name)) {
      out.push(path.join(dir, e.name))
    }
  }
  return out
}

// ── Helpers: extract translator → namespace map from a single file ────────────

/**
 * Matches all common next-intl translator declarations in this repo:
 *
 *   const t       = useTranslations('foo')
 *   const tAuth   = useTranslations('auth')
 *   const t       = await getTranslations('branches')
 *   const t       = await getTranslations({ locale, namespace: 'checkout' })
 *   const tCommon = await getTranslations({ locale, namespace: 'common' })
 *
 * Limitations (skipped silently — caller can audit manually if needed):
 *   - Namespace passed as a variable (`getTranslations({ namespace: ns })`)
 *   - Translator used WITHOUT a static identifier (rare)
 */
/**
 * A single identifier can be re-declared with a DIFFERENT namespace in a
 * different function scope (e.g. one `t` for `generateMetadata`, another `t`
 * for the default-export component). The script doesn't model scopes, so the
 * pragmatic compromise is: track ALL namespace bindings seen for a given
 * identifier and accept a call if ANY of the candidates resolve.
 *
 * Trade-off: under-reports rather than over-reports. False negatives in the
 * (rare) case where two same-named translators have non-overlapping key sets
 * AND one of them is genuinely broken. Acceptable for a gate.
 */
function extractIdentNamespaces(src: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const add = (ident: string, ns: string) => {
    const set = map.get(ident) ?? new Set<string>()
    set.add(ns)
    map.set(ident, set)
  }

  const reA = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*useTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  const reB = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?getTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  const reC = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?getTranslations\s*\(\s*\{[^}]*namespace\s*:\s*['"]([^'"]+)['"][^}]*\}\s*\)/g

  for (const re of [reA, reB, reC]) {
    let m
    while ((m = re.exec(src))) {
      add(m[1], m[2])
    }
  }

  // useTranslations() / getTranslations() with no namespace → top-level keys.
  const reNoNsHook   = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*useTranslations\s*\(\s*\)/g
  const reNoNsServer = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?getTranslations\s*\(\s*\)/g
  for (const re of [reNoNsHook, reNoNsServer]) {
    let m
    while ((m = re.exec(src))) {
      add(m[1], '')
    }
  }

  return map
}

// ── Helpers: extract t(...) calls ─────────────────────────────────────────────

/**
 * Match `<ident>('foo.bar')`, `<ident>("foo.bar")`, plus `<ident>.rich(...)`,
 * `.markup(...)`, `.raw(...)`. Skips template literals (any backtick = dynamic
 * key — can't statically resolve, so we don't false-positive on it).
 */
function extractCalls(
  src: string,
  idents: Set<string>,
): Array<{ ident: string; key: string; line: number; raw: boolean }> {
  const out: Array<{ ident: string; key: string; line: number; raw: boolean }> = []
  if (idents.size === 0) return out

  // Pre-compute line offsets for line-number lookup.
  const lineOffsets: number[] = [0]
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10 /* \n */) lineOffsets.push(i + 1)
  }
  const lineOf = (pos: number) => {
    let lo = 0, hi = lineOffsets.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineOffsets[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }

  const identPattern = [...idents].map(i => i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  // Group 1: identifier. Group 2: optional method (rich|markup|raw). Group 3: key.
  const callRe = new RegExp(
    `\\b(${identPattern})(?:\\.(rich|markup|raw))?\\s*\\(\\s*['"]([^'"\`]+)['"]`,
    'g',
  )

  let m
  while ((m = callRe.exec(src))) {
    out.push({
      ident: m[1],
      key:   m[3],
      line:  lineOf(m.index),
      raw:   m[2] === 'raw',
    })
  }
  return out
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rootDir = process.cwd()
  const srcDir  = path.join(rootDir, 'src')
  const arFile  = path.join(rootDir, 'messages', 'ar.json')
  const enFile  = path.join(rootDir, 'messages', 'en.json')
  const wantJson = process.argv.includes('--json')

  const findings: Finding[] = []

  // ── Check 1: parity (leaves only — intermediate paths are structural, not user-facing) ─
  const [ar, en] = await Promise.all([loadMessages(arFile), loadMessages(enFile)])

  for (const k of ar.leaves) if (!en.leaves.has(k)) findings.push({ type: 'parity_missing_en', key: k })
  for (const k of en.leaves) if (!ar.leaves.has(k)) findings.push({ type: 'parity_missing_ar', key: k })

  // Usage check sets:
  //   presentLeaves  — for plain t(...) / t.rich(...) / t.markup(...) calls (must hit a string).
  //   presentAll     — for t.raw(...) calls (may hit an intermediate object). Includes leaves.
  const presentLeaves = new Set<string>([...ar.leaves, ...en.leaves])
  const presentAll    = new Set<string>([...ar.all,    ...en.all,    ...ar.leaves, ...en.leaves])

  // ── Check 2: usage ──────────────────────────────────────────────────────────
  const files = await walk(srcDir)
  for (const file of files) {
    const src = await fs.readFile(file, 'utf8')
    const identMap = extractIdentNamespaces(src)
    if (identMap.size === 0) continue

    const calls = extractCalls(src, new Set(identMap.keys()))
    for (const { ident, key, line, raw } of calls) {
      const candidates = identMap.get(ident) ?? new Set<string>([''])
      const lookup     = raw ? presentAll : presentLeaves

      // Pass if ANY of the candidate namespaces resolves.
      let resolved = false
      let firstFullKey = ''
      for (const ns of candidates) {
        const fullKey = ns ? `${ns}.${key}` : key
        if (!firstFullKey) firstFullKey = fullKey
        if (lookup.has(fullKey)) { resolved = true; break }
      }

      if (!resolved) {
        findings.push({
          type: 'unresolved_key',
          key:  firstFullKey,
          file: path.relative(rootDir, file).replace(/\\/g, '/'),
          line,
          identifier: ident,
        })
      }
    }
  }

  const report: Report = {
    ok:           findings.length === 0,
    arKeyCount:   ar.leaves.size,
    enKeyCount:   en.leaves.size,
    findings,
    scannedFiles: files.length,
  }

  if (wantJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    printHuman(report)
  }

  process.exit(report.ok ? 0 : 1)
}

function printHuman(r: Report): void {
  const ms = (n: number) => n.toLocaleString()
  console.log(`\ni18n gate 8 — Kahramana Baghdad`)
  console.log(`  AR keys:        ${ms(r.arKeyCount)}`)
  console.log(`  EN keys:        ${ms(r.enKeyCount)}`)
  console.log(`  Source files:   ${ms(r.scannedFiles)}`)

  const missingEn  = r.findings.filter(f => f.type === 'parity_missing_en')
  const missingAr  = r.findings.filter(f => f.type === 'parity_missing_ar')
  const unresolved = r.findings.filter(f => f.type === 'unresolved_key')

  if (missingEn.length > 0) {
    console.log(`\n  [PARITY] ${missingEn.length} key(s) in ar.json missing from en.json:`)
    for (const f of missingEn.slice(0, 50)) console.log(`    - ${f.key}`)
    if (missingEn.length > 50) console.log(`    … +${missingEn.length - 50} more`)
  }
  if (missingAr.length > 0) {
    console.log(`\n  [PARITY] ${missingAr.length} key(s) in en.json missing from ar.json:`)
    for (const f of missingAr.slice(0, 50)) console.log(`    - ${f.key}`)
    if (missingAr.length > 50) console.log(`    … +${missingAr.length - 50} more`)
  }
  if (unresolved.length > 0) {
    console.log(`\n  [USAGE] ${unresolved.length} t() call(s) reference a key missing from BOTH messages files:`)
    for (const f of unresolved.slice(0, 100)) {
      if (f.type !== 'unresolved_key') continue
      console.log(`    ${f.file}:${f.line}  ${f.identifier}('…')  →  ${f.key}`)
    }
    if (unresolved.length > 100) console.log(`    … +${unresolved.length - 100} more`)
  }

  if (r.ok) {
    console.log(`\n  OK  — gate 8 PASS\n`)
  } else {
    console.log(`\n  FAIL — ${r.findings.length} finding(s)\n`)
  }
}

main().catch((err) => {
  console.error('check-i18n: fatal error')
  console.error(err)
  process.exit(2)
})
