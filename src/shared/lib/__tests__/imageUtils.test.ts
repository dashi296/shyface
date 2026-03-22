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
  // getSize mock: 320x240

  it('applies 20% padding to bounding box before cropping', async () => {
    const { manipulateAsync } = require('expo-image-manipulator')
    manipulateAsync.mockResolvedValue({ uri: 'file://cropped.jpg' })

    const { cropFace } = require('../imageUtils')
    // box: x=10.7, y=20.3, w=48.9, h=52.1
    // padX=9.78, padY=10.42
    // originX = max(0, round(10.7 - 9.78)) = max(0, round(0.92)) = 1
    // originY = max(0, round(20.3 - 10.42)) = max(0, round(9.88)) = 10
    // width = min(round(10.7+48.9+9.78) - 1, 320-1-1) = min(round(69.38)-1, 318) = min(69-1, 318) = 68
    // height = min(round(20.3+52.1+10.42) - 10, 240-1-10) = min(round(82.82)-10, 229) = min(83-10, 229) = 73
    const box = { x: 10.7, y: 20.3, width: 48.9, height: 52.1 }
    const result = await cropFace('file://original.jpg', box)

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://original.jpg',
      [{ crop: { originX: 1, originY: 10, width: 68, height: 73 } }],
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

  it('clamps padded origin to 0 when box is near image edge', async () => {
    const { manipulateAsync } = require('expo-image-manipulator')
    manipulateAsync.mockResolvedValue({ uri: 'file://cropped.jpg' })

    const { cropFace } = require('../imageUtils')
    // box at top-left corner: x=0, y=0, w=50, h=60
    // padX=10, padY=12 → originX=max(0,-10)=0, originY=max(0,-12)=0
    // width = min(round(0+50+10)-0, 319) = min(60, 319) = 60
    // height = min(round(0+60+12)-0, 239) = min(72, 239) = 72
    await cropFace('file://img.jpg', { x: 0, y: 0, width: 50, height: 60 })

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://img.jpg',
      [{ crop: { originX: 0, originY: 0, width: 60, height: 72 } }],
      { format: 'jpeg' }
    )
  })

  it('clamps padded size within image bounds', async () => {
    const { manipulateAsync } = require('expo-image-manipulator')
    manipulateAsync.mockResolvedValue({ uri: 'file://cropped.jpg' })

    const { cropFace } = require('../imageUtils')
    // box near right/bottom edge: x=270, y=200, w=40, h=30
    // padX=8, padY=6
    // originX=max(0,round(270-8))=262, originY=max(0,round(200-6))=194
    // rawWidth=round(270+40+8)-262=318-262=56 → min(56, 320-1-262)=min(56,57)=56
    // rawHeight=round(200+30+6)-194=236-194=42 → min(42, 240-1-194)=min(42,45)=42
    await cropFace('file://img.jpg', { x: 270, y: 200, width: 40, height: 30 })

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://img.jpg',
      [{ crop: { originX: 262, originY: 194, width: 56, height: 42 } }],
      { format: 'jpeg' }
    )
  })
})
