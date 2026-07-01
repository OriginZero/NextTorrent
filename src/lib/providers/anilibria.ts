import { Torrent, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { formatBytes } from '../utils/filesize'

const API_URL = 'https://anilibria.top/api/v1'
const MAX_RELEASES = 15

export class AniLibria extends BaseProvider {
  id = 'anilibria'
  name = 'AniLibria'
  url = 'https://www.anilibria.top'
  supportedCategories = [Category.Anime]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const searchUrl = `${API_URL}/app/search/releases?query=${query}`
    const responseJson = await ctx.httpClient.getJson(searchUrl)
    if (!Array.isArray(responseJson)) return []

    const releaseIds: number[] = responseJson
      .map((item: any) => item.id)
      .filter((id: any) => id != null)
      .slice(0, MAX_RELEASES)

    const results = await Promise.all(
      releaseIds.map(id => this.fetchReleaseTorrents(ctx, id))
    )
    return results.flat()
  }

  private async fetchReleaseTorrents(ctx: SearchContext, releaseId: number): Promise<Torrent[]> {
    const torrentsUrl = `${API_URL}/anime/torrents/release/${releaseId}`
    const responseJson = await ctx.httpClient.getJson(torrentsUrl)
    if (!Array.isArray(responseJson)) return []
    return responseJson
      .map((item: any) => this.parseTorrentObject(item))
      .filter(Boolean) as Torrent[]
  }

  private parseTorrentObject(obj: any): Torrent | null {
    const infoHash = obj.hash
    if (!infoHash) return null

    const release = obj.release
    const releaseName = release?.name?.english || release?.name?.main
    const name = obj.label || releaseName
    if (!name) return null

    const size = obj.size ? formatBytes(parseFloat(obj.size)) : undefined
    const seeders = (obj.seeders as number) ?? undefined
    const peers = (obj.leechers as number) ?? undefined
    const uploadDate = obj.created_at ? new Date(obj.created_at).toISOString() : undefined
    const descriptionPageUrl = release?.alias
      ? `${this.url}/anime/releases/release/${release.alias}`
      : undefined

    return {
      infoHash, name, size, seeders, peers,
      providerName: this.name,
      uploadDate,
      category: Category.Anime,
      descriptionPageUrl,
      magnetUri: obj.magnet,
    }
  }
}
