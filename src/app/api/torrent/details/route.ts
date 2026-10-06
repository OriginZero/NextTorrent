import { NextRequest, NextResponse } from 'next/server'
import { SearchProvidersGateway } from '@/lib/gateway'
import { SearchProvidersManager } from '@/lib/manager'

const manager = new SearchProvidersManager()
const gateway = new SearchProvidersGateway(manager)

export const dynamic = 'force-static'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  const provider = req.nextUrl.searchParams.get('provider')
  if (!url || !provider) return NextResponse.json({ error: 'Missing url or provider' }, { status: 400 })

  const result = await gateway.getTorrentDetails(url, provider)
  return NextResponse.json(result)
}
