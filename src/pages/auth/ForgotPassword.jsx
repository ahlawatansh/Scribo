import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resetPassword } from '../../firebase/auth';
import { alert } from '../../utils/alert';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSentTo('');
    try {
      await resetPassword(email);
      setSentTo(email);
      alert.success('Reset link sent. Check your inbox.', { id: 'reset-sent' });
    } catch (err) {
      alert.error(err?.message || 'Failed to send reset link.', { id: 'reset-failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen antialiased relative overflow-hidden flex flex-col" style={{ backgroundColor: '#dcfce7', backgroundImage: 'radial-gradient(circle at 50% -10%, rgba(255, 255, 255, 0.98) 0%, transparent 70%), radial-gradient(circle at 10% 85%, #ccfbf1 0%, transparent 60%), radial-gradient(circle at 80% 100%, rgba(22, 163, 74, 0.15) 0%, transparent 60%), radial-gradient(circle at 90% 10%, rgba(209, 234, 217, 0.8) 0%, transparent 40%)', backgroundSize: 'cover' }}>
      <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.18]" style={{ filter: 'url(#grainFilter)' }}></div>
      <svg height="0" style={{ position: 'absolute' }} width="0">
        <filter id="grainFilter">
          <feTurbulence baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" type="fractalNoise"></feTurbulence>
          <feColorMatrix type="saturate" values="0"></feColorMatrix>
        </filter>
      </svg>
      <div className="sm:mx-auto sm:w-full sm:max-w-[400px] min-h-screen flex flex-col relative z-20">

        <div className="px-10 pt-12 pb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800 leading-tight">
            <span className="font-normal">Reset</span>
            <div className="mt-2">
              <span className="font-bold">Password</span>
            </div>
          </h1>
          <p className="text-slate-500 mt-6 text-sm leading-relaxed px-4">
            Get a secure reset link for your <span className="font-bold text-primary">Scribo</span> account
          </p>
        </div>

        <div className="flex-grow bg-white rounded-t-[40px] shadow-[0_10px_30px_rgba(0,0,0,0.04)] px-8 pt-8 pb-10">
          {!sentTo ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <input
                    className="w-full bg-white border border-slate-200 rounded-xl h-12 px-4 outline-none text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Your email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">mail</span>
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full h-12 bg-primary disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2  mt-4"
                type="submit"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800">Reset Link Sent!</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                We sent a secure reset link to <span className="font-semibold text-slate-800">{sentTo}</span>. Please check your inbox and spam folders.
              </p>
              <button
                className="px-4 py-2 border border-green-200 hover:bg-green-50 rounded-xl text-xs font-semibold transition-all mt-2"
                onClick={() => setSentTo('')}
              >
                Try a different email
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 text-center text-sm text-slate-500">
            Remembered your password?{' '}
            <button type="button" className="text-sm font-semibold text-primary ml-2" onClick={() => nav('/')}>
              Log In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
