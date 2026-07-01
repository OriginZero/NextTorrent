import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { normalizeSize } from '../utils/filesize'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class Torrent9 extends BaseProvider {
  id = 'torrent9'
  name = 'Torrent9'
  url = 'https://www6.torrent9.to'
  supportedCategories = [Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Series]
  enabledByDefault = false

  private categoryMap: Record<string, string> = {
    [Category.Apps]: 'logiciels', [Category.Books]: 'ebook',
    [Category.Games]: 'jeux-pc', [Category.Movies]: 'films',
    [Category.Music]: 'musique', [Category.Series]: 'series',
  }

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    let url = `${this.url}/search_torrent`
    const cat = this.categoryMap[ctx.category]
    if (cat) url += `/${cat}`
    url += `/${query}.html`
    const html = await ctx.httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const cat = this.categoryMap[category]
    if (!cat) return []
    const url = `${this.url}/torrents_${cat}.html`
    const html = await httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(`${this.url}/top_torrent.html`)
    return parseResults(html, this.name)
  }
}

async function parseResults(html: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const items = $('table > tbody > tr').toArray()
  const results = await Promise.all(items.map(async (el) => parseListItem($(el), providerName)))
  return results.filter(Boolean) as Torrent[]
}

async function parseListItem($el: any, providerName: string): Promise<Torrent | null> {
  const detailsPageUrl = $el.find('td:nth-child(1) > a').attr('abs:href')
  if (!detailsPageUrl) return null
  const html = await httpClient.get(detailsPageUrl)
  const details = parseDetails(html, detailsPageUrl)
  if (!details) return null
  return {
    infoHash: details.infoHash,
    name: details.name,
    size: details.size,
    seeders: details.seeders,
    peers: details.peers,
    uploadDate: details.uploadDate,
    providerName,
    category: details.category,
    magnetUri: details.magnetUri,
    descriptionPageUrl: detailsPageUrl,
  }
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('div.movie-section h1').first().text().trim()
  if (!name) return null
  const magnetUri = $(`a[href^="magnet:?"]`).attr('href')
  if (!magnetUri) return null

  function valueAfter(selector: string): string | undefined {
    const el = $(selector).first().parent().next().next()
    return el.first().text().trim() || undefined
  }

  const sizeRaw = valueAfter('strong:contains("Poids du torrent")')
  const size = sizeRaw ? normalizeSize(`${sizeRaw}B`) : undefined

  const seedersText = $(`li[style="color:green"]`).first().text().trim()
  const peersText = $(`li[style="color:red"]`).first().text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined

  const uploadDateRaw = valueAfter("strong:contains(\"Date d'ajout\")")
  const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined

  const catHref = valueAfter('strong:contains("Catégories")')
  const category = catHref ? categoryFromRaw(catHref.replace('/torrents_', '').replace('.html', '')) : undefined

  const description = $('p.description_torrent').html() || undefined
  const posterUrl = $('div.movie-img > img').attr('abs:src')

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri),
    name, size, seeders, peers, uploadDate, category,
    magnetUri, description, posterUrl,
  }
}

function categoryFromRaw(raw: string): Category | undefined {
  const map: Record<string, Category> = {
    ebook: Category.Books, films: Category.Movies,
    'jeux-consoles': Category.Games, 'jeux-pc': Category.Games,
    logiciels: Category.Apps, musique: Category.Music, series: Category.Series,
  }
  return map[raw] || Category.Other
}
