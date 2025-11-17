import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

import { NeonCard } from '../components/ui/NeonCard'
import { RUN_STYLE_ACCENT, RUN_STYLE_IDS, type RunStyleId } from '../data/runStyles'

interface RunStyleCandidate {
  style: RunStyleId
  horseNameIndex: number
}

function getRandomRunStyles(): RunStyleId[] {
  const pool = [...RUN_STYLE_IDS]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

export function HorseSelectionPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  // TODO: 증강 게임 진행 페이지 구현 시 navigate 사용
  // const navigate = useNavigate()

  const getHorseName = (style: RunStyleId, nameIndex: number): string => {
    const namePool = t(`runStyle.horseNames.${style}`, {
      returnObjects: true,
      defaultValue: [],
    }) as string[]
    const fallback = t(`runStyle.options.${style}.name`)
    const candidates = Array.isArray(namePool) && namePool.length > 0 ? namePool : [fallback]
    return candidates[nameIndex % candidates.length]
  }

  const createCandidates = () => {
    const styles = getRandomRunStyles()
    return styles.map<RunStyleCandidate>((style) => {
      const namePool = t(`runStyle.horseNames.${style}`, {
        returnObjects: true,
        defaultValue: [],
      }) as string[]
      const fallback = t(`runStyle.options.${style}.name`)
      const candidates = Array.isArray(namePool) && namePool.length > 0 ? namePool : [fallback]
      const horseNameIndex = Math.floor(Math.random() * candidates.length)
      return { style, horseNameIndex }
    })
  }

  const [candidates, setCandidates] = useState<RunStyleCandidate[]>(createCandidates)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [rerollRemaining, setRerollRemaining] = useState(1)

  // 언어 변경 시 candidates를 재생성하지 않음 (말 선택지 유지)
  // useEffect(() => {
  //   setCandidates(createCandidates())
  //   setSelectedIndex(null)
  //   setRerollRemaining(1)
  // }, [i18n.language])

  const handleShuffle = () => {
    if (rerollRemaining <= 0) return
    setCandidates(createCandidates())
    setSelectedIndex(null)
    setRerollRemaining((prev) => prev - 1)
  }

  const handleConfirm = () => {
    if (selectedIndex == null) return
    const candidate = candidates[selectedIndex]
    const horseName = getHorseName(candidate.style, candidate.horseNameIndex)
    const params = new URLSearchParams(searchParams)
    params.set('runStyle', candidate.style)
    params.set('horse', horseName)
    // TODO: 증강 게임 진행 페이지로 이동
    // navigate(`/augment-game?${params.toString()}`)
    console.log('Selected horse:', horseName, 'Run style:', candidate.style)
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-surface/80 p-8 shadow-surface backdrop-blur-lg">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.45em] text-primary/70">
            {t('runStyle.title')}
          </p>
          <h1 className="mt-3 text-3xl font-display text-neutral-50">{t('runStyle.headline')}</h1>
          {t('runStyle.subtitle') ? (
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">
              {t('runStyle.subtitle')}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {candidates.map((candidate, index) => {
            const isSelected = selectedIndex === index
            const horseName = getHorseName(candidate.style, candidate.horseNameIndex)
            return (
              <button
                key={`${candidate.style}-${candidate.horseNameIndex}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={clsx(
                  'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]',
                )}
              >
                <NeonCard
                  accent={RUN_STYLE_ACCENT[candidate.style]}
                  title={horseName}
                  description={undefined}
                  className={clsx(
                    'h-full border border-white/10',
                    isSelected ? 'ring-2 ring-primary' : 'ring-1 ring-white/10',
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">
                    {t(`runStyle.options.${candidate.style}.tagline`)}
                  </p>
                  <p className="mt-3 text-sm text-neutral-200">
                    {t(`runStyle.options.${candidate.style}.description`)}
                  </p>
                </NeonCard>
              </button>
            )
          })}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={rerollRemaining <= 0}
            className={clsx(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition',
              rerollRemaining > 0
                ? 'border-white/10 text-neutral-200 hover:border-primary/50 hover:text-primary'
                : 'cursor-not-allowed border-white/10 text-neutral-500',
            )}
          >
            {t('runStyle.rerollRemaining', { count: rerollRemaining })}
          </button>
          <button
            type="button"
            disabled={selectedIndex == null}
            onClick={handleConfirm}
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-400"
          >
            {t('runStyle.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
