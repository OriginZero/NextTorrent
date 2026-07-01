import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { httpClient } from '../http-client'
import { getInfoHashFromMagnetUri } from '../utils/torrent'

export class TorrentKitty extends BaseProvider {
  id = 'torrentkitty'
  name = 'TorrentKitty'
  url = 'https://torrentkitty.tv'
  supportedCategories = [Category.Other]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const html = await ctx.httpClient.get(`${this.url}/search/${query}`)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html)
  }
}

function parseResults(html: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('table#archiveResult > tbody > tr').slice(1).each((_, el) => {
    const $el = $(el)
    const name = $el.find('td.name').text().trim()
    if (!name) return
    const magnetUri = $el.find('td.action > a:nth-child(2)').attr('href')
    if (!magnetUri) return
    const infoHash = getInfoHashFromMagnetUri(magnetUri)
    const size = $el.find('td.size').text().trim().toUpperCase() || undefined
    const dateText = $el.find('td.date').text().trim()
    const uploadDate = dateText ? parseDateString(dateText)?.toISOString() : undefined
    const fileDownloadLink = $el.find('td.action > a:nth-child(3)').attr('abs:href')
    const detailsUrl = $el.find('td.action > a:nth-child(1)').attr('abs:href')
    results.push({ infoHash, name, size, uploadDate, fileDownloadLink, descriptionPageUrl: detailsUrl, providerName })
  })
  return results
}

function parseDetails(html: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('h2').text().trim()
  if (!name) return null
  const magnetUri = $('p.action > a:nth-child(2)').attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)
  const size = $('table.detailSummary > tbody > tr:nth-child(4) > td').text().trim().toUpperCase() || undefined
  const dateText = $('table.detailSummary > tbody > tr:nth-child(5) > td').text().trim()
  const uploadDate = dateText ? parseDateString(dateText)?.toISOString() : undefined
  const fileDownloadLink = $('p.action > a:nth-child(1)').attr('abs:href')
  return { infoHash, name, size, uploadDate, magnetUri, fileDownloadLink }
}
