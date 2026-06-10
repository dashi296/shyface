import { detectAndClassify } from '../detectAndClassify'
import { FACE_SIMILARITY_THRESHOLD as THRESHOLD } from '@/shared/config'

const mockEmbedding = Array(128).fill(0.5)
const mockBox = { x: 0, y: 0, width: 50, height: 50 }
const NOW = '2026-01-01T00:00:00.000Z'

jest.mock('@/shared/native', () => ({
  FaceDetector: { detect: jest.fn() },
  FaceNet: { extractAll: jest.fn() },
}))

jest.mock('@/shared/lib', () => ({
  cosineSimilarity: jest.fn(),
  cropFace: jest.fn().mockResolvedValue('file://cropped.jpg'),
}))

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

describe('detectAndClassify', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('returns empty array when no faces detected', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')
    FaceDetector.detect.mockResolvedValue([])

    const result = await detectAndClassify('file://image.jpg', [])

    expect(result).toEqual([])
    expect(FaceNet.extractAll).not.toHaveBeenCalled()
  })

  it('returns candidate with isMatched=true when similarity exceeds threshold', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')
    const { cosineSimilarity } = require('@/shared/lib')

    FaceDetector.detect.mockResolvedValue([mockBox])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])
    cosineSimilarity.mockReturnValue(0.9)

    const result = await detectAndClassify('file://image.jpg', [makeStoredEmbedding('1', 'p1')])

    expect(result).toHaveLength(1)
    expect(result[0].isMatched).toBe(true)
    expect(result[0].isSelected).toBe(true)
    expect(result[0].box).toEqual(mockBox)
  })

  it('returns candidate with isMatched=false when similarity does not exceed threshold', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')
    const { cosineSimilarity } = require('@/shared/lib')

    FaceDetector.detect.mockResolvedValue([mockBox])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])
    cosineSimilarity.mockReturnValue(0.3)

    const result = await detectAndClassify('file://image.jpg', [makeStoredEmbedding('1', 'p1')])

    expect(result[0].isMatched).toBe(false)
    expect(result[0].isSelected).toBe(false)
  })

  it('isMatched=false when similarity equals threshold exactly (strict >)', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')
    const { cosineSimilarity } = require('@/shared/lib')

    FaceDetector.detect.mockResolvedValue([mockBox])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])
    cosineSimilarity.mockReturnValue(THRESHOLD)

    const result = await detectAndClassify('file://image.jpg', [makeStoredEmbedding('1', 'p1')])

    expect(result[0].isMatched).toBe(false)
  })

  it('throws when FaceNet returns fewer embeddings than detected faces', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')

    FaceDetector.detect.mockResolvedValue([mockBox, { x: 100, y: 0, width: 50, height: 50 }])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])

    await expect(
      detectAndClassify('file://image.jpg', [makeStoredEmbedding('1', 'p1')])
    ).rejects.toThrow('FaceNet embedding count mismatch')
  })

  it('skips corrupt embedding and continues matching', async () => {
    const { FaceDetector, FaceNet } = require('@/shared/native')
    const { cosineSimilarity } = require('@/shared/lib')

    FaceDetector.detect.mockResolvedValue([mockBox])
    FaceNet.extractAll.mockResolvedValue([mockEmbedding])
    cosineSimilarity.mockReturnValue(0.9)

    const corruptRecord = { id: 'bad', person_id: 'p1', embedding: 'INVALID_JSON', source_uri: 'u', created_at: NOW, updated_at: NOW }
    const validRecord = makeStoredEmbedding('good', 'p2')

    const result = await detectAndClassify('file://image.jpg', [corruptRecord, validRecord])

    expect(result[0].isMatched).toBe(true)
  })
})
