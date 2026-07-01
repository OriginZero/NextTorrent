import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class Rutor extends BaseProvider {
  id = 'rutorinfo'
  name = 'Rutor'
  url = 'https://rutor.info'
  supportedCategories = [Category.Anime, Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Other, Category.Series]
  enabledByDefault = false

  private categoryMap: Record<string, number> = {
    [Category.All]: 0, [Category.Anime]: 10, [Category.Apps]: 9,
    [Category.Books]: 11, [Category.Games]: 8, [Category.Movies]: 1,
    [Category.Music]: 2, [Category.Other]: 3, [Category.Series]: 4,
  }

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const catId = this.categoryMap[ctx.category] ?? this.categoryMap[Category.All]!
    const url = `${this.url}/search/0/${catId}/010/2/${query}`
    const html = await ctx.httpClient.get(url)
    return parseResults(html, url, ctx.category)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const catId = this.categoryMap[category] ?? this.categoryMap[Category.All]!
    const url = `${this.url}/browse/0/${catId}/0/0`
    const html = await httpClient.get(url)
    return parseResults(html, url, category)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const url = `${this.url}/top`
    const html = await httpClient.get(url)
    return parseResults(html, url, category)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }
}

function parseResults(html: string, pageUrl: string, searchCategory: Category): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('div#index > table > tbody > tr').slice(1).each((_, el) => {
    const $el = $(el)
    const torrentName = $el.find('td:nth-child(2) > a:nth-child(3)').first().text().trim()
    if (!torrentName) return
    const magnetUri = $el.find('td:nth-child(2) > a:nth-child(2)').attr('href')
    if (!magnetUri) return
    const size = $el.find('td:nth-child(3)').first().text().trim() || undefined
    const seedersText = $el.find('td:nth-child(4) > span:nth-child(1)').text().trim()
    const peersText = $el.find('td:nth-child(4) > span:nth-child(3)').text().trim()
    const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
    const peers = peersText ? parseInt(peersText) || undefined : undefined
    const uploadDateRaw = $el.find('td:nth-child(1)').first().text().trim()
    const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined
    const fileDownloadLink = $el.find('td:nth-child(2) > a:nth-child(1)').attr('abs:href')
    const detailsPageUrl = $el.find('td:nth-child(2) > a:nth-child(3)').attr('abs:href')

    results.push({
      infoHash: getInfoHashFromMagnetUri(magnetUri),
      name: torrentName, size, seeders, peers,
      providerName: 'Rutor',
      uploadDate,
      category: searchCategory !== Category.All ? searchCategory : undefined,
      magnetUri, fileDownloadLink, descriptionPageUrl: detailsPageUrl,
    })
  })
  return results
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const torrentName = $('div#all > h1').text().trim()
  if (!torrentName) return null
  const magnetUri = $('div#download > a:nth-child(1)').attr('href')
  if (!magnetUri) return null

  const infos: Record<string, any> = {}
  $('table#details > tbody > tr:nth-child(n+2)').each((_, tr) => {
    const $tr = $(tr)
    const header = $tr.find('td.header').first().text().trim()
    if (!header) return
    infos[header] = $tr.find('td:nth-child(2)')
  })

  function ownTextOf(key: string): string | undefined {
    const el = infos[key]
    return el ? el.first().text().trim() || undefined : undefined
  }

  const sizeRaw = ownTextOf('Размер')
  const size = sizeRaw ? sizeRaw.replace(/\(.*\)/, '').trim() : undefined
  const seedersText = ownTextOf('Раздают')
  const peersText = ownTextOf('Качают')
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined

  const uploadDateRaw = ownTextOf('Добавлен')
  const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined

  const catHref = infos['Категория']?.find('a').attr('href')
  const category = catHref ? categoryFromRaw(catHref.substring(catHref.lastIndexOf('/') + 1)) : undefined
  const uploader = infos['Залил']?.text().trim() || undefined

  const lastCheckedRaw = ownTextOf('Сидер замечен')
  const lastChecked = lastCheckedRaw ? parseDateString(lastCheckedRaw)?.toISOString() : undefined

  const posterUrl = $('table#details > tbody > tr:nth-child(1) > td:nth-child(2) > img').attr('src')

  const descEl = $('table#details > tbody > tr:nth-child(1) > td:nth-child(2)')
  descEl.find('img').remove()
  descEl.find('div.hidewrap').remove()
  const description = descEl.html() || undefined

  const screenshotUrls: string[] = []
  $('div.hidewrap').each((_, el) => {
    const $el = $(el)
    if ($el.find('div.hidehead').first().text().trim() === 'Скриншоты') {
      const textarea = $el.find('textarea.hidearea').first().text().trim()
      if (textarea) {
        const $inner = cheerio.load(textarea)
        $inner('a > img').each((_, img) => {
          const src = $inner(img).attr('src')
          if (src) screenshotUrls.push(src)
        })
      }
    }
  })

  const fileDownloadLink = $('div#download > a:nth-child(2)').attr('abs:href')

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri),
    name: torrentName, size, seeders, peers, uploadDate, category,
    uploader, lastChecked, magnetUri, fileDownloadLink,
    description, posterUrl, screenshotUrls,
  }
}

function categoryFromRaw(raw: string): Category | undefined {
  const map: Record<string, Category> = {
    kino: Category.Movies, nashe_kino: Category.Movies, multiki: Category.Movies,
    seriali: Category.Series, nashi_seriali: Category.Series, tv: Category.Series,
    anime: Category.Anime, audio: Category.Music,
    games: Category.Games, soft: Category.Apps, knigi: Category.Books,
  }
  return map[raw] || Category.Other
}
