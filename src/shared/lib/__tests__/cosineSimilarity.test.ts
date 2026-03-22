/**
 * @jest-environment node
 */
import { cosineSimilarity } from '../cosineSimilarity'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('is symmetric', () => {
    const a = [1, 2, 3]
    const b = [4, 5, 6]
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a))
  })

  it('returns 0 when one vector is zero', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0)
  })

  it('returns 0 when both vectors are zero', () => {
    expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0)
  })

  it('throws for mismatched lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow()
  })

  it('throws for empty vectors', () => {
    expect(() => cosineSimilarity([], [])).toThrow()
  })

  it('handles 128-dimensional FaceNet embeddings', () => {
    const a = Array.from({ length: 128 }, (_, i) => i * 0.01)
    const b = Array.from({ length: 128 }, (_, i) => i * 0.02)
    const result = cosineSimilarity(a, b)
    expect(result).toBeCloseTo(1, 5)
  })
})
