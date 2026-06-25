import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Closet from './pages/Closet.jsx';
import TryOn from './pages/TryOn.jsx';
import Recommendations from './pages/Recommendations.jsx';
import Outfits from './pages/Outfits.jsx';
import Profile from './pages/Profile.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/closet"
          element={
            <ProtectedRoute>
              <Closet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/try-on"
          element={
            <ProtectedRoute>
              <TryOn />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recommendations"
          element={
            <ProtectedRoute>
              <Recommendations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outfits"
          element={
            <ProtectedRoute>
              <Outfits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
