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
import { MyTripsPage } from './pages/MyTripsPage';
import { ShowroomPage } from './pages/ShowroomPage';

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
      {!bare && (
        <header className="topbar">
          <NavLink to="/" className="brand">
            <span className="brand__mark" aria-hidden>
              <svg viewBox="0 0 24 40"><rect x="1" y="1" width="22" height="38" rx="9" fill="#f59e0b" /><rect x="4" y="9" width="16" height="7" rx="2.5" fill="#111827" /><rect x="4" y="29" width="16" height="5" rx="2" fill="#111827" /></svg>
            </span>
            Seat<b>Share</b>
          </NavLink>
          <nav className="nav">
            <NavLink to="/" end>Find a ride</NavLink>
            <NavLink to="/trips/new">Offer a ride</NavLink>
            <NavLink to="/garage">My garage</NavLink>
            <NavLink to="/me/trips">My trips</NavLink>
            <NavLink to="/showroom">Showroom</NavLink>
          </nav>
          <div className="topbar__user">
            {user ? (
              <>
                <span className={`avatar avatar--${user.gender}`} title={user.name}>{initials(user.name)}</span>
                <span className="topbar__name">{user.name.split(' ')[0]}</span>
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
          <Route path="/trips/new" element={<RequireAuth><CreateTripPage /></RequireAuth>} />
          <Route path="/trips/:id" element={<TripPage />} />
          <Route path="/garage" element={<RequireAuth><GaragePage /></RequireAuth>} />
          <Route path="/garage/new" element={<RequireAuth><AddCarPage /></RequireAuth>} />
          <Route path="/me/trips" element={<RequireAuth><MyTripsPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
