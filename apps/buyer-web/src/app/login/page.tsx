export default function Login() {
  return (
    <div className="flex items-center justify-center min-h-[80vh] px-6">
      <div className="glass-card p-12 w-full max-w-md text-center">
        <h2 className="text-3xl font-black mb-2 tracking-tighter neon-text">WELCOME BACK</h2>
        <p className="text-white/40 mb-10 text-sm">Secure biometric or password entry</p>
        
        <form className="space-y-6 text-left">
          <div>
            <label className="text-[10px] uppercase font-bold text-white/30 ml-2">Email Address</label>
            <input 
              type="email" 
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-primary transition-all mt-1"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-white/30 ml-2">Password</label>
            <input 
              type="password" 
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-primary transition-all mt-1"
              placeholder="••••••••"
            />
          </div>
          <button className="btn-primary w-full py-4 mt-4">Sign In</button>
        </form>

        <p className="mt-8 text-sm text-white/30">
          New to DRAVIO? <a href="#" className="text-primary hover:underline">Create an account</a>
        </p>
      </div>
    </div>
  );
}
