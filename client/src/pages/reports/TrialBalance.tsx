import { Construction } from "lucide-react";
import { ReportShell } from "@/components/ReportShell";

export default function TrialBalance() {
  return (
    <ReportShell
      title="Trial Balance"
      subtitle="Summary of all ledger closing balances"
      icon={<Construction size={18} />}
    >
      <div className="flex flex-col items-center justify-center py-24 gap-5 text-gray-400">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-200">
          <Construction size={36} className="text-amber-400" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-600">Under Construction</p>
          <p className="text-sm mt-1 text-gray-400 max-w-xs">
            The Trial Balance report is being built and will be available soon.
          </p>
        </div>
      </div>
    </ReportShell>
  );
}
