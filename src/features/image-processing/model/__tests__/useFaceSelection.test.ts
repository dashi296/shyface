import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useFaceSelection } from '../useFaceSelection'

const mockBox = { x: 0, y: 0, width: 50, height: 50 }
const mockCandidate = { box: mockBox, isMatched: true, isSelected: true }

jest.mock('../detectAndClassify', () => ({ detectAndClassify: jest.fn() }))
jest.mock('../applyMosaicToSelected', () => ({ applyMosaicToSelected: jest.fn() }))

describe('useFaceSelection', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('starts in detecting phase', () => {
    const { detectAndClassify } = require('../detectAndClassify')
    detectAndClassify.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useFaceSelection('file://image.jpg'))

    expect(result.current.phase).toBe('detecting')
    expect(result.current.candidates).toEqual([])
    expect(result.current.resultUri).toBeUndefined()
  })

  it('transitions to error when no faces detected', async () => {
    const { detectAndClassify } = require('../detectAndClassify')
    detectAndClassify.mockResolvedValue([])

    const { result } = renderHook(() => useFaceSelection('file://image.jpg'))

    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.error?.message).toBe('顔が検出されませんでした')
  })

  it('transitions to selecting when faces detected', async () => {
    const { detectAndClassify } = require('../detectAndClassify')
    detectAndClassify.mockResolvedValue([mockCandidate])

    const { result } = renderHook(() => useFaceSelection('file://image.jpg'))

    await waitFor(() => expect(result.current.phase).toBe('selecting'))
    expect(result.current.candidates).toEqual([mockCandidate])
  })

  it('toggleFace inverts isSelected of the specified index', async () => {
    const { detectAndClassify } = require('../detectAndClassify')
    detectAndClassify.mockResolvedValue([mockCandidate])

    const { result } = renderHook(() => useFaceSelection('file://image.jpg'))
    await waitFor(() => expect(result.current.phase).toBe('selecting'))

    act(() => { result.current.toggleFace(0) })

    expect(result.current.candidates[0].isSelected).toBe(false)
  })

  it('toggleFace does not affect other candidates', async () => {
    const { detectAndClassify } = require('../detectAndClassify')
    const candidateA = { box: mockBox, isMatched: true, isSelected: true }
    const candidateB = { box: { x: 100, y: 0, width: 50, height: 50 }, isMatched: false, isSelected: false }
    detectAndClassify.mockResolvedValue([candidateA, candidateB])

    const { result } = renderHook(() => useFaceSelection('file://image.jpg'))
    await waitFor(() => expect(result.current.phase).toBe('selecting'))

    act(() => { result.current.toggleFace(0) })

    expect(result.current.candidates[0].isSelected).toBe(false)
    expect(result.current.candidates[1].isSelected).toBe(false)
  })

  it('confirm transitions to processing then done', async () => {
    const { detectAndClassify } = require('../detectAndClassify')
    const { applyMosaicToSelected } = require('../applyMosaicToSelected')
    detectAndClassify.mockResolvedValue([mockCandidate])
    applyMosaicToSelected.mockResolvedValue('file://result.jpg')

    const { result } = renderHook(() => useFaceSelection('file://image.jpg'))
    await waitFor(() => expect(result.current.phase).toBe('selecting'))

    act(() => { result.current.confirm() })

    await waitFor(() => expect(result.current.phase).toBe('done'))
    expect(result.current.resultUri).toBe('file://result.jpg')
  })

  it('transitions to error when detectAndClassify throws', async () => {
    const { detectAndClassify } = require('../detectAndClassify')
    detectAndClassify.mockRejectedValue(new Error('detector error'))

    const { result } = renderHook(() => useFaceSelection('file://image.jpg'))

    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.error?.message).toBe('detector error')
  })

  it('transitions to error when applyMosaicToSelected throws', async () => {
    const { detectAndClassify } = require('../detectAndClassify')
    const { applyMosaicToSelected } = require('../applyMosaicToSelected')
    detectAndClassify.mockResolvedValue([mockCandidate])
    applyMosaicToSelected.mockRejectedValue(new Error('mosaic error'))

    const { result } = renderHook(() => useFaceSelection('file://image.jpg'))
    await waitFor(() => expect(result.current.phase).toBe('selecting'))

    act(() => { result.current.confirm() })

    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.error?.message).toBe('mosaic error')
  })
})
