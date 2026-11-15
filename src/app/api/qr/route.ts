import { type NextRequest } from 'next/server'
import QRCode from 'qrcode'

export const runtime = 'nodejs'

/** GET /api/qr?text=<url> -> PNG data of the QR code. */
export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get('text') ?? ''
  if (!text || text.length > 512) {
    return new Response('Bad request', { status: 400 })
  }

  try {
    const buffer = await QRCode.toBuffer(text, {
      type: 'png',
      width: 640,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0f1aff', light: '#ffffffff' },
    })
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new Response('Failed to generate QR code', { status: 500 })
  }
}
