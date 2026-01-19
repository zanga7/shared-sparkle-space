import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
import NetworkStatusIndicator from "@/components/NetworkStatusIndicator";
import { VersionBadge } from "@/components/ui/version-badge";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { GoalsProvider } from "@/hooks/useGoals";
import { ColorPaletteProvider } from "@/contexts/ColorPaletteContext";
import { OnboardingRedirect } from "@/components/OnboardingRedirect";
import { RouteMemoryProvider } from "@/components/RouteMemoryProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ChildAuth from "./pages/ChildAuth";
import NotFound from "./pages/NotFound";
import Rewards from "./pages/Rewards";
import Lists from "./pages/Lists";
import Goals from "./pages/Goals";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import MemberManagement from "./pages/admin/MemberManagement";
import CalendarSettings from "./pages/admin/CalendarSettings";
import RewardsManagement from "./pages/admin/RewardsManagement";
import RewardApprovals from "./pages/admin/RewardApprovals";
import { ScreenSaverManagement } from "./pages/admin/ScreenSaverManagement";
import { ScreenSaverPreview } from "./pages/ScreenSaverPreview";
import Permissions from "./pages/admin/Permissions";
import RotatingTasks from "./pages/admin/RotatingTasks";


import HolidayManagement from "./pages/admin/HolidayManagement";
import { SuperAdminGuard } from "./components/super-admin/SuperAdminGuard";
import SuperAdminLayout from "./pages/super-admin/SuperAdminLayout";
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import FamilyManagement from "./pages/super-admin/FamilyManagement";
import PlanManagement from "./pages/super-admin/PlanManagement";
import ThemesManagement from "./pages/super-admin/ThemesManagement";
import IntegrationsManagement from "./pages/super-admin/IntegrationsManagement";
import AppSettings from "./pages/super-admin/AppSettings";
import CelebrationsManagement from "./pages/admin/CelebrationsManagement";
import Welcome from "./pages/onboarding/Welcome";
import CreateCrew from "./pages/onboarding/CreateCrew";
import AddCelebrations from "./pages/onboarding/AddCelebrations";
import FeatureHighlights from "./pages/onboarding/FeatureHighlights";
import Complete from "./pages/onboarding/Complete";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GoalsProvider>
        <ColorPaletteProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <PWAInstallPrompt />
            <PWAUpdatePrompt />
            <NetworkStatusIndicator />
            <VersionBadge />

            <BrowserRouter>
              <RouteMemoryProvider>
                <OnboardingRedirect>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/child-auth" element={<ChildAuth />} />
                    <Route path="/rewards" element={<Rewards />} />
                    <Route path="/lists" element={<Lists />} />
                    <Route path="/goals" element={<Goals />} />
                    <Route path="/screensaver-preview" element={<ScreenSaverPreview />} />

                    {/* Onboarding Routes */}
                    <Route path="/onboarding/welcome" element={<Welcome />} />
                    <Route path="/onboarding/crew" element={<CreateCrew />} />
                    <Route path="/onboarding/celebrations" element={<AddCelebrations />} />
                    <Route path="/onboarding/features" element={<FeatureHighlights />} />
                    <Route path="/onboarding/complete" element={<Complete />} />

                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="members" element={<MemberManagement />} />
                      <Route path="calendar-settings" element={<CalendarSettings />} />
                      <Route path="rewards" element={<RewardsManagement />} />
                      <Route path="reward-approvals" element={<RewardApprovals />} />
                      <Route path="permissions" element={<Permissions />} />
                      <Route path="screensaver" element={<ScreenSaverManagement />} />
                      <Route path="rotating-tasks" element={<RotatingTasks />} />
                      <Route path="holidays" element={<HolidayManagement />} />
                      <Route path="holidays" element={<HolidayManagement />} />
                      <Route path="celebrations" element={<CelebrationsManagement />} />
                    </Route>

                    <Route
                      path="/super-admin"
                      element={
                        <SuperAdminGuard>
                          <SuperAdminLayout />
                        </SuperAdminGuard>
                      }
                    >
                      <Route index element={<SuperAdminDashboard />} />
                      <Route path="families" element={<FamilyManagement />} />
                      <Route path="plans" element={<PlanManagement />} />
                      <Route path="integrations" element={<IntegrationsManagement />} />
                      <Route path="app-settings" element={<AppSettings />} />
                      <Route path="themes" element={<ThemesManagement />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </OnboardingRedirect>
              </RouteMemoryProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ColorPaletteProvider>
      </GoalsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

