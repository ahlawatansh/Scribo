import { useEffect, useState } from 'react';

export default function SplashScreen({ onComplete }) {
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {

    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, 1500);

    const completeTimer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 1700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[#064e3b] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${fadingOut ? 'opacity-0 scale-110 blur-sm' : 'opacity-100 scale-100 blur-0'}`}>
      <style>
        {`
          @keyframes subtle-pulse {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.05); opacity: 1; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes loading-progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
          @keyframes pulse-slow {
            0%, 100% { transform: scale(1) translate(0,0); opacity: 0.8; }
            50% { transform: scale(1.1) translate(2%, 2%); opacity: 1; }
          }

          .animate-subtle-pulse { animation: subtle-pulse 3s ease-in-out infinite; }
          .animate-float { animation: float 4s ease-in-out infinite; }
          .animate-pulse-slow { animation: pulse-slow 8s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

          .cinematic-gradient {
            background: radial-gradient(circle at 20% 20%, #22c55e 0%, transparent 40%),
                        radial-gradient(circle at 80% 80%, #064e3b 0%, transparent 50%),
                        radial-gradient(circle at 50% 50%, #16a34a 0%, #064e3b 100%);
          }

          .noise-bg {
            position: fixed;
            inset: 0;
            z-index: 10;
            pointer-events: none;
            opacity: 0.05;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          }

          @media (prefers-reduced-motion: reduce) {
            .animate-subtle-pulse, .animate-float, .animate-pulse-slow { animation: none; }
          }
        `}
      </style>

      <div className="noise-bg"></div>
      <div className="fixed inset-0 cinematic-gradient animate-pulse-slow"></div>

      <div className="relative z-20 flex flex-col items-center">
        <div className="animate-float">
          <div className="animate-subtle-pulse">
            <img
              alt="Logo"
              className="w-24 h-24 object-contain "
              src="/white.png"
            />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center space-y-4">
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
            <div className="h-full bg-white w-1/2 rounded-full " style={{ animation: 'loading-progress 2.5s ease-in-out infinite' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
