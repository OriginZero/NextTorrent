import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { normalizeSize } from '../utils/filesize'
import { getInfoHashFromMagnetUri, createMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class TokyoToshokan extends BaseProvider {
  id = 'tokyotoshokan'
  name = 'TokyoToshokan'
  url = 'https://tokyotosho.info'
  supportedCategories = [Category.Anime, Category.Books, Category.Music, Category.Porn, Category.Other]
  enabledByDefault = true

  private categoryMap: Record<string, number> = {
    [Category.All]: 0, [Category.Anime]: 1, [Category.Books]: 3,
    [Category.Music]: 2, [Category.Porn]: 15, [Category.Other]: 5,
  }

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const catId = this.categoryMap[ctx.category] ?? this.categoryMap[Category.All]!
    const url = `${this.url}/search.php?terms=${query}&type=${catId}&searchName=true`
    const html = await ctx.httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    let url = `${this.url}/index.php`
    if (category !== Category.All) {
      const catId = this.categoryMap[category]
      if (catId !== undefined) url += `?cat=${catId}`
    }
    const html = await httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    return this.getLatestTorrents(category)
  }
}

function parseResults(html: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const trs = $('table.listing > tbody > tr:nth-child(n+2)').toArray()
  const results: Torrent[] = []
  for (let i = 0; i < trs.length - 1; i += 2) {
    const tr1 = $(trs[i])
    const tr2 = $(trs[i + 1])
    const torrent = parseItem(tr1, tr2, providerName)
    if (torrent) results.push(torrent)
  }
  return results
}

function parseItem($tr1: any, $tr2: any, providerName: string): Torrent | null {
  const name = $tr1.find('td.desc-top > a:nth-child(2)').first().text().trim()
  if (!name) return null
  const magnetUri = $tr1.find('td.desc-top > a:nth-child(1)').attr('href')
  if (!magnetUri) return null
  const fileDownloadLink = $tr1.find('td.desc-top > a:nth-child(2)').attr('abs:href')
  const detailsPageUrl = $tr1.find('td.web > a:last-child').attr('abs:href')

  const catHref = $tr1.find('td:nth-child(1) > a').attr('href') || ''
  const category = categoryFromId(catHref.replace('/?cat=', ''))

  const descBot = $tr2.find('td.desc-bot').first().text().trim()
  const parts = descBot.split('|').slice(1).map((s: string) => s.trim().replace(/^\S+\s*/, ''))
  const rawSize = parts[0] || undefined
  const rawUploadDate = parts[1] || undefined
  const size = rawSize ? normalizeSize(rawSize) : undefined
  const uploadDate = rawUploadDate ? parseDateString(rawUploadDate)?.toISOString() : undefined

  const seedersText = $tr2.find('td.stats > span:nth-child(1)').text().trim()
  const peersText = $tr2.find('td.stats > span:nth-child(2)').text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri),
    name, size, seeders, peers,
    providerName, uploadDate, category,
    descriptionPageUrl: detailsPageUrl,
    magnetUri, fileDownloadLink,
  }
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const nameAnchor = $('#main > div.details > ul > li:nth-child(6) > a')
  if (!nameAnchor.length) return null
  const name = nameAnchor.text().trim()
  const fileDownloadLink = nameAnchor.attr('type') === 'application/x-bittorrent'
    ? nameAnchor.attr('abs:href') || undefined
    : undefined
  const infoHash = $('#main > div.details > ul > li:nth-child(18)').first().text().trim()
  if (!infoHash) return null
  const magnetUri = $(`a[href^="magnet:?"]`).attr('href') || createMagnetUri(infoHash)
  const sizeRaw = $('#main > div.details > ul > li:nth-child(10)').first().text().trim()
  const size = sizeRaw ? normalizeSize(sizeRaw) : undefined
  const seedersText = $('#main > div.details > ul > li:nth-child(20)').first().text().trim()
  const peersText = $('#main > div.details > ul > li:nth-child(22)').first().text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const uploadDateRaw = $('#main > div.details > ul > li:nth-child(8)').first().text().trim()
  const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined
  const catHref = $('#main > div.details > ul > li:nth-child(2) > a').attr('href') || ''
  const category = categoryFromId(catHref.replace('index.php?cat=', ''))
  const uploader = $('#main > div.details > ul > li:nth-child(28)').first().text().trim() || undefined

  return {
    infoHash, name, size, seeders, peers,
    uploadDate, category, uploader, magnetUri, fileDownloadLink,
  }
}

function categoryFromId(id: string): Category | undefined {
  if (['1', '7', '8', '10', '11'].includes(id)) return Category.Anime
  if (id === '3') return Category.Books
  if (['2', '9'].includes(id)) return Category.Music
  if (['4', '12', '13', '14', '15'].includes(id)) return Category.Porn
  return Category.Other
}
