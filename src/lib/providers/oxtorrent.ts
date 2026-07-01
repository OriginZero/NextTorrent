import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class OxTorrent extends BaseProvider {
  id = 'oxtorrent'
  name = 'OxTorrent'
  url = 'https://oxtorrent.co'
  supportedCategories = [Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Series]
  enabledByDefault = false

  private categoryMap: Record<string, string> = {
    [Category.Apps]: 'logiciels',
    [Category.Books]: 'ebook',
    [Category.Games]: 'jeux-pc',
    [Category.Movies]: 'films',
    [Category.Music]: 'musique',
    [Category.Series]: 'series',
  }

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    let requestUrl = `${this.url}/recherche`
    const cat = this.categoryMap[ctx.category]
    if (cat) requestUrl += `/${cat}`
    requestUrl += `/${query}`
    const html = await ctx.httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const cat = this.categoryMap[category]
    if (!cat) return []
    const url = `${this.url}/torrents/${cat}`
    const html = await httpClient.get(url)
    return parseResults(html, url, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const url = `${this.url}/top`
    const html = await httpClient.get(url)
    return parseResults(html, url, this.name)
  }
}

async function parseResults(html: string, pageUrl: string, providerName: string): Promise<Torrent[]> {
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
  const torrentName = $('div.title > a').first().text().trim()
  if (!torrentName) return null
  const magnetUri = $('div.btn-magnet > a').attr('href')
  if (!magnetUri) return null

  function siblingAfter(selector: string): string | undefined {
    const el = $(selector).first().parent().next()
    return el.text().trim() || undefined
  }

  const size = siblingAfter('td:contains("Poids du fichier:")')
  const seedersText = siblingAfter('td:contains("Seeders:")')
  const peersText = siblingAfter('td:contains("Leechers:")')
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const uploadDateRaw = siblingAfter("td:contains(\"Date d'ajout:\")")
  const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined

  const catHref = $("td:contains('Catégories:')").first().parent().next().find('strong > a').attr('href')
  const category = catHref ? categoryFromRaw(catHref.replace('/torrents/', '')) : undefined

  const description = $('#torrentsdesc').html() || undefined
  const posterUrl = $('img.img-rounded').attr('abs:src')

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri),
    name: torrentName,
    size, seeders, peers, uploadDate, category,
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
