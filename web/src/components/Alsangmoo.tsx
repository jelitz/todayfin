import type { JSX } from 'react'
import type { YoutubeFeed, YoutubeVideo } from '../types'
import { formatDateTimeKST } from '../lib/format'
import { usePolledJson } from '../lib/usePolledJson'
import Modal from './Modal'
import './Alsangmoo.css'

const CHANNEL_FALLBACK_URL = 'https://www.youtube.com/@rsangmoo'
/** 새 영상 자동 반영 주기 — 수집 cron(매시 25분)과 별개로, 열어둔 탭에서의 재조회 (R6) */
const FEED_POLL_INTERVAL_MS = 5 * 60 * 1000

function VideoCard({ video }: { video: YoutubeVideo }): JSX.Element {
  // 소유자가 임베드를 꺼둔 영상만 기존처럼 유튜브 새 탭으로 — 깨진 플레이어를 처음부터 안 보여준다(R4)
  const external = video.embeddable === false
  const cardProps = external
    ? { href: video.watch_url, target: '_blank', rel: 'noopener noreferrer' }
    : { href: `#/alsangmoo/v/${video.video_id}` }

  return (
    <a className="alsangmoo-card" {...cardProps}>
      <div className="alsangmoo-thumb-wrap">
        {video.thumbnail_url ? (
          <img className="alsangmoo-thumb" src={video.thumbnail_url} alt="" loading="lazy" />
        ) : (
          <div className="alsangmoo-thumb-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="alsangmoo-card-body">
        <span className="alsangmoo-card-title">
          {video.title}
          {external && (
            <span className="alsangmoo-card-external" aria-label="유튜브에서 열림">
              {' '}
              ↗
            </span>
          )}
        </span>
        <span className="alsangmoo-card-date muted">{formatDateTimeKST(video.published_at)}</span>
      </div>
    </a>
  )
}

function PlayerModal({ videoId, title }: { videoId: string; title: string | null }): JSX.Element {
  return (
    <Modal onClose={() => (window.location.hash = '#/alsangmoo')}>
      <div className="alsangmoo-player">
        {title && <h2 className="alsangmoo-player-title">{title}</h2>}
        <div className="alsangmoo-player-frame">
          <iframe
            className="alsangmoo-player-iframe"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
            title={title ?? '알상무 영상'}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
        {/* 저작권·지역 차단 등 사전 감지 불가능한 재생 실패의 최종 안전망 (R3) */}
        <a
          className="alsangmoo-player-external"
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          유튜브에서 보기 ↗
        </a>
      </div>
    </Modal>
  )
}

export default function Alsangmoo({ videoId }: { videoId: string | null }): JSX.Element {
  const { data: feed, error } = usePolledJson<YoutubeFeed>(
    `${import.meta.env.BASE_URL}data/youtube.json`,
    FEED_POLL_INTERVAL_MS,
  )
  const loading = feed === null && !error

  const channelUrl = feed?.channel_url ?? CHANNEL_FALLBACK_URL
  // 피드(최신 15개 롤링)에서 밀려난 딥링크도 재생은 허용 — 제목만 생략 (R5)
  const currentTitle = feed?.videos.find((v) => v.video_id === videoId)?.title ?? null

  return (
    <div className="alsangmoo">
      <header className="alsangmoo-header">
        <h1 className="alsangmoo-title">알상무</h1>
        <a className="alsangmoo-channel-link" href={channelUrl} target="_blank" rel="noopener noreferrer">
          유튜브 채널 바로가기 ↗
        </a>
      </header>

      {loading && <p className="alsangmoo-status muted">불러오는 중…</p>}

      {error && (
        <div className="alsangmoo-status">
          <p className="alsangmoo-error-text">영상 목록을 불러오지 못했습니다.</p>
          <p className="muted">
            <a href={CHANNEL_FALLBACK_URL} target="_blank" rel="noopener noreferrer">
              유튜브에서 직접 보기 ↗
            </a>
          </p>
        </div>
      )}

      {feed && feed.videos.length > 0 && (
        <>
          <div className="alsangmoo-grid">
            {feed.videos.map((video) => (
              <VideoCard key={video.video_id} video={video} />
            ))}
          </div>
          <p className="alsangmoo-updated muted">목록 갱신: {formatDateTimeKST(feed.generated_at)}</p>
        </>
      )}

      {feed && feed.videos.length === 0 && (
        <p className="alsangmoo-status muted">표시할 영상이 없습니다.</p>
      )}

      {videoId && <PlayerModal videoId={videoId} title={currentTitle} />}
    </div>
  )
}
