'use client'

import { useState } from 'react'
import {
  MessageCircleQuestion,
  Plus,
  QrCode,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import type { GameOptions } from '@/lib/game-types'

const MAX_QUESTIONS = 500

/** Arabic count phrases with correct number-noun agreement. */
function readyCountLabel(n: number): string {
  if (n === 1) return 'سؤال جاهز واحد'
  if (n === 2) return 'سؤالين جاهزين'
  if (n <= 10) return `${n} أسئلة جاهزة`
  return `${n} سؤالاً جاهزاً`
}

const READY_QUESTIONS = [
  'ما آخر أغنية سمعتها وما تقدر توقف عن ترديدها؟',
  'لو تقدر تسافر لأي مكان بالعالم اليوم، وين تروح؟',
  'ما أغرب أكلة جربتها وعجبتك؟',
  'لو تختار قدرة خارقة واحدة، وش تختار؟',
  'وش أصغر شيء يخلص يومك بسرور؟',
  'لو تغير اسمك ليوم واحد، وش تسمي نفسك؟',
  'ما الشيء اللي تشتريه دايم بدون تفكير؟',
  'لو صار عندك يوم بدون إنترنت، وش بتسوي؟',
  'ما المهارة اللي تتمنى تتعلمها بسرعة؟',
  'وش أول شيء تسويه إذا ربحت مليون ريال؟',
  'لو رجعت بالزمن، وش تقول لنفسك قبل خمس سنوات؟',
  'ما أكثر شيء يضحكك بسرعة؟',
]

export function HostSetup({
  questions,
  opts,
  onQuestionsChange,
  onOptsChange,
  onCreate,
  busy,
}: {
  questions: string[]
  opts: GameOptions
  onQuestionsChange: (questions: string[]) => void
  onOptsChange: (opts: GameOptions) => void
  onCreate: () => void
  busy: boolean
}) {
  const { toast } = useToast()
  const [draft, setDraft] = useState('')

  const addFromDraft = () => {
    const parts = draft
      .split(/[\n،,]+/)
      .map(s => s.trim())
      .filter(Boolean)
    if (!parts.length) return
    const next = [...questions]
    let added = 0
    let duplicated = 0
    for (const part of parts) {
      if (next.includes(part) || next.length >= MAX_QUESTIONS) {
        duplicated++
        continue
      }
      next.push(part)
      added++
    }
    if (added) onQuestionsChange(next)
    setDraft('')
    if (duplicated) toast({ description: 'تم تجاهل الأسئلة المكررة' })
  }

  const addReadyPack = () => {
    const next = [...questions]
    let added = 0
    for (const question of READY_QUESTIONS) {
      if (!next.includes(question) && next.length < MAX_QUESTIONS) {
        next.push(question)
        added++
      }
    }
    onQuestionsChange(next)
    toast({ description: added ? `تمت إضافة ${readyCountLabel(added)}` : 'الأسئلة الجاهزة موجودة أصلاً' })
  }

  const removeQuestion = (index: number) => {
    onQuestionsChange(questions.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <Tabs defaultValue="questions" className="gap-4">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1">
          <TabsTrigger value="questions" className="gap-2 rounded-xl py-2.5 font-bold">
            <MessageCircleQuestion className="size-4" aria-hidden="true" />
            الأسئلة
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {questions.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="options" className="gap-2 rounded-xl py-2.5 font-bold">
            <Settings2 className="size-4" aria-hidden="true" />
            الإعدادات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-0">
          <Card className="shadow-brand">
            <CardContent className="space-y-3 p-4">
              <div className="flex gap-2">
                <Input
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') addFromDraft()
                  }}
                  placeholder="اكتب سؤالاً ثم اضغط إضافة"
                  maxLength={200}
                  className="h-12 rounded-2xl bg-background"
                />
                <Button onClick={addFromDraft} disabled={!draft.trim()} className="h-12 rounded-2xl px-5">
                  <Plus className="size-4" aria-hidden="true" />
                  إضافة
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                تقدر تلصق عدة أسئلة دفعة واحدة، كل سؤال في سطر.
              </p>

              {questions.length === 0 ? (
                <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-8 text-center">
                  <MessageCircleQuestion className="size-8 text-muted-foreground/60" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">لا توجد أسئلة بعد</p>
                  <Button variant="secondary" size="sm" onClick={addReadyPack} className="mt-1">
                    <Sparkles className="size-4" aria-hidden="true" />
                    أضف أسئلة جاهزة للبداية
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <ul className="scroll-thin flex max-h-72 flex-col gap-2 overflow-y-auto pe-1">
                      {questions.map((question, index) => (
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
                    {questions.length > 4 && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-card to-transparent"
                      />
                    )}
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button variant="ghost" size="sm" onClick={addReadyPack}>
                      <Sparkles className="size-4" aria-hidden="true" />
                      أضف أسئلة جاهزة
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => onQuestionsChange([])}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      مسح الكل
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="options" className="mt-0">
          <Card className="shadow-brand">
            <CardContent className="space-y-4 p-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-background p-4">
                <Checkbox
                  checked={opts.norepeat}
                  onCheckedChange={checked => onOptsChange({ ...opts, norepeat: checked === true })}
                  className="mt-0.5"
                  aria-label="عدم تكرار السؤال"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-bold">عدم تكرار السؤال</span>
                  <span className="block text-xs text-muted-foreground">
                    ما يتكرر السؤال حتى تنتهي كل الأسئلة، بعدها نعيد خلطها.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-background p-4">
                <Checkbox
                  checked={opts.shuffle}
                  onCheckedChange={checked => onOptsChange({ ...opts, shuffle: checked === true })}
                  className="mt-0.5"
                  aria-label="ترتيب اللاعبين عشوائي"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-bold">ترتيب الأدوار عشوائي</span>
                  <span className="block text-xs text-muted-foreground">
                    عند بدء اللعبة تُخلط أدوار اللاعبين بدل ترتيب انضمامهم.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 safe-bottom mt-auto border-t bg-background pt-3">
        <Button
          onClick={onCreate}
          disabled={questions.length === 0 || busy}
          className="brand-gradient shadow-brand btn-press h-14 w-full gap-2 rounded-2xl text-lg font-extrabold"
        >
          <QrCode className="size-5" aria-hidden="true" />
          أنشئ غرفة اللعب عبر QR
        </Button>
        {questions.length === 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">أضف سؤالاً واحداً على الأقل لإنشاء الغرفة</p>
        )}
      </div>
    </div>
  )
}
