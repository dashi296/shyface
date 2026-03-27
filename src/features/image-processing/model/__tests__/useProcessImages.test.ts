import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Alert } from 'react-native'
import { useProcessImages } from '../useProcessImages'

jest.mock('@/shared/db', () => ({
  getAllEmbeddings: jest.fn(),
}))

jest.mock('../processImage', () => ({
  processImage: jest.fn(),
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('useProcessImages', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns success results for all images', async () => {
    const { getAllEmbeddings } = require('@/shared/db')
    const { processImage } = require('../processImage')

    getAllEmbeddings.mockResolvedValue([])
    processImage
      .mockResolvedValueOnce('file://result1.jpg')
      .mockResolvedValueOnce('file://result2.jpg')

    const { result } = renderHook(() => useProcessImages(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate(['file://a.jpg', 'file://b.jpg']) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { status: 'success', originalUri: 'file://a.jpg', resultUri: 'file://result1.jpg' },
      { status: 'success', originalUri: 'file://b.jpg', resultUri: 'file://result2.jpg' },
    ])
  })

  it('continues processing remaining images when one fails, without showing Alert', async () => {
    const { getAllEmbeddings } = require('@/shared/db')
    const { processImage } = require('../processImage')

    getAllEmbeddings.mockResolvedValue([])
    processImage
      .mockRejectedValueOnce(new Error('native error'))
      .mockResolvedValueOnce('file://result2.jpg')

    const { result } = renderHook(() => useProcessImages(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate(['file://a.jpg', 'file://b.jpg']) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { status: 'error', originalUri: 'file://a.jpg', resultUri: 'file://a.jpg', error: 'native error' },
      { status: 'success', originalUri: 'file://b.jpg', resultUri: 'file://result2.jpg' },
    ])
    // 画像単位のエラーは onError (Alert) を発火しない。結果オブジェクトで通知する
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('enters error state and shows Alert when getAllEmbeddings fails', async () => {
    const { getAllEmbeddings } = require('@/shared/db')
    getAllEmbeddings.mockRejectedValue(new Error('db error'))

    const { result } = renderHook(() => useProcessImages(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate(['file://a.jpg']) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(Alert.alert).toHaveBeenCalledWith('処理エラー', 'データの読み込みに失敗しました。アプリを再起動してもう一度お試しください。')
  })

  it('passes preloaded embeddings to processImage for each image in the batch', async () => {
    const { getAllEmbeddings } = require('@/shared/db')
    const { processImage } = require('../processImage')

    const storedEmbeddings = [
      { id: '1', person_id: 'p1', embedding: JSON.stringify(Array(128).fill(0.5)), source_uri: 'u', created_at: '', updated_at: '' },
    ]
    getAllEmbeddings.mockResolvedValue(storedEmbeddings)
    processImage.mockResolvedValue('file://result.jpg')

    const { result } = renderHook(() => useProcessImages(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate(['file://a.jpg', 'file://b.jpg']) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(processImage).toHaveBeenCalledWith('file://a.jpg', storedEmbeddings)
    expect(processImage).toHaveBeenCalledWith('file://b.jpg', storedEmbeddings)
  })

  it('calls getAllEmbeddings only once for a batch of images', async () => {
    const { getAllEmbeddings } = require('@/shared/db')
    const { processImage } = require('../processImage')

    getAllEmbeddings.mockResolvedValue([])
    processImage.mockResolvedValue('file://result.jpg')

    const { result } = renderHook(() => useProcessImages(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate(['file://a.jpg', 'file://b.jpg', 'file://c.jpg']) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getAllEmbeddings).toHaveBeenCalledTimes(1)
  })

  it('returns empty results immediately without calling getAllEmbeddings for empty input', async () => {
    const { getAllEmbeddings } = require('@/shared/db')

    const { result } = renderHook(() => useProcessImages(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate([]) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
    expect(getAllEmbeddings).not.toHaveBeenCalled()
  })

  it('tracks progress to total by end of batch', async () => {
    const { getAllEmbeddings } = require('@/shared/db')
    const { processImage } = require('../processImage')

    getAllEmbeddings.mockResolvedValue([])
    processImage.mockResolvedValue('file://result.jpg')

    const { result } = renderHook(() => useProcessImages(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate(['file://a.jpg', 'file://b.jpg']) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.progress).toEqual({ current: 2, total: 2 })
  })

  it('resolves as success (not error) even when all images fail', async () => {
    const { getAllEmbeddings } = require('@/shared/db')
    const { processImage } = require('../processImage')

    getAllEmbeddings.mockResolvedValue([])
    processImage
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))

    const { result } = renderHook(() => useProcessImages(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate(['file://a.jpg', 'file://b.jpg']) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toEqual([
      { status: 'error', originalUri: 'file://a.jpg', resultUri: 'file://a.jpg', error: 'fail1' },
      { status: 'error', originalUri: 'file://b.jpg', resultUri: 'file://b.jpg', error: 'fail2' },
    ])
    // 画像単位の全失敗でも onError (Alert) は発火しない
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('stores error message as string even for non-Error throws', async () => {
    const { getAllEmbeddings } = require('@/shared/db')
    const { processImage } = require('../processImage')

    getAllEmbeddings.mockResolvedValue([])
    // NativeModules が Error インスタンスでなく文字列を throw する場合
    processImage.mockRejectedValueOnce('native bridge exception string')

    const { result } = renderHook(() => useProcessImages(), { wrapper: makeWrapper() })
    act(() => { result.current.mutate(['file://a.jpg']) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const item = result.current.data![0]
    expect(item.status).toBe('error')
    if (item.status === 'error') {
      expect(item.error).toBe('native bridge exception string')
    }
  })
})
