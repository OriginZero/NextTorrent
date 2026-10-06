'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { I18nProvider, useI18n } from '@/lib/i18n/context'

function LangSwitcher() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="flex items-center gap-1 text-xs">
      <button onClick={() => setLang('en')} className={`px-2 py-1 rounded ${lang === 'en' ? 'bg-zinc-200 dark:bg-zinc-700 font-medium' : 'text-zinc-400 hover:text-zinc-600'}`}>EN</button>
      <button onClick={() => setLang('zh')} className={`px-2 py-1 rounded ${lang === 'zh' ? 'bg-zinc-200 dark:bg-zinc-700 font-medium' : 'text-zinc-400 hover:text-zinc-600'}`}>中文</button>
    </div>
  )
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/" className="font-bold text-lg">TorrentNext</Link>
        <LangSwitcher />
      </header>
      <main className="flex flex-col flex-1">{children}</main>
    </I18nProvider>
  )
}
