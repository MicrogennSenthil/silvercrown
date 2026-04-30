import { useState } from "react";
import { EyeOffIcon, EyeIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const ElementLogInScreen = (): JSX.Element => {
  const [username, setUsername] = useState("Admin");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login.mutateAsync({ username, password });
    } catch (err: any) {
      setError(err.message || "Invalid username or password");
    }
  }

  return (
    <div className="w-screen h-screen overflow-hidden flex" style={{ fontFamily: "'Source Sans Pro', sans-serif", background: "#f0f4f8" }}>

      {/* ── LEFT PANEL ── futuristic metal-coatings illustration */}
      <div className="hidden lg:flex flex-col relative overflow-hidden" style={{ width: "58%", background: "linear-gradient(135deg, #012a3a 0%, #014d6b 40%, #027fa5 75%, #03a8d8 100%)" }}>

        {/* Dot-grid overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Diagonal stripe accent */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)",
          backgroundSize: "20px 20px"
        }} />

        {/* Large background circle */}
        <div className="absolute" style={{
          width: 600, height: 600,
          borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.12)",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)"
        }} />
        <div className="absolute" style={{
          width: 420, height: 420,
          borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.12)",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)"
        }} />

        {/* Central SVG illustration — metal coating process */}
        <svg className="absolute" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, height: 480 }}
          viewBox="0 0 480 480" fill="none" xmlns="http://www.w3.org/2000/svg">

          {/* Outer ring */}
          <circle cx="240" cy="240" r="200" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

          {/* Rotating arc segments */}
          <path d="M240 50 A190 190 0 0 1 430 240" stroke="rgba(3,168,216,0.6)" strokeWidth="3" strokeLinecap="round" />
          <path d="M240 430 A190 190 0 0 1 50 240" stroke="rgba(3,168,216,0.4)" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 160 A190 190 0 0 1 380 100" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />

          {/* Central gear-like shape */}
          <circle cx="240" cy="240" r="90" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <circle cx="240" cy="240" r="60" fill="rgba(255,255,255,0.06)" stroke="rgba(3,168,216,0.5)" strokeWidth="2" />
          <circle cx="240" cy="240" r="28" fill="rgba(3,168,216,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />

          {/* Gear teeth */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 240 + 90 * Math.cos(rad);
            const y1 = 240 + 90 * Math.sin(rad);
            const x2 = 240 + 110 * Math.cos(rad);
            const y2 = 240 + 110 * Math.sin(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" />;
          })}

          {/* Coating flow lines — curved paths */}
          <path d="M130 180 Q180 140 240 140 Q300 140 350 180" stroke="rgba(3,168,216,0.7)" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M130 200 Q180 165 240 165 Q300 165 350 200" stroke="rgba(3,168,216,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M130 300 Q180 340 240 340 Q300 340 350 300" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" fill="none" strokeLinecap="round" />

          {/* Particle dots — coating droplets */}
          {[
            [160, 130], [310, 125], [355, 240], [310, 355],
            [160, 360], [105, 240], [200, 100], [280, 100],
            [380, 170], [380, 310], [200, 380], [280, 380]
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 5 : 3.5}
              fill={i % 2 === 0 ? "rgba(3,168,216,0.8)" : "rgba(255,255,255,0.5)"} />
          ))}

          {/* Corner tech brackets */}
          <path d="M60 60 L60 90 M60 60 L90 60" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
          <path d="M420 60 L420 90 M420 60 L390 60" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 420 L60 390 M60 420 L90 420" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
          <path d="M420 420 L420 390 M420 420 L390 420" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />

          {/* Data lines */}
          <line x1="60" y1="240" x2="130" y2="240" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="350" y1="240" x2="420" y2="240" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="240" y1="60" x2="240" y2="130" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="240" y1="350" x2="240" y2="420" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 3" />
        </svg>

        {/* Bottom-left text block */}
        <div className="absolute bottom-10 left-10 text-white">
          <div className="text-2xl font-semibold tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.95)" }}>
            Metal Coatings ERP
          </div>
          <div className="text-sm tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.2em" }}>
            Precision · Quality · Control
          </div>
          <div className="mt-4 flex gap-2">
            {["#027fa5","#03a8d8","rgba(255,255,255,0.3)"].map((c,i) => (
              <div key={i} className="rounded-full" style={{ width: 8, height: 8, background: c }} />
            ))}
          </div>
        </div>

        {/* Top-right badge */}
        <div className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#03a8d8" }} />
          <span className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.6)" }}>Element ERP v2</span>
        </div>
      </div>

      {/* ── RIGHT PANEL ── login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8" style={{ background: "#ffffff" }}>
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="flex justify-center mb-10">
            <img
              src="/figmaAssets/image-1.png"
              alt="Silver Crown Metals"
              className="object-contain"
              style={{ height: 80, maxWidth: 260 }}
            />
          </div>

          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold mb-1" style={{ color: "#0f2b3d" }}>Welcome back</h1>
            <p className="text-sm" style={{ color: "#7a8fa6" }}>Sign in to your Element ERP account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#4a5f72" }}>User ID</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-base transition-all outline-none"
                style={{
                  border: "1.5px solid #d1dce8",
                  background: "#f7fafc",
                  color: "#0f2b3d",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "#027fa5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(2,127,165,0.12)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#d1dce8"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}
                placeholder="Enter your user ID"
                required
                data-testid="input-username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#4a5f72" }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-lg text-base transition-all outline-none"
                  style={{
                    border: "1.5px solid #d1dce8",
                    background: "#f7fafc",
                    color: "#0f2b3d",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#027fa5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(2,127,165,0.12)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#d1dce8"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}
                  placeholder="Enter your password"
                  required
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                  style={{ color: "#7a8fa6" }}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <span className="text-xs cursor-pointer hover:underline" style={{ color: "#027fa5" }}>
                  Forgot Password?
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 rounded-lg text-sm" style={{ background: "#fff1f0", border: "1px solid #ffc9c9", color: "#c0392b" }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={login.isPending}
              className="w-full py-3.5 rounded-lg text-white font-semibold text-base flex items-center justify-center gap-2.5 transition-all"
              style={{
                background: login.isPending
                  ? "linear-gradient(135deg, #b83c00, #d74700)"
                  : "linear-gradient(135deg, #d74700, #e85c1a)",
                boxShadow: login.isPending ? "none" : "0 4px 14px rgba(215,71,0,0.35)"
              }}
              data-testid="button-login"
            >
              {login.isPending && <Loader2 size={18} className="animate-spin" />}
              {login.isPending ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-10 text-center">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: "#e8eef4" }} />
              <span className="text-xs" style={{ color: "#b0bec5" }}>SECURED ACCESS</span>
              <div className="flex-1 h-px" style={{ background: "#e8eef4" }} />
            </div>
            <p className="text-xs" style={{ color: "#b0bec5" }}>Powered by Microgenn</p>
          </div>
        </div>
      </div>

    </div>
  );
};
