import * as cheerio from 'cheerio'
import { parse as dateParse, isValid } from 'date-fns'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

const DATE_PREFIX = 'Date/time submitted: '
const STATS_REGEX = /\[(\d+)↑\/(\d+)↓\]/

export class AnimeTosho extends BaseProvider {
  id = 'animetosho'
  name = 'AnimeTosho'
  url = 'https://animetosho.org'
  supportedCategories = [Category.Anime]
  enabledByDefault = true

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const html = await ctx.httpClient.get(`${this.url}/search?q=${query}`)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, this.name)
  }
}

function parseResults(html: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('div.home_list_entry').each((_, el) => {
    const $el = $(el)
    const anchor = $el.find('div.link > a').first()
    const name = anchor.text().trim()
    if (!name) return
    const descriptionPageUrl = anchor.attr('href') || undefined

    const size = $el.find('div.size').first().text().trim()
    if (!size) return

    const { seeders, peers } = parseSeedsAndPeers($el)
    const uploadDate = parseUploadDate($el)
    if (!uploadDate) return

    const links = $el.find('div.links').first()
    const fileDownloadLink = links.find('a.dllink').first().attr('href') || undefined
    const magnetUri = links.find('a[href^="magnet:"]').first().attr('href')
    if (!magnetUri) return
    const infoHash = getInfoHashFromMagnetUri(magnetUri)

    results.push({
      infoHash, name, size, seeders, peers,
      providerName, uploadDate,
      category: Category.Anime,
      descriptionPageUrl,
      magnetUri,
      fileDownloadLink,
    })
  })
  return results
}

function parseUploadDate($el: cheerio.Cheerio<any>): string | undefined {
  const raw = $el.find('div.date').first().attr('title')?.replace(DATE_PREFIX, '')?.trim()
  if (!raw) return undefined

  if (raw.startsWith('Today')) return new Date().toISOString()
  if (raw.startsWith('Yesterday')) return new Date(Date.now() - 86400000).toISOString()

  const datePart = raw.split(' ')[0]
  const d = dateParse(datePart, 'd/M/yyyy', new Date())
  if (isValid(d)) return d.toISOString()
  return undefined
}

function parseSeedsAndPeers($el: cheerio.Cheerio<any>): { seeders?: number, peers?: number } {
  const span = $el.find('div.links').first().find('span[title]').first()
  const spanText = span.text().trim()
  const match = spanText.match(STATS_REGEX)
  if (!match) return {}
  return {
    seeders: parseInt(match[1]) || 0,
    peers: parseInt(match[2]) || 0,
  }
}

function parseDetails(html: string, providerName: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('#title').first().text().trim()
  if (!name) return null
  const magnetUriEl = $('a[href^="magnet:"]').first()
  const magnetUri = magnetUriEl.attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)

  const unprocessedSize = $('span[title^="File size:"]').first().text().trim()
    || (magnetUriEl[0] && $(magnetUriEl[0]).next().text().trim())
  const size = unprocessedSize
    ?.replace(/[()|]/g, '')
    .trim() || undefined

  const seedersText = $('td[title="Seeders"][align="right"]').first().text().trim()
  const peersText = $('td[title="Leechers"][align="right"]').first().text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined

  const dateText = $('#content > table:nth-of-type(1) > tbody > tr:nth-child(2) > td').first().text().trim()
  let uploadDate: string | undefined
  if (dateText) {
    if (dateText.startsWith('Today')) uploadDate = new Date().toISOString()
    else if (dateText.startsWith('Yesterday')) uploadDate = new Date(Date.now() - 86400000).toISOString()
    else {
      const d = dateParse(dateText, 'dd/MM/yyyy HH:mm', new Date())
      if (isValid(d)) uploadDate = d.toISOString()
    }
  }

  const screenshotUrls = $('a.screenthumb').toArray().map(el => $(el).attr('href') || '').filter(Boolean)
  const fileDownloadLink = $('a[href^="https://animetosho.org/storage/torrent"]').first().attr('href') || undefined

  return { infoHash, name, size, seeders, peers, uploadDate, category: Category.Anime, magnetUri, fileDownloadLink, screenshotUrls }
}
