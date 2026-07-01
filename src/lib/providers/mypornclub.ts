import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { createMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class MyPornClub extends BaseProvider {
  id = 'mypornclub'
  name = 'MyPornClub'
  url = 'https://myporn.club'
  supportedCategories = [Category.Porn]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const formattedQuery = query.trim().replace(/%20/g, '-')
    const url = `${this.url}/s/${formattedQuery}/seeders`
    const html = await ctx.httpClient.get(url)
    return parseResults(html, url, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const requestUrl = `${this.url}/ts/latest/alltime`
    const html = await httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const requestUrl = `${this.url}/ts/hits/alltime`
    const html = await httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }
}

function parseResults(html: string, pageUrl: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const items = $('div.torrents_list > div.torrent_element').toArray()
  return Promise.all(items.map(el => parseListItem($(el), providerName))).then(r => r.filter(Boolean) as Torrent[])
}

async function parseListItem($el: cheerio.Cheerio<any>, providerName: string): Promise<Torrent | null> {
  const detailsPageUrl = $el.find('div.torrent_element_text_div > a:nth-child(2)').attr('abs:href')
  if (!detailsPageUrl) return null
  const detailsHtml = await httpClient.get(detailsPageUrl)
  const details = parseDetails(detailsHtml, detailsPageUrl)
  if (!details) return null
  const name = $el.find('div.torrent_element_text_div > a:nth-child(2) > span.torrent_element_text_span').text().trim()
  if (!name) return null
  const size = $el.find('div.torrent_element_info > span.teiv:nth-child(4)').text().trim() || undefined
  const seedersStr = $el.find('div.torrent_element_info > span.teiv.teiv_seeders').text().trim()
  const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
  const peersStr = $el.find('div.torrent_element_info > span.teiv.teiv_leechers').text().trim()
  const peers = peersStr ? parseInt(peersStr) || undefined : undefined
  const uploadDateRaw = $el.find('div.torrent_element_info > span.teiv:nth-child(2)').text().trim()
  const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined

  return {
    infoHash: details.infoHash, name, size, seeders, peers,
    providerName, uploadDate, category: Category.Porn,
    descriptionPageUrl: detailsPageUrl,
    magnetUri: details.magnetUri, fileDownloadLink: details.fileDownloadLink,
  }
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const infoHash = ($('div.torrent_info_div > div:nth-child(1)').text().trim() || '').replace('[hash_info]:', '').trim().toLowerCase()
  if (!infoHash) return null
  const name = ($('div.torrent_text').text().trim() || '').split('#')[0].trim()
  if (!name) return null
  const size = ($('div.torrent_info_div span.tsize_span').text().trim() || '').toUpperCase() || undefined
  const seedersStr = $('div.torrent_info_div span.teiv_seeders').text().trim()
  const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
  const peersStr = $('div.torrent_info_div span.teiv_leechers').text().trim()
  const peers = peersStr ? parseInt(peersStr) || undefined : undefined
  const uploadDateRaw = ($('div.torrent_info_div > div:nth-child(9)').text().trim() || '').replace('[uploaded]:', '').trim()
  const uploadDate = uploadDateRaw ? parseDateString(uploadDateRaw)?.toISOString() : undefined
  const uploader = ($('div.torrent_info_div span.uploader_nick').text().trim() || '').replace('@', '') || undefined
  const lastCheckedRaw = ($('div.torrent_info_div > div:nth-child(8)').text().trim() || '').replace('[last checked]:', '').trim()
  const lastChecked = lastCheckedRaw ? parseDateString(lastCheckedRaw)?.toISOString() : undefined
  const magnetUri = $('a.md_btn').attr('href') || createMagnetUri(infoHash)
  const fileDownloadLink = $('a.td_btn').attr('abs:href') || undefined

  return {
    infoHash, name, size, seeders, peers, uploadDate,
    category: Category.Porn, uploader, lastChecked, magnetUri, fileDownloadLink,
  }
}
