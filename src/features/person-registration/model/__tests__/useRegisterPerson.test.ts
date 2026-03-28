import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRegisterPerson } from '../useRegisterPerson'
import { getAllPersons, getEmbeddingsByPersonId } from '@/shared/db'
import * as dbModule from '@/shared/db'

jest.mock('@/shared/db', () => ({ __esModule: true, ...jest.requireActual('@/shared/db') }))

jest.mock('@/shared/native', () => ({
  FaceDetector: { detect: jest.fn() },
  FaceNet: { extractAll: jest.fn() },
}))

jest.mock('@/shared/lib', () => ({
  cropFace: jest.fn(),
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
  })

  afterEach(() => jest.restoreAllMocks())

  it('calls FaceNet.extractAll before insertPerson (no orphaned records on FaceNet failure)', async () => {
    const { FaceNet } = require('@/shared/native')
    FaceNet.extractAll.mockRejectedValueOnce(new Error('inference error'))

    const qc = makeQc()
    const { result } = renderHook(() => useRegisterPerson(), { wrapper: makeWrapper(qc) })
    act(() => { result.current.mutate(INPUT) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const persons = await getAllPersons()
    expect(persons).toHaveLength(0)
  })

  it('calls insertPerson once and insertEmbedding per photo on success', async () => {
    const qc = makeQc()
    const { result } = renderHook(() => useRegisterPerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate(INPUT) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const persons = await getAllPersons()
    expect(persons).toHaveLength(1)
    const embeddings = await getEmbeddingsByPersonId(persons[0].id)
    expect(embeddings).toHaveLength(3)
  })

  it('passes serialized embeddings and matching photoUris to insertEmbedding', async () => {
    const qc = makeQc()
    const { result } = renderHook(() => useRegisterPerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate(INPUT) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const persons = await getAllPersons()
    const personId = persons[0].id
    const embeddings = await getEmbeddingsByPersonId(personId)

    for (let i = 0; i < 3; i++) {
      expect(embeddings).toContainEqual(
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
    jest.spyOn(dbModule, 'insertPerson').mockRejectedValueOnce(new Error('db error'))

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
