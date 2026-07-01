import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { httpClient } from '../http-client'
import { getInfoHashFromMagnetUri } from '../utils/torrent'

export class ZeroMagnet extends BaseProvider {
  id = '0magnet'
  name = '0Magnet'
  url = 'https://9mag.net'
  supportedCategories = [Category.Porn]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const html = await ctx.httpClient.get(`${this.url}/search?q=${query}`)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html)
  }
}

async function parseResults(html: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const items = $('table.file-list > tbody > tr').toArray()
  const results = await Promise.all(items.map(el => parseListItem($(el), providerName)))
  return results.filter(Boolean) as Torrent[]
}

async function parseListItem($el: cheerio.Cheerio<any>, providerName: string): Promise<Torrent | null> {
  const detailsUrl = $el.find('td:nth-child(1) > a').attr('abs:href')
  if (!detailsUrl) return null
  const detailsHtml = await httpClient.get(detailsUrl)
  const details = parseDetails(detailsHtml)
  if (!details) return null
  return { infoHash: details.infoHash, name: details.name, size: details.size, uploadDate: details.uploadDate, providerName, category: details.category, descriptionPageUrl: detailsUrl }
}

function parseDetails(html: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('h2.magnet-title').text().trim()
  if (!name) return null
  const magnetUri = $('input#input-magnet').attr('value')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)
  const size = $('dl.torrent-info > dd:nth-child(4)').text().trim() || undefined
  const dateText = $('dl.torrent-info > dd:nth-child(6)').text().trim()
  const uploadDate = dateText ? parseDateString(dateText)?.toISOString() : undefined
  return { infoHash, name, size, uploadDate, magnetUri, category: Category.Porn }
}
