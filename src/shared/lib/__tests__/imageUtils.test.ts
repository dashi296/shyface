/**
 * @jest-environment node
 */
import { uriToFilePath, isFileUri } from '../imageUtils'

jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { isDev: false } } },
}))

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

describe('resizeForMosaic', () => {
  beforeEach(() => {
    const { Image } = require('react-native')
    const { manipulateAsync } = require('expo-image-manipulator')
    Image.getSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) => success(320, 240))
    manipulateAsync.mockResolvedValue({ uri: 'file://processed.jpg' })
  })

  it('returns scale=1 and no resize action when image is within MOSAIC_MAX_DIMENSION', async () => {
    // 320x240 < 1920 → scale = 1, no resize
    const { resizeForMosaic } = require('../imageUtils')
    const { manipulateAsync } = require('expo-image-manipulator')

    const result = await resizeForMosaic('file://original.jpg')

    expect(result.scale).toBe(1)
    expect(result.uri).toBe('file://processed.jpg')
    // resize action は含まれない（空配列）
    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://original.jpg',
      [],
      expect.objectContaining({ format: 'jpeg' })
    )
  })

  it('returns scale<1 and resize action when image exceeds MOSAIC_MAX_DIMENSION', async () => {
    const { Image } = require('react-native')
    const { manipulateAsync } = require('expo-image-manipulator')
    // 3840x2160 → maxDim=3840 → scale=1920/3840=0.5
    Image.getSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) => success(3840, 2160))

    const { resizeForMosaic } = require('../imageUtils')
    const result = await resizeForMosaic('file://large.jpg')

    expect(result.scale).toBe(0.5)
    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://large.jpg',
      [{ resize: { width: 1920, height: 1080 } }],
      expect.objectContaining({ format: 'jpeg' })
    )
  })

  it('uses the longer side (width) to determine scale', async () => {
    const { Image } = require('react-native')
    // 2560x1440 → maxDim=2560 → scale=1920/2560=0.75
    Image.getSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) => success(2560, 1440))

    const { resizeForMosaic } = require('../imageUtils')
    const result = await resizeForMosaic('file://img.jpg')

    expect(result.scale).toBeCloseTo(0.75)
  })

  it('uses the longer side (height) to determine scale for portrait images', async () => {
    const { Image } = require('react-native')
    // 1440x3840 → maxDim=3840 → scale=1920/3840=0.5
    Image.getSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) => success(1440, 3840))

    const { resizeForMosaic } = require('../imageUtils')
    const result = await resizeForMosaic('file://portrait.jpg')

    expect(result.scale).toBe(0.5)
  })
})

describe('cropFace', () => {
  // getSize mock: 320x240

  it('applies 10% padding to bounding box before cropping', async () => {
    const { manipulateAsync } = require('expo-image-manipulator')
    manipulateAsync.mockResolvedValue({ uri: 'file://cropped.jpg' })

    const { cropFace } = require('../imageUtils')
    // box: x=10.7, y=20.3, w=48.9, h=52.1
    // padX=48.9*0.1=4.89, padY=52.1*0.1=5.21
    // originX = max(0, round(10.7 - 4.89)) = max(0, round(5.81)) = 6
    // originY = max(0, round(20.3 - 5.21)) = max(0, round(15.09)) = 15
    // width = min(round(10.7+48.9+4.89) - 6, 320-1-6) = min(round(64.49)-6, 313) = min(64-6, 313) = 58
    // height = min(round(20.3+52.1+5.21) - 15, 240-1-15) = min(round(77.61)-15, 224) = min(78-15, 224) = 63
    const box = { x: 10.7, y: 20.3, width: 48.9, height: 52.1 }
    const result = await cropFace('file://original.jpg', box)

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://original.jpg',
      [{ crop: { originX: 6, originY: 15, width: 58, height: 63 } }],
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
    // padX=50*0.1=5, padY=60*0.1=6 → originX=max(0,-5)=0, originY=max(0,-6)=0
    // width = min(round(0+50+5)-0, 319) = min(55, 319) = 55
    // height = min(round(0+60+6)-0, 239) = min(66, 239) = 66
    await cropFace('file://img.jpg', { x: 0, y: 0, width: 50, height: 60 })

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://img.jpg',
      [{ crop: { originX: 0, originY: 0, width: 55, height: 66 } }],
      { format: 'jpeg' }
    )
  })

  it('clamps padded size within image bounds', async () => {
    const { manipulateAsync } = require('expo-image-manipulator')
    manipulateAsync.mockResolvedValue({ uri: 'file://cropped.jpg' })

    const { cropFace } = require('../imageUtils')
    // box near right/bottom edge: x=270, y=200, w=40, h=30
    // padX=40*0.1=4, padY=30*0.1=3
    // originX=max(0,round(270-4))=266, originY=max(0,round(200-3))=197
    // rawWidth=round(270+40+4)-266=314-266=48 → min(48, 320-1-266)=min(48,53)=48
    // rawHeight=round(200+30+3)-197=233-197=36 → min(36, 240-1-197)=min(36,42)=36
    await cropFace('file://img.jpg', { x: 270, y: 200, width: 40, height: 30 })

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://img.jpg',
      [{ crop: { originX: 266, originY: 197, width: 48, height: 36 } }],
      { format: 'jpeg' }
    )
  })
})
