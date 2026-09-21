import requests
from datetime import datetime

url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle'
r = requests.get(url, timeout=10)
lines = r.text.strip().split('\n')
print('Status:', r.status_code)
print('Total satellites fetched:', len(lines)//3)
print('Fetched at:', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
print('\nFirst satellite:')
print(lines[0].strip())
print(lines[1].strip())
print(lines[2].strip())

# Extract epoch from TLE line 1 (columns 18-32)
epoch_str = lines[1].strip()[18:32].strip()
year = int(epoch_str[:2])
year = 2000 + year if year < 57 else 1900 + year
day = float(epoch_str[2:])
print(f'\nData epoch: Year {year}, Day {day:.4f} (approx {datetime(*[year,1,1]).__class__.__name__} {year})')

# Debris check
url2 = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=tle'
r2 = requests.get(url2, timeout=10)
lines2 = r2.text.strip().split('\n')
print(f'\nCosmos-1408 debris pieces fetched: {len(lines2)//3}')
