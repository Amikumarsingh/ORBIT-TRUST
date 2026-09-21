import { useEffect, useState } from 'react';
import Plot from '../PlotlyChart';
import { fetchHealth, fetchModelStats, fetchLive } from '../api';

export default function Dashboard() {
  const [health,      setHealth]      = useState(null);
  const [model,       setModel]       = useState(null);
  const [objects,     setObjects]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [plotLoading, setPlotLoading] = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => {
    Promise.all([fetchHealth(), fetchModelStats()])
      .then(([h, m]) => { setHealth(h.data); setModel(m.data); })
      .catch(() => setError('Could not reach backend at 127.0.0.1:8001. Is the server running?'))
      .finally(() => setLoading(false));

    fetchLive('stations', 200)
      .then(l => setObjects(l.data.objects || []))
      .catch(() => setObjects([]))
      .finally(() => setPlotLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading dashboard…</p>;
  if (error)   return <p className="error-msg">{error}</p>;

  const debris = objects.filter(o => o.label === 1);
  const sats   = objects.filter(o => o.label === 0);

  const trace = (arr, name, color) => ({
    type: 'scatter3d', mode: 'markers', name,
    x: arr.map(o => o.x), y: arr.map(o => o.y), z: arr.map(o => o.z),
    marker: { size: 2.5, color, opacity: 0.8 },
    text: arr.map(o => `${o.name}<br>Alt: ${o.altitude?.toFixed(0)} km`),
    hoverinfo: 'text',
  });

  const layout = {
    paper_bgcolor: '#0d1117', plot_bgcolor: '#0d1117',
    scene: {
      bgcolor: '#0d1117',
      xaxis: { gridcolor: '#21262d', color: '#8b949e', title: 'X (km)' },
      yaxis: { gridcolor: '#21262d', color: '#8b949e', title: 'Y (km)' },
      zaxis: { gridcolor: '#21262d', color: '#8b949e', title: 'Z (km)' },
    },
    legend: { font: { color: '#c9d1d9' }, bgcolor: '#161b22' },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    height: 480,
  };

  return (
    <div>
      <h1 className="page-title">🛰 Mission Dashboard</h1>

      {/* Quick-nav pipeline links */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          ['📡 Live Feed',       'Live Feed'],
          ['🔭 Trajectory',     '🔭 Trajectory'],
          ['⚠️ Risk Score',      'Risk Score'],
          ['📂 Upload TLE',     'Upload TLE'],
        ].map(([label, page]) => (
          <button key={page} className="btn btn-traj"
            style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            onClick={() => window.__orbitNav?.(page)}>
            {label}
          </button>
        ))}
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-value">
            <span className={`health-dot ${health?.status === 'ok' ? 'dot-ok' : 'dot-err'}`} />
            {health?.status === 'ok' ? 'Online' : 'Offline'}
          </div>
          <div className="stat-label">API Status</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{model?.accuracy ? (model.accuracy * 100).toFixed(2) + '%' : '—'}</div>
          <div className="stat-label">Model Accuracy</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{model?.training_objects?.toLocaleString() ?? '—'}</div>
          <div className="stat-label">Training Objects</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--red)' }}>{debris.length}</div>
          <div className="stat-label">Debris (live)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--green)' }}>{sats.length}</div>
          <div className="stat-label">Active Sats (live)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{model?.n_estimators ?? '—'}</div>
          <div className="stat-label">RF Trees</div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">3D Orbital Map — Live Objects</div>
        {plotLoading ? (
          <p className="loading">Fetching live orbital data from CelesTrak…</p>
        ) : objects.length === 0 ? (
          <p className="error-msg">⚠ CelesTrak live feed unavailable. Try the Live Feed page to retry.</p>
        ) : (
          <div className="plot-wrap">
            <Plot
              data={[trace(sats, 'Active Satellites', '#3fb950'), trace(debris, 'Debris', '#f85149')]}
              layout={layout}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>

      {model?.top_8_features && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="section-title">Top Feature Importances</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Feature</th><th>Importance</th><th>Bar</th></tr></thead>
              <tbody>
                {Object.entries(model.top_8_features).map(([feat, val]) => (
                  <tr key={feat}>
                    <td>{feat}</td>
                    <td>{(val * 100).toFixed(3)}%</td>
                    <td>
                      <div style={{
                        height: 8, borderRadius: 4,
                        background: 'var(--accent)',
                        width: `${Math.min(val * 500, 100)}%`,
                        minWidth: 4,
                      }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
