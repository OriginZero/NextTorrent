import { NextRequest, NextResponse } from 'next/server'
import { SearchProvidersGateway } from '@/lib/gateway'
import { SearchProvidersManager } from '@/lib/manager'
import { Category } from '@/lib/types'

const manager = new SearchProvidersManager()
const gateway = new SearchProvidersGateway(manager)

export const dynamic = 'force-static'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'Missing query parameter: q' }, { status: 400 })

  const category = (req.nextUrl.searchParams.get('category') as Category) || Category.All
  const results = await gateway.searchTorrents(q, category)
  return NextResponse.json(results)
}
