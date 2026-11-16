import { type NextRequest } from 'next/server'
import QRCode from 'qrcode'

export const runtime = 'nodejs'

/**
 * GET /api/qr?text=<url-or-relative-path> -> PNG data of the QR code.
 * Relative paths (starting with "/") are resolved against the incoming
 * request host so the encoded URL is absolute and reachable by phones.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('text') ?? ''
  if (!raw || raw.length > 512) {
    return new Response('Bad request', { status: 400 })
  }

  let text = raw
  if (raw.startsWith('/')) {
    const host = request.headers.get('host')
    if (host) {
      const proto = request.headers.get('x-forwarded-proto') ?? 'http'
      text = `${proto}://${host}${raw}`
    }
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
