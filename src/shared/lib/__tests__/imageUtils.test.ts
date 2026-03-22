/**
 * @jest-environment node
 */
import { uriToFilePath, isFileUri } from '../imageUtils'

jest.mock('react-native', () => ({
  Image: {
    getSize: jest.fn((_uri: string, success: (w: number, h: number) => void) => success(320, 240)),
  },
}))

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}))

describe('uriToFilePath', () => {
  it('strips file:// prefix', () => {
    expect(uriToFilePath('file:///var/mobile/image.jpg')).toBe('/var/mobile/image.jpg')
  })

  it('strips file:// on iOS-style triple-slash URIs correctly', () => {
    // file:///path → /path (file:// removed, one slash remains)
    expect(uriToFilePath('file:///data/user/0/com.shyface/image.jpg'))
      .toBe('/data/user/0/com.shyface/image.jpg')
  })

  it('returns unchanged string when no file:// prefix', () => {
    expect(uriToFilePath('/abs/path/image.jpg')).toBe('/abs/path/image.jpg')
  })

  it('returns unchanged string for http:// URIs', () => {
    expect(uriToFilePath('http://example.com/image.jpg')).toBe('http://example.com/image.jpg')
  })

  it('returns empty string unchanged', () => {
    expect(uriToFilePath('')).toBe('')
  })
})

describe('isFileUri', () => {
  it('returns true for file:// URIs', () => {
    expect(isFileUri('file:///var/mobile/image.jpg')).toBe(true)
  })

  it('returns false for http:// URIs', () => {
    expect(isFileUri('http://example.com/image.jpg')).toBe(false)
  })

  it('returns false for bare paths', () => {
    expect(isFileUri('/abs/path/image.jpg')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isFileUri('')).toBe(false)
  })
})

describe('cropFace', () => {
  it('passes rounded bounding box coords to manipulateAsync', async () => {
    const { manipulateAsync } = require('expo-image-manipulator')
    manipulateAsync.mockResolvedValue({ uri: 'file://cropped.jpg' })

    const { cropFace } = require('../imageUtils')
    const box = { x: 10.7, y: 20.3, width: 48.9, height: 52.1 }
    const result = await cropFace('file://original.jpg', box)

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://original.jpg',
      [{ crop: { originX: 11, originY: 20, width: 49, height: 52 } }],
      { format: 'jpeg' }
    )
    expect(result).toBe('file://cropped.jpg')
  })

  it('returns the uri from manipulateAsync result', async () => {
    const { manipulateAsync } = require('expo-image-manipulator')
    manipulateAsync.mockResolvedValue({ uri: 'file://result.jpg' })

    const { cropFace } = require('../imageUtils')
    const result = await cropFace('file://img.jpg', { x: 0, y: 0, width: 100, height: 100 })
    expect(result).toBe('file://result.jpg')
  })

  it('passes integer coords without rounding change', async () => {
    const { manipulateAsync } = require('expo-image-manipulator')
    manipulateAsync.mockResolvedValue({ uri: 'file://cropped.jpg' })

    const { cropFace } = require('../imageUtils')
    await cropFace('file://img.jpg', { x: 10, y: 20, width: 50, height: 60 })

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://img.jpg',
      [{ crop: { originX: 10, originY: 20, width: 50, height: 60 } }],
      { format: 'jpeg' }
    )
  })
})
