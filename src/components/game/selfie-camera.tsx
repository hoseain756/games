'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, ImagePlus, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CAPTURE_SIZE = 256

async function fileToSquareDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('decode failed'))
    image.src = dataUrl
  })
  const side = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = CAPTURE_SIZE
  canvas.height = CAPTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE)
  return canvas.toDataURL('image/jpeg', 0.78)
}

/**
 * Selfie capture: opens the front camera, lets the player take a photo of
 * himself, and falls back to picking an image from the device gallery when
 * the camera is unavailable or permission is denied.
 */
export function SelfieCamera({
  value,
  onChange,
  onCameraFailed,
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
  /** Called once when the camera cannot be used at all. */
  onCameraFailed?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const failedRef = useRef(false)
  const [status, setStatus] = useState<'starting' | 'live' | 'denied'>('starting')

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    setStatus('starting')
    stopStream()
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera api')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setStatus('live')
    } catch {
      setStatus('denied')
      if (!failedRef.current) {
        failedRef.current = true
        onCameraFailed?.()
      }
    }
  }, [onCameraFailed, stopStream])

  useEffect(() => {
    if (!value) void start()
    return () => stopStream()
  }, [value])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const side = Math.min(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = CAPTURE_SIZE
    canvas.height = CAPTURE_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Mirror the frame so the saved photo matches the live preview.
    ctx.translate(CAPTURE_SIZE, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE)
    stopStream()
    onChange(canvas.toDataURL('image/jpeg', 0.78))
  }

  const onPickFile = async (file: File | undefined) => {
    if (!file) return
    try {
      onChange(await fileToSquareDataUrl(file))
    } catch {
      /* ignore malformed files */
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-3xl border bg-secondary">
        {value ? (
          <img src={value} alt="صورتك" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full -scale-x-100 object-cover ${status === 'live' ? '' : 'opacity-0'}`}
          />
        )}

        {status === 'starting' && !value && (
          <div className="absolute inset-0 grid place-items-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            <span className="text-sm">جاري تشغيل الكاميرا...</span>
          </div>
        )}

        {status === 'denied' && !value && (
          <div className="absolute inset-0 grid place-items-center gap-3 p-4 text-center">
            <CameraOff className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">ما قدرنا نفتح الكاميرا</p>
            <p className="text-xs text-muted-foreground">تقدر تختار صورة من جهازك أو تكمل بدون صورة.</p>
          </div>
        )}

        {status === 'live' && !value && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-center">
            <p className="text-xs font-medium text-white">صوّر نفسك — تظهر صورتك للجميع في اللعبة</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {value ? (
          <>
            <Button variant="outline" onClick={() => onChange(null)}>
              <RefreshCw className="size-4" aria-hidden="true" />
              إعادة التصوير
            </Button>
            <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="size-4" aria-hidden="true" />
              صورة من الجهاز
            </Button>
          </>
        ) : status === 'live' ? (
          <>
            <Button
              size="lg"
              className="brand-gradient text-primary-foreground shadow-brand btn-press h-14 w-14 rounded-full p-0"
              onClick={capture}
              aria-label="التقاط الصورة"
            >
              <Camera className="size-6" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="size-4" aria-hidden="true" />
              من الجهاز
            </Button>
          </>
        ) : status === 'denied' ? (
          <>
            <Button variant="outline" onClick={() => void start()}>
              <Camera className="size-4" aria-hidden="true" />
              محاولة الكاميرا مرة ثانية
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="size-4" aria-hidden="true" />
              اختيار صورة
            </Button>
          </>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => {
          void onPickFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
    </div>
  )
}
