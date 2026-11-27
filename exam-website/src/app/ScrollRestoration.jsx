import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SCROLL_STORAGE_KEY = 'app-scroll-positions'

function getSavedScrollPositions() {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export default function ScrollRestoration() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const savedPositions = getSavedScrollPositions()
    const savedPosition = Number(savedPositions[pathname] || 0)
    if (!savedPosition) return undefined

    const restoreScrollPosition = () => window.scrollTo(0, savedPosition)
    restoreScrollPosition()

    const observer = new ResizeObserver(restoreScrollPosition)
    observer.observe(document.body)
    const stopObserving = window.setTimeout(() => observer.disconnect(), 2000)

    return () => {
      window.clearTimeout(stopObserving)
      observer.disconnect()
    }
  }, [pathname])

  useEffect(() => {
    const saveScrollPosition = () => {
      const savedPositions = getSavedScrollPositions()
      savedPositions[pathname] = window.scrollY
      sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(savedPositions))
    }

    window.addEventListener('scroll', saveScrollPosition, { passive: true })
    return () => {
      saveScrollPosition()
      window.removeEventListener('scroll', saveScrollPosition)
    }
  }, [pathname])

  return null
}
