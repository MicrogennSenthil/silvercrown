import { EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const ElementLogInScreen = (): JSX.Element => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="bg-white w-full min-w-[1920px] min-h-[1080px] relative flex">
      {/* Left side: factory background image */}
      <div className="flex-shrink-0 w-[1230px] h-[1080px]">
        <img
          className="w-full h-full object-cover"
          alt="Vecteezy automated"
          src="/figmaAssets/vecteezy-automated-robotic-arm-working-on-production-line-in-sma.png"
        />
      </div>

      {/* Right side: login panel */}
      <div className="flex-1 flex flex-col items-center justify-between py-[200px] pb-5 bg-white">
        {/* Logo */}
        <div className="flex flex-col items-center gap-10 w-full">
          <img
            className="w-[334px] h-[100px] object-cover"
            alt="Silver Crown Group of Companies"
            src="/figmaAssets/image-1.png"
          />

          {/* Form fields */}
          <div className="flex flex-col w-[460px] items-start gap-10">
            {/* User Id field */}
            <div className="relative w-[460px] h-[83px]">
              {/* Border box */}
              <div className="absolute -left-px -bottom-px w-[462px] h-[62px] rounded border-2 border-solid border-[#00000080]" />

              {/* Value */}
              <div className="inline-flex items-center justify-center gap-2.5 p-2.5 absolute top-[35px] left-5">
                <span className="relative w-fit mt-[-1.00px] [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#000000cc] text-[26px] tracking-[0] leading-[39px] whitespace-nowrap">
                  Admin
                </span>
              </div>

              {/* Floating label */}
              <div className="inline-flex items-center justify-center gap-2.5 p-2.5 absolute top-px left-[21px] bg-[linear-gradient(0deg,rgba(255,255,255,1)_0%,rgba(255,255,255,1)_100%)]">
                <span className="relative w-fit mt-[-1.00px] [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#5b5e66] text-2xl tracking-[0] leading-9 whitespace-nowrap">
                  User Id
                </span>
              </div>
            </div>

            {/* Password field */}
            <div className="flex flex-col items-end justify-center gap-2.5 relative self-stretch w-full flex-[0_0_auto]">
              <div className="relative w-[460px] h-[83px]">
                {/* Border box */}
                <div className="absolute -left-px -bottom-px w-[462px] h-[62px] rounded border-2 border-solid border-[#00000080]" />

                {/* EyeIcon icon toggle */}
                <button
                  className="absolute top-[37px] right-5 w-8 h-8 flex items-center justify-center text-[#00000080]"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOffIcon className="w-6 h-6" />
                  ) : (
                    <img
                      className="w-8 h-8"
                      alt="Icon frame"
                      src="/figmaAssets/icon-frame.svg"
                    />
                  )}
                </button>

                {/* Password value */}
                <div className="flex w-[137px] items-end justify-center gap-2.5 px-2.5 py-0 absolute top-[51px] left-5">
                  <span className="relative w-fit mt-[-1.00px] ml-[-10.53px] mr-[-10.53px] [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#000000cc] text-[38px] tracking-[1.52px] leading-[57px] whitespace-nowrap">
                    ********
                  </span>
                </div>

                {/* Floating label */}
                <div className="inline-flex items-center justify-center gap-2.5 p-2.5 absolute top-px left-[21px] bg-[linear-gradient(0deg,rgba(255,255,255,1)_0%,rgba(255,255,255,1)_100%)]">
                  <span className="relative w-fit mt-[-1.00px] [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#5b5e66] text-2xl tracking-[0] leading-9 whitespace-nowrap">
                    Password
                  </span>
                </div>
              </div>

              {/* Forget Password */}
              <div className="inline-flex items-center justify-center gap-2.5 p-2.5 relative flex-[0_0_auto]">
                <span className="relative w-fit mt-[-1.00px] [font-family:'Source_Sans_Pro',Helvetica] font-normal text-[#0000004c] text-base tracking-[-0.32px] leading-[normal] whitespace-nowrap cursor-pointer hover:underline">
                  Forget Password ?
                </span>
              </div>
            </div>
          </div>

          {/* Log-in button */}
          <Button
            className="w-[460px] h-auto py-[17px] bg-[#d74700] hover:bg-[#b83c00] rounded text-white [font-family:'Source_Sans_Pro',Helvetica] font-normal text-2xl tracking-[-0.48px] leading-[normal]"
            type="button"
          >
            Log-in
          </Button>
        </div>

        {/* Powered by Microgenn */}
        <div className="inline-flex items-center justify-center gap-2.5 p-2.5">
          <span className="relative w-fit mt-[-1.00px] [font-family:'Source_Sans_Pro',Helvetica] font-normal text-light text-sm tracking-[-0.28px] leading-[normal] whitespace-nowrap">
            Powered by Microgenn
          </span>
        </div>
      </div>
    </div>
  );
};
