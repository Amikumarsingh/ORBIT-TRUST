import { useState, useEffect } from 'react';
import Plot from '../PlotlyChart';
import { getTrajectory } from '../api';

const SAMPLE = {
  name:  'ISS (ZARYA)',
  line1: '1 25544U 98067A   24321.65912821  .00009845  00000+0  42102-3 0  9997',
  line2: '2 25544  28.4697  41.2857 0001752 252.6034 107.4367 15.21129706700501',
};

const H_COLOR = { 1: '#58a6ff', 6: '#a371f7', 12: '#e3b341', 24: '#f85149' };

function navWith(page, form) {
  sessionStorage.setItem('orbit_prefill', JSON.stringify({
    name: form.name, line1: form.line1, line2: form.line2,
  }));
  window.__orbitNav?.(page);
}

export default function Trajectory() {
  const [form,    setForm]    = useState({ name: '', line1: '', line2: '' });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Read pre-fill from sessionStorage (set by LiveFeed or RiskScore)
  useEffect(() => {
    const raw = sessionStorage.getItem('orbit_prefill');
    if (raw) {
      try { setForm(JSON.parse(raw)); } catch (_) {}
      sessionStorage.removeItem('orbit_prefill');
    }
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.line1 || !form.line2) return;
    setLoading(true); setError(''); setResult(null);
    getTrajectory(form.line1, form.line2, form.name || 'OBJECT')
      .then(r => setResult(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Trajectory prediction failed.'))
      .finally(() => setLoading(false));
  };

  // ── Build Plotly 3-D arc ────────────────────────────────────────────────────
  const buildPlot = (data) => {
    const cur = data.current;

    const currentTrace = {
      type: 'scatter3d', mode: 'markers',
      name: 'Now (t = 0)',
      x: [cur.x_km], y: [cur.y_km], z: [cur.z_km],
      marker: { size: 8, color: '#00e676', symbol: 'diamond' },
      text: [`${data.name}<br>Alt: ${cur.altitude_km} km`],
      hoverinfo: 'text',
    };

    const horizonTraces = data.horizons.map(h => ({
      type: 'scatter3d', mode: 'markers+text',
      name: `t + ${h.horizon_hours} h`,
      x: [h.x_km], y: [h.y_km], z: [h.z_km],
      marker: { size: 6, color: H_COLOR[h.horizon_hours] },
      text: [`+${h.horizon_hours}h  ${h.altitude_km} km`],
      textposition: 'top center',
      textfont: { size: 9, color: H_COLOR[h.horizon_hours] },
      hoverinfo: 'text',
    }));

    const xs = [cur.x_km, ...data.horizons.map(h => h.x_km)];
    const ys = [cur.y_km, ...data.horizons.map(h => h.y_km)];
    const zs = [cur.z_km, ...data.horizons.map(h => h.z_km)];
    const arcTrace = {
      type: 'scatter3d', mode: 'lines',
      name: 'Predicted arc',
      x: xs, y: ys, z: zs,
      line: { color: '#58a6ff', width: 3, dash: 'dot' },
      hoverinfo: 'skip',
    };

    // Approximate Earth sphere
    const phi   = Array.from({ length: 25 }, (_, i) => (i / 24) * Math.PI);
    const theta = Array.from({ length: 25 }, (_, i) => (i / 24) * 2 * Math.PI);
    const ex = [], ey = [], ez = [];
    phi.forEach(p => theta.forEach(t => {
      ex.push(6371 * Math.sin(p) * Math.cos(t));
      ey.push(6371 * Math.sin(p) * Math.sin(t));
      ez.push(6371 * Math.cos(p));
    }));
    const earthTrace = {
      type: 'scatter3d', mode: 'markers', name: 'Earth',
      x: ex, y: ey, z: ez,
      marker: { size: 1.2, color: '#1a3a6a', opacity: 0.25 },
      hoverinfo: 'skip',
    };

    const layout = {
      paper_bgcolor: '#0d1117',
      scene: {
        bgcolor: '#0d1117',
        xaxis: { gridcolor: '#21262d', color: '#8b949e', title: 'X (km)' },
        yaxis: { gridcolor: '#21262d', color: '#8b949e', title: 'Y (km)' },
        zaxis: { gridcolor: '#21262d', color: '#8b949e', title: 'Z (km)' },
      },
      legend: { font: { color: '#c9d1d9' }, bgcolor: '#161b22' },
      margin: { l: 0, r: 0, t: 0, b: 0 },
      height: 460,
    };

    return { traces: [earthTrace, arcTrace, currentTrace, ...horizonTraces], layout };
  };

  return (
    <div>
      <h1 className="page-title">🔭 Trajectory Prediction</h1>

      {/* Pipeline badge */}
      <div className="pipeline-badge" style={{ marginBottom: 20 }}>
        <span style={{ color: '#7b2fff', fontWeight: 700 }}>⚙ ORBIT-TRUST Pipeline</span>
        &nbsp;·&nbsp; SGP4 propagation &nbsp;·&nbsp; RIC error frame &nbsp;·&nbsp; 1 h / 6 h / 12 h / 24 h horizons
      </div>

      {/* Input card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Enter TLE</div>
          <button className="btn btn-purple" onClick={() => setForm(SAMPLE)}>Load ISS Sample</button>
        </div>
        <div className="form-group">
          <label>Object Name (optional)</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. ISS (ZARYA)" />
        </div>
        <div className="form-group">
          <label>TLE Line 1</label>
          <input value={form.line1} onChange={e => set('line1', e.target.value)}
            placeholder="1 NNNNNX XXXXXXXX ..." style={{ fontFamily: 'monospace' }} />
        </div>
        <div className="form-group">
          <label>TLE Line 2</label>
          <input value={form.line2} onChange={e => set('line2', e.target.value)}
            placeholder="2 NNNNN XXX.XXXX ..." style={{ fontFamily: 'monospace' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={submit}
            disabled={loading || !form.line1 || !form.line2}>
            {loading ? 'Predicting…' : 'Predict Trajectory'}
          </button>
          {form.line1 && form.line2 && (
            <button className="btn btn-traj" onClick={() => navWith('Risk Score', form)}>
              ⚠️ Get Risk Score
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {result && (() => {
        const { traces, layout } = buildPlot(result);
        return (
          <>
            {/* Object header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{result.name}</span>
              <span className={`badge ${result.classification === 'DEBRIS' ? 'badge-debris' : 'badge-sat'}`}>
                {result.classification}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                NORAD {result.norad_id} &nbsp;·&nbsp; Debris prob: {result.debris_prob}%
              </span>
              <button className="btn btn-traj" style={{ marginLeft: 'auto' }}
                onClick={() => navWith('Risk Score', form)}>
                ⚠️ Get Risk Score
              </button>
            </div>

            {/* Current state */}
            <div className="card-grid" style={{ marginBottom: 20 }}>
              {[
                ['Current Alt',  `${result.current.altitude_km} km`,    'var(--accent)'],
                ['Velocity',     `${result.current.velocity_km_s} km/s`, 'var(--green)'],
                ['X (ECI)',      `${result.current.x_km} km`,            'var(--muted)'],
                ['Y (ECI)',      `${result.current.y_km} km`,            'var(--muted)'],
                ['Z (ECI)',      `${result.current.z_km} km`,            'var(--muted)'],
              ].map(([label, val, color]) => (
                <div className="stat-card" key={label}>
                  <div className="stat-value" style={{ fontSize: '1.1rem', color }}>{val}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>

            {/* 3-D plot */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title">Predicted Orbital Arc — ECI Frame</div>
              <div className="plot-wrap">
                <Plot
                  data={traces}
                  layout={layout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Horizon table */}
            <div className="card">
              <div className="section-title">Horizon Predictions — RIC Error Frame</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 12 }}>
                RIC = Radial / In-track / Cross-track displacement from current position.
                In-track grows fastest and is the primary conjunction risk driver.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Horizon</th>
                      <th>Target Time (UTC)</th>
                      <th>Altitude (km)</th>
                      <th>Dist from Now (km)</th>
                      <th>Radial (km)</th>
                      <th>In-track (km)</th>
                      <th>Cross-track (km)</th>
                      <th>RIC Total (km)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.horizons.map(h => (
                      <tr key={h.horizon_hours}>
                        <td>
                          <span style={{
                            fontWeight: 700, color: H_COLOR[h.horizon_hours],
                            background: `${H_COLOR[h.horizon_hours]}18`,
                            padding: '2px 10px', borderRadius: 10, fontSize: '0.8rem',
                          }}>
                            +{h.horizon_hours}h
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {h.target_time_utc.replace('T', ' ').slice(0, 19)}
                        </td>
                        <td>{h.altitude_km}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{h.distance_from_now_km}</td>
                        <td style={{ color: Math.abs(h.ric.radial_km)    > 50 ? 'var(--red)' : 'var(--text)' }}>{h.ric.radial_km}</td>
                        <td style={{ color: Math.abs(h.ric.intrack_km)   > 50 ? 'var(--red)' : 'var(--text)' }}>{h.ric.intrack_km}</td>
                        <td style={{ color: Math.abs(h.ric.crosstrack_km)> 50 ? 'var(--red)' : 'var(--text)' }}>{h.ric.crosstrack_km}</td>
                        <td style={{ fontWeight: 700, color: h.ric.total_km > 100 ? 'var(--yellow)' : 'var(--green)' }}>
                          {h.ric.total_km}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* RIC explainer */}
              <div className="pipeline-badge" style={{ marginTop: 16 }}>
                <span style={{ color: '#7b2fff', fontWeight: 700 }}>⚙ ORBIT-TRUST RIC Frame: </span>
                Radial = altitude change · In-track = along motion (grows fastest) · Cross-track = inclination drift.
                RIC Total &gt; 100 km at 24 h = high SGP4 uncertainty zone.
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
