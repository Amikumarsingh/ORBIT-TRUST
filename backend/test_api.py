import requests
import json

BASE = 'http://localhost:8000'

def test(label, method, url, **kwargs):
    try:
        r = getattr(requests, method)(url, timeout=30, **kwargs)
        print(f'\n{"="*55}')
        print(f'TEST : {label}')
        print(f'STATUS: {r.status_code}')
        data = r.json()
        summary = {k: v for k, v in data.items() if k != 'objects'}
        print(json.dumps(summary, indent=2))
    except Exception as e:
        print(f'FAILED: {label} -> {e}')

test('Health Check',  'get', f'{BASE}/stats/health')
test('Model Info',    'get', f'{BASE}/stats/model')
test('Live Sources',  'get', f'{BASE}/live/sources')

test('Predict Single - ISS', 'post', f'{BASE}/predict/single', json={
    'name':  'ISS (ZARYA)',
    'line1': '1 25544U 98067A   24321.65912821  .00009845  00000+0  42102-3 0  9997',
    'line2': '2 25544  28.4697  41.2857 0001752 252.6034 107.4367 15.21129706700501',
})

test('Predict Bulk', 'post', f'{BASE}/predict/bulk', json={'tle_text': """ISS (ZARYA)
1 25544U 98067A   24321.65912821  .00009845  00000+0  42102-3 0  9997
2 25544  28.4697  41.2857 0001752 252.6034 107.4367 15.21129706700501
COSMOS 1408 DEB
1 49271U 71015CE  24321.50000000  .00001000  00000+0  10000-3 0  9999
2 49271  82.5000  45.0000 0050000 100.0000 260.0000 14.80000000000001"""})

test('Live Fetch Stations (limit=5)', 'get', f'{BASE}/live/fetch?source=stations&limit=5')

with open('../data/iridium-33-debris.txt', 'rb') as f:
    test('Upload TLE File', 'post', f'{BASE}/upload/tle',
         files={'file': ('iridium-33-debris.txt', f, 'text/plain')})

print(f'\n{"="*55}')
print('ALL TESTS DONE')
print(f'Swagger UI  -> {BASE}/docs')
print(f'ReDoc       -> {BASE}/redoc')
