import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useProcessImage } from '../useProcessImage'
import { FACE_SIMILARITY_THRESHOLD as THRESHOLD } from '@/shared/config'

const mockEmbedding = Array(128).fill(0.5)

jest.mock('@/shared/native', () => ({
  FaceDetector: { detect: jest.fn() },
  FaceNet: { extractAll: jest.fn() },
  Mosaic: { apply: jest.fn().mockResolvedValue('file://blurred.jpg') },
}))

jest.mock('@/shared/db', () => ({
  getAllEmbeddings: jest.fn(),
}))

jest.mock('@/shared/lib', () => ({
  cosineSimilarity: jest.fn(),
  cropFace: jest.fn().mockImplementation((_uri, _box) => Promise.resolve('file://cropped.jpg')),
  resizeForMosaic: jest.fn().mockResolvedValue({ uri: 'file://original.jpg', scale: 1 }),
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

const storedEmbedding = [
  { id: '1', person_id: 'p1', embedding: JSON.stringify(mockEmbedding), source_uri: 'u', created_at: '', updated_at: '' },
]

describe('useProcessImage', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('returns original uri when no faces detected', async () => {
    const { FaceDetector } = require('@/shared/native')
    FaceDetector.detect.mockResolvedValue([])

    const { result } = renderHook(() => useProcessImage(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate('file://original.jpg') })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('file://original.jpg')
  })

  it('crops each face before extracting embeddings', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')
    const { getAllEmbeddings } = require('@/shared/db')
    const { cosineSimilarity, cropFace } = require('@/shared/lib')

    const box = { x: 10, y: 10, width: 50, height: 50 }
    FaceDetector.detect.mockResolvedValue([box])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])
    getAllEmbeddings.mockResolvedValue([])
    cosineSimilarity.mockReturnValue(0.3)

    const { result } = renderHook(() => useProcessImage(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate('file://original.jpg') })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(cropFace).toHaveBeenCalledWith('file://original.jpg', box)
    expect(FaceNet.extractAll).toHaveBeenCalledWith(['file://cropped.jpg'])
  })

  it('applies mosaic when similarity is above threshold', async () => {
    const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
    const { getAllEmbeddings } = require('@/shared/db')
    const { cosineSimilarity } = require('@/shared/lib')

    const box = { x: 10, y: 10, width: 50, height: 50 }
    FaceDetector.detect.mockResolvedValue([box])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])
    getAllEmbeddings.mockResolvedValue(storedEmbedding)
    cosineSimilarity.mockReturnValue(0.95)

    const { result } = renderHook(() => useProcessImage(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate('file://original.jpg') })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(Mosaic.apply).toHaveBeenCalledWith('file://original.jpg', [box])
    expect(result.current.data).toBe('file://blurred.jpg')
  })

  it('does not apply mosaic when similarity is below threshold', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')
    const { getAllEmbeddings } = require('@/shared/db')
    const { cosineSimilarity } = require('@/shared/lib')

    const box = { x: 10, y: 10, width: 50, height: 50 }
    FaceDetector.detect.mockResolvedValue([box])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])
    getAllEmbeddings.mockResolvedValue(storedEmbedding)
    cosineSimilarity.mockReturnValue(0.3)

    const { result } = renderHook(() => useProcessImage(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate('file://original.jpg') })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('file://original.jpg')
  })

  it('does not blur when similarity equals threshold exactly (strict >)', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')
    const { getAllEmbeddings } = require('@/shared/db')
    const { cosineSimilarity } = require('@/shared/lib')
    const { Mosaic } = require('@/shared/native')

    const box = { x: 0, y: 0, width: 100, height: 100 }
    FaceDetector.detect.mockResolvedValue([box])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])
    getAllEmbeddings.mockResolvedValue(storedEmbedding)
    cosineSimilarity.mockReturnValue(THRESHOLD) // exactly 0.7

    const { result } = renderHook(() => useProcessImage(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate('file://original.jpg') })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(Mosaic.apply).not.toHaveBeenCalled()
    expect(result.current.data).toBe('file://original.jpg')
  })

  it('blurs only matched faces in multi-face image', async () => {
    const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
    const { getAllEmbeddings } = require('@/shared/db')
    const { cosineSimilarity } = require('@/shared/lib')

    const boxA = { x: 0, y: 0, width: 50, height: 50 }
    const boxB = { x: 100, y: 0, width: 50, height: 50 }
    const embeddingA = Array(128).fill(0.1)
    const embeddingB = Array(128).fill(0.9)

    FaceDetector.detect.mockResolvedValue([boxA, boxB])
    FaceNet.extractAll.mockResolvedValue([embeddingA, embeddingB])
    getAllEmbeddings.mockResolvedValue(storedEmbedding)

    // faceA: above threshold → blur; faceB: below threshold → keep
    cosineSimilarity
      .mockReturnValueOnce(0.95)  // embeddingA vs storedEmbedding
      .mockReturnValueOnce(0.2)   // embeddingB vs storedEmbedding

    const { result } = renderHook(() => useProcessImage(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate('file://original.jpg') })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(Mosaic.apply).toHaveBeenCalledWith('file://original.jpg', [boxA])
    expect(result.current.data).toBe('file://blurred.jpg')
  })

  it('enters error state when FaceDetector fails', async () => {
    const { FaceDetector } = require('@/shared/native')
    FaceDetector.detect.mockRejectedValue(new Error('detector error'))

    const { result } = renderHook(() => useProcessImage(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate('file://original.jpg') })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('enters error state when FaceNet fails', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')
    const { getAllEmbeddings } = require('@/shared/db')

    FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
    FaceNet.extractAll.mockRejectedValue(new Error('inference error'))
    getAllEmbeddings.mockResolvedValue([])

    const { result } = renderHook(() => useProcessImage(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate('file://original.jpg') })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('skips corrupt embedding records and returns original uri gracefully', async () => {
    const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
    const { getAllEmbeddings } = require('@/shared/db')

    FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])
    getAllEmbeddings.mockResolvedValue([
      { id: '1', person_id: 'p1', embedding: 'INVALID_JSON', source_uri: 'u', created_at: '', updated_at: '' },
    ])

    const { result } = renderHook(() => useProcessImage(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate('file://original.jpg') })

    // corrupt レコードはスキップされ処理が継続する（エラーにならない）
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('file://original.jpg') // match なし → 元画像を返す
    expect(Mosaic.apply).not.toHaveBeenCalled()
  })
})
