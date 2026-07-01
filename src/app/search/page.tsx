'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useI18n } from '@/lib/i18n/context'

type Torrent = {
  infoHash: string; name: string; size?: string; seeders?: number; peers?: number
  providerName: string; uploadDate?: string; descriptionPageUrl?: string; magnetUri?: string; category?: string
}
type SearchException = { searchProviderName: string; message: string }

function copyText(text: string) { navigator.clipboard.writeText(text) }

function TorrentModal({ torrent, onClose }: { torrent: Torrent; onClose: () => void }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const doCopy = (type: string, text: string) => {
    copyText(text); setCopied(type)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(null), 1500)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-2 text-zinc-400 hover:text-zinc-600 text-xl leading-none">&times;</button>
        <h2 className="font-bold text-lg pr-6 break-words mb-4">{torrent.name}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm mb-5">
          <div><span className="text-zinc-400">{t('detail.uploader')}:</span> {torrent.providerName}</div>
          {torrent.size && <div><span className="text-zinc-400">{t('detail.size')}:</span> {torrent.size}</div>}
          {torrent.seeders !== undefined && <div><span className="text-green-600">{t('detail.seeders')}:</span> {torrent.seeders}</div>}
          {torrent.peers !== undefined && <div><span className="text-red-600">{t('detail.peers')}:</span> {torrent.peers}</div>}
          {torrent.uploadDate && <div className="col-span-2"><span className="text-zinc-400">{t('detail.uploaded')}:</span> {formatDate(torrent.uploadDate)}</div>}
        </div>
        <div className="flex flex-col gap-2">
          {torrent.magnetUri && (
            <button onClick={() => doCopy('magnet', torrent.magnetUri!)}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 active:bg-blue-800">
              {copied === 'magnet' ? t('search.copied') : t('search.copy_magnet')}
            </button>
          )}
          {torrent.infoHash && (
            <button onClick={() => doCopy('hash', torrent.infoHash)}
              className="w-full px-4 py-3 bg-zinc-200 dark:bg-zinc-800 rounded-xl font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700">
              {copied === 'hash' ? t('search.copied') : t('search.copy_hash')}
            </button>
          )}
          {torrent.descriptionPageUrl && (
            <a href={torrent.descriptionPageUrl} target="_blank" rel="noopener noreferrer"
              className="block w-full text-center px-4 py-3 rounded-xl font-medium bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700">{t('search.view_details')}</a>
          )}
          {!torrent.magnetUri && !torrent.descriptionPageUrl && (
            <p className="text-center text-zinc-400 text-sm py-2">{t('search.no_link')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(d: string) {
  try { return formatDistanceToNow(parseISO(d), { addSuffix: true }) } catch { return d }
}

function SearchInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useI18n()
  const q = searchParams.get('q') || ''
  const [query, setQuery] = useState(q)
  const [results, setResults] = useState<Torrent[]>([])
  const [failures, setFailures] = useState<SearchException[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedTorrent, setSelectedTorrent] = useState<Torrent | null>(null)

  useEffect(() => { setQuery(q) }, [q])

  useEffect(() => {
    if (!q) return
    setLoading(true); setSearched(true); setSelectedTorrent(null)
    fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json()).then(data => {
      setResults(data.successes || []); setFailures(data.failures || [])
    }).catch(() => { setFailures([{ searchProviderName: 'System', message: 'Search request failed' }]) }).finally(() => setLoading(false))
  }, [q])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }, [query, router])

  return (
    <div className="flex flex-col flex-1 px-4 py-6 max-w-4xl mx-auto w-full">
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search.placeholder')} autoFocus
          className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">{t('search.button')}</button>
      </form>

      {loading && <p className="text-zinc-500 text-center py-12">{t('search.loading')}</p>}
      {!loading && searched && results.length === 0 && <p className="text-zinc-500 text-center py-12">{t('search.no_results', { q })}</p>}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400 mb-2">{t('search.results_count', { n: results.length })}</p>
          {results.map((tItem, i) => (
            <div key={`${tItem.infoHash}-${i}`} onClick={() => setSelectedTorrent(tItem)}
              className="block p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{tItem.name}</p>
                  <p className="text-xs text-zinc-400 mt-1">{tItem.uploadDate ? formatDate(tItem.uploadDate) : ''}{tItem.size ? ` · ${tItem.size}` : ''}</p>
                </div>
                <div className="flex gap-4 text-sm shrink-0">
                  <span className="text-green-600">{tItem.seeders ?? '?'}↑</span>
                  <span className="text-red-600">{tItem.peers ?? '?'}↓</span>
                </div>
              </div>
              <div className="mt-1">
                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">{tItem.providerName}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {failures.length > 0 && (
        <details className="mt-6">
          <summary className="text-sm text-zinc-400 cursor-pointer">{t('search.providers_failed', { n: failures.length })}</summary>
          <ul className="mt-2 space-y-1">{failures.map((f, i) => <li key={i} className="text-xs text-zinc-500"><b>{f.searchProviderName}:</b> {f.message}</li>)}</ul>
        </details>
      )}

      {selectedTorrent && <TorrentModal torrent={selectedTorrent} onClose={() => setSelectedTorrent(null)} />}
    </div>
  )
}

export default function SearchPage() {
  return <Suspense fallback={null}><SearchInner /></Suspense>
}
