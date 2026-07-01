'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useI18n } from '@/lib/i18n/context'

function copyText(text: string) { navigator.clipboard.writeText(text) }

function DetailsInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const url = searchParams.get('url')
  const provider = searchParams.get('provider')
  const hash = params.hash as string
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const doCopy = (label: string, text: string) => {
    copyText(text); setCopied(label)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(null), 1500)
  }

  useEffect(() => {
    if (!url || !provider) { setLoading(false); setError(t('detail.error.missing')); return }
    fetch(`/api/torrent/details?url=${encodeURIComponent(url)}&provider=${encodeURIComponent(provider)}`)
      .then(r => r.json()).then(d => {
        if (d.type === 'success') setData(d.details)
        else if (d.type === 'unsupported_url') setError(t('detail.error.unsupported'))
        else setError(t('detail.error.unavailable'))
      }).catch(() => setError(t('detail.error.load'))).finally(() => setLoading(false))
  }, [url, provider])

  if (loading) return <p className="text-center py-12 text-zinc-500">{t('detail.loading')}</p>
  if (error) return (
    <div className="flex flex-col items-center py-12 gap-4">
      <p className="text-zinc-500">{error}</p>
      {hash && <button onClick={() => doCopy('hash', hash)}
        className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-sm">{copied === 'hash' ? t('search.copied') : t('search.copy_hash')}</button>}
    </div>
  )
  if (!data) return <p className="text-center py-12 text-zinc-500">{t('detail.error.unavailable')}</p>

  return (
    <div className="flex flex-col flex-1 px-4 py-6 max-w-3xl mx-auto w-full">
      <h1 className="text-xl font-bold mb-4 break-words">{data.name}</h1>
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        {data.size && <div><span className="text-zinc-400">{t('detail.size')}:</span> {data.size}</div>}
        {data.seeders !== undefined && <div><span className="text-green-600">{t('detail.seeders')}:</span> {data.seeders}</div>}
        {data.peers !== undefined && <div><span className="text-red-600">{t('detail.peers')}:</span> {data.peers}</div>}
        {data.uploadDate && <div><span className="text-zinc-400">{t('detail.uploaded')}:</span> {data.uploadDate}</div>}
        {data.uploader && <div><span className="text-zinc-400">{t('detail.uploader')}:</span> {data.uploader}</div>}
        {data.lastChecked && <div><span className="text-zinc-400">{t('detail.last_checked')}:</span> {data.lastChecked}</div>}
      </div>
      <div className="flex flex-col gap-2 mb-6">
        {data.magnetUri && (
          <button onClick={() => doCopy('magnet', data.magnetUri)}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
            {copied === 'magnet' ? t('search.copied') : t('detail.copy_magnet')}
          </button>
        )}
        {data.infoHash && (
          <button onClick={() => doCopy('hash', data.infoHash)}
            className="w-full px-4 py-3 bg-zinc-200 dark:bg-zinc-800 rounded-xl font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700">
            {copied === 'hash' ? t('search.copied') : t('detail.copy_hash')}
          </button>
        )}
        {data.fileDownloadLink && (
          <a href={data.fileDownloadLink}
            className="block w-full text-center px-4 py-3 rounded-xl font-medium bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700">{t('detail.download_torrent')}</a>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="block w-full text-center px-4 py-3 rounded-xl font-medium bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700">{t('detail.view_original')}</a>
        )}
      </div>
      {data.posterUrl && <img src={data.posterUrl} alt="Poster" className="max-h-64 rounded-lg mb-4 object-cover" />}
      {data.screenshotUrls?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto mb-4">
          {data.screenshotUrls.map((s: string, i: number) => <img key={i} src={s} alt={`Screenshot ${i + 1}`} className="h-40 rounded object-cover" />)}
        </div>
      )}
      {data.description && (
        <div className="prose dark:prose-invert max-w-none text-sm">
          <h3 className="text-lg font-semibold mb-2">Description</h3>
          <div dangerouslySetInnerHTML={{ __html: data.description }} />
        </div>
      )}
    </div>
  )
}

export default function TorrentDetailsPage() {
  return <Suspense fallback={null}><DetailsInner /></Suspense>
}
