import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class Eztv extends BaseProvider {
  id = 'eztvx'
  name = 'Eztv'
  url = 'https://eztvx.to'
  cloudflareSolverUrl = 'https://eztvx.to/home'
  supportedCategories = [Category.Series]
  isCloudflareProtected = true
  enabledByDefault = true

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const requestUrl = `${this.url}/search/${query}`
    const html = await ctx.httpClient.get(requestUrl, { Cookie: 'layout=def_wlinks' })
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
  $('table:last-of-type > tbody > tr').each((i, el) => {
    if (i < 2) return
    const $el = $(el)
    const torrentName = $el.find('td:nth-child(2) > a.epinfo').text().trim()
    if (!torrentName) return
    const magnetUri = $el.find('td:nth-child(3) > a.magnet').attr('href') || ''
    if (!magnetUri) return
    const size = $el.find('td:nth-child(4)').text().trim() || undefined
    const seedersStr = $el.find('td:nth-child(6)').text().trim()
    const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
    const fileDownloadLink = $el.find('td:nth-child(3) > a:nth-child(2)').attr('abs:href') || undefined
    const detailsPageUrl = $el.find('td:nth-child(2) > a.epinfo').attr('abs:href') || undefined
    const infoHash = getInfoHashFromMagnetUri(magnetUri)

    results.push({
      infoHash, name: torrentName, size, seeders, peers: 0,
      category: Category.Series, providerName, magnetUri,
      fileDownloadLink, descriptionPageUrl: detailsPageUrl,
    })
  })
  return results
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const $title = $('#header_holder > table > tbody > tr:nth-child(1) > td > h1 > span')
  const torrentName = $title.text().trim()
  if (!torrentName) return null
  const magnetUri = $('a[title="Magnet Link"]').attr('href') || ''
  if (!magnetUri) return null

  const seedersStr = $('#header_holder > table > tbody > tr:nth-child(2) > td > table.episode_columns_holder > tbody > tr:nth-child(1) > td.episode_middle_column > table:nth-child(2) > tbody > tr:nth-child(2) > td > div > table > tbody > tr > td:nth-child(2) > span.stat_red').text().trim()
  const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
  const peersStr = $('#header_holder > table > tbody > tr:nth-child(2) > td > table.episode_columns_holder > tbody > tr:nth-child(1) > td.episode_middle_column > table:nth-child(2) > tbody > tr:nth-child(2) > td > div > table > tbody > tr > td:nth-child(2) > span.stat_green').text().trim()
  const peers = peersStr ? parseInt(peersStr) || undefined : undefined

  const infoContainer = '#header_holder > table > tbody > tr:nth-child(2) > td > table.episode_columns_holder > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(1) > td'
  const $info = $(infoContainer)
  let size: string | undefined
  let uploadDate: string | undefined
  const nodes = $info.contents().toArray()
  for (let i = 0; i < nodes.length - 1; i++) {
    if (nodes[i].type === 'tag') {
      const text = $(nodes[i]).text().trim()
      if (text === 'Filesize:' && nodes[i + 1].type === 'text') {
        size = $(nodes[i + 1]).text().trim() || undefined
      }
      if (text === 'Released:' && nodes[i + 1].type === 'text') {
        const raw = $(nodes[i + 1]).text().trim().replace(/(\d+)(st|nd|rd|th)/, '$1')
        const parsed = parseDateString(raw)
        uploadDate = parsed?.toISOString()
      }
    }
  }

  const fileDownloadLink = $('a[title="Download Torrent"]').attr('abs:href') || undefined
  const description = $('div.desc_big').html() || undefined
  const $poster = $('#header_holder > table > tbody > tr:nth-child(2) > td > table.episode_columns_holder > tbody > tr:nth-child(1) > td.episode_left_column > table > tbody > tr:nth-child(2) > td > a:nth-child(1) > img')
  const posterUrl = $poster.attr('abs:src') || undefined

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri), name: torrentName,
    size, seeders, peers, uploadDate, category: Category.Series, magnetUri,
    fileDownloadLink, description, posterUrl,
  }
}
