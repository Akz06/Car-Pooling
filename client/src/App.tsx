import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { initials } from './lib/format';
import { AuthPage } from './pages/AuthPage';
import { TripsPage } from './pages/TripsPage';
import { TripPage } from './pages/TripPage';
import { GaragePage } from './pages/GaragePage';
import { AddCarPage } from './pages/AddCarPage';
import { CreateTripPage } from './pages/CreateTripPage';
import { EditTripPage } from './pages/EditTripPage';
import { MyTripsPage } from './pages/MyTripsPage';
import { ShowroomPage } from './pages/ShowroomPage';
import { CarGalleryPage } from './pages/CarGalleryPage';
import { AccountPage } from './pages/AccountPage';

const NAV: [string, string, string][] = [
  ['/', 'Find a ride', 'M10.5 4a6.5 6.5 0 1 0 4 11.6l4.2 4.2 1.4-1.4-4.2-4.2A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z'],
  ['/trips/new', 'Offer a ride', 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z'],
  ['/garage', 'My garage', 'M5 11 6.5 6.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11a2 2 0 0 1 2 2v4h-2v2h-2v-2H7v2H5v-2H3v-4a2 2 0 0 1 2-2Zm2.1 0h9.8l-1.2-4H8.3l-1.2 4ZM6.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm11 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z'],
  ['/me/trips', 'My trips', 'M7 3h2v2h6V3h2v2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V3Zm-2 8v8h14v-8H5Z'],
  ['/showroom', 'Showroom', 'M4 5h16v11H4V5Zm2 2v7h12V7H6Zm3 11h6v2H9v-2Z'],
];

function DemoBanner() {
  return (
    <div className="demo-banner">
      Demo — runs fully in your browser; your data stays on this device.
      <button onClick={async () => { (await import('./demo/backend')).resetDemo(); location.reload(); }}>Reset</button>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="page-loading">Starting engine…</div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

export function App() {
  const { user, signOut } = useAuth();
  const loc = useLocation();
  const bare = loc.pathname === '/login';
  return (
    <div className="app">
      {import.meta.env.VITE_DEMO && <DemoBanner />}
      {!bare && (
        <header className="topbar">
          <NavLink to="/" className="brand">
            <span className="brand__mark" aria-hidden>
              <svg viewBox="0 0 24 40"><rect x="1" y="1" width="22" height="38" rx="9" fill="#f59e0b" /><rect x="4" y="9" width="16" height="7" rx="2.5" fill="#111827" /><rect x="4" y="29" width="16" height="5" rx="2" fill="#111827" /></svg>
            </span>
            Seat<b>Share</b>
          </NavLink>
          <nav className="nav" aria-label="Main">
            {NAV.map(([to, label, icon]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                <svg className="nav__icon" viewBox="0 0 24 24" aria-hidden><path d={icon} /></svg>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="topbar__user">
            {user ? (
              <>
                <NavLink to="/account" className="topbar__me" title="Account">
                  <span className={`avatar avatar--${user.gender}`}>{initials(user.name)}</span>
                  <span className="topbar__name">{user.name.split(' ')[0]}</span>
                </NavLink>
                <button className="btn btn--ghost btn--sm" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <NavLink to="/login" className="btn btn--primary btn--sm">Sign in</NavLink>
            )}
          </div>
        </header>
      )}
      <main className={bare ? '' : 'main'}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/" element={<TripsPage />} />
          <Route path="/showroom" element={<ShowroomPage />} />
          <Route path="/cars/:modelId" element={<CarGalleryPage />} />
          <Route path="/trips/new" element={<RequireAuth><CreateTripPage /></RequireAuth>} />
          <Route path="/trips/:id/edit" element={<RequireAuth><EditTripPage /></RequireAuth>} />
          <Route path="/trips/:id" element={<TripPage />} />
          <Route path="/garage" element={<RequireAuth><GaragePage /></RequireAuth>} />
          <Route path="/garage/new" element={<RequireAuth><AddCarPage /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="/me/trips" element={<RequireAuth><MyTripsPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
