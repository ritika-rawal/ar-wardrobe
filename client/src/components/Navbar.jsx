import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const LINKS = [
  { to: '/closet', label: 'Closet' },
  { to: '/try-on', label: 'Try-On (AR)' },
  { to: '/recommendations', label: 'Recommendations' },
  { to: '/outfits', label: 'My Outfits' },
  { to: '/profile', label: 'Profile' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate('/login');
  }

  return (
    <nav className="bg-slate-900 text-white px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between">
        <Link to="/" className="font-semibold text-lg" onClick={() => setMenuOpen(false)}>
          👗 Virtual Wardrobe
        </Link>

        {user && (
          <>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-5 text-sm">
              {LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="hover:text-indigo-300">
                  {l.label}
                </Link>
              ))}
              <span className="text-slate-400">Hi, {user.name}</span>
              <button
                onClick={handleLogout}
                className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
              >
                Logout
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden text-2xl leading-none"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </>
        )}
      </div>

      {user && menuOpen && (
        <div className="md:hidden mt-3 flex flex-col gap-3 text-sm pb-2">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} className="hover:text-indigo-300">
              {l.label}
            </Link>
          ))}
          <span className="text-slate-400">Hi, {user.name}</span>
          <button
            onClick={handleLogout}
            className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-left"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
