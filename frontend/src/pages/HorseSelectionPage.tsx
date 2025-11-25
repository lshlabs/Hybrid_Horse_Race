import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

import { NeonCard } from '../components/ui/NeonCard'
import { RUN_STYLE_ACCENT, RUN_STYLE_IDS, type RunStyleId } from '../data/runStyles'
import { useRoom } from '../hooks/useRoom'
import { selectRunStyle } from '../lib/firebase-functions'
import { getUserId } from '../lib/user-id'

interface RunStyleCandidate {
  style: RunStyleId
  horseNameIndex: number
}

function getRandomRunStyles(availableStyles: RunStyleId[]): RunStyleId[] {
  if (availableStyles.length <= 3) {
    return availableStyles
  }
  
  const pool = [...availableStyles]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

export function HorseSelectionPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const roomId = searchParams.get('roomId')
  const playerId = searchParams.get('playerId') // 초대 링크로 들어온 플레이어 ID
  const userId = getUserId()
  
  const { room, players, loading } = useRoom(roomId)
  
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 현재 플레이어 찾기
  const currentPlayer = useMemo(() => {
    if (!room || !userId) {
      console.log('[HorseSelectionPage] currentPlayer: room or userId missing', { room: !!room, userId })
      return null
    }
    
    console.log('[HorseSelectionPage] Finding currentPlayer', {
      roomHostId: room.hostId,
      userId,
      playerId,
      playersCount: players.length,
      players: players.map(p => ({ id: p.id, isHost: p.isHost, name: p.name })),
    })
    
    // 호스트인 경우: playerId를 무시하고 항상 isHost로 찾기
    // 호스트의 Firestore 문서 ID는 hostId와 동일하므로
    if (room.hostId === userId) {
      const host = players.find((p) => p.isHost) || null
      console.log('[HorseSelectionPage] Found host:', host?.id, 'expected hostId:', room.hostId)
      return host
    }
    
    // 일반 플레이어인 경우 (playerId로 찾기)
    // playerId는 Firestore 문서 ID이므로 id 필드와 비교
    // 호스트가 아닌 플레이어만 찾기
    if (playerId) {
      const found = players.find((p) => !p.isHost && p.id === playerId) || null
      console.log('[HorseSelectionPage] Found player by playerId:', found?.id, 'searching for:', playerId)
      return found
    }
    
    // playerId가 없지만 일반 플레이어일 수 있음 (URL에서 빠졌을 수 있음)
    // 하지만 일반 플레이어는 반드시 playerId가 있어야 함
    console.log('[HorseSelectionPage] currentPlayer: not found (no playerId for non-host player)')
    return null
  }, [room, userId, players, playerId])

  // 사용 가능한 주행 습성 (게임 시작 시 제시된 3개)
  const availableRunStyles = useMemo(() => {
    if (currentPlayer?.availableRunStyles) {
      return currentPlayer.availableRunStyles
    }
    // 백엔드에서 받지 못한 경우 기본값
    return RUN_STYLE_IDS
  }, [currentPlayer])

  // 후보 생성 (제시된 습성 3개 사용)
  const candidates = useMemo<RunStyleCandidate[]>(() => {
    const styles = getRandomRunStyles(availableRunStyles)
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
  }, [availableRunStyles, t])

  // 이미 선택한 습성이 있는지 확인
  useEffect(() => {
    if (currentPlayer?.runStyle) {
      const selectedStyle = currentPlayer.runStyle
      const index = candidates.findIndex((c) => c.style === selectedStyle)
      if (index >= 0) {
        setSelectedIndex(index)
      }
    }
  }, [currentPlayer, candidates])

  // 룸이 없으면 홈으로 리다이렉트
  useEffect(() => {
    if (!roomId) {
      navigate('/')
      return
    }
  }, [roomId, navigate])

  // 룸 상태가 runStyleSelection이 아니면 로비로 리다이렉트
  useEffect(() => {
    if (room && room.status !== 'runStyleSelection') {
      if (room.status === 'waiting') {
        navigate(`/lobby?roomId=${roomId}`)
      } else if (room.status === 'augmentSelection') {
        // TODO: 증강 선택 페이지로 이동
      }
    }
  }, [room, roomId, navigate])

  // 플레이어를 찾지 못한 경우 처리 (일반 플레이어만)
  // Firestore 구독이 업데이트될 때까지 기다림
  useEffect(() => {
    // 로딩이 완료되었고, 룸이 있고, currentPlayer가 없고, playerId가 있고, 호스트가 아닌 경우
    if (!loading && room && !currentPlayer && playerId && room.hostId !== userId) {
      // players 배열에 해당 playerId가 있는지 확인
      const playerExists = players.some(p => p.id === playerId)
      
      if (!playerExists) {
        console.warn('[HorseSelectionPage] Player not found, waiting for Firestore update...', {
          playerId,
          playersCount: players.length,
          players: players.map(p => ({ id: p.id, isHost: p.isHost, name: p.name })),
          roomId,
          roomStatus: room.status,
        })
        
        // Firestore 구독이 업데이트될 때까지 기다림 (최대 10초)
        let retryCount = 0
        const maxRetries = 20 // 10초 (500ms * 20)
        
        const checkInterval = setInterval(() => {
          retryCount++
          
          // players 배열이 업데이트되었는지 확인 (useEffect 의존성 배열 때문에 players가 업데이트되면 자동으로 다시 실행됨)
          // 하지만 여기서는 players가 이미 업데이트되었는지 확인할 방법이 없으므로
          // 단순히 재시도 횟수만 확인
          
          if (retryCount >= maxRetries) {
            // 최대 재시도 횟수에 도달했으면 로비로 리다이렉트
            console.error('[HorseSelectionPage] Player not found after retries, redirecting to lobby', {
              playerId,
              finalPlayersCount: players.length,
              finalPlayers: players.map(p => p.id),
            })
            clearInterval(checkInterval)
            navigate(`/lobby?roomId=${roomId}${playerId ? `&playerId=${playerId}` : ''}`)
          }
        }, 500)
        
        return () => clearInterval(checkInterval)
      }
    }
  }, [loading, room, currentPlayer, playerId, userId, players, roomId, navigate])

  const getHorseName = (style: RunStyleId, nameIndex: number): string => {
    const namePool = t(`runStyle.horseNames.${style}`, {
      returnObjects: true,
      defaultValue: [],
    }) as string[]
    const fallback = t(`runStyle.options.${style}.name`)
    const candidates = Array.isArray(namePool) && namePool.length > 0 ? namePool : [fallback]
    return candidates[nameIndex % candidates.length]
  }

  const handleConfirm = async () => {
    if (selectedIndex == null || !roomId || !currentPlayer || isSubmitting) return
    
    const candidate = candidates[selectedIndex]
    setError(null)
    setIsSubmitting(true)

    try {
      // playerId는 호스트인 경우 userId, 일반 플레이어인 경우 playerId (Firestore 문서 ID)
      const actualPlayerId = currentPlayer.id || (room?.hostId === userId ? userId : playerId)
      
      if (!actualPlayerId) {
        throw new Error('플레이어 정보를 찾을 수 없습니다.')
      }

      await selectRunStyle({
        roomId,
        playerId: actualPlayerId,
        runStyle: candidate.style,
      })
      
      // 성공하면 자동으로 다음 페이지로 이동 (useEffect에서 처리)
      // 모든 플레이어가 선택하면 augmentSelection으로 전환됨
    } catch (err: any) {
      console.error('Failed to select run style:', err)
      setError(err.message || '주행 습성 선택에 실패했습니다.')
      setIsSubmitting(false)
    }
  }

  // 로딩 중
  if (loading || !room || !currentPlayer) {
    const isHost = room?.hostId === userId
    const playerNotFound = !loading && room && !currentPlayer
    
    console.log('[HorseSelectionPage] Loading state:', {
      loading,
      hasRoom: !!room,
      hasCurrentPlayer: !!currentPlayer,
      roomStatus: room?.status,
      playersCount: players.length,
      isHost,
      playerId,
      userId,
      players: players.map(p => ({ id: p.id, isHost: p.isHost, name: p.name })),
    })
    
    if (playerNotFound && !isHost && playerId) {
      console.error('[HorseSelectionPage] Player not found in players array!', {
        searchingFor: playerId,
        availablePlayers: players.map(p => p.id),
      })
    }
    
    return (
      <div className="flex w-full flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-neutral-200">로딩 중...</p>
          {playerNotFound && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-neutral-400">
                플레이어 정보를 불러오는 중...
              </p>
              <p className="text-xs text-neutral-500">
                roomId: {roomId}
              </p>
              <p className="text-xs text-neutral-500">
                playerId: {playerId || 'none'}
              </p>
              <p className="text-xs text-neutral-500">
                players: {players.length}명
              </p>
              {players.length > 0 && (
                <div className="text-xs text-neutral-500 mt-2">
                  <p>플레이어 목록:</p>
                  <ul className="list-disc list-inside">
                    {players.map(p => (
                      <li key={p.id}>
                        {p.id} ({p.isHost ? '호스트' : '일반'})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
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

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {currentPlayer.horseStats && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-400 mb-2">
              말 능력치
            </p>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <div>
                <span className="text-neutral-400">속도:</span>
                <span className="ml-2 text-neutral-100">{currentPlayer.horseStats.speed}</span>
              </div>
              <div>
                <span className="text-neutral-400">지구력:</span>
                <span className="ml-2 text-neutral-100">{currentPlayer.horseStats.stamina}</span>
              </div>
              <div>
                <span className="text-neutral-400">컨디션:</span>
                <span className="ml-2 text-neutral-100">{currentPlayer.horseStats.condition}</span>
              </div>
              <div>
                <span className="text-neutral-400">기수기술:</span>
                <span className="ml-2 text-neutral-100">{currentPlayer.horseStats.jockeySkill}</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {candidates.map((candidate, index) => {
            const isSelected = selectedIndex === index
            const horseName = getHorseName(candidate.style, candidate.horseNameIndex)
            return (
              <button
                key={`${candidate.style}-${candidate.horseNameIndex}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                disabled={isSubmitting}
                className={clsx(
                  'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]',
                  isSubmitting && 'opacity-50 cursor-not-allowed',
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
          <div className="text-sm text-neutral-400">
            {currentPlayer.runStyle && (
              <span>이미 선택됨: {t(`runStyle.options.${currentPlayer.runStyle}.name`)}</span>
            )}
          </div>
          <button
            type="button"
            disabled={selectedIndex == null || isSubmitting}
            onClick={handleConfirm}
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-neon transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-400"
          >
            {isSubmitting ? '처리 중...' : t('runStyle.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
