"""수집 오케스트레이션 — 프로필 분기, 검증, 원자적 교체, meta/summary 생성.

사용:
    python collect.py --profile {preopen|afterclose|all} [--backfill-years 5] [--data-dir ../data]
    python collect.py --profile all --backfill-days 90   # Stage 2 파이프라인 검증용 축소 백필

동작 개요는 docs/specs/dashboard-mvp/design.md "수집 시퀀스" 참조.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone

import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from indicators import INDICATORS, PROFILES  # noqa: E402
import validate as validators  # noqa: E402

_RETRIES = 2
_RETRY_DELAYS = [5, 15]
_REVISION_LOOKBACK_DAYS = 7  # 최근 5영업일 재수집(잠정→확정 반영) 목적, 주말 포함 여유
_STALE_BUSINESS_DAYS = 3


def _ensure_dir(path: str) -> str:
    d = os.path.abspath(path)
    os.makedirs(d, exist_ok=True)
    return d


def _staging_dir() -> str:
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".staging")
    os.makedirs(d, exist_ok=True)
    return d


def _load_existing(data_dir: str, indicator_id: str) -> dict | None:
    path = os.path.join(data_dir, f"{indicator_id}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _record_columns(spec: dict) -> list[str]:
    if spec["type"] == "ohlcv":
        return ["date", "open", "high", "low", "close", "volume"]
    if spec["type"] == "flows":
        return ["date", *spec["columns"]]
    return ["date", "value"]


def _series_to_df(spec: dict, existing: dict) -> pd.DataFrame:
    return pd.DataFrame(existing["series"], columns=_record_columns(spec))


def _df_to_series(spec: dict, df: pd.DataFrame) -> list:
    return df[_record_columns(spec)].values.tolist()


def _fetch_with_retry(module, indicator_id: str, start: date, end: date) -> pd.DataFrame:
    last_err: Exception | None = None
    for attempt in range(_RETRIES + 1):
        try:
            return module.fetch(indicator_id, start, end)
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < _RETRIES:
                time.sleep(_RETRY_DELAYS[attempt])
    assert last_err is not None
    raise last_err


def _result(indicator_id: str, status: str, existing: dict | None, note: str) -> dict:
    return {
        "id": indicator_id,
        "status": status,
        "observed_last": (existing or {}).get("observed_last"),
        "note": note,
    }


def collect_one(
    indicator_id: str, data_dir: str, backfill_years: int, backfill_days: int | None
) -> dict:
    spec = INDICATORS[indicator_id]
    existing = _load_existing(data_dir, indicator_id)
    today = date.today()
    backfill_start = (
        today - timedelta(days=backfill_days)
        if backfill_days is not None
        else today - timedelta(days=365 * backfill_years)
    )

    if existing and existing.get("series"):
        last_date = date.fromisoformat(existing["series"][-1][0])
        start = max(last_date - timedelta(days=_REVISION_LOOKBACK_DAYS), backfill_start)
    else:
        start = backfill_start
    end = today

    used_fallback = False
    try:
        new_df = _fetch_with_retry(spec["module"], indicator_id, start, end)
        warnings = validators.validate(spec["type"], new_df, spec.get("columns"))
    except Exception as e:  # noqa: BLE001
        fallback = spec.get("fallback_module")
        if fallback is None:
            return _result(indicator_id, "failed", existing, str(e))
        try:
            new_df = _fetch_with_retry(fallback, indicator_id, start, end)
            warnings = validators.validate(spec["type"], new_df, spec.get("columns"))
            used_fallback = True
        except Exception as e2:  # noqa: BLE001
            return _result(indicator_id, "failed", existing, f"1차 실패({e}) / 폴백 실패({e2})")

    if existing and existing.get("series"):
        old_df = _series_to_df(spec, existing)
        merged = pd.concat([old_df[old_df["date"] < new_df["date"].min()], new_df], ignore_index=True)
    else:
        merged = new_df
    merged = merged.drop_duplicates(subset="date").sort_values("date").reset_index(drop=True)

    record = {
        "id": indicator_id,
        "name": spec["name"],
        "type": spec["type"],
        "unit": spec["unit"],
        "source": spec["fallback_source_label"] if used_fallback else spec["source_label"],
        "instrument": spec["instrument"],
        "timezone": "Asia/Seoul",
        "frequency": "daily",
        "observed_last": merged["date"].iloc[-1],
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }
    if spec["type"] == "flows":
        record["columns"] = spec["columns"]
    record["series"] = _df_to_series(spec, merged)

    staging_path = os.path.join(_staging_dir(), f"{indicator_id}.json")
    with open(staging_path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, separators=(",", ":"))
    final_path = os.path.join(data_dir, f"{indicator_id}.json")
    os.replace(staging_path, final_path)  # 원자적 교체

    status = "ok_fallback" if used_fallback else ("ok_with_warnings" if warnings else "ok")
    return _result(indicator_id, status, {"observed_last": record["observed_last"]}, "; ".join(warnings))


def _business_days_between(d: date, today: date) -> int:
    return sum(1 for n in range(1, (today - d).days + 1) if (d + timedelta(days=n)).weekday() < 5)


def _is_stale(observed_last: str | None, today: date) -> bool:
    if not observed_last:
        return True
    return _business_days_between(date.fromisoformat(observed_last), today) > _STALE_BUSINESS_DAYS


def _headline_index(spec: dict) -> int:
    """카드에 표시할 대표값의 행 내 컬럼 인덱스.

    ohlcv → close (volume 아님), flows → foreign(외국인, 알상무 기준 핵심 계열),
    line → value. 컬럼 순서에 의존하지 않도록 이름으로 찾는다.
    """
    cols = _record_columns(spec)
    if spec["type"] == "ohlcv":
        return cols.index("close")
    if spec["type"] == "flows":
        return cols.index("foreign")
    return cols.index("value")


def build_summary(data_dir: str) -> dict:
    out = []
    today = date.today()
    for indicator_id, spec in INDICATORS.items():
        path = os.path.join(data_dir, f"{indicator_id}.json")
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            rec = json.load(f)
        series = rec["series"]
        if not series:
            continue
        cutoff = (today - timedelta(days=95)).isoformat()
        spark_series = [row for row in series if row[0] >= cutoff] or series[-60:]
        idx = _headline_index(spec)

        latest = series[-1][idx]
        prev = series[-2][idx] if len(series) >= 2 else None
        change_pct = (
            round((latest - prev) / prev * 100, 2) if prev not in (None, 0) else None
        )
        out.append(
            {
                "id": indicator_id,
                "name": rec["name"],
                "unit": rec["unit"],
                "type": rec["type"],
                "latest": latest,
                "prev": prev,
                "change_pct": change_pct,
                "observed_last": rec.get("observed_last"),
                "stale": _is_stale(rec.get("observed_last"), today),
                "spark": [row[idx] for row in spark_series],
            }
        )
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "indicators": out}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=["preopen", "afterclose", "all"], default="all")
    parser.add_argument("--backfill-years", type=int, default=5)
    parser.add_argument(
        "--backfill-days", type=int, default=None, help="테스트용 — 지정 시 backfill-years 대신 사용"
    )
    parser.add_argument(
        "--data-dir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    )
    args = parser.parse_args()

    data_dir = _ensure_dir(args.data_dir)
    ids = PROFILES[args.profile]
    print(f"수집 시작: profile={args.profile} indicators={ids}")

    results = []
    for indicator_id in ids:
        print(f"- {indicator_id} ...", end=" ", flush=True)
        r = collect_one(indicator_id, data_dir, args.backfill_years, args.backfill_days)
        print(r["status"], r["note"] or "")
        results.append(r)

    summary = build_summary(data_dir)
    with open(os.path.join(data_dir, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, separators=(",", ":"))

    meta_path = os.path.join(data_dir, "meta.json")
    meta: dict = {"runs": []}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:  # noqa: BLE001
            meta = {"runs": []}
    meta["runs"] = (
        [
            {
                "profile": args.profile,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "results": {r["id"]: r["status"] for r in results},
            }
        ]
        + meta.get("runs", [])
    )[:10]
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    stale_today = [i["id"] for i in summary["indicators"] if i["stale"] and i["id"] in ids]
    failed = [r["id"] for r in results if r["status"] == "failed"]
    if failed:
        print(f"\n실패 지표: {failed}")
    if stale_today:
        print(f"경고(3영업일+ stale, 워크플로우 실패로 승격): {stale_today}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
