# live.py — Live TLE fetch router for ORBIT-TRUST
# Fetches and classifies real-time NASA/NORAD TLE data from CelesTrak.
# Author: ORBIT-TRUST Project Team

import time
import requests
from fastapi import APIRouter, HTTPException, Query
from app.ml import parse_tle_text

router = APIRouter(prefix='/live', tags=['Live Data'])

_REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

TLE_SOURCES = {
    'active':      'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
    'stations':    'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle',
    'visual':      'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle',
    'starlink':    'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
    'cosmos_1408': 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=tle',
    'cosmos_2251': 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle',
    'fengyun_1c':  'https://celestrak.org/NORAD/elements/gp.php?GROUP=fengyun-1c-debris&FORMAT=tle',
    'iridium_33':  'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle',
}

# In-memory cache: { source_key: (fetched_at_timestamp, raw_tle_text) }
_tle_cache: dict = {}
CACHE_TTL_SECONDS = 300  # refresh every 5 minutes


def fetch_tle(source_key: str) -> str:
    """
    Return raw TLE text for the given source, using a 5-minute in-memory cache.
    Falls back to stale cache on CelesTrak 403/503 rather than hard-failing.
    Retries up to 3 times with exponential back-off on transient errors.
    """
    now = time.time()
    cached = _tle_cache.get(source_key)
    if cached and (now - cached[0]) < CACHE_TTL_SECONDS:
        return cached[1]

    url      = TLE_SOURCES[source_key]
    last_err = None

    for attempt in range(3):
        try:
            resp = requests.get(url, timeout=20, headers=_REQUEST_HEADERS)
            if resp.status_code == 403:
                # CelesTrak rate-limit — serve stale cache if available
                if cached:
                    return cached[1]
                time.sleep(2)
                continue
            resp.raise_for_status()
            _tle_cache[source_key] = (now, resp.text)
            return resp.text
        except Exception as exc:
            last_err = exc
            time.sleep(1.5 * (attempt + 1))

    if cached:
        return cached[1]

    raise HTTPException(
        status_code=503,
        detail=f'CelesTrak unavailable for "{source_key}": {last_err}',
    )


@router.get('/sources')
def list_sources():
    """Return the list of available live TLE source keys."""
    return {'available_sources': list(TLE_SOURCES.keys())}


@router.get('/fetch')
def fetch_and_classify(
    source: str = Query('stations'),
    limit:  int  = Query(50, ge=1, le=500),
):
    """Fetch a live CelesTrak source, classify every object, and return up to `limit` results."""
    if source not in TLE_SOURCES:
        raise HTTPException(
            status_code=400,
            detail=f'Unknown source. Valid options: {list(TLE_SOURCES.keys())}',
        )
    raw_text   = fetch_tle(source)
    all_objs   = parse_tle_text(raw_text)
    page       = all_objs[:limit]
    debris_cnt = sum(1 for o in page if o['label'] == 1)
    sat_cnt    = len(page) - debris_cnt
    return {
        'source':          source,
        'total_fetched':   len(all_objs),
        'returned':        len(page),
        'debris_count':    debris_cnt,
        'satellite_count': sat_cnt,
        'objects':         page,
    }


@router.get('/stats')
def live_stats():
    """Return object counts and fetch status for every available source."""
    summary = {}
    for key in TLE_SOURCES:
        try:
            raw   = fetch_tle(key)
            lines = [ln for ln in raw.strip().splitlines() if ln.strip()]
            summary[key] = {'object_count': len(lines) // 3, 'status': 'ok'}
        except Exception:
            summary[key] = {'object_count': 0, 'status': 'error'}
    return summary
