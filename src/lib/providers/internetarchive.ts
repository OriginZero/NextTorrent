import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { formatBytes } from '../utils/filesize'
import { parseDateString } from '../utils/date'
import { createMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class InternetArchive extends BaseProvider {
  id = 'internetarchive'
  name = 'InternetArchive'
  url = 'https://archive.org'
  supportedCategories = [Category.Apps, Category.Books, Category.Movies, Category.Other]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const requestUrl = `${this.url}/advancedsearch.php?q=title:${query}${appendCategory(ctx.category)}&fl[]=title,item_size,publicdate,mediatype,identifier,btih&rows=100&page=1&output=json`
    const json = await ctx.httpClient.getJson(requestUrl)
    if (!json) return []
    return parseResults(json, this.name, this.url)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const id = detailsPageUrl.split('/').pop()
    const json = await httpClient.getJson(`https://archive.org/metadata/${id}`)
    if (!json) return null
    return parseMetadata(json)
  }
}

function appendCategory(category: Category): string {
  if (category === Category.All) return ''
  const mediaType = category === Category.Apps ? 'software'
    : category === Category.Books ? 'texts'
    : category === Category.Movies ? 'movies'
    : 'other'
  return `%20AND%20mediatype:(${mediaType})`
}

function parseResults(json: any, providerName: string, providerUrl: string): Torrent[] {
  const docs = json?.response?.docs
  if (!Array.isArray(docs)) return []
  return docs.map((doc: any) => {
    const name = doc.title
    if (!name) return null
    const size = doc.item_size ? formatBytes(Number(doc.item_size)) : null
    if (!size) return null
    const uploadDate = doc.publicdate ? new Date(doc.publicdate).toISOString() : undefined
    const category = categoryFromMediaType(doc.mediatype)
    if (!category) return null
    const descriptionPageUrl = doc.identifier ? `${providerUrl}/details/${doc.identifier}` : null
    if (!descriptionPageUrl) return null
    const infoHash = (doc.btih || '').toLowerCase().trim()
    if (!infoHash) return null

    return {
      infoHash, name, size, uploadDate, category,
      providerName, descriptionPageUrl,
    } as Torrent
  }).filter(Boolean) as Torrent[]
}

function parseMetadata(json: any): TorrentDetails | null {
  const metadata = json?.metadata
  if (!metadata) return null
  const name = metadata.title
  if (!name) return null
  const lastChecked = json.item_last_updated
    ? new Date(Number(json.item_last_updated) * 1000).toISOString()
    : undefined
  const size = json.item_size ? formatBytes(Number(json.item_size)) : undefined
  const uploadDate = metadata.publicdate
    ? parseDateString(metadata.publicdate)?.toISOString()
    : undefined
  const uploader = metadata.uploader
  const description = metadata.description
  const category = categoryFromMediaType(metadata.metadata)

  const torrentFile = (json.files || []).find((f: any) => f.btih)
  if (!torrentFile) return null
  const id = metadata.identifier
  if (!id) return null
  const infoHash = torrentFile.btih || ''
  const torrentFileName = torrentFile.name || ''
  const fileDownloadLink = `https://archive.org/download/${id}/${torrentFileName}`
  const magnetUri = createMagnetUri(infoHash)

  return {
    infoHash, name, size, uploadDate, category, uploader,
    lastChecked, magnetUri, fileDownloadLink, description,
  }
}

function categoryFromMediaType(mediaType: string): Category | undefined {
  if (mediaType === 'software') return Category.Apps
  if (mediaType === 'texts') return Category.Books
  if (mediaType === 'movies') return Category.Movies
  if (mediaType) return Category.Other
  return undefined
}
