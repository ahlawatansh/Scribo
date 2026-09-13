import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, handleRedirectResult, signInAnon, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../../firebase/auth';
import useAuth from '../../hooks/useAuth';
import { getShopOwnerEmail, linkFarmerByMobile } from '../../utils/authRole';
import { alert } from '../../utils/alert';

function friendlyAuthError(e) {
  const code = String(e?.code || '');
  const msg = String(e?.message || '');
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('invalid-password'))
    return 'Incorrect email or password. Please check your credentials.';
  if (code.includes('user-not-found')) return 'No account found with this email address.';
  if (code.includes('too-many-requests')) return 'Too many failed attempts. Please wait a few minutes and try again.';
  if (code.includes('network-request-failed')) return 'Network error. Please check your internet connection.';
  if (code.includes('email-already-in-use')) return 'This email is already registered to another account.';
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'Sign-in was cancelled.';
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  if (msg && !msg.includes('Firebase:')) return msg;
  return 'Authentication failed. Please try again.';
}

function CodeInput({ value, onChange }) {
  const inputsRef = useRef([]);
  const [visible, setVisible] = useState(false);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  const handleChange = (index, rawValue) => {
    const numeric = rawValue.replace(/\D/g, '');
    if (!numeric) {
      const next = [...digits];
      next[index] = '';
      setCode(next);
      return;
    }
    const next = [...digits].map((digit) => (digit === ' ' ? '' : digit));
    numeric.slice(0, 6 - index).split('').forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    setCode(next, Math.min(index + numeric.length, 5));
    setVisible(true);
    setTimeout(() => setVisible(false), 1000);
  };

  const setCode = (nextDigits, focusIndex) => {
    onChange(nextDigits.join('').replace(/\D/g, '').slice(0, 6));
    if (typeof focusIndex === 'number') {
      requestAnimationFrame(() => inputsRef.current[focusIndex]?.focus());
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key !== 'Backspace') return;
    if (digits[index] && digits[index] !== ' ') return;
    if (index > 0) {
      e.preventDefault();
      const next = [...digits].map((digit) => (digit === ' ' ? '' : digit));
      next[index - 1] = '';
      setCode(next, index - 1);
    }
  };

  const handlePaste = (index, e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    handleChange(index, pasted);
  };

  return (
    <div className="mb-3">
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">6-Digit Login Code</label>
      <div className="grid grid-cols-6 gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => { inputsRef.current[index] = node; }}
            aria-label={`Login code digit ${index + 1}`}
            className={`h-12 min-w-0 rounded-xl bg-transparent border border-slate-200 text-center text-xl font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all leading-none flex items-center justify-center pt-0 ${visible ? 'text-slate-900' : 'text-slate-900'}`}
            inputMode="numeric"
            maxLength={1}
            pattern="[0-9]*"
            type="password"
            value={digit === ' ' ? '' : digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(index, e)}
          />
        ))}
      </div>
    </div>
  );
}

function AuthRestoreScreen() {
  return (
    <div className="min-h-screen bg-background grid place-items-center">
      <div className="flex flex-col items-center gap-4 animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-white border border-outline flex items-center justify-center">
          <span
            className="material-symbols-outlined text-primary text-3xl animate-spin"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24", animationDuration: '1.4s' }}
          >
            sync
          </span>
        </div>
        <p className="text-on-surface-variant text-xs font-bold uppercase tracking-[0.2em]">Opening…</p>
      </div>
    </div>
  );
}

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('kk_last_email') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobile, setMobile] = useState('');
  const [fullName, setFullName] = useState('');
  const [farmerAuthReady, setFarmerAuthReady] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [signupError, setSignupError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const nav = useNavigate();
  const { role, loading: authLoading, refreshSession, applyRoleState } = useAuth();

  const validateMobile = (m) => /^[6-9]\d{9}$/.test(m);

  useEffect(() => {
    if (authLoading) return;
    if (role === 'shop') nav('/shop/dashboard', { replace: true });
    if (role === 'farmer') nav('/farmer/balance', { replace: true });
  }, [authLoading, role, nav]);

  const getSavedFarmerLink = () => {
    try {
      const savedMobile = localStorage.getItem('kk_farmer_mobile') || '';
      const savedName = localStorage.getItem('kk_farmer_name') || '';
      if (!validateMobile(savedMobile)) return null;
      if (!savedName.trim()) return null;
      return { mobile: savedMobile, fullName: savedName };
    } catch { return null; }
  };

  const saveFarmerLink = (m, name) => {
    try {
      localStorage.setItem('kk_farmer_mobile', String(m || ''));
      localStorage.setItem('kk_farmer_name', String(name || ''));
    } catch { /* ignore */ }
  };

  const isShopOwnerUser = async (user) => {
    const ownerEmail = String(await getShopOwnerEmail() || '').trim().toLowerCase();
    return Boolean(ownerEmail && user?.email && user.email.toLowerCase() === ownerEmail);
  };

  const finishShopLogin = async () => {
    const current = auth.currentUser;
    if (!(await isShopOwnerUser(current))) throw new Error('This account is not authorized to access the shop.');
    await refreshSession(current);
    nav('/shop/dashboard');
  };

  const finishFarmerLogin = async () => {
    if (!validateMobile(mobile)) throw new Error('Enter a valid 10-digit mobile number.');
    if (!fullName.trim()) throw new Error('Please enter your full name.');
    const current = auth.currentUser;
    const linked = await linkFarmerByMobile(current, mobile, fullName);
    applyRoleState({ role: 'farmer', farmerId: linked.farmerId, farmerData: linked.farmerData, farmerMobile: mobile });
    saveFarmerLink(mobile, fullName);
    nav('/farmer/balance');
  };

  const onSignup = async () => {
    setSignupError('');
    if (!email.trim()) {
      setSignupError('Enter your email address.');
      return;
    }
    if (!password) {
      setSignupError('Enter your password.');
      return;
    }
    if (password !== confirmPassword) {
      setSignupError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, rememberMe);
      alert.success('Account created successfully!', { id: 'signup-created' });

      try {
        localStorage.setItem('kk_last_email', email.trim());
      } catch { /* ignore */ }

      const current = auth.currentUser;

      if (await isShopOwnerUser(current)) {
        await finishShopLogin();
        return;
      }

      setFarmerAuthReady(true);
    } catch (e) {
      setSignupError(e?.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const tryAutoLinkFarmer = async () => {
    const current = auth.currentUser;
    const saved = getSavedFarmerLink();
    if (!current || !saved) return null;
    const linked = await linkFarmerByMobile(current, saved.mobile, saved.fullName);
    applyRoleState({ role: 'farmer', farmerId: linked.farmerId, farmerData: linked.farmerData, farmerMobile: saved.mobile });
    return linked;
  };

  const finishGoogleLogin = async (current) => {
    if (!current) throw new Error('Google sign-in did not return an account.');

    try {
      localStorage.setItem('kk_last_email', current.email || '');
    } catch { /* ignore */ }

    if (await isShopOwnerUser(current)) {
      await finishShopLogin();
      return;
    }

    const resolved = await refreshSession(current);
    if (resolved?.role === 'farmer' && resolved?.farmerId) {
      nav('/farmer/balance');
      return;
    }

    try {
      const linked = await tryAutoLinkFarmer();
      if (linked) {
        nav('/farmer/balance');
      } else {
        setFarmerAuthReady(true);
      }
    } catch (e) {
      console.error('Auto-link error:', e);
      setFarmerAuthReady(true);
    }
  };

  useEffect(() => {
    let alive = true;

    const completeRedirectLogin = async () => {
      try {
        const result = await handleRedirectResult();
        if (!alive || !result?.user) return;
        setLoading(true);
        await finishGoogleLogin(result.user);
      } catch (e) {
        if (alive) alert.error(friendlyAuthError(e), { id: 'login-error' });
      } finally {
        if (alive) setLoading(false);
      }
    };

    completeRedirectLogin();
    return () => { alive = false; };
  }, []);

  const onSubmitEmail = async () => {
    if (!password) {
      alert.error('Please enter your password.', { id: 'password-error' });
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email, password, rememberMe);
      const current = auth.currentUser;

      try {
        localStorage.setItem('kk_last_email', email);
      } catch { /* ignore */ }

      if (await isShopOwnerUser(current)) {
        await finishShopLogin();
        return;
      }

      const resolved = await refreshSession(current);
      if (resolved?.role === 'farmer' && resolved?.farmerId) {
        nav('/farmer/balance');
      } else {
        try {
          const linked = await tryAutoLinkFarmer();
          if (linked) {
            nav('/farmer/balance');
          } else {
            setFarmerAuthReady(true);
          }
        } catch (e) {
          console.error('Auto-link error:', e);
          setFarmerAuthReady(true);
        }
      }
    } catch (e) {
      alert.error(friendlyAuthError(e), { id: 'login-error' });
    } finally {
      setLoading(false);
    }
  };

  const onSubmitGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle(rememberMe);
      if (result?.user) {
        await finishGoogleLogin(result.user);
        return;
      }

      const current = auth.currentUser;
      if (current) await finishGoogleLogin(current);
    } catch (e) {
      alert.error(friendlyAuthError(e), { id: 'login-error' });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <AuthRestoreScreen />;

  const inputClass = "w-full bg-transparent border border-slate-200 rounded-xl h-11 px-4 py-3 outline-none text-sm text-slate-900 placeholder:text-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";

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
            <span className="font-normal">Hello,</span>
            <div className="mt-2">
              <span className="font-bold">Welcome Back!</span>
            </div>
          </h1>
          <p className="text-slate-500 mt-6 text-sm leading-relaxed px-4">
            <span className="font-bold text-primary">Scribo</span> is your complete business dashboard, right in your pocket.
          </p>
        </div>

        <div className="flex-grow bg-white rounded-t-[40px] shadow-[0_10px_30px_rgba(0,0,0,0.04)] px-8 pt-8 pb-10">
          <div className="flex items-center p-1.5 rounded-full mb-10 bg-slate-100/80 backdrop-blur-sm border border-slate-200 relative">
            <div
              className={`absolute top-0 bottom-0 rounded-full bg-primary transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                mode === 'signup' ? 'left-0 right-[calc(50%-6px)]' : 'left-[calc(50%-6px)] right-0'
              }`}
            />
            <button
              type="button"
              className={`flex-1 py-3 rounded-full text-sm font-semibold transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] relative z-10 ${
                mode === 'signup' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => { setMode('signup'); setFarmerAuthReady(false); setSignupError(''); setShowPassword(false); setShowConfirmPassword(false); }}
            >
              Sign Up
            </button>
            <button
              type="button"
              className={`flex-1 py-3 rounded-full text-sm font-semibold transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] relative z-10 ${
                mode === 'login' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => { setMode('login'); setFarmerAuthReady(false); setSignupError(''); setShowPassword(false); }}
            >
              Login
            </button>
          </div>

          {mode === 'signup' ? (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <div className="relative">
                  <input
                    className={inputClass}
                    placeholder="Your email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-lg">mail</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <input
                    className={inputClass}
                    placeholder="Your password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-lg hover:text-slate-500"
                  >
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    className={inputClass}
                    placeholder="Re-enter password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-lg hover:text-slate-500"
                  >
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </button>
                </div>
              </div>

              {signupError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs">
                  {signupError}
                </div>
              )}

              <button
                disabled={loading || !email || !password || !confirmPassword}
                className="w-full h-11 bg-primary disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 "
                onClick={onSignup}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onSubmitGoogle}
                className="w-full h-11 border border-slate-200 disabled:opacity-40 text-slate-700 font-semibold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <img src="/google.png" alt="Google" className="w-4 h-4" style={{ background: 'transparent' }} />
                <span className="font-semibold text-sm">Continue with Google</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {!farmerAuthReady ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                    <div className="relative">
                      <input className={inputClass} placeholder="Your email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-lg">mail</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
                    <div className="relative">
                      <input className={inputClass} placeholder="Your password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-lg hover:text-slate-500"
                      >
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end -mt-1">
                    <button type="button" className="text-xs font-semibold text-primary" onClick={() => nav('/forgot-password')}>
                      Forgot Password?
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={loading || !email || !password}
                    onClick={onSubmitEmail}
                    className="w-full h-11 bg-primary disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center "
                  >
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={onSubmitGoogle}
                    className="w-full h-11 border border-slate-200 disabled:opacity-40 text-slate-700 font-semibold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    <img src="/google.png" alt="Google" className="w-4 h-4" style={{ background: 'transparent' }} />
                    <span className="font-semibold text-sm">Continue with Google</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mobile Number</label>
                    <div className="relative">
                      <input
                        className={inputClass}
                        maxLength={10}
                        placeholder="10-digit mobile number"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      />
                      <span className="absolute right-4 top-3 material-symbols-outlined text-slate-300 text-lg">smartphone</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Your Name</label>
                    <div className="relative">
                      <input
                        className={inputClass}
                        placeholder="Full Name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                      <span className="absolute right-4 top-3 material-symbols-outlined text-slate-300 text-lg">person</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={loading || !mobile || !fullName.trim()}
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await finishFarmerLogin();
                      } catch (e) {
                        alert.error(friendlyAuthError(e), { id: 'farmer-link-error' });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full h-11 bg-primary disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 "
                  >
                    {loading ? 'Linking account…' : 'Link Customer Account'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
