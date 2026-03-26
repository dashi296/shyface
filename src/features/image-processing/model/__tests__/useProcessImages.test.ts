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
    expect(Alert.alert).toHaveBeenCalledWith('処理エラー', 'db error')
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
