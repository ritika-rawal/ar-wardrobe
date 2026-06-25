import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  {
    icon: '👕',
    title: 'Digital Closet',
    desc: 'Upload your clothes once and organize them by category, color, season, and warmth.',
  },
  {
    icon: '🪞',
    title: 'Live AR Try-On',
    desc: 'See garments overlaid on your live webcam feed, tracked to your body in real time.',
  },
  {
    icon: '🌦️',
    title: 'Smart Recommendations',
    desc: "Get outfit suggestions matched to today's weather and your personal style.",
  },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div>
      <div className="max-w-3xl mx-auto mt-16 sm:mt-24 text-center px-4">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">👗 Virtual Wardrobe</h1>
        <p className="text-slate-600 text-lg mb-8">
          Organize your closet digitally, try on clothes live with AR, and get smart outfit
          recommendations based on the weather and your style.
        </p>
        {user ? (
          <Link
            to="/closet"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg text-lg"
          >
            Go to my closet →
          </Link>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg">
              Log in
            </Link>
            <Link to="/register" className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg">
              Register
            </Link>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto mt-16 px-4 grid grid-cols-1 sm:grid-cols-3 gap-6 pb-16">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-white rounded-lg shadow p-5 text-center">
            <div className="text-3xl mb-2">{f.icon}</div>
            <h3 className="font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-slate-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
