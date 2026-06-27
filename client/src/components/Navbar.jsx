import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const LINKS = [
  { to: '/dashboard', label: 'Home', authOnly: true },
  { to: '/closet', label: 'Closet', authOnly: true },
  { to: '/try-on', label: 'Try-On', authOnly: true },
  { to: '/recommendations', label: 'Recommendations', authOnly: true },
  { to: '/outfits', label: 'Outfits', authOnly: true },
  { to: '/lookbook', label: 'Lookbook', authOnly: true },
  { to: '/profile', label: 'Profile', authOnly: true },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const overlayRef = useRef(null);

  function handleLogout() {
    logout();
    setOpen(false);
    navigate('/login');
  }

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    close();
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const visibleLinks = user ? LINKS.filter((l) => l.authOnly) : [];

  return (
    <>
      <nav
        className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm"
        style={{ borderBottom: '1px solid var(--brand-border)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12 sm:h-13">
          <Link
            to={user ? '/dashboard' : '/'}
            className="text-xs font-semibold tracking-[0.18em] uppercase"
            style={{ color: 'var(--brand-black)', letterSpacing: '0.18em' }}
          >
            VIRTUAL WARDROBE
          </Link>

          {user && (
            <>
              {/* Desktop links */}
              <div className="hidden md:flex items-center gap-6 text-sm">
                {visibleLinks.map((l) => {
                  const active = location.pathname === l.to;
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      className="transition-colors"
                      style={{
                        color: active ? 'var(--brand-black)' : 'var(--brand-muted)',
                        textDecoration: active ? 'underline' : 'none',
                        textUnderlineOffset: '3px',
                        textDecorationThickness: '1px',
                      }}
                    >
                      {l.label}
                    </Link>
                  );
                })}
                <button
                  onClick={handleLogout}
                  className="text-sm transition-colors"
                  style={{ color: 'var(--brand-muted)' }}
                >
                  Logout
                </button>
              </div>

              {/* Mobile hamburger */}
              <button
                className="md:hidden flex items-center justify-center w-8 h-8"
                onClick={() => setOpen((v) => !v)}
                aria-label="Toggle menu"
                style={{ color: 'var(--brand-black)' }}
              >
                <Menu className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Mobile bottom sheet */}
      {user && open && (
        <>
          {/* Overlay */}
          <div
            ref={overlayRef}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={close}
          />
          {/* Sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white"
            style={{
              borderRadius: 'var(--brand-radius-lg) var(--brand-radius-lg) 0 0',
              animation: 'sheet-up 220ms ease',
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
            }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <span
                className="text-xs font-semibold tracking-[0.18em] uppercase"
                style={{ color: 'var(--brand-black)' }}
              >
                VIRTUAL WARDROBE
              </span>
              <button onClick={close} aria-label="Close menu" style={{ color: 'var(--brand-muted)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              style={{ borderBottom: '1px solid var(--brand-border)', marginBottom: '8px' }}
            />
            <nav className="flex flex-col px-5 pb-4">
              {visibleLinks.map((l) => {
                const active = location.pathname === l.to;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={close}
                    className="py-3 text-base font-medium transition-colors"
                    style={{
                      color: active ? 'var(--brand-black)' : 'var(--brand-muted)',
                      textDecoration: active ? 'underline' : 'none',
                      textUnderlineOffset: '3px',
                      textDecorationThickness: '1px',
                    }}
                  >
                    {l.label}
                  </Link>
                );
              })}
              <div
                style={{ borderTop: '1px solid var(--brand-border)', margin: '8px 0' }}
              />
              <button
                onClick={handleLogout}
                className="py-3 text-base font-medium text-left transition-colors"
                style={{ color: 'var(--brand-muted)' }}
              >
                Logout
              </button>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
