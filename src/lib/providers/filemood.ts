import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { createMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class FileMood extends BaseProvider {
  id = 'filemood'
  name = 'FileMood'
  url = 'https://filemood.com'
  supportedCategories = [Category.Other]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const requestUrl = `${this.url}/result?q=${query}+in%3Atitle`
    const html = await ctx.httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html)
  }
}

function parseResults(html: string, pageUrl: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('table > tbody > tr:has(a.btn-success)').each((_, el) => {
    const $el = $(el)
    const torrentName = $el.find('> td.dn-title').text().trim()
    if (!torrentName) return
    const size = $el.find('td.dn-size').text().trim() || undefined
    const sp = ($el.find('td.dn-status').text().trim() || '/').split('/')
    const seeders = sp[0] ? parseInt(sp[0]) || undefined : undefined
    const peers = sp[1] ? parseInt(sp[1]) || undefined : undefined
    const descriptionPageUrl = $el.find('td.dn-btn > div > a').attr('abs:href') || ''
    const infoHash = descriptionPageUrl
      ? descriptionPageUrl.replace(/\.html$/, '').split('-').pop()?.toLowerCase().trim()
      : undefined
    if (!infoHash) return

    results.push({
      infoHash, name: torrentName, size, seeders, peers,
      category: Category.Other, providerName, descriptionPageUrl,
    })
  })
  return results
}

function parseDetails(html: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const torrentName = $('div.well > table:nth-child(1) > tbody > tr:nth-child(1) > td > h1 > b').text().trim()
  if (!torrentName) return null
  const infoHash = $('div.well > table:nth-child(3) > tbody > tr:nth-child(5) > td:nth-child(2) > p').text().trim().toLowerCase() || ''
  if (!infoHash) return null
  const magnetUri = createMagnetUri(infoHash)
  const size = $('div.well > table:nth-child(3) > tbody > tr:nth-child(2) > td:nth-child(2) > p > b').text().trim() || undefined
  const lastCheckedRaw = $('div.well > table:nth-child(3) > tbody > tr:nth-child(4) > td:nth-child(2) > p > b').text().trim()
  const lastChecked = lastCheckedRaw
    ? parseDateString(lastCheckedRaw.replace(/\s.*/, ''))?.toISOString()
    : undefined

  return { infoHash, name: torrentName, size, category: Category.Other, lastChecked, magnetUri }
}
