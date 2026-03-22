import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRegisterPerson } from '../useRegisterPerson'

jest.mock('@/shared/native', () => ({
  FaceDetector: { detect: jest.fn() },
  FaceNet: { extractAll: jest.fn() },
}))

jest.mock('@/shared/lib', () => ({
  cropFace: jest.fn(),
}))

jest.mock('@/shared/db', () => ({
  withTransaction: jest.fn((fn: (db: unknown) => Promise<unknown>) => fn({})),
  insertPerson: jest.fn(),
  insertEmbedding: jest.fn(),
}))

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } } })
}

const INPUT = { name: 'Test User', memo: 'memo', photoUris: ['uri1', 'uri2', 'uri3'] }
const EMBEDDINGS = [Array(128).fill(0.1), Array(128).fill(0.2), Array(128).fill(0.3)]

describe('useRegisterPerson', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const { FaceDetector, FaceNet } = require('@/shared/native')
    FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 100, height: 100 }])
    FaceNet.extractAll.mockResolvedValue(EMBEDDINGS)
    const { cropFace } = require('@/shared/lib')
    cropFace.mockImplementation((_uri: string) => Promise.resolve('file://cropped.jpg'))
    const { insertPerson, insertEmbedding } = require('@/shared/db')
    insertPerson.mockResolvedValue(undefined)
    insertEmbedding.mockResolvedValue(undefined)
  })

  it('calls FaceNet.extractAll before insertPerson (no orphaned records on FaceNet failure)', async () => {
    const { FaceNet } = require('@/shared/native')
    const { insertPerson, insertEmbedding } = require('@/shared/db')
    FaceNet.extractAll.mockRejectedValueOnce(new Error('inference error'))

    const qc = makeQc()
    const { result } = renderHook(() => useRegisterPerson(), { wrapper: makeWrapper(qc) })
    act(() => { result.current.mutate(INPUT) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(insertPerson).not.toHaveBeenCalled()
    expect(insertEmbedding).not.toHaveBeenCalled()
  })

  it('calls insertPerson once and insertEmbedding per photo on success', async () => {
    const { insertPerson, insertEmbedding } = require('@/shared/db')
    const qc = makeQc()
    const { result } = renderHook(() => useRegisterPerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate(INPUT) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(insertPerson).toHaveBeenCalledTimes(1)
    expect(insertEmbedding).toHaveBeenCalledTimes(3)
  })

  it('passes serialized embeddings and matching photoUris to insertEmbedding', async () => {
    const { insertPerson, insertEmbedding } = require('@/shared/db')
    const qc = makeQc()
    const { result } = renderHook(() => useRegisterPerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate(INPUT) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const personId = insertPerson.mock.calls[0][0].id
    for (let i = 0; i < 3; i++) {
      expect(insertEmbedding).toHaveBeenCalledWith(
        expect.objectContaining({
          person_id: personId,
          embedding: JSON.stringify(EMBEDDINGS[i]),
          source_uri: INPUT.photoUris[i],
        })
      )
    }
  })

  it('invalidates persons query on success', async () => {
    const qc = makeQc()
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRegisterPerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate(INPUT) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['persons'] })
  })

  it('enters error state when insertPerson fails (after FaceNet succeeds)', async () => {
    const { insertPerson } = require('@/shared/db')
    insertPerson.mockRejectedValueOnce(new Error('db error'))

    const qc = makeQc()
    const { result } = renderHook(() => useRegisterPerson(), { wrapper: makeWrapper(qc) })
    act(() => { result.current.mutate(INPUT) })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('selects the largest face when multiple faces are detected', async () => {
    const { FaceDetector } = require('@/shared/native')
    const { cropFace } = require('@/shared/lib')
    // 小さい顔(100x100)と大きい顔(200x200)が検出される場合
    FaceDetector.detect.mockResolvedValue([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 200, height: 200 },
    ])

    const qc = makeQc()
    const { result } = renderHook(() => useRegisterPerson(), { wrapper: makeWrapper(qc) })
    act(() => { result.current.mutate(INPUT) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // 3枚すべてで最大面積の顔(200x200)が選ばれていることを確認
    for (const call of cropFace.mock.calls) {
      expect(call[1]).toEqual({ x: 50, y: 50, width: 200, height: 200 })
    }
  })
})
