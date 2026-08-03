import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { YoutubeFeed } from '../types'
import { formatDateTimeKST } from '../lib/format'
import './Alsangmoo.css'

const CHANNEL_FALLBACK_URL = 'https://www.youtube.com/@rsangmoo'

export default function Alsangmoo(): JSX.Element {
  const [feed, setFeed] = useState<YoutubeFeed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    // 캐시 버스팅 — GitHub Pages CDN·브라우저 캐시로 새 영상이 가려지는 것 방지
    fetch(`${import.meta.env.BASE_URL}data/youtube.json?_=${Date.now()}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<YoutubeFeed>
      })
      .then((data) => {
        if (!cancelled) {
          setFeed(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const channelUrl = feed?.channel_url ?? CHANNEL_FALLBACK_URL

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
              <a
                key={video.video_id}
                className="alsangmoo-card"
                href={video.watch_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="alsangmoo-thumb-wrap">
                  {video.thumbnail_url ? (
                    <img
                      className="alsangmoo-thumb"
                      src={video.thumbnail_url}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <div className="alsangmoo-thumb-placeholder" aria-hidden="true" />
                  )}
                </div>
                <div className="alsangmoo-card-body">
                  <span className="alsangmoo-card-title">{video.title}</span>
                  <span className="alsangmoo-card-date muted">
                    {formatDateTimeKST(video.published_at)}
                  </span>
                </div>
              </a>
            ))}
          </div>
          <p className="alsangmoo-updated muted">
            목록 갱신: {formatDateTimeKST(feed.generated_at)}
          </p>
        </>
      )}

      {feed && feed.videos.length === 0 && (
        <p className="alsangmoo-status muted">표시할 영상이 없습니다.</p>
      )}
    </div>
  )
}
