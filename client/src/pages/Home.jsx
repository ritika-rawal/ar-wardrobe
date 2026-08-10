import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CloudSun, Shirt, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  {
    Icon: Shirt,
    title: 'Digital closet',
    desc: 'Upload your clothes once and organise them by category, colour, season, and warmth.',
    gradient: 'from-amber-700 to-stone-800',
  },
  {
    Icon: Sparkles,
    title: 'Live AR try-on',
    desc: 'See garments overlaid on your live webcam feed, tracked to your body in real time.',
    gradient: 'from-orange-600 to-amber-800',
  },
  {
    Icon: CloudSun,
    title: 'Smart recommendations',
    desc: "Get outfit suggestions matched to today's weather and your personal style.",
    gradient: 'from-stone-500 to-stone-700',
  },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  return (
    <div className="relative bg-[#1b1712] overflow-hidden">
      {/* Glow orbs */}
      <div className="pointer-events-none absolute -top-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-amber-700/25 blur-[120px]" />
      <div className="pointer-events-none absolute top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-orange-800/25 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 w-[28rem] h-[28rem] rounded-full bg-stone-500/15 blur-[120px]" />

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 sm:pb-28 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-10 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-200 bg-white/5 border border-amber-100/10 backdrop-blur-md px-4 py-1.5 rounded-full mb-6 shadow-[0_0_20px_-4px_rgba(217,119,6,0.5)]">
            <Sparkles className="h-3.5 w-3.5" />
            Now with live AR try-on
          </span>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6 text-stone-50">
            Your wardrobe,
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200 bg-clip-text text-transparent">
              reimagined.
            </span>
          </h1>

          <p className="text-lg text-stone-300 leading-relaxed mb-10 max-w-md">
            Organise your closet digitally, try on clothes live with AR, and get smart outfit
            recommendations based on the weather and your style.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-full text-white bg-gradient-to-r from-amber-700 via-orange-700 to-amber-800 shadow-[0_0_40px_-8px_rgba(180,83,9,0.8)] hover:shadow-[0_0_55px_-6px_rgba(180,83,9,0.95)] hover:scale-[1.03] transition-all"
            >
              Create account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/login"
              className="font-semibold px-8 py-4 rounded-full text-stone-100 bg-white/5 border border-stone-100/15 backdrop-blur-md hover:bg-white/10 transition-colors"
            >
              Log in
            </Link>
          </div>

          <div className="flex items-center gap-6 mt-12 text-sm text-stone-400">
            <div>
              <div className="text-2xl font-bold text-stone-50">10k+</div>
              items organised
            </div>
            <div className="w-px h-8 bg-stone-100/10" />
            <div>
              <div className="text-2xl font-bold text-stone-50">Real-time</div>
              AR tracking
            </div>
          </div>
        </div>

        {/* Hero image */}
        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-amber-700/40 via-orange-800/30 to-stone-700/40 blur-2xl" />
          <div className="relative rounded-[1.75rem] overflow-hidden border border-stone-100/15 shadow-2xl">
            <img
              src="/fypbg.png"
              alt="Weather-aware outfit recommendations shown next to a live AR try-on preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-stone-100/10 rounded-[1.75rem]" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-stone-50 mb-3">
            Everything your closet needs
          </h2>
          <p className="text-stone-400 max-w-lg mx-auto">
            One place to organise, try on, and plan your outfits — powered by AR and smart
            recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {FEATURES.map(({ Icon, title, desc, gradient }) => (
            <div
              key={title}
              className="group relative rounded-2xl bg-white/5 border border-stone-100/10 backdrop-blur-md p-7 hover:bg-white/[0.08] hover:border-stone-100/20 hover:-translate-y-1 transition-all"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5 shadow-lg`}
              >
                <Icon className="h-5.5 w-5.5 text-white" />
              </div>
              <h3 className="font-semibold text-stone-50 mb-2 text-lg">{title}</h3>
              <p className="text-sm text-stone-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-800 via-orange-800 to-stone-800 px-8 py-14 sm:py-16 text-center shadow-[0_0_60px_-15px_rgba(154,52,18,0.6)]">
          <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <h2 className="relative text-3xl sm:text-4xl font-bold text-stone-50 mb-4">
            Ready to reimagine your wardrobe?
          </h2>
          <p className="relative text-amber-100 max-w-md mx-auto mb-8">
            Create a free account and start organising your closet in minutes.
          </p>
          <Link
            to="/register"
            className="relative inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-full bg-stone-50 text-amber-900 hover:bg-white transition-colors shadow-lg"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
