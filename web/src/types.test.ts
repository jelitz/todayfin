import { describe, expect, it } from 'vitest';
import { HOME_BLOCKS } from './types';

/**
 * HOME_BLOCKS 구성 고정 — docs/specs/home-two-column/design.md.
 * IndicatorTable.test.tsx는 로컬 픽스처만 쓰므로 실제 상수는 여기서 단언한다.
 */

const allIds = HOME_BLOCKS.flatMap((b) => b.groups.flatMap((g) => g.ids));

describe('HOME_BLOCKS (home-two-column 재편)', () => {
  it('블록 순서가 R1 배치(수급→변동성→국내→해외→환율→국채→원자재)를 따른다', () => {
    expect(HOME_BLOCKS.map((b) => b.title)).toEqual([
      '수급',
      '변동성·리스크',
      '시장 가격·추세 — 국내',
      '시장 가격·추세 — 해외',
      '거시·통화 — 환율·달러인덱스',
      '거시·통화 — 국채',
      '원자재',
    ]);
  });

  it('국채 블록은 미국/한국 소그룹으로 나뉜다', () => {
    const bonds = HOME_BLOCKS.find((b) => b.anchor === 'section-macro-bonds');
    expect(bonds?.groups.map((g) => g.title)).toEqual(['미국 국채', '한국 국채']);
    expect(bonds?.groups[0].ids).toEqual(['ust2y', 'ust10y', 'ust30y']);
    expect(bonds?.groups[1].ids).toEqual(['ktb3y']);
  });

  it('환율 블록은 유로/달러·달러인덱스를 포함한다', () => {
    const fx = HOME_BLOCKS.find((b) => b.anchor === 'section-macro');
    expect(fx?.groups[0].ids).toEqual(['usdkrw', 'usdjpy', 'eurusd', 'dxy']);
  });

  it('앵커 id가 블록마다 고유하다', () => {
    const anchors = HOME_BLOCKS.map((b) => b.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('전체 지표는 21개이고 중복이 없다', () => {
    expect(allIds).toHaveLength(21);
    expect(new Set(allIds).size).toBe(21);
  });
});
