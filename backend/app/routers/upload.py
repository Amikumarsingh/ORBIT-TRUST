# upload.py — TLE file upload router for ORBIT-TRUST
# Accepts a .txt TLE file and classifies every object inside it.
# Author: ORBIT-TRUST Project Team

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.ml import parse_tle_text

router = APIRouter(prefix='/upload', tags=['Upload'])


@router.post('/tle')
async def upload_tle_file(file: UploadFile = File(...)):
    """
    Accept a UTF-8 encoded .txt file in standard 3-line TLE format,
    classify every object, and return a summary with per-object results.
    """
    if not file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail='Only .txt TLE files are accepted.')

    raw_bytes = await file.read()
    try:
        tle_text = raw_bytes.decode('utf-8')
    except Exception:
        raise HTTPException(status_code=400, detail='File must be UTF-8 encoded text.')

    results = parse_tle_text(tle_text)
    if not results:
        raise HTTPException(status_code=422, detail='No valid TLE entries found in uploaded file.')

    debris_list = [r for r in results if r['label'] == 1]
    sat_list    = [r for r in results if r['label'] == 0]
    return {
        'filename':        file.filename,
        'total':           len(results),
        'debris_count':    len(debris_list),
        'satellite_count': len(sat_list),
        'debris_percent':  round(len(debris_list) / len(results) * 100, 2),
        'objects':         results,
    }
