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
    <div className="w-screen h-screen overflow-hidden bg-white flex items-center justify-center">
      <div
        style={{ width: 1920, height: 1080, transformOrigin: "center center" }}
        className="bg-white flex absolute"
        ref={(el) => {
          if (!el) return;
          const update = () => {
            const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
            el.style.transform = `scale(${scale})`;
            el.style.left = `${(window.innerWidth - 1920 * scale) / 2}px`;
            el.style.top = `${(window.innerHeight - 1080 * scale) / 2}px`;
            el.style.transformOrigin = "top left";
          };
          update();
          window.addEventListener("resize", update);
        }}
      >
        {/* Left side: factory background image */}
        <div className="flex-shrink-0 w-[1230px] h-[1080px]">
          <img
            className="w-full h-full object-cover"
            alt="Silver Crown Metals - Production"
            src="/figmaAssets/vecteezy-automated-robotic-arm-working-on-production-line-in-sma.png"
          />
        </div>

        {/* Right side: login panel */}
        <div className="flex-1 flex flex-col items-center justify-between py-[200px] pb-10 bg-white">
          <form onSubmit={handleLogin} className="flex flex-col items-center gap-10 w-full">
            {/* Logo */}
            <img
              className="w-[334px] h-[100px] object-contain"
              alt="Silver Crown Metals"
              src="/figmaAssets/image-1.png"
            />

            {/* Form fields */}
            <div className="flex flex-col w-[460px] items-start gap-10">
              {/* User Id field */}
              <div className="relative w-[460px] h-[83px]">
                <div className="absolute -left-px -bottom-px w-[462px] h-[62px] rounded border-2 border-solid border-[#00000080]" />
                <div className="inline-flex items-center justify-center gap-2.5 p-2.5 absolute top-[35px] left-5">
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="relative w-[380px] bg-transparent border-none outline-none [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#000000cc] text-[26px] tracking-[0] leading-[39px]"
                    data-testid="input-username"
                    required
                  />
                </div>
                <div className="inline-flex items-center justify-center gap-2.5 p-2.5 absolute top-px left-[21px] bg-white">
                  <span className="relative w-fit mt-[-1.00px] [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#5b5e66] text-2xl tracking-[0] leading-9 whitespace-nowrap">
                    User Id
                  </span>
                </div>
              </div>

              {/* Password field */}
              <div className="flex flex-col items-end justify-center gap-2.5 relative self-stretch w-full">
                <div className="relative w-[460px] h-[83px]">
                  <div className="absolute -left-px -bottom-px w-[462px] h-[62px] rounded border-2 border-solid border-[#00000080]" />
                  <button
                    type="button"
                    className="absolute top-[37px] right-5 w-8 h-8 flex items-center justify-center text-[#00000080] z-10"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOffIcon className="w-6 h-6" /> : <EyeIcon className="w-6 h-6" />}
                  </button>
                  <div className="flex items-center absolute top-[35px] left-5 right-14">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-transparent border-none outline-none [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#000000cc] text-[26px] tracking-[1px] leading-[39px]"
                      data-testid="input-password"
                      required
                    />
                  </div>
                  <div className="inline-flex items-center justify-center gap-2.5 p-2.5 absolute top-px left-[21px] bg-white">
                    <span className="relative w-fit mt-[-1.00px] [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#5b5e66] text-2xl tracking-[0] leading-9 whitespace-nowrap">
                      Password
                    </span>
                  </div>
                </div>
                <div className="inline-flex items-center justify-center gap-2.5 p-2.5 relative">
                  <span className="relative w-fit mt-[-1.00px] [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#0000004c] text-base tracking-[-0.32px] leading-[normal] whitespace-nowrap cursor-pointer hover:underline">
                    Forget Password ?
                  </span>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="w-[460px] px-4 py-3 rounded border border-red-200 bg-red-50 text-red-600 text-sm [font-family:'Source_Sans_Pro',Helvetica]">
                {error}
              </div>
            )}

            {/* Log-in button */}
            <button
              type="submit"
              disabled={login.isPending}
              className="w-[460px] py-[17px] rounded text-white [font-family:'Source_Sans_Pro',Helvetica] font-normal text-2xl tracking-[-0.48px] leading-[normal] flex items-center justify-center gap-3 transition-colors disabled:opacity-80"
              style={{ background: login.isPending ? "#b83c00" : "#d74700" }}
              data-testid="button-login"
            >
              {login.isPending && <Loader2 className="w-6 h-6 animate-spin" />}
              {login.isPending ? "Logging in..." : "Log-in"}
            </button>
          </form>

          {/* Powered by */}
          <div className="inline-flex items-center justify-center gap-2.5 p-2.5">
            <span className="relative w-fit [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#a1b2b2] text-sm tracking-[-0.28px] leading-[normal] whitespace-nowrap">
              Powered by Microgenn
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
