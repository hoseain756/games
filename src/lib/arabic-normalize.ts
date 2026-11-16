// ---------------------------------------------------------------------------
// Arabic answer normalization for "حروف مع حسين".
//
// Mirrors exactly the normalization used by the question bank
// (arabic_letters_question_bank_2800.json -> `normalized_answer`, documented
// in its metadata.answer_rules):
//   1. Strip diacritics (harakat), superscript alef and tatweel.
//   2. Drop ONE leading bare definite article «ال» (exact alef-lam) BEFORE
//      unifying hamzas — so «الأسد» -> «اسد» but «أليكس» keeps its alef
//      («اليكس»), exactly like the bank.
//   3. Unify alef variants  أ إ آ ٱ  ->  ا.
//   4. Normalize alef maqsura  ى  ->  ي.
//   5. Collapse unnecessary whitespace.
//
// The comparison itself is always FULL-STRING — a wrong answer that merely
// shares the first letter is never accepted. On top of the strict pass we run
// tolerant passes for common spelling variants (ة/ه، ؤ/و، ئ/ي), the un-stripped
// article form and squeezed spaces, so real answers typed slightly
// differently still match.
// ---------------------------------------------------------------------------

/** Harakat (fathatan..sukun), superscript alef and tatweel. */
const DIACRITICS_AND_TATWEEL = /[\u064B-\u0652\u0670\u0640]/g
/** Bare definite article «ال» at the very start (alef U+0627 + lam U+0644). */
const LEADING_AL = /^ال/

/** Strip diacritics/tatweel only. */
function clean(input: string): string {
  return input.replace(DIACRITICS_AND_TATWEEL, '')
}

/** Unify hamza seats + alef maqsura + whitespace (no article handling). */
function unify(input: string): string {
  return input
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Bank-compatible canonical normalization: drop one leading bare «ال» BEFORE
 * alef unification, then unify. Reproduces the bank's `normalized_answer`
 * (verified over all 2800 questions).
 */
export function normalizeArabic(input: string): string {
  const cleaned = clean(input)
  const withoutArticle = cleaned.replace(LEADING_AL, '')
  return unify(withoutArticle)
}

/** Tolerance pass: merge common spelling variants of the same letters. */
function loose(input: string): string {
  return input
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
}

/** Remove ALL spaces (multi-word tolerance: "ابو بكر" == "ابوبكر"). */
function squeezed(input: string): string {
  return input.replace(/\s+/g, '')
}

/**
 * Every acceptable normalized form of a text: the canonical form, the
 * un-stripped form (answers legitimately starting with «ال» like
 * «البانيا»), plus loose and space-squeezed variants of both.
 */
function variantsOf(input: string): string[] {
  const cleaned = clean(input)
  const canonical = unify(cleaned.replace(LEADING_AL, ''))
  const unstripped = unify(cleaned)
  return Array.from(
    new Set(
      [canonical, unstripped, loose(canonical), loose(unstripped)].flatMap(v => [
        v,
        squeezed(v),
      ]),
    ),
  ).filter(v => v.length > 0)
}

/** Minimal shape needed to verify an answer (server-side question bank). */
export interface AnswerCheck {
  /** The display answer, e.g. «الأسد». */
  answer: string
  /** The bank's precomputed normalized answer. */
  normalizedAnswer: string
}

/**
 * True when the typed text matches the expected answer under Arabic
 * normalization. Never accepts answers that merely share the first letter —
 * every pass compares the complete string.
 */
export function answersMatch(typed: string, expected: AnswerCheck): boolean {
  const typedVariants = new Set(variantsOf(typed))
  if (typedVariants.size === 0) return false
  // `normalized_answer` is the source of truth; the raw answer adds a safety
  // net in case the bank's precomputed form ever differs from ours.
  for (const candidate of [expected.normalizedAnswer, expected.answer]) {
    for (const variant of variantsOf(candidate)) {
      if (typedVariants.has(variant)) return true
    }
  }
  return false
}
