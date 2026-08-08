import { describe, expect, it } from 'vitest';
import { SECTIONS } from './types';

/**
 * SECTIONS 구성 고정 — docs/specs/global-indicators/design.md §2-1 (R3).
 * IndicatorTable.test.tsx는 로컬 픽스처만 쓰므로 실제 상수는 여기서 단언한다.
 */

function sectionIds(title: string): string[] {
  const section = SECTIONS.find((s) => s.title === title);
  if (!section) return [];
  return section.subsections ? section.subsections.flatMap((sub) => sub.ids) : (section.ids ?? []);
}

describe('SECTIONS (global-indicators 재편)', () => {
  it('시장 가격·추세는 국내/해외 소그룹으로 나뉜다', () => {
    const section = SECTIONS.find((s) => s.title === '시장 가격·추세');
    expect(section?.subsections?.map((sub) => sub.title)).toEqual(['국내', '해외']);
    expect(section?.subsections?.[0].ids).toEqual(['kospi', 'kosdaq', 'samsung', 'skhynix']);
    expect(section?.subsections?.[1].ids).toEqual(['nasdaq', 'sp500', 'dow', 'nikkei']);
  });

  it('거시·통화의 환율 소그룹은 "환율·달러인덱스"로 유로/달러·달러인덱스를 포함한다', () => {
    const macro = SECTIONS.find((s) => s.title === '거시·통화');
    const fx = macro?.subsections?.find((sub) => sub.title === '환율·달러인덱스');
    expect(fx?.ids).toEqual(['usdkrw', 'usdjpy', 'eurusd', 'dxy']);
  });

  it('원자재는 WTI·금 선물 순', () => {
    expect(sectionIds('원자재')).toEqual(['wti', 'gold']);
  });

  it('전체 지표는 21개이고 중복이 없다', () => {
    const all = SECTIONS.flatMap((s) => sectionIds(s.title));
    expect(all).toHaveLength(21);
    expect(new Set(all).size).toBe(21);
  });
});
