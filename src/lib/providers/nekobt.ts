import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class NekoBT extends BaseProvider {
  id = 'nekobt'
  name = 'NekoBT'
  url = 'https://nekobt.to'
  supportedCategories = [Category.Anime]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const requestUrl = `${this.url}/search?query=${query}`
    const html = await ctx.httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const requestUrl = `${this.url}/search?sort-by=latest`
    const html = await httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const requestUrl = `${this.url}/search?sort-by=seeders`
    const html = await httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }
}

function parseResults(html: string, pageUrl: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('table.table > tbody > tr').each((_, el) => {
    const $el = $(el)
    const torrentName = $el.find('td:nth-child(3) > div:nth-child(1) > div > a > span > span:nth-child(1)').text().trim()
    if (!torrentName) return
    const magnetUri = $el.find('td:nth-child(4) > div > a:nth-child(1)').attr('href') || ''
    if (!magnetUri) return
    const size = $el.find('td:nth-child(5) > span').text().trim() || undefined
    const seedersStr = $el.find('td:nth-child(7) > span').text().trim()
    const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
    const peersStr = $el.find('td:nth-child(8) > span').text().trim()
    const peers = peersStr ? parseInt(peersStr) || undefined : undefined
    const uploadDateRaw = $el.find('td:nth-child(6) > span').text().trim()
    const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined
    const fileDownloadLink = $el.find('td:nth-child(4) > div > a:nth-child(2)').attr('abs:href') || undefined
    const detailsPageUrl = $el.find('td:nth-child(3) > div:nth-child(1) > div > a').attr('abs:href') || undefined
    const infoHash = getInfoHashFromMagnetUri(magnetUri)

    results.push({
      infoHash, name: torrentName, size, seeders, peers,
      providerName, uploadDate, category: Category.Anime,
      descriptionPageUrl: detailsPageUrl, magnetUri, fileDownloadLink,
    })
  })
  return results
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const infoCard = 'div.grid > div:nth-child(1) > div.card:nth-child(1) > div.card-body'
  const torrentName = $(`${infoCard} > h2.card-title > div > span > span:nth-child(1)`).text().trim()
  if (!torrentName) return null
  const magnetUri = $(`${infoCard} a[href^="magnet:?"]`).attr('href') || ''
  if (!magnetUri) return null
  const size = $(`${infoCard} > div:nth-child(2) > span[data-tip="Total Size"]`).text().trim() || undefined
  const seedersStr = $(`${infoCard} > div:nth-child(2) > span[data-tip="Seeders"]`).text().trim()
  const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
  const peersStr = $(`${infoCard} > div:nth-child(2) > span[data-tip="Leechers"]`).text().trim()
  const peers = peersStr ? parseInt(peersStr) || undefined : undefined
  const uploadDateRaw = $(`${infoCard} > div:nth-child(2) span:nth-child(8)`).text().trim()
  const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined
  const uploader = $(`${infoCard} > div:nth-child(2) > span[data-tip="Uploader"] > a`).text().trim() || undefined
  const fileDownloadLink = $(`${infoCard} a[href^="/api/v1/torrents"]`).attr('abs:href') || undefined
  const description = $('div.grid > div:nth-child(1) > div.card:nth-last-child(3) div.markdown').html() || undefined
  const posterUrl = $('img[alt^="Banner for "]').attr('abs:src') || undefined

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri), name: torrentName,
    size, seeders, peers, uploadDate, category: Category.Anime,
    uploader, magnetUri, fileDownloadLink, description, posterUrl,
  }
}
