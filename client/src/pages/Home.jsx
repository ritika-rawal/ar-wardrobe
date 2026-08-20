import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CloudSun,
  Shirt,
  Sparkles,
  Camera,
  Wand2,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Reveal from '../components/Reveal.jsx';

const STEPS = [
  {
    n: '01',
    Icon: Upload,
    title: 'Add your clothes',
    desc: 'Snap a photo of each item — our system tags category, colour, and season automatically.',
  },
  {
    n: '02',
    Icon: Wand2,
    title: 'Get matched picks',
    desc: "We pair items with today's weather and your style profile to suggest outfits that work.",
  },
  {
    n: '03',
    Icon: Camera,
    title: 'Try it on in AR',
    desc: 'See the outfit on your own camera feed before you ever change clothes.',
  },
];

const FEATURES = [
  {
    tag: '01 — Organise',
    Icon: Shirt,
    title: 'A digital closet that actually knows what you own',
    desc: 'Every item lives in one place, sorted by category, colour, and season — so you always know what you have and what\'s missing.',
    color: '#8b5e3c',
    colorDark: '#6b4530',
  },
  {
    tag: '02 — Preview',
    Icon: Sparkles,
    title: 'Live AR try-on, right on your camera',
    desc: 'Hold up your phone and see outfits rendered on you in real time — no changing room, no guesswork.',
    color: '#b8863a',
    colorDark: '#8f6a2c',
  },
  {
    tag: '03 — Decide',
    Icon: CloudSun,
    title: 'Smart picks matched to today\'s weather',
    desc: 'Outfit suggestions that account for temperature and conditions, pulled from your own wardrobe.',
    color: '#5c4033',
    colorDark: '#3d2b1f',
  },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  return (
    <div className="bg-[#faf6ee]">
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-30"
          style={{ background: '#8b5e3c' }}
        />
        <div
          className="pointer-events-none absolute top-10 -right-40 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-20"
          style={{ background: '#b8863a' }}
        />

        <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-14 sm:pt-16 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
            {/* Copy */}
            <Reveal>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-[#8b5e3c] bg-[#8b5e3c]/8 px-4 py-1.5 rounded-full mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                Now with live AR try-on
              </span>

              <h1 className="text-5xl sm:text-6xl font-extrabold text-[#3d2b1f] leading-[1.05] mb-4">
                Your wardrobe,{' '}
                <span
                  className="italic"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#b8863a' }}
                >
                  reimagined.
                </span>
              </h1>

              <p className="text-[#8a7362] text-lg leading-relaxed max-w-md mb-6">
                Organise your closet, try on outfits live with AR, and get smart picks for today's
                weather — all in one place.
              </p>

              <div className="flex flex-wrap items-center gap-4 mb-7">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 font-semibold px-7 py-3.5 rounded-full text-white bg-[#8b5e3c] hover:bg-[#6b4530] shadow-lg shadow-[#8b5e3c]/20 transition-colors"
                >
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="font-semibold px-7 py-3.5 rounded-full text-[#3d2b1f] border border-[#3d2b1f]/15 hover:border-[#3d2b1f]/30 transition-colors"
                >
                  Log in
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                {[
                  { Icon: Shirt, label: 'Digital closet' },
                  { Icon: Sparkles, label: 'AR try-on' },
                  { Icon: CloudSun, label: 'Weather picks' },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-[#8a7362]">
                    <Icon className="h-4 w-4 text-[#8b5e3c]" />
                    {label}
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Photo card */}
            <Reveal delay={100}>
              <div className="relative max-w-md mx-auto">
                <div className="rounded-[1.75rem] overflow-hidden shadow-xl shadow-[#3d2b1f]/10 aspect-[4/5]">
                  <img
                    src="/fypbg.png"
                    alt="A shirt floating out of a phone screen showing the AR wardrobe app"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-lg shadow-[#3d2b1f]/10 px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#8b5e3c]/10 flex items-center justify-center shrink-0">
                    <CloudSun className="h-4.5 w-4.5 text-[#8b5e3c]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#3d2b1f]">21°C · Clear</p>
                    <p className="text-[11px] text-[#8a7362]">Today's pick is ready</p>
                  </div>
                </div>

                <div className="absolute -top-5 -right-5 bg-[#b8863a] text-white rounded-full shadow-lg shadow-[#b8863a]/30 px-4 py-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">AR live</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="max-w-6xl mx-auto px-6 py-14 sm:py-16 border-t border-[#3d2b1f]/8">
        <Reveal>
          <span className="inline-block text-[11px] font-semibold tracking-[0.14em] uppercase text-[#b8863a] mb-2">
            Process
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#3d2b1f] mb-8 max-w-md">
            Three steps to your best outfit
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {STEPS.map(({ n, Icon, title, desc }, i) => (
            <Reveal key={n} delay={i * 100}>
              <div className="relative">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-11 h-11 rounded-full bg-[#8b5e3c] text-white flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className="text-3xl font-extrabold text-[#3d2b1f]/10"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    {n}
                  </span>
                </div>
                <h3 className="font-semibold text-lg text-[#3d2b1f] mb-2">{title}</h3>
                <p className="text-sm text-[#8a7362] leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== Feature showcase ===== */}
      <section className="max-w-6xl mx-auto px-6 py-14 sm:py-16 border-t border-[#3d2b1f]/8 space-y-14 sm:space-y-16">
        {FEATURES.map(({ tag, Icon, title, desc, color, colorDark }, i) => (
          <Reveal key={title}>
            <div
              className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center ${
                i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
              }`}
            >
              {/* Text */}
              <div>
                <span
                  className="inline-block text-[11px] font-semibold tracking-[0.14em] uppercase mb-3"
                  style={{ color }}
                >
                  {tag}
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-[#3d2b1f] mb-3 leading-tight">
                  {title}
                </h3>
                <p className="text-[#8a7362] leading-relaxed max-w-md mb-4">{desc}</p>
                <Link
                  to={user ? '/dashboard' : '/register'}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold hover:gap-2.5 transition-all"
                  style={{ color: colorDark }}
                >
                  Get started
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Visual panel */}
              <div
                className="relative rounded-[2rem] aspect-[4/3] flex items-center justify-center overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${color} 0%, ${colorDark} 100%)` }}
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-14 -left-10 w-52 h-52 rounded-full bg-black/10" />
                <div className="relative w-24 h-24 rounded-3xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Icon className="h-11 w-11 text-white" />
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ===== Final CTA ===== */}
      <section
        className="py-14 sm:py-16"
        style={{ background: 'linear-gradient(135deg, #8b5e3c 0%, #6b4530 100%)' }}
      >
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-white/80 bg-white/10 px-4 py-1.5 rounded-full mb-5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Free to get started
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
              Ready to reimagine your wardrobe?
            </h2>
            <p className="text-white/75 text-lg mb-6 max-w-md mx-auto">
              Create your digital closet in minutes and get your first AR try-on today.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-full text-[#6b4530] bg-white hover:bg-white/90 shadow-lg shadow-black/10 transition-colors"
            >
              Create free account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-[#3d2b1f]/8">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs font-semibold tracking-[0.18em] uppercase text-[#6b4530]">
            Virtual Wardrobe
          </span>
          <p className="text-xs text-[#8a7362]">
            © {new Date().getFullYear()} Virtual Wardrobe. Organise, try on, decide.
          </p>
        </div>
      </footer>
    </div>
  );
}
