import type { JSX } from 'react'
import './About.css'

/**
 * 지표별 설명. types.ts의 HOME_BLOCKS를 재사용하지 않고 별도 상수로 둔다 —
 * 소개 문구의 분류·순서는 대시보드 레이아웃과 독립적으로 바뀔 수 있다(design.md 참조).
 * 지표 이름은 docs/specs/dashboard-mvp/requirements.md R1 표와 일치시킬 것.
 */
const INDICATOR_NOTES: {
  section: string
  items: { name: string; note: string; sourceUrl?: string; sourceLabel?: string }[]
}[] = [
  {
    section: '수급',
    items: [
      {
        name: '주체별 순매수 (코스피 / 코스닥)',
        note: '개인·외국인·기관이 하루에 얼마를 사고팔았는지 보여줍니다. 지수가 오르내린 이유를 "누가 샀는가"로 되짚을 때 먼저 보는 숫자입니다.',
      },
    ],
  },
  {
    section: '시장 가격·추세',
    items: [
      {
        name: '코스피 / 코스닥',
        note: '국내 증시의 전반적인 방향입니다. 캔들과 이동평균선(20·60·120일)으로 단기 흐름이 중기 추세 위에 있는지 아래에 있는지 확인합니다.',
      },
      {
        name: '삼성전자 / SK하이닉스',
        note: '코스피 시가총액 상위 두 종목이자 국내 반도체 업황의 대리 지표입니다. 지수가 이 둘에 크게 좌우되기 때문에 따로 봅니다.',
      },
      {
        name: '나스닥 · S&P 500 · 다우존스',
        note: '미국 증시 3대 지수입니다. 한국 시장은 밤사이 미국 시장의 위험자산 선호를 다음 날 아침에 반영하는 경향이 강해, 장 시작 전 방향을 가늠하는 기준으로 봅니다.',
      },
      {
        name: '니케이 225',
        note: '일본 증시 대표 지수입니다. 엔화·엔캐리 자금 흐름과 함께 움직이며, 한국과 같은 시간대에 열리는 시장이라 아시아 전반의 위험 선호를 실시간으로 보여주는 이웃 지표입니다.',
      },
    ],
  },
  {
    section: '변동성·리스크',
    items: [
      {
        name: 'VKOSPI',
        note: '코스피200 옵션 가격에서 산출한 향후 30일 기대변동성으로, 흔히 "공포지수"라 불립니다. 글로벌 기관은 VaR(Value at Risk) 한도라는 위험예산 안에서 움직이기 때문에, 변동성이 커지면 담을 수 있는 코스피 금액이 기계적으로 줄어 매도가 나옵니다. 외국인 수급을 읽는 보조 렌즈로 봅니다.',
        sourceUrl: 'https://blog.naver.com/ranto28/224371367594',
        sourceLabel: '참고: 메르, "외국인들이 국장을 던지는 비밀 1"',
      },
    ],
  },
  {
    section: '거시·통화',
    items: [
      {
        name: '원/달러 · 달러/엔',
        note: '환율은 외국인 자금의 유출입과 직결됩니다. 원화가 약해지면 외국인 입장에서는 한국 주식의 달러 환산 수익이 줄어듭니다.',
      },
      {
        name: '유로/달러 · 달러인덱스',
        note: '달러의 상대 가치를 보여줍니다. 달러인덱스가 오르면(달러 강세) 신흥국 통화·주식에서 자금이 빠지는 압력이 커져 원화 약세·외국인 매도로 이어지기 쉽습니다. 유로/달러는 달러인덱스 구성의 절반 이상을 차지하는 그 반대편 거울입니다.',
      },
      {
        name: '미국 국채 2년 · 10년 · 30년',
        note: '2년물은 기준금리 기대를, 10년·30년물은 장기 성장·물가 기대를 반영합니다. 만기별 금리 차이(장단기 스프레드)는 경기 국면을 읽는 대표적인 신호입니다.',
      },
      {
        name: '국고채 3년',
        note: '한국의 대표 시장금리입니다. 한국은행 기준금리 변화 기대가 가장 빠르게 반영되는 구간입니다.',
      },
    ],
  },
  {
    section: '원자재',
    items: [
      {
        name: 'WTI',
        note: '국제 유가는 물가와 기업 원가에 동시에 영향을 줍니다. 에너지 수입 비중이 큰 한국 경제에는 특히 민감한 변수입니다.',
      },
      {
        name: '금 선물',
        note: '대표 안전자산입니다. 실질금리가 내리거나 지정학 불안이 커질 때 오르며, 주식·달러와 다른 방향으로 움직이는 경우가 많아 위험 선호의 온도계로 봅니다.',
      },
    ],
  },
]

export default function About(): JSX.Element {
  return (
    <div className="about">
      <h1 className="about-title">소개</h1>

      <section className="about-block">
        <h2 className="about-heading">왜 만들었나</h2>
        <p className="about-text">
          시황에 따라 말이 바뀌는 코멘트 대신, 기관 투자자들이 매일 아침 확인하는 핵심 지표를 스스로
          살펴보며 자신만의 판단 기준을 세울 수 있도록 돕습니다. 종목을 추천하는 곳이 아니라, 데이터를
          매일 루틴하게 확인하는 훈련을 통해 시장을 읽는 감각을 기르는 것이 목표입니다.
        </p>
        <p className="about-text">
          그래서 지표 수를 엄선해 제한했습니다. 더 많은 숫자를 나열하는 대신, 매일 같은 지표를 같은
          자리에서 보며 변화를 체감하는 편이 판단 기준을 만드는 데 유리하다고 봤습니다.
        </p>
      </section>

      <section className="about-block">
        <h2 className="about-heading">지표별 특성</h2>
        {INDICATOR_NOTES.map((group) => (
          <div key={group.section} className="about-group">
            <h3 className="about-group-title">{group.section}</h3>
            <dl className="about-list">
              {group.items.map((item) => (
                <div key={item.name} className="about-item">
                  <dt className="about-item-name">{item.name}</dt>
                  <dd className="about-item-note">
                    {item.note}
                    {item.sourceUrl && (
                      <>
                        {' '}
                        <a
                          className="about-item-source"
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.sourceLabel ?? '출처'} ↗
                        </a>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section className="about-block">
        <h2 className="about-heading">데이터에 대해</h2>
        <p className="about-text">
          모든 수치는 한국거래소(KRX), 한국은행(ECOS), 미국 재무부, Yahoo Finance 등 공개된 출처에서
          자동으로 수집합니다. 코스피·환율·니케이·금처럼 한국 정규장 시간에 거래되는 지표는 장중 30분
          간격으로 갱신되고, 미국 지수는 현지 폐장 후 확정치를 아침에, 국채 금리처럼 하루 한 번
          고시되는 값은 발표 후 반영됩니다. 각 지표 상세 화면에 표시된 기준일이 실제 데이터의
          관측일입니다. 홈 상단의 주요 뉴스는 Google News가 국내 언론사 경제 기사에서 추린
          헤드라인을 매시간 가져와 표시하며, 제목을 클릭하면 해당 언론사 원문으로 이동합니다.
        </p>
      </section>
    </div>
  )
}
