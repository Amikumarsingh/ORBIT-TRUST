import { useRef, useState } from 'react';
import { uploadTLE, predictBulk } from '../api';

export default function UploadTLE() {
  const fileRef = useRef();
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [rawText, setRawText] = useState('');
  const [tab,     setTab]     = useState('file'); // 'file' | 'paste'

  const handleFile = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    uploadTLE(fd)
      .then(r => setResult(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Upload failed.'))
      .finally(() => setLoading(false));
  };

  const handlePaste = async () => {
    if (!rawText.trim()) return;
    setLoading(true); setError(''); setResult(null);
    predictBulk({ tle_text: rawText })
      .then(r => setResult(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Classification failed.'))
      .finally(() => setLoading(false));
  };

  const debris = result?.objects?.filter(o => o.label === 1) ?? [];
  const sats   = result?.objects?.filter(o => o.label === 0) ?? [];

  return (
    <div>
      <h1 className="page-title">📂 Upload & Classify TLE</h1>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['file', 'paste'].map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-purple' : ''}`}
              style={tab !== t ? { background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' } : {}}
              onClick={() => setTab(t)}>
              {t === 'file' ? '📁 Upload .txt File' : '📋 Paste TLE Text'}
            </button>
          ))}
        </div>

        {tab === 'file' ? (
          <div>
            <div className="drop-zone" onClick={() => fileRef.current.click()}>
              <input ref={fileRef} type="file" accept=".txt" style={{ display: 'none' }}
                onChange={() => fileRef.current.files[0] && handleFile()} />
              <div style={{ fontSize: '2rem' }}>📡</div>
              <div>Click to select a <strong>.txt</strong> TLE file</div>
              <div style={{ fontSize: '0.8rem', marginTop: 6 }}>Standard 3-line TLE format</div>
            </div>
          </div>
        ) : (
          <div>
            <div className="form-group">
              <label>Paste raw TLE text (3-line format)</label>
              <textarea rows={8} value={rawText} onChange={e => setRawText(e.target.value)}
                placeholder={'ISS (ZARYA)\n1 25544U 98067A   24001.00000000  .00001234  00000-0  12345-4 0  9999\n2 25544  51.6400 123.4567 0001234  12.3456 347.6543 15.49815691234567'} />
            </div>
            <button className="btn btn-purple" onClick={handlePaste} disabled={loading || !rawText.trim()}>
              {loading ? 'Classifying…' : 'Classify'}
            </button>
          </div>
        )}
      </div>

      {loading && <p className="loading">Processing TLE data…</p>}
      {error   && <p className="error-msg">{error}</p>}

      {result && (
        <>
          <div className="card-grid">
            <div className="stat-card">
              <div className="stat-value">{result.total}</div>
              <div className="stat-label">Total Objects</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--red)' }}>{debris.length}</div>
              <div className="stat-label">Debris</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--green)' }}>{sats.length}</div>
              <div className="stat-label">Active Satellites</div>
            </div>
            {result.debris_percent !== undefined && (
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--yellow)' }}>{result.debris_percent}%</div>
                <div className="stat-label">Debris Ratio</div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title">Classification Results</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>NORAD ID</th><th>Type</th><th>Confidence</th><th>Debris Prob</th><th>Alt (km)</th></tr>
                </thead>
                <tbody>
                  {result.objects.map((o, i) => (
                    <tr key={i}>
                      <td>{o.name}</td>
                      <td>{o.norad_id}</td>
                      <td><span className={`badge ${o.label === 1 ? 'badge-debris' : 'badge-sat'}`}>{o.type}</span></td>
                      <td>{o.confidence}%</td>
                      <td>{o.debris_prob}%</td>
                      <td>{o.altitude?.toFixed(1)}</td>
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
