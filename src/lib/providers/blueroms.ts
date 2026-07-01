import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { normalizeSize } from '../utils/filesize'
import { httpClient } from '../http-client'

const LIST_ITEM = 'div.row > div.col-xs-12 > div.card'
const GAME_NAME = 'h4.card-title > a'
const SIZE = 'strong:contains(Size:)'
const PLATFORM = 'strong:contains(Platform:)'
const DOWNLOAD_PAGE_URL = 'div.card-footer > a'
const DETAILS_PAGE_URL = GAME_NAME

export class BlueRoms extends BaseProvider {
  id = 'blueroms'
  name = 'BlueRoms'
  url = 'https://www.blueroms.ws'
  supportedCategories = [Category.Games]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const html = await ctx.httpClient.get(`${this.url}/search?g=0&p=0&q=${query}`)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html)
  }
}

async function parseResults(html: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const items = $(LIST_ITEM).toArray()
  const results = await Promise.all(
    items.map(async (el) => {
      const $el = $(el)
      const downloadPageLink = $el.find(DOWNLOAD_PAGE_URL).first().attr('abs:href')
      if (!downloadPageLink) return null
      const magnetUri = await getMagnetUri(downloadPageLink)
      if (!magnetUri) return null

      const gameName = $el.find(GAME_NAME).first().text().trim()
      if (!gameName) return null

      const platform = $el.find(PLATFORM).first().next('td').text().trim()
      const torrentName = platform ? `${gameName} - ${platform}` : gameName

      const sizeEl = $el.find(SIZE).first()
      const size = normalizeSize((sizeEl[0]?.nextSibling as any)?.nodeValue?.trim() || '')

      const detailsPageUrl = $el.find(DETAILS_PAGE_URL).first().attr('abs:href') || undefined

      return {
        infoHash: getInfoHashFromMagnetUri(magnetUri),
        name: torrentName, size: size || undefined,
        category: Category.Games, providerName,
        magnetUri, descriptionPageUrl: detailsPageUrl,
      } as Torrent
    })
  )
  return results.filter(Boolean) as Torrent[]
}

async function getMagnetUri(downloadPageUrl: string): Promise<string | null> {
  const html = await httpClient.get(downloadPageUrl)
  const $ = cheerio.load(html)
  const encoded = $('button#magnet-button').first().attr('data-link')
  if (!encoded) return null
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
  return decoded || null
}

async function parseDetails(html: string): Promise<TorrentDetails | null> {
  const $ = cheerio.load(html)
  const downloadPageLink = $('a[href^="/download/"]').first().attr('abs:href')
  if (!downloadPageLink) return null
  const magnetUri = await getMagnetUri(downloadPageLink)
  if (!magnetUri) return null
  const gameName = $('h3.custom-title').first().text().trim()
  if (!gameName) return null

  const platform = $('strong:contains(Platform:)').first().parent().text().trim()
  const torrentName = platform ? `${gameName} - ${platform}` : gameName

  const sizeEl = $('strong:contains(Files Size:)').first()
  const size = normalizeSize((sizeEl[0]?.parent as any)?.textContent?.trim() || '')

  const posterUrl = $('img[src^="/static/game/"]:not(.img-thumbnail)').first().attr('abs:src') || undefined
  const screenshotUrls = $('div.panel:has(div.panel-heading:has(h3:contains(Screenshots))) img.img-thumbnail')
    .toArray()
    .map(el => $(el).attr('abs:src') || '')
    .filter(Boolean)

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri),
    name: torrentName, size: size || undefined,
    posterUrl, screenshotUrls,
    magnetUri,
  }
}
