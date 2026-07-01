import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { normalizeSize } from '../utils/filesize'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class Mikan extends BaseProvider {
  id = 'mikanproject'
  name = 'Mikan'
  url = 'https://mikanani.me'
  supportedCategories = [Category.Anime]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const requestUrl = `${this.url}/Home/Search?searchstr=${query}`
    const html = await ctx.httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }
}

function parseResults(html: string, pageUrl: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('tr.js-search-results-row').each((_, el) => {
    const $el = $(el)
    const torrentName = $el.find('td:nth-child(2) > a:nth-child(1)').text().trim()
    if (!torrentName) return
    const magnetUri = $el.find('td:nth-child(2) > a[data-clipboard-text]').attr('data-clipboard-text') || ''
    if (!magnetUri) return
    const sizeRaw = $el.find('td:nth-child(3)').text().trim()
    const size = sizeRaw ? normalizeSize(sizeRaw) : undefined
    const uploadDateRaw = $el.find('td:nth-child(4)').text().trim()
    const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined
    const fileDownloadLink = $el.find('td:nth-child(5) > a').attr('abs:href') || undefined
    const detailsPageUrl = $el.find('td:nth-child(2) > a:nth-child(1)').attr('abs:href') || undefined
    const infoHash = getInfoHashFromMagnetUri(magnetUri)

    results.push({
      infoHash, name: torrentName, size, uploadDate,
      category: Category.Anime, providerName, magnetUri,
      fileDownloadLink, descriptionPageUrl: detailsPageUrl,
    })
  })
  return results
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const torrentName = $('p.episode-title').text().trim()
  if (!torrentName) return null
  const magnetUri = $('a[href^="magnet:?"]').attr('href') || ''
  if (!magnetUri) return null
  const fileDownloadLink = $('a[href^="/Download/"]').attr('abs:href') || undefined
  const description = $('div.episode-desc').html() || undefined

  let size: string | undefined
  let uploadDate: string | undefined
  $('p.bangumi-info').each((_, el) => {
    const text = $(el).text().trim()
    if (text.startsWith('文件大小：')) {
      const raw = text.replace('文件大小：', '').trim()
      size = raw ? normalizeSize(raw) : undefined
    }
    if (text.startsWith('发布日期：')) {
      const raw = text.replace('发布日期：', '').trimEnd()
      const parsed = raw ? parseDateString(raw) : null
      uploadDate = parsed?.toISOString()
    }
  })

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri), name: torrentName,
    size, uploadDate, category: Category.Anime, magnetUri,
    description, fileDownloadLink,
  }
}
