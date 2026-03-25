import { processImage } from '../processImage'
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
  resizeForMosaic: jest.fn().mockResolvedValue({ uri: 'file://resized.jpg', scale: 1 }),
}))

const makeStoredEmbedding = (id: string, personId: string) => ({
  id,
  person_id: personId,
  embedding: JSON.stringify(mockEmbedding),
  source_uri: 'u',
  created_at: '',
  updated_at: '',
})

describe('processImage', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('any-match semantics (CLAUDE.md 照合方針)', () => {
    it('blurs face when any single embedding exceeds threshold', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])

      // 1人につき2枚登録: 1枚は高一致(0.9)・1枚は低一致(0.3) → any-match なのでモザイク対象
      // 平均(0.6)は THRESHOLD と等しく、平均判定なら対象外になってしまう
      cosineSimilarity.mockReturnValueOnce(0.9).mockReturnValueOnce(0.3)

      await processImage('file://original.jpg', [
        makeStoredEmbedding('1', 'p1'),
        makeStoredEmbedding('2', 'p1'),
      ])

      expect(Mosaic.apply).toHaveBeenCalled()
    })

    it('does not blur face when no embedding exceeds threshold', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])

      cosineSimilarity.mockReturnValueOnce(0.4).mockReturnValueOnce(0.5)

      const result = await processImage('file://original.jpg', [
        makeStoredEmbedding('1', 'p1'),
        makeStoredEmbedding('2', 'p1'),
      ])

      expect(Mosaic.apply).not.toHaveBeenCalled()
      expect(result).toBe('file://original.jpg')
    })

    it('does not blur when similarity equals threshold exactly (strict >)', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(THRESHOLD)

      const result = await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])

      expect(Mosaic.apply).not.toHaveBeenCalled()
      expect(result).toBe('file://original.jpg')
    })
  })

  describe('bounding box coordinate scaling', () => {
    it('scales box coordinates by resizeForMosaic scale factor before passing to Mosaic.apply', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { cosineSimilarity, resizeForMosaic } = require('@/shared/lib')

      const box = { x: 10, y: 20, width: 50, height: 60 }
      FaceDetector.detect.mockResolvedValue([box])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.95)
      resizeForMosaic.mockResolvedValue({ uri: 'file://resized.jpg', scale: 0.5 })

      await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])

      expect(Mosaic.apply).toHaveBeenCalledWith('file://resized.jpg', [
        { x: 5, y: 10, width: 25, height: 30 },
      ])
    })

    it('passes resized uri (not original) to Mosaic.apply', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { cosineSimilarity, resizeForMosaic } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.95)
      resizeForMosaic.mockResolvedValue({ uri: 'file://resized.jpg', scale: 1 })

      await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])

      expect(Mosaic.apply).toHaveBeenCalledWith('file://resized.jpg', expect.anything())
    })
  })

  describe('preloadedEmbeddings', () => {
    it('uses preloaded embeddings and skips DB call', async () => {
      const { FaceDetector, FaceNet } = require('@/shared/native')
      const { getAllEmbeddings } = require('@/shared/db')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.3)

      await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])

      expect(getAllEmbeddings).not.toHaveBeenCalled()
    })
  })
})
