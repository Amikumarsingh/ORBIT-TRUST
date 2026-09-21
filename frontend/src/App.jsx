import { useState } from 'react';
import Dashboard    from './pages/Dashboard';
import LiveFeed     from './pages/LiveFeed';
import UploadTLE    from './pages/UploadTLE';
import RiskScore    from './pages/RiskScore';
import GlobeView    from './pages/GlobeView';
import Trajectory   from './pages/Trajectory';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

const PAGES = ['Dashboard', '🌍 Globe', 'Live Feed', 'Upload TLE', 'Risk Score', '🔭 Trajectory'];

export default function App() {
  const [page, setPage] = useState('Dashboard');
  const isGlobe = page === '🌍 Globe';

  const renderPage = () => {
    if (page === 'Dashboard')      return <Dashboard />;
    if (page === 'Live Feed')      return <LiveFeed />;
    if (page === 'Upload TLE')     return <UploadTLE />;
    if (page === 'Risk Score')     return <RiskScore />;
    if (page === '🌍 Globe')       return <GlobeView />;
    if (page === '🔭 Trajectory')  return <Trajectory />;
  };

  // expose a global nav helper so child pages can navigate
  window.__orbitNav = setPage;

  return (
    <div className="app">
      <nav className="navbar">
        <span className="nav-brand">🛰 ORBIT-TRUST</span>
        <div className="nav-links">
          {PAGES.map(p => (
            <button
              key={p}
              className={`nav-btn ${page === p ? 'active' : ''}`}
              onClick={() => setPage(p)}
            >{p}</button>
          ))}
        </div>
      </nav>
      <main style={{ flex: 1, overflow: isGlobe ? 'hidden' : 'auto', minHeight: 0 }}>
        <ErrorBoundary>
          {isGlobe ? renderPage() : <div className="main-content">{renderPage()}</div>}
        </ErrorBoundary>
      </main>
    </div>
  );
}
