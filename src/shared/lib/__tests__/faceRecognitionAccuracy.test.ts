/**
 * @jest-environment node
 *
 * FaceNet embedding 精度レポート。
 * __fixtures__/face_embeddings.json から事前計算済み embedding を読み込み、
 * FAR / FRR / 正解率を計測して console.table で出力する。
 *
 * fixture の再生成: scripts/README.md を参照
 */

import path from 'path'
import fs from 'fs'
import { cosineSimilarity } from '../cosineSimilarity'
import { FACE_SIMILARITY_THRESHOLD } from '../../config/constants'

type EmbeddingPair = { a: number[]; b: number[] }

type Fixture = {
  _meta: {
    scope: string
    dataset: string
    model: string
    generated_at: string
    note: string
    n_same_pairs: number
    n_diff_pairs: number
  }
  same_pairs: EmbeddingPair[]
  diff_pairs: EmbeddingPair[]
}

const FIXTURE_PATH = path.resolve(__dirname, '../../../../__fixtures__/face_embeddings.json')

function loadFixture(): Fixture {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(
      `Fixture not found: ${FIXTURE_PATH}\n` +
        'Run: python scripts/gen_face_fixtures.py --lfw-root <path>',
    )
  }
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) as Fixture
}

describe('FaceNet embedding accuracy', () => {
  let fixture: Fixture

  beforeAll(() => {
    fixture = loadFixture()
  })

  it('outputs FAR / FRR / accuracy report', () => {
    const { same_pairs, diff_pairs, _meta } = fixture
    const threshold = FACE_SIMILARITY_THRESHOLD

    const sameSims = same_pairs.map((p) => cosineSimilarity(p.a, p.b))
    const diffSims = diff_pairs.map((p) => cosineSimilarity(p.a, p.b))

    // FAR: 別人を同一人物と誤判定する率
    const falseAccepts = diffSims.filter((s) => s > threshold).length
    const far = falseAccepts / diffSims.length

    // FRR: 同一人物を別人と誤判定する率
    const falseRejects = sameSims.filter((s) => s <= threshold).length
    const frr = falseRejects / sameSims.length

    // 正解率
    const accuracy = 1 - (falseAccepts + falseRejects) / (diffSims.length + sameSims.length)

    const avgSameSim = sameSims.reduce((a, b) => a + b, 0) / sameSims.length
    const avgDiffSim = diffSims.reduce((a, b) => a + b, 0) / diffSims.length

    const pct = (v: number) => `${(v * 100).toFixed(1)}%`
    const fmt = (v: number) => v.toFixed(4)

    console.log(`\n顔認識精度レポート（FaceNet / dataset: ${_meta.dataset}）`)
    console.log(`threshold = ${threshold}  |  same_pairs = ${same_pairs.length}  |  diff_pairs = ${diff_pairs.length}`)
    console.table({
      '正解率 (Acc)':     { 値: pct(accuracy) },
      'FAR (他人→本人)':  { 値: pct(far) },
      'FRR (本人→他人)':  { 値: pct(frr) },
      '同一人物 avg sim': { 値: fmt(avgSameSim) },
      '別人 avg sim':     { 値: fmt(avgDiffSim) },
    })

    if (_meta.dataset.startsWith('synthetic')) {
      console.warn(
        '\n⚠ Placeholder fixture (synthetic embeddings). ' +
          'Run gen_face_fixtures.py with real LFW data for meaningful results.',
      )
    }

    // 現時点は合格基準なし（計測できる状態を作ることが目標）
    expect(sameSims).toHaveLength(same_pairs.length)
    expect(diffSims).toHaveLength(diff_pairs.length)
  })
})
