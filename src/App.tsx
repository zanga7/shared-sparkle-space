import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ChildAuth from "./pages/ChildAuth";
import NotFound from "./pages/NotFound";
import Rewards from "./pages/Rewards";
import Lists from "./pages/Lists";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import MemberManagement from "./pages/admin/MemberManagement";
import RotatingTasksManagement from "./pages/admin/RotatingTasksManagement";
import CalendarSettings from "./pages/admin/CalendarSettings";
import RewardsManagement from "./pages/admin/RewardsManagement";
import RewardApprovals from "./pages/admin/RewardApprovals";
import { ScreenSaverManagement } from "./pages/admin/ScreenSaverManagement";
import { ScreenSaverPreview } from "./pages/ScreenSaverPreview";
import DashboardMode from "./pages/admin/DashboardMode";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/child-auth" element={<ChildAuth />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/lists" element={<Lists />} />
            <Route path="/screensaver-preview" element={<ScreenSaverPreview />} />
            
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="members" element={<MemberManagement />} />
            <Route path="rotating-tasks" element={<RotatingTasksManagement />} />
            <Route path="calendar-settings" element={<CalendarSettings />} />
            <Route path="rewards" element={<RewardsManagement />} />
            <Route path="reward-approvals" element={<RewardApprovals />} />
            <Route path="dashboard" element={<DashboardMode />} />
            <Route path="screensaver" element={<ScreenSaverManagement />} />
          </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
