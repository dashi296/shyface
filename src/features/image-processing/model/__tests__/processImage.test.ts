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

  it('returns original uri immediately when no faces are detected', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')

    FaceDetector.detect.mockResolvedValue([])

    const result = await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])

    expect(result).toBe('file://original.jpg')
    expect(FaceNet.extractAll).not.toHaveBeenCalled()
  })

  it('propagates error when Mosaic.apply fails', async () => {
    const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
    const { cosineSimilarity } = require('@/shared/lib')

    FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])
    cosineSimilarity.mockReturnValue(0.95)
    Mosaic.apply.mockRejectedValueOnce(new Error('mosaic error'))

    await expect(
      processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])
    ).rejects.toThrow('mosaic error')
  })

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

    it('blurs face when matched person is among multiple registered persons', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])

      // p1: 低一致(0.3)、p2: 高一致(0.9) → p2 が一致するのでモザイク対象
      cosineSimilarity
        .mockReturnValueOnce(0.3)  // face vs p1
        .mockReturnValueOnce(0.9)  // face vs p2

      await processImage('file://original.jpg', [
        makeStoredEmbedding('1', 'p1'),
        makeStoredEmbedding('2', 'p2'),
      ])

      expect(Mosaic.apply).toHaveBeenCalled()
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
  })

  describe('preloadedEmbeddings', () => {
    it('calls getAllEmbeddings when preloadedEmbeddings is not provided', async () => {
      const { FaceDetector, FaceNet } = require('@/shared/native')
      const { getAllEmbeddings } = require('@/shared/db')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      getAllEmbeddings.mockResolvedValue([makeStoredEmbedding('1', 'p1')])
      cosineSimilarity.mockReturnValue(0.3)

      await processImage('file://original.jpg') // 第2引数なし

      expect(getAllEmbeddings).toHaveBeenCalledTimes(1)
    })

    it('uses preloaded embeddings for matching without calling DB', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { getAllEmbeddings } = require('@/shared/db')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.95) // 一致 → モザイク適用

      await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])

      expect(getAllEmbeddings).not.toHaveBeenCalled()
      expect(Mosaic.apply).toHaveBeenCalled() // preloadedEmbeddings が実際に照合に使われた証拠
    })
  })

  describe('robustness', () => {
    it('throws when FaceNet returns fewer embeddings than detected faces', async () => {
      const { FaceDetector, FaceNet } = require('@/shared/native')

      // 2つの顔が検出されたが FaceNet が1つしか embedding を返さない
      FaceDetector.detect.mockResolvedValue([
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 100, y: 0, width: 50, height: 50 },
      ])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding]) // 2顔に対して1件のみ

      // embedding 数不一致はサイレントスキップではなく明示的エラーにする（プライバシー保護）
      await expect(
        processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])
      ).rejects.toThrow('FaceNet embedding count mismatch')
    })

    it('skips corrupt embedding records and continues matching', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.95) // 有効なレコードは一致

      const corruptRecord = { id: 'bad', person_id: 'p1', embedding: 'INVALID_JSON', source_uri: 'u', created_at: '', updated_at: '' }
      const validRecord = makeStoredEmbedding('good', 'p2')

      // corrupt レコードはスキップ、valid レコードで照合が成功する
      await processImage('file://original.jpg', [corruptRecord, validRecord])

      expect(Mosaic.apply).toHaveBeenCalled()
    })
  })
})
