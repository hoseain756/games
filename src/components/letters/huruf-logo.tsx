// ---------------------------------------------------------------------------
// "حروف مع حسين" official lettering logo — the hand-drawn retro sticker
// artwork (yellow / teal / coral words with purple offset shadows) served as
// a static SVG asset. Scaling is lossless and the spelling is always perfect.
// ---------------------------------------------------------------------------

export function HurufLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo-huruf.svg"
      alt="حروف مع حسين"
      className={className}
      draggable={false}
    />
  )
}
