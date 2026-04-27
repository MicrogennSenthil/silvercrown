import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { ElementLogInScreen } from "@/pages/ElementLogInScreen";
import Dashboard from "@/pages/Dashboard";
import PurchaseInvoices from "@/pages/PurchaseInvoices";
import Inventory from "@/pages/Inventory";
import Sales from "@/pages/Sales";
import Accounts from "@/pages/Accounts";
import Tasks from "@/pages/Tasks";
import TallyIntegration from "@/pages/TallyIntegration";
import Reports from "@/pages/Reports";
import Suppliers from "@/pages/Suppliers";
import Customers from "@/pages/Customers";
import NotFound from "@/pages/not-found";
// Masters
import Employees from "@/pages/masters/Employees";
import { Warehouses, UnitsOfMeasure, TaxRates, Categories, VoucherTypes, PayModeTypes, LedgerCategories, TermTypes, Departments, StoreItemGroups, StoreItemSubGroups } from "@/pages/masters/MastersList";
import GeneralLedgerTree from "@/pages/masters/GeneralLedger";
import { Countries, States, Cities } from "@/pages/masters/Geography";
import { SubCategories, Products } from "@/pages/masters/ProductMasters";
import { MachineMaster, PurchaseStoreItems, PurchaseApprovals, Terms } from "@/pages/masters/OperationMasters";
import ApprovalAuthority from "@/pages/masters/ApprovalAuthority";
import ProcessMasters from "@/pages/masters/ProcessMasters";
import SubLedgerMaster from "@/pages/masters/SubLedger";
import SoftwareSetup from "@/pages/SoftwareSetup";
import JobWorkInward from "@/pages/transactions/JobWorkInward";
import JobWorkDespatch from "@/pages/transactions/JobWorkDespatch";
import JobWorkInvoice from "@/pages/transactions/JobWorkInvoice";
import ReturnableInward from "@/pages/transactions/ReturnableInward";
import ReturnableOutward from "@/pages/transactions/ReturnableOutward";
import GatePass from "@/pages/transactions/GatePass";
import PurchaseOrder from "@/pages/inventory/PurchaseOrder";
import PurchaseAmendment from "@/pages/inventory/PurchaseAmendment";
import PurchaseOrderApproval from "@/pages/inventory/PurchaseOrderApproval";
import GoodsReceiptNote from "@/pages/inventory/GoodsReceiptNote";
import StoreRequestNote from "@/pages/inventory/StoreRequestNote";
import StoreIssueIndent from "@/pages/inventory/StoreIssueIndent";
import PhyReconciliation from "@/pages/inventory/PhyReconciliation";
import GoodsReceiptReturn from "@/pages/inventory/GoodsReceiptReturn";
import IssueIndentReturn from "@/pages/inventory/IssueIndentReturn";
import StoreOpening from "@/pages/inventory/StoreOpening";
import FinancialYears from "@/pages/masters/FinancialYears";
import YearEndClosing from "@/pages/masters/YearEndClosing";
import VoucherSeries from "@/pages/masters/VoucherSeries";
import AccountingVoucher from "@/pages/accounts/AccountingVoucher";
import StoreMaster from "@/pages/masters/StoreMaster";
// Reports
import JobWorkPendingReport from "@/pages/reports/JobWorkPending";
import DespatchPendingReport from "@/pages/reports/DespatchPending";
import InvoicePendingReport  from "@/pages/reports/InvoicePending";
// User Management
import Users from "@/pages/usermgmt/Users";
import Roles from "@/pages/usermgmt/Roles";
import RoleRights from "@/pages/usermgmt/RoleRights";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f0ed" }}>
      <div className="flex flex-col items-center gap-4">
        <img src="/figmaAssets/image-1.png" alt="Silver Crown Metals" className="h-16 object-contain" />
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "#027fa5", borderTopColor: "transparent" }} />
      </div>
    </div>
  );
  if (!isAuthenticated) return <Redirect to="/" />;
  return <Layout><Component /></Layout>;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <Switch>
      <Route path="/">
        {!isLoading && isAuthenticated ? <Redirect to="/dashboard" /> : <ElementLogInScreen />}
      </Route>
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/purchase/invoices"><ProtectedRoute component={PurchaseInvoices} /></Route>
      <Route path="/inventory/purchase-order"><ProtectedRoute component={PurchaseOrder} /></Route>
      <Route path="/inventory/purchase-amendment"><ProtectedRoute component={PurchaseAmendment} /></Route>
      <Route path="/inventory/purchase-order-approval"><ProtectedRoute component={PurchaseOrderApproval} /></Route>
      <Route path="/inventory/goods-receipt-note"><ProtectedRoute component={GoodsReceiptNote} /></Route>
      <Route path="/inventory/store-request-note"><ProtectedRoute component={StoreRequestNote} /></Route>
      <Route path="/inventory/store-issue-indent"><ProtectedRoute component={StoreIssueIndent} /></Route>
      <Route path="/inventory/phy-reconciliation"><ProtectedRoute component={PhyReconciliation} /></Route>
      <Route path="/inventory/goods-receipt-return"><ProtectedRoute component={GoodsReceiptReturn} /></Route>
      <Route path="/inventory/issue-indent-return"><ProtectedRoute component={IssueIndentReturn} /></Route>
      <Route path="/inventory/store-opening"><ProtectedRoute component={StoreOpening} /></Route>
      <Route path="/inventory/items"><ProtectedRoute component={Inventory} /></Route>
      <Route path="/inventory/categories"><ProtectedRoute component={Inventory} /></Route>
      <Route path="/sales/invoices"><ProtectedRoute component={Sales} /></Route>
      <Route path="/accounts"><ProtectedRoute component={Accounts} /></Route>
      <Route path="/journal"><ProtectedRoute component={Accounts} /></Route>
      <Route path="/reports"><ProtectedRoute component={Reports} /></Route>
      <Route path="/tasks"><ProtectedRoute component={Tasks} /></Route>
      <Route path="/tally"><ProtectedRoute component={TallyIntegration} /></Route>
      {/* Masters */}
      <Route path="/masters/suppliers"><ProtectedRoute component={Suppliers} /></Route>
      <Route path="/masters/customers"><ProtectedRoute component={Customers} /></Route>
      <Route path="/masters/employees"><ProtectedRoute component={Employees} /></Route>
      <Route path="/masters/warehouses"><ProtectedRoute component={Warehouses} /></Route>
      <Route path="/masters/uom"><ProtectedRoute component={UnitsOfMeasure} /></Route>
      <Route path="/masters/tax-rates"><ProtectedRoute component={TaxRates} /></Route>
      <Route path="/masters/accounts"><ProtectedRoute component={Accounts} /></Route>
      <Route path="/masters/inventory-categories"><ProtectedRoute component={Inventory} /></Route>
      <Route path="/masters/countries"><ProtectedRoute component={Countries} /></Route>
      <Route path="/masters/states"><ProtectedRoute component={States} /></Route>
      <Route path="/masters/cities"><ProtectedRoute component={Cities} /></Route>
      <Route path="/masters/categories"><ProtectedRoute component={Categories} /></Route>
      <Route path="/masters/sub-categories"><ProtectedRoute component={SubCategories} /></Route>
      <Route path="/masters/products"><ProtectedRoute component={Products} /></Route>
      <Route path="/masters/machines"><ProtectedRoute component={MachineMaster} /></Route>
      <Route path="/masters/store-item-groups"><ProtectedRoute component={StoreItemGroups} /></Route>
      <Route path="/masters/purchase-store-items"><ProtectedRoute component={PurchaseStoreItems} /></Route>
      <Route path="/masters/purchase-approvals"><ProtectedRoute component={PurchaseApprovals} /></Route>
      <Route path="/masters/voucher-types"><ProtectedRoute component={VoucherTypes} /></Route>
      <Route path="/masters/pay-mode-types"><ProtectedRoute component={PayModeTypes} /></Route>
      <Route path="/masters/ledger-categories"><ProtectedRoute component={LedgerCategories} /></Route>
      <Route path="/masters/term-types"><ProtectedRoute component={TermTypes} /></Route>
      <Route path="/masters/terms"><ProtectedRoute component={Terms} /></Route>
      <Route path="/masters/departments"><ProtectedRoute component={Departments} /></Route>
      <Route path="/masters/approval-authority"><ProtectedRoute component={ApprovalAuthority} /></Route>
      <Route path="/masters/processes"><ProtectedRoute component={ProcessMasters} /></Route>
      <Route path="/masters/store-item-sub-groups"><ProtectedRoute component={StoreItemSubGroups} /></Route>
      <Route path="/masters/general-ledgers"><ProtectedRoute component={GeneralLedgerTree} /></Route>
      <Route path="/masters/ledger"><ProtectedRoute component={SubLedgerMaster} /></Route>
      <Route path="/accounts/voucher"><ProtectedRoute component={AccountingVoucher} /></Route>
      <Route path="/accounts/general-ledger"><ProtectedRoute component={GeneralLedgerTree} /></Route>
      <Route path="/accounts/ledger"><ProtectedRoute component={SubLedgerMaster} /></Route>
      <Route path="/setup"><ProtectedRoute component={SoftwareSetup} /></Route>
      <Route path="/engineering/job-work-inward"><ProtectedRoute component={JobWorkInward} /></Route>
      <Route path="/engineering/job-work-despatch"><ProtectedRoute component={JobWorkDespatch} /></Route>
      <Route path="/engineering/job-work-invoice"><ProtectedRoute component={JobWorkInvoice} /></Route>
      <Route path="/engineering/returnable-inward"><ProtectedRoute component={ReturnableInward} /></Route>
      <Route path="/engineering/returnable-outward"><ProtectedRoute component={ReturnableOutward} /></Route>
      <Route path="/engineering/gate-pass"><ProtectedRoute component={GatePass} /></Route>
      <Route path="/masters/financial-years"><ProtectedRoute component={FinancialYears} /></Route>
      <Route path="/masters/year-end-closing"><ProtectedRoute component={YearEndClosing} /></Route>
      <Route path="/masters/voucher-series"><ProtectedRoute component={VoucherSeries} /></Route>
      <Route path="/masters/stores"><ProtectedRoute component={StoreMaster} /></Route>
      {/* Reports */}
      <Route path="/reports/engineering/job-work-pending"><ProtectedRoute component={JobWorkPendingReport} /></Route>
      <Route path="/reports/engineering/despatch-pending"><ProtectedRoute component={DespatchPendingReport} /></Route>
      <Route path="/reports/engineering/invoice-pending"><ProtectedRoute component={InvoicePendingReport} /></Route>
      {/* Keep old routes for backwards compatibility */}
      <Route path="/suppliers"><ProtectedRoute component={Suppliers} /></Route>
      <Route path="/customers"><ProtectedRoute component={Customers} /></Route>
      {/* User Management */}
      <Route path="/usermgmt/users"><ProtectedRoute component={Users} /></Route>
      <Route path="/usermgmt/roles"><ProtectedRoute component={Roles} /></Route>
      <Route path="/usermgmt/role-rights"><ProtectedRoute component={RoleRights} /></Route>
      <Route><NotFound /></Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
