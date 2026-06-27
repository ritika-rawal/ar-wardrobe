import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Shirt, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg" onClick={() => setMenuOpen(false)}>
          <Shirt className="h-5 w-5" />
          Virtual Wardrobe
        </Link>

        {user && (
          <>
            <div className="hidden md:flex items-center gap-1 text-sm">
              {LINKS.map((l) => (
                <Button key={l.to} variant="ghost" size="sm" asChild className="text-white hover:text-indigo-300 hover:bg-slate-800">
                  <Link to={l.to}>{l.label}</Link>
                </Button>
              ))}
              <Separator orientation="vertical" className="h-5 mx-2 bg-slate-700" />
              <span className="text-slate-400 text-sm">Hi, {user.name}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-slate-700">
                Logout
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white hover:bg-slate-800"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </>
        )}
      </div>

      {user && menuOpen && (
        <div className="md:hidden mt-3 flex flex-col gap-1 pb-2">
          {LINKS.map((l) => (
            <Button key={l.to} variant="ghost" asChild className="justify-start text-white hover:text-indigo-300 hover:bg-slate-800">
              <Link to={l.to} onClick={() => setMenuOpen(false)}>{l.label}</Link>
            </Button>
          ))}
          <Separator className="my-1 bg-slate-700" />
          <span className="text-slate-400 text-sm px-3">Hi, {user.name}</span>
          <Button variant="ghost" onClick={handleLogout} className="justify-start text-white hover:bg-slate-700">
            Logout
          </Button>
        </div>
      )}
    </nav>
  );
}
