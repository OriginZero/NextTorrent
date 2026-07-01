import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { formatBytes } from '../utils/filesize'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class TheRarBg extends BaseProvider {
  id = 'therarbag'
  name = 'TheRarBg'
  url = 'https://therarbg.com'
  supportedCategories = [Category.Anime, Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Porn, Category.Series, Category.Other]
  safetyStatus = { unsafe: 'TheRarBg has been reported to host malicious torrents' }
  enabledByDefault = false

  private categoryName(raw: Category): string {
    const map: Record<string, string> = {
      [Category.Anime]: 'Anime', [Category.Apps]: 'Apps', [Category.Books]: 'Books',
      [Category.Games]: 'Games', [Category.Movies]: 'Movies', [Category.Music]: 'Music',
      [Category.Porn]: 'XXX', [Category.Series]: 'Tv', [Category.Other]: 'Other',
    }
    return map[raw] || ''
  }

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    let url = `${this.url}/get-posts/keywords:${query}`
    if (ctx.category !== Category.All) url += `:category:${this.categoryName(ctx.category)}`
    const html = await ctx.httpClient.get(url)
    return parseResults(html, url, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetailsPage(html)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    let url = `${this.url}/get-posts/time:2D`
    if (category !== Category.All) url += `:category:${this.categoryName(category)}`
    const html = await httpClient.get(url)
    return parseResults(html, url, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    let url = `${this.url}/get-posts/time:2D:order:-se`
    if (category !== Category.All) url += `:category:${this.categoryName(category)}`
    const html = await httpClient.get(url)
    return parseResults(html, url, this.name)
  }
}

async function parseResults(html: string, pageUrl: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const items = $('table > tbody > tr.list-entry').toArray()
  const results = await Promise.all(items.map(async (el) => parseListItem($(el), providerName)))
  return results.filter(Boolean) as Torrent[]
}

async function parseListItem($el: any, providerName: string): Promise<Torrent | null> {
  const detailsPageUrl = $el.find('td.cellName > div > a').attr('abs:href')
  if (!detailsPageUrl) return null
  const html = await httpClient.get(detailsPageUrl)
  const details = parseDetailsPage(html)
  if (!details) return null

  const name = $el.find('td.cellName > div > a').first().text().trim()
  if (!name) return null
  const dataOrder = $el.find('td.sizeCell').attr('data-order')
  const size = dataOrder ? formatBytes(parseFloat(dataOrder)) : undefined
  const seedersText = $el.find('td:nth-child(7)').first().text().trim()
  const peersText = $el.find('td:nth-child(8)').first().text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const ts = $el.find('td:nth-child(4)').attr('data-order')
  const uploadDate = ts ? new Date(parseFloat(ts) * 1000).toISOString() : undefined
  const catText = $el.find('td:nth-child(3) > a').first().text().trim()
  const category = catText ? categoryFromRawString(catText) : undefined

  return {
    infoHash: getInfoHashFromMagnetUri(details.magnetUri),
    name, size, seeders, peers,
    providerName, uploadDate, category,
    magnetUri: details.magnetUri,
    fileDownloadLink: details.fileDownloadLink,
    descriptionPageUrl: detailsPageUrl,
  }
}

function parseDetailsPage(html: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('div.postContL > h4').first().text().trim()
  if (!name) return null
  const magnetUri = $(`a[href^="magnet:?"]`).attr('href')
  if (!magnetUri) return null

  const rows: Record<string, string | undefined> = {}
  $('table.detailTable > tbody > tr').each((_, tr) => {
    const $tr = $(tr)
    const label = $tr.find('th').first().text().trim()
    if (!label) return
    const value = $tr.find('td').first()
    rows[label] = value.text().trim() || undefined
  })

  const size = rows['Size:']
  const peersRow = rows['Peers:']
  let seeders: number | undefined
  let peers: number | undefined
  if (peersRow) {
    const parts = peersRow.split(',').map(s => s.trim())
    const seedersMatch = parts[0]?.match(/Seeders:\s*(\d+)/)
    const peersMatch = parts[1]?.match(/Leechers:\s*(\d+)/)
    seeders = seedersMatch ? parseInt(seedersMatch[1]) || undefined : undefined
    peers = peersMatch ? parseInt(peersMatch[1]) || undefined : undefined
  }

  const uploadDateRaw = rows['Added:']
  const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined
  const category = rows['Category:'] ? categoryFromRawString(rows['Category:']!) : undefined
  const uploader = rows['Uploader:']
  const description = rows['Description:']

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri),
    name, size, seeders, peers, uploadDate, category,
    uploader, magnetUri, description,
  }
}

function categoryFromRawString(raw: string): Category | undefined {
  const map: Record<string, Category> = {
    Anime: Category.Anime, Apps: Category.Apps, Books: Category.Books,
    Games: Category.Games, Movies: Category.Movies, Music: Category.Music,
    XXX: Category.Porn, Tv: Category.Series, TV: Category.Series, Other: Category.Other,
  }
  return map[raw] || Category.Other
}
