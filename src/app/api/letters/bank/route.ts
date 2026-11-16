import { NextResponse } from "next/server";
import { ARABIC_LETTERS, BANK_INFO, BANK_TITLE, QUESTION_BANK } from "@/lib/question-bank";

// ---------------------------------------------------------------------------
// Metadata-only view of the Arabic letters question bank.
// Deliberately exposes NO questions and NO answers — useful for dashboards
// and QA (verifying the 28 x 100 structure) without leaking the bank.
// ---------------------------------------------------------------------------

export async function GET() {
  const perLetterCounts: Record<string, number> = {};
  for (const display of ARABIC_LETTERS) {
    const bankLetter = display === "أ" ? "ا" : display;
    perLetterCounts[display] = QUESTION_BANK[bankLetter]?.length ?? 0;
  }

  const byDifficulty: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const questions of Object.values(QUESTION_BANK)) {
    for (const q of questions) {
      byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1;
      byCategory[q.category] = (byCategory[q.category] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    title: BANK_TITLE,
    totalQuestions: BANK_INFO.totalQuestions,
    letters: BANK_INFO.letters,
    questionsPerLetter: BANK_INFO.questionsPerLetter,
    categories: BANK_INFO.categories,
    difficulties: BANK_INFO.difficulties,
    counts: {
      perLetter: perLetterCounts,
      byDifficulty,
      byCategory,
    },
  });
}
