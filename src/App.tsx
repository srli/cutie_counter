import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { loadAllPacks, type PackEntry } from './store'
import { Menu } from './ui/Menu'
import { PackLink, packLinkFromUrl } from './ui/PackLink'
import { Setup } from './ui/Setup'
import { Stories } from './ui/Stories'
import { Write } from './ui/Write'

export type Packs = Record<string, PackEntry>

// The Studio is only for authors, so writers don't download it.
const Studio = lazy(() => import('./studio/Studio').then((m) => ({ default: m.Studio })))

/** Tiny hash router: #/, #/setup, #/stories, #/write/<projectId>, #/studio[/<draftId>] */
function useRoute(): [string[], (path: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onHash = () => setRoute(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = useCallback((path: string) => { window.location.hash = `#/${path}` }, [])
  return [route, go]
}

export function App() {
  const [route, go] = useRoute()
  const [packs, setPacks] = useState<Packs | null>(null)
  const reloadPacks = useCallback(() => loadAllPacks().then(setPacks), [])
  useEffect(() => { void reloadPacks() }, [reloadPacks])

  const [sharedPack, setSharedPack] = useState(packLinkFromUrl)

  if (!packs) return <div className="loading">Loading…</div>

  return (
    <>
      {screen(route, packs, go, reloadPacks)}
      {sharedPack && <PackLink src={sharedPack} onDone={(added) => { setSharedPack(null); if (added) void reloadPacks() }} />}
    </>
  )
}

function screen(route: string[], packs: Packs, go: (p: string) => void, reloadPacks: () => Promise<void>) {
  switch (route[0]) {
    case 'setup':
      return <Setup packs={packs} go={go} reloadPacks={reloadPacks} />
    case 'stories':
      return <Stories packs={packs} go={go} />
    case 'studio':
      return (
        <Suspense fallback={<div className="loading">Loading the Studio…</div>}>
          <Studio draftId={route[1]} packs={packs} go={go} reloadPacks={reloadPacks} />
        </Suspense>
      )
    case 'write':
      return <Write key={route[1]} projectId={route[1]} packs={packs} go={go} />
    default:
      return <Menu packs={packs} go={go} reloadPacks={reloadPacks} />
  }
}
