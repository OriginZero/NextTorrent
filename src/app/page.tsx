'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'

type Provider = {
  id: string; name: string; url: string; supportedCategories: string[]; isCloudflareProtected: boolean
}

export default function Home() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [providers, setProviders] = useState<Provider[]>([])
  const { t } = useI18n()

  useEffect(() => {
    fetch('/api/providers').then(r => r.json()).then(setProviders).catch(() => {})
  }, [])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }, [query, router])

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4">
      <h1 className="text-4xl font-bold mb-2">{t('app.title')}</h1>
      <p className="text-zinc-500 mb-8">{t('app.subtitle', { n: providers.length })}</p>
      <form onSubmit={handleSearch} className="w-full max-w-xl flex gap-2">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
        <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">{t('search.button')}</button>
      </form>
      {providers.length > 0 && (
        <div className="mt-12 w-full max-w-xl">
          <h2 className="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wide">{t('providers.title')}</h2>
          <div className="flex flex-wrap gap-2">
            {providers.map(p => (
              <span key={p.id} className={`text-xs px-2 py-1 rounded ${p.isCloudflareProtected ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>{p.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
