import { describe, expect, it } from 'vitest'
import { parseAnswer } from './parseAnswer'

const cites = (...ids) => ids.map((id) => ({ id }))

describe('parseAnswer', () => {
  it('returns [] for an empty answer', () => {
    expect(parseAnswer('', cites('a'))).toEqual([])
  })

  it('leaves unknown ids as literal text', () => {
    const [paragraph] = parseAnswer('See [zzz] here', cites('a'))
    expect(paragraph.parts).toEqual([
      { type: 'text', key: 0, value: 'See ' },
      { type: 'text', key: 1, value: '[zzz]' },
      { type: 'text', key: 2, value: ' here' },
    ])
  })

  it('preserves text before, between and after markers', () => {
    const [paragraph] = parseAnswer('before [a] middle [b] after', cites('a', 'b'))
    expect(paragraph.parts).toEqual([
      { type: 'text', key: 0, value: 'before ' },
      { type: 'marker', key: 1, number: 1, unitId: 'a' },
      { type: 'text', key: 2, value: ' middle ' },
      { type: 'marker', key: 3, number: 2, unitId: 'b' },
      { type: 'text', key: 4, value: ' after' },
    ])
  })

  it('numbers markers by first appearance, shared across paragraphs', () => {
    const result = parseAnswer('One [b]\n\nTwo [a] and [b]', cites('a', 'b'))
    const markers = result.map((p) => p.parts.filter((x) => x.type === 'marker'))
    expect(markers[0].map((m) => [m.unitId, m.number])).toEqual([['b', 1]])
    expect(markers[1].map((m) => [m.unitId, m.number])).toEqual([
      ['a', 2],
      ['b', 1],
    ])
  })

  it('reuses the number when an id repeats', () => {
    const [paragraph] = parseAnswer('[a] then [a]', cites('a'))
    const numbers = paragraph.parts.filter((x) => x.type === 'marker').map((m) => m.number)
    expect(numbers).toEqual([1, 1])
  })

  it('drops blank paragraphs', () => {
    const result = parseAnswer('first\n\n   \n\nsecond', [])
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.parts[0].value)).toEqual(['first', 'second'])
    expect(result.map((p) => p.key)).toEqual([0, 1])
  })
})
