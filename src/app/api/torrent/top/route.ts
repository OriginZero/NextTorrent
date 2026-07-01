import { NextRequest, NextResponse } from 'next/server'
import { SearchProvidersGateway } from '@/lib/gateway'
import { SearchProvidersManager } from '@/lib/manager'
import { Category } from '@/lib/types'

const manager = new SearchProvidersManager()
const gateway = new SearchProvidersGateway(manager)

export async function GET(req: NextRequest) {
  const category = (req.nextUrl.searchParams.get('category') as Category) || Category.All
  const torrents = await gateway.getTopTorrents(category)
  return NextResponse.json(torrents)
}
