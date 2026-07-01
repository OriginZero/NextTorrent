import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class LinuxTracker extends BaseProvider {
  id = 'linuxtracker'
  name = 'LinuxTracker'
  url = 'https://linuxtracker.org'
  supportedCategories = [Category.Apps]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const requestUrl = `${this.url}/index.php?page=torrents&search=${query}&category=0&active=0`
    const html = await ctx.httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const requestUrl = `${this.url}/index.php?page=torrents&search=&category=0&active=0`
    const html = await httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    return this.getLatestTorrents(category)
  }
}

function parseResults(html: string, pageUrl: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('table.lista[width="100%"] > tbody > tr:has(a[href^="index.php?page=torrent-details&id="][title])').each((_, el) => {
    const $el = $(el)
    const torrentName = $el.find('a[href^="index.php?page=torrent-details&id="][title]').text().trim()
    if (!torrentName) return
    const magnetUri = $el.find('a[href^="magnet:?"]').attr('href') || ''
    if (!magnetUri) return
    const size = $el.find('td:nth-child(2) > table > tbody > tr:nth-child(2) > td').text().trim() || undefined
    const seedersStr = $el.find('td:nth-child(2) > table > tbody > tr:nth-child(3) > td').text().trim()
    const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
    const peersStr = $el.find('td:nth-child(2) > table > tbody > tr:nth-child(4) > td').text().trim()
    const peers = peersStr ? parseInt(peersStr) || undefined : undefined
    const uploadDateRaw = $el.find('td:nth-child(2) > table > tbody > tr > td').text().trim()
    const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined
    const fileDownloadLink = $el.find('a[href^="index.php?page=downloadcheck&id="]').attr('abs:href') || undefined
    const detailsPageUrl = $el.find('a[href^="index.php?page=torrent-details&id="][title]').attr('abs:href') || undefined
    const infoHash = getInfoHashFromMagnetUri(magnetUri)

    results.push({
      infoHash, name: torrentName, size, seeders, peers, uploadDate,
      category: Category.Apps, providerName, magnetUri,
      fileDownloadLink, descriptionPageUrl: detailsPageUrl,
    })
  })
  return results
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const torrentName = $('span[itemprop="name"]').text().trim()
  if (!torrentName) return null
  const magnetUri = $('a[href^="magnet:?"]').attr('href') || ''
  if (!magnetUri) return null
  const size = $('td:containsOwn(Size)').next().text().trim() || undefined
  const uploadDateRaw = $('td:containsOwn(AddDate)').next().text().trim()
  const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined
  const uploader = $('td:containsOwn(Uploader)').next().text().trim() || undefined
  const description = $('span[itemprop="blogPost"]').html() || undefined
  const peersStats = $('td:containsOwn(peers)').next().text().trim()
  const seeders = peersStats ? parseInt(peersStats.replace(/^seeds:\s*/, '').split(',')[0]) || undefined : undefined
  const peers = peersStats ? parseInt((peersStats.split(',').pop() || '').replace(/leechers:\s*/, '').trim()) || undefined : undefined

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri), name: torrentName,
    magnetUri, size, seeders, peers, uploadDate, category: Category.Apps,
    uploader, description,
  }
}
