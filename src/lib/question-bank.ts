// ---------------------------------------------------------------------------
// Question bank for "حروف مع حسين" — SERVER-SIDE module.
//
// Single source of truth: src/data/arabic_letters_question_bank_2800.json
// (2800 questions, 28 letters, 100 questions per letter, 16 categories,
// 3 difficulty levels). The JSON is loaded as-is: questions, answers,
// identifiers, categories and structure are preserved untouched.
//
// IMPORTANT: never import this file from a client component — it would ship
// the whole answer bank to the browser. The frontend only receives bank
// metadata (BANK_INFO fields) through the letters service broadcast.
// ---------------------------------------------------------------------------

import rawBankJson from '../data/arabic_letters_question_bank_2800.json'
import { ARABIC_LETTERS, type LettersBankInfo } from './letters-types'

export { ARABIC_LETTERS }

/** Raw question shape exactly as stored in the JSON. */
export interface BankQuestion {
  /** Stable id from the bank, e.g. "Q0001". */
  id: string
  /** Bank letter key (plain alef "ا" style), e.g. "ا". */
  letter: string
  category: string
  subcategory: string
  /** سهل | متوسط | صعب */
  difficulty: string
  /** Question text (Arabic). */
  q: string
  /** Display answer (Arabic, original spelling preserved). */
  a: string
  /** Precomputed normalized answer from the bank (used for verification). */
  na: string
}

interface RawQuestion {
  id: string
  letter: string
  category: string
  subcategory: string
  difficulty: string
  question: string
  answer: string
  normalized_answer: string
}

interface RawBank {
  metadata: {
    title: string
    total_questions: number
    total_letters: number
    questions_per_letter: number
    categories: string[]
    difficulty_levels: string[]
  }
  questions_by_letter: Record<string, RawQuestion[]>
}

const raw = rawBankJson as unknown as RawBank

/**
 * The bank keys letters with plain alef "ا" while the board shows "أ".
 * Only the alef differs — every other letter is identical in both spaces.
 */
const DISPLAY_TO_BANK: Record<string, string> = { 'أ': 'ا' }

/** Board/display letter -> bank letter key ("أ" -> "ا"). */
export function toBankLetter(displayLetter: string): string {
  return DISPLAY_TO_BANK[displayLetter] ?? displayLetter
}

/** Bank letter key -> board/display letter ("ا" -> "أ"). */
export function toDisplayLetter(bankLetter: string): string {
  return bankLetter === 'ا' ? 'أ' : bankLetter
}

/** Questions grouped by BANK letter key ("ا", "ب", ... 28 keys). */
export const QUESTION_BANK: Record<string, BankQuestion[]> = Object.fromEntries(
  Object.entries(raw.questions_by_letter).map(([letter, questions]) => [
    letter,
    questions.map(q => ({
      id: q.id,
      letter: q.letter,
      category: q.category,
      subcategory: q.subcategory,
      difficulty: q.difficulty,
      q: q.question,
      a: q.answer,
      na: q.normalized_answer,
    })),
  ]),
)

/** Metadata broadcast to every screen — never includes questions/answers. */
export const BANK_INFO: LettersBankInfo = {
  totalQuestions: raw.metadata.total_questions,
  questionsPerLetter: raw.metadata.questions_per_letter,
  letters: raw.metadata.total_letters,
  categories: [...raw.metadata.categories],
  difficulties: [...raw.metadata.difficulty_levels],
}

export const BANK_TITLE = raw.metadata.title
