import { SearchProvider, Category } from './types'
import { BuiltinSearchProviders } from './providers/index'

export class SearchProvidersManager {
  private providers: SearchProvider[]

  constructor() {
    this.providers = BuiltinSearchProviders
  }

  getEnabledProviders(): SearchProvider[] {
    return this.providers.filter(p => p.enabledByDefault)
  }

  getEnabledProvidersByCategory(category: Category): SearchProvider[] {
    const enabled = this.getEnabledProviders()
    if (category === Category.All) return enabled
    return enabled.filter(p => p.supportedCategories.includes(category))
  }

  findDetailsProviderByUrl(url: string): SearchProvider | null {
    for (const p of this.providers) {
      if (!p.getDetails) continue
      if (url.startsWith(p.url)) return p
      if ((p as any).alternateUrlDomains?.some((d: string) => url.startsWith(d))) return p
    }
    return null
  }

  findDetailsProviderByName(name: string): SearchProvider | null {
    for (const p of this.providers) {
      if (p.getDetails && p.name === name) return p
    }
    return null
  }

  getEnabledLatestTorrentsProviders(category: Category): SearchProvider[] {
    return this.providers
      .filter(p => p.getLatestTorrents)
      .filter(p => category === Category.All || p.supportedCategories.includes(category))
  }

  getEnabledTopTorrentsProviders(category: Category): SearchProvider[] {
    return this.providers
      .filter(p => p.getTopTorrents)
      .filter(p => category === Category.All || p.supportedCategories.includes(category))
  }
}
