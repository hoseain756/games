'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  MessageCircleQuestion,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

const MAX_MY_QUESTIONS = 30

export function PlayerQuestions({
  name,
  onSubmit,
  busy,
}: {
  name: string
  onSubmit: (questions: string[]) => void
  busy: boolean
}) {
  const [draft, setDraft] = useState('')
  const [list, setList] = useState<string[]>([])

  const addFromDraft = () => {
    const parts = draft
      .split(/[\n،,]+/)
      .map(s => s.trim())
      .filter(Boolean)
    if (!parts.length) return
    setList(prev => {
      const next = [...prev]
      for (const part of parts) {
        if (next.includes(part) || next.length >= MAX_MY_QUESTIONS) continue
        next.push(part)
      }
      return next
    })
    setDraft('')
  }

  const removeQuestion = (index: number) => {
    setList(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <div className="text-center">
        <h2 className="flex items-center justify-center gap-2 text-2xl font-extrabold">
          <PenLine className="size-6 text-primary" aria-hidden="true" />
          اكتب أسئلتك يا {name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          أسئلتك تُخلط مع أسئلة البقية، وكل لاعب ياخذ سؤالاً عشوائياً في دوره
        </p>
      </div>

      <Card className="shadow-brand">
        <CardContent className="space-y-3 p-4">
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addFromDraft()
                }
              }}
              placeholder="اكتب سؤالاً ثم اضغط إضافة"
              maxLength={200}
              inputMode="text"
              className="h-12 rounded-2xl bg-background"
            />
            <Button onClick={addFromDraft} disabled={!draft.trim()} className="h-12 rounded-2xl px-5">
              <Plus className="size-4" aria-hidden="true" />
              إضافة
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            تقدر تلصق عدة أسئلة دفعة واحدة، كل سؤال في سطر. سؤال واحد على الأقل.
          </p>

          {list.length === 0 ? (
            <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-8 text-center">
              <MessageCircleQuestion className="size-8 text-muted-foreground/60" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">لا توجد أسئلة بعد — أضف سؤالاً واحداً على الأقل</p>
            </div>
          ) : (
            <div className="relative">
              <ul className="scroll-thin flex max-h-64 flex-col gap-2 overflow-y-auto pe-1">
                {list.map((question, index) => (
                  <li
                    key={`${question}-${index}`}
                    className="animate-fadein flex items-center gap-2.5 rounded-2xl bg-background px-3 py-2.5"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="flex-1 break-words text-sm leading-relaxed">{question}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                      onClick={() => removeQuestion(index)}
                      aria-label={`حذف السؤال ${index + 1}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
              {list.length > 4 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-card to-transparent"
                />
              )}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            {list.length} من {MAX_MY_QUESTIONS}
          </p>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 safe-bottom mt-auto border-t bg-background pt-3">
        <Button
          onClick={() => onSubmit(list)}
          disabled={list.length === 0 || busy}
          className="brand-gradient shadow-brand btn-press h-14 w-full gap-2 rounded-2xl text-lg font-extrabold"
        >
          <CheckCircle2 className="size-5" aria-hidden="true" />
          انتهيت
        </Button>
        {list.length === 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            أضف سؤالاً واحداً على الأقل قبل الانتهاء
          </p>
        )}
      </div>
    </div>
  )
}
