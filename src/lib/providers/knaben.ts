import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { formatBytes } from '../utils/filesize'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

const API_URL = 'https://api.knaben.org'

const CATEGORY_IDS: Record<string, number[]> = {
  Music: [1000000], Series: [2000000], Movies: [3000000],
  Apps: [4000000], Porn: [5000000], Anime: [6000000],
  Games: [7000000], Books: [9000000], Other: [10000000],
}

const CATEGORY_RANGES: [number, number, Category][] = [
  [1000000, 1999999, Category.Music],
  [2000000, 2999999, Category.Series],
  [3000000, 3999999, Category.Movies],
  [4000000, 4999999, Category.Apps],
  [5000000, 5999999, Category.Porn],
  [6000000, 6999999, Category.Anime],
  [7000000, 7999999, Category.Games],
  [9000000, 9999999, Category.Books],
  [10000000, 10999999, Category.Other],
]

export class Knaben extends BaseProvider {
  id = 'knaben'
  name = 'Knaben'
  url = 'https://knaben.org'
  supportedCategories = [
    Category.Anime, Category.Apps, Category.Books, Category.Games,
    Category.Movies, Category.Music, Category.Other, Category.Porn, Category.Series,
  ]
  enabledByDefault = true

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const body = buildRequestJson(query, ctx.category, 'seeders')
    const json = await ctx.httpClient.postJson(`${API_URL}/v1`, body)
    return json ? parseResults(json, this.name) : []
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const body = buildRequestJson(null, category, 'date')
    const json = await httpClient.postJson(`${API_URL}/v1`, body)
    return json ? parseResults(json, this.name) : []
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const body = buildRequestJson(null, category, 'seeders')
    const json = await httpClient.postJson(`${API_URL}/v1`, body)
    return json ? parseResults(json, this.name) : []
  }
}

function buildRequestJson(query: string | null, category: Category, orderBy: string): any {
  const body: any = {
    size: 300,
    order_by: orderBy,
    order_direction: 'desc',
    hide_unsafe: true,
    hide_xxx: false,
  }
  if (query) body.query = query
  const catIds = CATEGORY_IDS[category] || []
  if (catIds.length) body.categories = catIds
  return body
}

function parseResults(json: any, providerName: string): Torrent[] {
  const hits = json?.hits
  if (!Array.isArray(hits)) return []
  return hits.map((obj: any) => {
    const name = obj.title
    if (!name) return null
    const magnetUri = obj.magnetUrl
    if (!magnetUri) return null
    const infoHash = getInfoHashFromMagnetUri(magnetUri)
    const size = obj.bytes ? formatBytes(Number(obj.bytes)) : undefined
    const seeders = obj.seeders !== undefined ? Number(obj.seeders) : undefined
    const peers = obj.peers !== undefined ? Number(obj.peers) : undefined
    const uploadDate = obj.date ? new Date(obj.date).toISOString() : undefined
    const descriptionPageUrl = obj.details
    const category = extractCategory(obj)
    return {
      infoHash, name, size, seeders, peers, providerName,
      uploadDate, descriptionPageUrl, magnetUri, category,
    } as Torrent
  }).filter(Boolean) as Torrent[]
}

function extractCategory(obj: any): Category | undefined {
  const ids = obj.categoryId
  if (!Array.isArray(ids) || !ids.length) return undefined
  const firstId = Math.min(...ids.map(Number).filter(n => !isNaN(n)))
  for (const [lo, hi, cat] of CATEGORY_RANGES) {
    if (firstId >= lo && firstId <= hi) return cat
  }
  return undefined
}
