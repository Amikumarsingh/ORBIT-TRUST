import { useState, useEffect } from 'react';
import { getRiskScore } from '../api';

const SAMPLE = {
  name:  'ISS (ZARYA)',
  line1: '1 25544U 98067A   24320.50000000  .00001764  00000-0  40080-4 0  9993',
  line2: '2 25544  51.6416 290.4043 0006703 126.4740 233.6937 15.50377579479891',
};

function navWith(page, form) {
  sessionStorage.setItem('orbit_prefill', JSON.stringify({
    name: form.name, line1: form.line1, line2: form.line2,
  }));
  window.__orbitNav?.(page);
}

export default function RiskScore() {
  const [form,    setForm]    = useState({ name: '', line1: '', line2: '' });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Read pre-fill from sessionStorage (set by LiveFeed or UploadTLE)
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
    getRiskScore(form.line1, form.line2, form.name || 'TARGET SAT')
      .then(r => setResult(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Risk assessment failed.'))
      .finally(() => setLoading(false));
  };

  const riskColor = {
    CRITICAL: 'var(--red)',
    HIGH:     '#ff9800',
    MEDIUM:   'var(--yellow)',
    LOW:      'var(--green)',
  };

  return (
    <div>
      <h1 className="page-title">⚠️ Collision Risk Score</h1>

      {/* Input card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Enter Satellite TLE</div>
          <button className="btn btn-purple" onClick={() => setForm(SAMPLE)}>Load ISS Sample</button>
        </div>
        <div className="form-group">
          <label>Satellite Name (optional)</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. ISS (ZARYA)" />
        </div>
        <div className="form-group">
          <label>TLE Line 1</label>
          <input value={form.line1} onChange={e => set('line1', e.target.value)}
            placeholder="1 NNNNNX XXXXXXXX XXXXXXXX.XXXXXXXX ..." style={{ fontFamily: 'monospace' }} />
        </div>
        <div className="form-group">
          <label>TLE Line 2</label>
          <input value={form.line2} onChange={e => set('line2', e.target.value)}
            placeholder="2 NNNNN XXX.XXXX XXX.XXXX XXXXXXX ..." style={{ fontFamily: 'monospace' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={submit}
            disabled={loading || !form.line1 || !form.line2}>
            {loading ? 'Assessing…' : 'Get Risk Score'}
          </button>
          {form.line1 && form.line2 && (
            <button className="btn btn-traj" onClick={() => navWith('🔭 Trajectory', form)}>
              🔭 Predict Trajectory
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {result && (
        <>
          {/* Risk level banner */}
          <div className="card" style={{
            marginBottom: 20,
            borderColor: riskColor[result.risk_level],
            borderWidth: 2,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
              Risk Assessment for <strong style={{ color: 'var(--text)' }}>{result.satellite}</strong>
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: riskColor[result.risk_level] }}>
              {result.risk_level}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>
              NORAD ID: {result.norad_id}
            </div>
          </div>

          {/* Stat cards */}
          <div className="card-grid">
            {[
              ['Debris Probability', `${result.debris_probability}%`,                                    riskColor[result.risk_level]],
              ['Closest Debris',     result.closest_debris_km === 9999 ? 'None' : `${result.closest_debris_km} km`, 'var(--text)'],
              ['Conjunctions <50 km', result.conjunctions_found,                                         result.conjunctions_found > 0 ? 'var(--red)' : 'var(--green)'],
              ['Altitude',           `${result.altitude_km} km`,                                         'var(--accent)'],
              ['Velocity',           `${result.velocity_km_s} km/s`,                                     'var(--green)'],
              ['Classification',     result.classification,                                               result.classification === 'DEBRIS' ? 'var(--red)' : 'var(--green)'],
            ].map(([label, val, color]) => (
              <div className="stat-card" key={label}>
                <div className="stat-value" style={{ fontSize: '1.1rem', color }}>{val}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>

          {/* See trajectory CTA */}
          <div className="card" style={{ marginTop: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Where will this object be?
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                Use the ORBIT-TRUST trajectory pipeline to predict its position at +1 h, +6 h, +12 h, +24 h
                with RIC-frame error decomposition.
              </div>
            </div>
            <button className="btn btn-traj" onClick={() => navWith('🔭 Trajectory', form)}>
              🔭 Predict Trajectory
            </button>
          </div>

          {/* Conjunction table */}
          {result.close_objects?.length > 0 && (
            <div className="card">
              <div className="section-title">⚠️ Close Conjunction Objects</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>#</th><th>Name</th><th>NORAD ID</th><th>Distance (km)</th></tr>
                  </thead>
                  <tbody>
                    {result.close_objects.map((o, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{o.name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.norad_id}</td>
                        <td style={{ color: o.distance_km < 10 ? 'var(--red)' : o.distance_km < 25 ? '#ff9800' : 'var(--yellow)', fontWeight: 700 }}>
                          {o.distance_km}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
