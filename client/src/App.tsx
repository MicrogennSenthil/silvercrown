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
import { Warehouses, UnitsOfMeasure, TaxRates } from "@/pages/masters/MastersList";
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
