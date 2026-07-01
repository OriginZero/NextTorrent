import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

const categoryMap: Record<string, number> = {
  All: 0, Apps: 29, Books: 52, Games: 28, Movies: 80, Music: 94, Other: 59, Series: 6,
}

export class MegaPeer extends BaseProvider {
  id = 'megapeer'
  name = 'MegaPeer'
  url = 'https://megapeer.vip'
  supportedCategories = [Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Other, Category.Series]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const catId = categoryMap[ctx.category] ?? 0
    const requestUrl = `${this.url}/browse.php?search=${query}&age=&cat=${catId}&stype=0&sort=0&ascdesc=0`
    const html = await ctx.httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }
}

function parseResults(html: string, pageUrl: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const items = $('div#index > table > tbody > tr.table_fon').toArray()
  return Promise.all(items.map(el => parseListItem($(el), pageUrl, providerName))).then(r => r.filter(Boolean) as Torrent[])
}

async function parseListItem($el: cheerio.Cheerio<any>, pageUrl: string, providerName: string): Promise<Torrent | null> {
  const detailsPageUrl = $el.find('td:nth-child(2) > a:nth-child(2)').attr('abs:href')
  if (!detailsPageUrl) return null
  const magnetUri = await getMagnetUri(detailsPageUrl)
  if (!magnetUri) return null
  const torrentName = $el.find('td:nth-child(2) > a:nth-child(2)').text().trim()
  if (!torrentName) return null
  const size = $el.find('td:nth-child(3)').text().trim() || undefined
  const seedersStr = $el.find('td:nth-child(4) > font:nth-child(2)').text().trim()
  const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
  const peersStr = $el.find('td:nth-child(4) > font:nth-child(4)').text().trim()
  const peers = peersStr ? parseInt(peersStr) || undefined : undefined
  const uploadDateRaw = $el.find('td:nth-child(1)').text().trim().replace('Мая', 'Май')
  const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined
  const fileDownloadLink = $el.find('td:nth-child(2) > a:nth-child(1)').attr('abs:href') || undefined
  const infoHash = getInfoHashFromMagnetUri(magnetUri)

  return {
    infoHash, name: torrentName, size, seeders, peers, uploadDate,
    providerName, fileDownloadLink, descriptionPageUrl: detailsPageUrl,
  }
}

async function getMagnetUri(detailsPageUrl: string): Promise<string | null> {
  const html = await httpClient.get(detailsPageUrl)
  const $ = cheerio.load(html)
  return $('a[href^="magnet:?xt="]').attr('href') || null
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const torrentName = $('h1').text().trim()
  if (!torrentName) return null
  const magnetUri = $('a[href^="magnet:?xt="]').attr('href') || ''
  if (!magnetUri) return null
  const size = ($('td:containsOwn(Размер)').next().text().trim() || '').split('(')[0].trim() || undefined
  const seedersStr = $('td:containsOwn(Раздают)').next().text().trim()
  const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
  const peersStr = $('td:containsOwn(Качают)').next().text().trim()
  const peers = peersStr ? parseInt(peersStr) || undefined : undefined
  const catHref = $('td:containsOwn(Категория)').next().find('a').attr('href') || ''
  const category = getCategoryFromId(catHref.replace('/cat/', ''))
  const fileDownloadLink = $('a[href^="/download/"]').attr('abs:href') || undefined
  const posterUrl = $('table#details > tbody > tr:nth-child(1) > td:nth-child(2) > img').attr('src') || undefined
  const $desc = $('table#details > tbody > tr:nth-child(1) > td:nth-child(2)')
  $desc.find('img').first().remove()
  $desc.find('div.sp-wrap').remove()
  const description = $desc.html() || undefined
  const screenshotUrls: string[] = []
  $('div.sp-head:containsOwn(Скриншоты)').next().find('img.lazy-screenshot').each((_, img) => {
    const src = $(img).attr('data-src')
    if (src) screenshotUrls.push(src)
  })

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri), name: torrentName,
    size, seeders, peers, category, magnetUri, fileDownloadLink,
    description, posterUrl, screenshotUrls,
  }
}

function getCategoryFromId(id: string): Category | undefined {
  if (id === '80' || id === '79') return Category.Movies
  if (['5', '6', '55', '21'].includes(id)) return Category.Series
  if (id === '94') return Category.Music
  if (id === '28') return Category.Games
  if (id === '29') return Category.Apps
  if (id === '52') return Category.Books
  return Category.Other
}
