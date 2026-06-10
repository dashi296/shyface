import { applyMosaicToSelected } from '../applyMosaicToSelected'
import type { FaceCandidate } from '../types'

const mockBox = { x: 0, y: 0, width: 50, height: 50 }

jest.mock('@/shared/native', () => ({
  Mosaic: { apply: jest.fn().mockResolvedValue('file://blurred.jpg') },
}))

jest.mock('@/shared/lib', () => ({
  resizeForMosaic: jest.fn().mockResolvedValue({ uri: 'file://resized.jpg', scale: 1 }),
}))

function makeCandidate(isSelected: boolean): FaceCandidate {
  return { box: mockBox, isMatched: isSelected, isSelected }
}

describe('applyMosaicToSelected', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('returns original uri when no candidates are selected', async () => {
    const { Mosaic } = require('@/shared/native')
    const result = await applyMosaicToSelected('file://original.jpg', [makeCandidate(false)])
    expect(result).toBe('file://original.jpg')
    expect(Mosaic.apply).not.toHaveBeenCalled()
  })

  it('returns original uri when candidates array is empty', async () => {
    const { Mosaic } = require('@/shared/native')
    const result = await applyMosaicToSelected('file://original.jpg', [])
    expect(result).toBe('file://original.jpg')
    expect(Mosaic.apply).not.toHaveBeenCalled()
  })

  it('applies mosaic to selected faces', async () => {
    const { Mosaic } = require('@/shared/native')
    const result = await applyMosaicToSelected('file://original.jpg', [makeCandidate(true)])
    expect(Mosaic.apply).toHaveBeenCalledWith('file://resized.jpg', [mockBox])
    expect(result).toBe('file://blurred.jpg')
  })

  it('applies mosaic only to selected faces when mixed', async () => {
    const { Mosaic } = require('@/shared/native')
    const selectedBox = { x: 0, y: 0, width: 50, height: 50 }
    const unselectedBox = { x: 100, y: 0, width: 50, height: 50 }
    await applyMosaicToSelected('file://original.jpg', [
      { box: selectedBox, isMatched: true, isSelected: true },
      { box: unselectedBox, isMatched: false, isSelected: false },
    ])
    expect(Mosaic.apply).toHaveBeenCalledWith('file://resized.jpg', [selectedBox])
  })

  it('scales box coordinates by resizeForMosaic scale factor', async () => {
    const { Mosaic } = require('@/shared/native')
    const { resizeForMosaic } = require('@/shared/lib')
    resizeForMosaic.mockResolvedValueOnce({ uri: 'file://resized.jpg', scale: 0.5 })
    const box = { x: 10, y: 20, width: 50, height: 60 }
    await applyMosaicToSelected('file://original.jpg', [{ box, isMatched: true, isSelected: true }])
    expect(Mosaic.apply).toHaveBeenCalledWith('file://resized.jpg', [
      { x: 5, y: 10, width: 25, height: 30 },
    ])
  })
})
