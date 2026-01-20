import React, { Suspense, lazy } from "react";
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
import { GlobalStyleProvider } from "@/contexts/GlobalStyleContext";
import { OnboardingRedirect } from "@/components/OnboardingRedirect";
import { RouteMemoryProvider } from "@/components/RouteMemoryProvider";

// Eagerly loaded critical routes
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy loaded routes for code splitting
const ChildAuth = lazy(() => import("./pages/ChildAuth"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Lists = lazy(() => import("./pages/Lists"));
const Goals = lazy(() => import("./pages/Goals"));
const ScreenSaverPreview = lazy(() => import("./pages/ScreenSaverPreview").then(m => ({ default: m.ScreenSaverPreview })));

// Admin routes - lazy loaded
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const MemberManagement = lazy(() => import("./pages/admin/MemberManagement"));
const CalendarSettings = lazy(() => import("./pages/admin/CalendarSettings"));
const RewardsManagement = lazy(() => import("./pages/admin/RewardsManagement"));
const RewardApprovals = lazy(() => import("./pages/admin/RewardApprovals"));
const ScreenSaverManagement = lazy(() => import("./pages/admin/ScreenSaverManagement").then(m => ({ default: m.ScreenSaverManagement })));
const Permissions = lazy(() => import("./pages/admin/Permissions"));
const RotatingTasks = lazy(() => import("./pages/admin/RotatingTasks"));
const HolidayManagement = lazy(() => import("./pages/admin/HolidayManagement"));
const CelebrationsManagement = lazy(() => import("./pages/admin/CelebrationsManagement"));

// Super Admin routes - lazy loaded
const SuperAdminGuard = lazy(() => import("./components/super-admin/SuperAdminGuard").then(m => ({ default: m.SuperAdminGuard })));
const SuperAdminLayout = lazy(() => import("./pages/super-admin/SuperAdminLayout"));
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/SuperAdminDashboard"));
const FamilyManagement = lazy(() => import("./pages/super-admin/FamilyManagement"));
const PlanManagement = lazy(() => import("./pages/super-admin/PlanManagement"));
const ThemesManagement = lazy(() => import("./pages/super-admin/ThemesManagement"));
const IntegrationsManagement = lazy(() => import("./pages/super-admin/IntegrationsManagement"));
const AppSettings = lazy(() => import("./pages/super-admin/AppSettings"));
const StyleSettings = lazy(() => import("./pages/super-admin/StyleSettings"));

// Onboarding routes - lazy loaded
const Welcome = lazy(() => import("./pages/onboarding/Welcome"));
const SelectPlan = lazy(() => import("./pages/onboarding/SelectPlan"));
const CreateCrew = lazy(() => import("./pages/onboarding/CreateCrew"));
const AddCelebrations = lazy(() => import("./pages/onboarding/AddCelebrations"));
const FeatureHighlights = lazy(() => import("./pages/onboarding/FeatureHighlights"));
const Complete = lazy(() => import("./pages/onboarding/Complete"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 1000 * 60 * 2, // 2 minutes - slightly increased for better caching
      gcTime: 1000 * 60 * 10, // 10 minutes - extended cache retention
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GlobalStyleProvider>
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
                    <Suspense fallback={<PageLoader />}>
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
                        <Route path="/onboarding/plan" element={<SelectPlan />} />
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
                          <Route path="styles" element={<StyleSettings />} />
                        </Route>

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </OnboardingRedirect>
                </RouteMemoryProvider>
              </BrowserRouter>
            </TooltipProvider>
          </ColorPaletteProvider>
        </GoalsProvider>
      </GlobalStyleProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

