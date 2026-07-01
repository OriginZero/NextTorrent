import { NextResponse } from 'next/server'
import { SearchProvidersGateway } from '@/lib/gateway'
import { SearchProvidersManager } from '@/lib/manager'

const manager = new SearchProvidersManager()
const gateway = new SearchProvidersGateway(manager)

export async function GET() {
  const providers = manager.getEnabledProviders().map(p => ({
    id: p.id,
    name: p.name,
    url: p.url,
    supportedCategories: p.supportedCategories,
    isCloudflareProtected: p.isCloudflareProtected,
  }))
  return NextResponse.json(providers)
}
