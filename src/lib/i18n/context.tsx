'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Lang, translations } from './translations'

type I18nCtx = { lang: Lang; t: (key: string, vars?: Record<string, string | number>) => string; setLang: (l: Lang) => void }

const Ctx = createContext<I18nCtx>({ lang: 'en', t: (k: string) => k, setLang: () => {} })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    if (typeof window !== 'undefined') localStorage.setItem('lang', l)
  }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let s = translations[lang][key] || translations.en[key] || key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
    return s
  }, [lang])

  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>
}

export function useI18n() { return useContext(Ctx) }
