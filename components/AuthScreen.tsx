import React, { useState } from 'react';
import { auth } from '../config';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { MessageCircle, ArrowRight, Lock } from 'lucide-react';

const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Persistence is handled globally in config.ts via setPersistence(auth, browserLocalPersistence)
      
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name
        });
      }
    } catch (err: any) {
        console.error(err);
      setError(err.message.replace('Firebase: ', ''));
      setLoading(false); // Only stop loading on error, otherwise app will unmount/transition
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop')] bg-cover bg-center p-4 relative overflow-hidden">
      
      {/* Overlay to darken background */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"></div>

      <div className="glass w-full max-w-md rounded-2xl shadow-2xl z-10 overflow-hidden transition-all duration-500 modal-animate border border-white/20">
        
        {/* The Login Line - Visibility controlled by loading state */}
        {loading && <div className="loading-line"></div>}

        <div className="p-8 md:p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <MessageCircle size={36} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Chitchat</h1>
            <p className="text-gray-500 text-sm mt-1 font-medium">Connect freely, secure instantly.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-1 modal-animate">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide ml-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-3 rounded-xl bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all duration-300"
                  placeholder="John Doe"
                />
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide ml-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3 rounded-xl bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all duration-300"
                placeholder="name@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3 rounded-xl bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all duration-300"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-red-500 text-xs font-medium bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-4"
            >
              {loading ? (
                <span className="text-gray-300">Processing...</span>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100/50 text-center">
             <p className="text-sm text-gray-500 mb-4">
                 {isLogin ? "New to Chitchat?" : "Already have an account?"}
             </p>
            <button
              onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
              }}
              className="text-purple-600 font-bold hover:text-purple-800 transition-colors uppercase text-xs tracking-widest border-b-2 border-transparent hover:border-purple-600 pb-0.5"
            >
              {isLogin ? 'Create Account' : 'Log In to Account'}
            </button>
          </div>
        </div>
        
        {/* Decorative footer strip */}
        <div className="h-2 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500"></div>
      </div>
      
      <div className="absolute bottom-4 text-white/50 text-xs flex items-center gap-1">
          <Lock size={12} /> Secure End-to-End Environment
      </div>
    </div>
  );
};

export default AuthScreen;