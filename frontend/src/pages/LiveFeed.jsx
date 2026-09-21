import { useState } from 'react';
import { fetchLive } from '../api';

const SOURCES = ['stations', 'visual', 'starlink', 'cosmos_1408', 'cosmos_2251', 'fengyun_1c', 'iridium_33'];

// Store TLE in sessionStorage then navigate to the target page.
// App.jsx exposes window.__orbitNav = setPage so any child can navigate.
function navWith(page, obj) {
  sessionStorage.setItem('orbit_prefill', JSON.stringify({
    name: obj.name, line1: obj.line1 ?? '', line2: obj.line2 ?? '',
  }));
  window.__orbitNav?.(page);
}

export default function LiveFeed() {
  const [source,  setSource]  = useState('stations');
  const [limit,   setLimit]   = useState(100);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState('all');

  const load = () => {
    setLoading(true); setError(''); setData(null);
    fetchLive(source, limit)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to fetch live data. Is the backend running?'))
      .finally(() => setLoading(false));
  };

  const objects = data?.objects ?? [];
  const shown   = filter === 'debris' ? objects.filter(o => o.label === 1)
                : filter === 'sat'    ? objects.filter(o => o.label === 0)
                : objects;

  return (
    <div>
      <h1 className="page-title">📡 Live TLE Feed</h1>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Data Source</label>
            <select value={source} onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ width: 120, marginBottom: 0 }}>
            <label>Limit</label>
            <input type="number" min={1} max={500} value={limit}
              onChange={e => setLimit(Number(e.target.value))} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? 'Fetching…' : 'Fetch & Classify'}
          </button>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {data && (
        <>
          {/* Summary stats */}
          <div className="card-grid">
            {[
              ['Total in Source',   data.total_fetched,    'var(--accent)'],
              ['Returned',          data.returned,         'var(--text)'],
              ['Debris',            data.debris_count,     'var(--red)'],
              ['Active Satellites', data.satellite_count,  'var(--green)'],
            ].map(([label, val, color]) => (
              <div className="stat-card" key={label}>
                <div className="stat-value" style={{ color }}>{val}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>

          {/* Filter + table */}
          <div className="card">
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {['all', 'debris', 'sat'].map(f => (
                <button key={f}
                  className={`btn ${filter === f ? 'btn-primary' : ''}`}
                  style={filter !== f ? { background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' } : {}}
                  onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f === 'debris' ? '🔴 Debris' : '🟢 Satellites'}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: '0.85rem', alignSelf: 'center' }}>
                Showing {shown.length} objects
              </span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>NORAD ID</th>
                    <th>Type</th>
                    <th>Confidence</th>
                    <th>Alt (km)</th>
                    <th>Vel (km/s)</th>
                    <th>Eccentricity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((o, i) => (
                    <tr key={i}>
                      <td>{o.name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.norad_id}</td>
                      <td>
                        <span className={`badge ${o.label === 1 ? 'badge-debris' : 'badge-sat'}`}>
                          {o.type}
                        </span>
                      </td>
                      <td>{o.confidence}%</td>
                      <td>{o.altitude?.toFixed(1)}</td>
                      <td>{o.velocity_magnitude?.toFixed(3)}</td>
                      <td>{o.eccentricity?.toFixed(6)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-link btn-link-traj"
                            onClick={() => navWith('🔭 Trajectory', o)}
                            title="Predict trajectory for this object">
                            🔭 Trajectory
                          </button>
                          <button className="btn-link btn-link-risk"
                            onClick={() => navWith('Risk Score', o)}
                            title="Get collision risk score for this object">
                            ⚠️ Risk
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
