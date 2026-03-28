import { processImage } from '../processImage'
import { FACE_SIMILARITY_THRESHOLD as THRESHOLD } from '@/shared/config'
import { insertPerson, insertEmbedding } from '@/shared/db'
import * as dbModule from '@/shared/db'

jest.mock('@/shared/db', () => ({ __esModule: true, ...jest.requireActual('@/shared/db') }))

const mockEmbedding = Array(128).fill(0.5)

jest.mock('@/shared/native', () => ({
  FaceDetector: { detect: jest.fn() },
  FaceNet: { extractAll: jest.fn() },
  Mosaic: { apply: jest.fn().mockResolvedValue('file://blurred.jpg') },
}))

jest.mock('@/shared/lib', () => ({
  cosineSimilarity: jest.fn(),
  cropFace: jest.fn().mockImplementation((_uri, _box) => Promise.resolve('file://cropped.jpg')),
  resizeForMosaic: jest.fn().mockResolvedValue({ uri: 'file://resized.jpg', scale: 1 }),
}))

const NOW = '2026-01-01T00:00:00.000Z'

function makeStoredEmbedding(id: string, personId: string) {
  return {
    id,
    person_id: personId,
    embedding: JSON.stringify(mockEmbedding),
    source_uri: 'u',
    created_at: NOW,
    updated_at: NOW,
  }
}

async function seedEmbedding(id: string, personId: string) {
  await insertPerson({ id: personId, name: 'Test', memo: null, created_at: NOW, updated_at: NOW })
  await insertEmbedding(makeStoredEmbedding(id, personId))
}

describe('processImage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

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

  describe('top-K average matching semantics', () => {
    it('blurs face when top-K average score exceeds threshold', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])

      // 1人につき2枚登録: 上位2件の平均 = (0.9 + 0.8) / 2 = 0.85 > THRESHOLD → モザイク対象
      cosineSimilarity.mockReturnValueOnce(0.9).mockReturnValueOnce(0.8)

      await processImage('file://original.jpg', [
        makeStoredEmbedding('1', 'p1'),
        makeStoredEmbedding('2', 'p1'),
      ])

      expect(Mosaic.apply).toHaveBeenCalled()
    })

    it('does not blur face when single high match is averaged down by low match', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])

      // 1人につき2枚登録: 上位2件の平均 = (0.9 + 0.3) / 2 = 0.6 < THRESHOLD → モザイク対象外
      // any-match では一致になっていたが、外れ値に強い平均方式では非一致
      cosineSimilarity.mockReturnValueOnce(0.9).mockReturnValueOnce(0.3)

      const result = await processImage('file://original.jpg', [
        makeStoredEmbedding('1', 'p1'),
        makeStoredEmbedding('2', 'p1'),
      ])

      expect(Mosaic.apply).not.toHaveBeenCalled()
      expect(result).toBe('file://original.jpg')
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
      await seedEmbedding('1', 'p1')
      const { FaceDetector, FaceNet } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')
      const getAllEmbeddingsSpy = jest.spyOn(dbModule, 'getAllEmbeddings')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.3)

      await processImage('file://original.jpg') // 第2引数なし

      expect(getAllEmbeddingsSpy).toHaveBeenCalledTimes(1)
    })

    it('uses preloaded embeddings for matching without calling DB', async () => {
      const { FaceDetector, FaceNet, Mosaic } = require('@/shared/native')
      const { cosineSimilarity } = require('@/shared/lib')
      const getAllEmbeddingsSpy = jest.spyOn(dbModule, 'getAllEmbeddings')

      FaceDetector.detect.mockResolvedValue([{ x: 0, y: 0, width: 50, height: 50 }])
      FaceNet.extractAll.mockResolvedValue([mockEmbedding])
      cosineSimilarity.mockReturnValue(0.95) // 一致 → モザイク適用

      await processImage('file://original.jpg', [makeStoredEmbedding('1', 'p1')])

      expect(getAllEmbeddingsSpy).not.toHaveBeenCalled()
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
