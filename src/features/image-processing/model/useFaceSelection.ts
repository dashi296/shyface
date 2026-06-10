import { useState, useEffect, useCallback, useRef } from 'react'
import { detectAndClassify } from './detectAndClassify'
import { applyMosaicToSelected } from './applyMosaicToSelected'
import type { FaceCandidate } from './types'

type Phase = 'detecting' | 'selecting' | 'processing' | 'done' | 'error'

interface FaceSelectionState {
  phase: Phase
  candidates: FaceCandidate[]
  resultUri: string | undefined
  error: Error | undefined
  toggleFace: (index: number) => void
  confirm: () => void
}

export function useFaceSelection(uri: string): FaceSelectionState {
  const [phase, setPhase] = useState<Phase>('detecting')
  const [candidates, setCandidates] = useState<FaceCandidate[]>([])
  const [resultUri, setResultUri] = useState<string | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const hasStarted = useRef(false)

  useEffect(() => {
    if (!uri || hasStarted.current) return
    hasStarted.current = true

    detectAndClassify(uri)
      .then((result) => {
        if (result.length === 0) {
          setError(new Error('顔が検出されませんでした'))
          setPhase('error')
          return
        }
        setCandidates(result)
        setPhase('selecting')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)))
        setPhase('error')
      })
  }, [uri])

  const toggleFace = useCallback((index: number) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, isSelected: !c.isSelected } : c))
    )
  }, [])

  const confirm = useCallback(() => {
    setPhase('processing')
    applyMosaicToSelected(uri, candidates)
      .then((result) => {
        setResultUri(result)
        setPhase('done')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)))
        setPhase('error')
      })
  }, [uri, candidates])

  return { phase, candidates, resultUri, error, toggleFace, confirm }
}
