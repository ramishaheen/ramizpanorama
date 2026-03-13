import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider, useLanguage } from "@/hooks/useLanguage";
import { AuthProvider } from "@/hooks/useAuth";
import { MapSyncProvider } from "@/hooks/useMapSync";
import { SplashScreen } from "@/components/SplashScreen";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import Index from "./pages/Index";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

const Auth = lazy(() => import("./pages/Auth"));
const IntelMap = lazy(() => import("./pages/intel/IntelMap"));
const SourceRegistry = lazy(() => import("./pages/intel/SourceRegistry"));
const ReviewQueue = lazy(() => import("./pages/intel/ReviewQueue"));
const MonitorWall = lazy(() => import("./pages/intel/MonitorWall"));
const TrafficLayer = lazy(() => import("./pages/intel/TrafficLayer"));
const EventsFeed = lazy(() => import("./pages/intel/EventsFeed"));
const Incidents = lazy(() => import("./pages/intel/Incidents"));
const Watchlists = lazy(() => import("./pages/intel/Watchlists"));
const SourceHealth = lazy(() => import("./pages/intel/SourceHealth"));
const Connectors = lazy(() => import("./pages/intel/Connectors"));

const queryClient = new QueryClient();

const Loader = () => <div className="flex items-center justify-center h-screen bg-background"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

const AppContent = () => {
  const { dir } = useLanguage();
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  // Fail-safe to avoid any stuck splash black screen
  useEffect(() => {
    if (splashDone) return;
    const guard = window.setTimeout(() => setSplashDone(true), 4500);
    return () => window.clearTimeout(guard);
  }, [splashDone]);

  return (
    <div dir={dir} className="h-full">
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      <AppErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<Loader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/install" element={<Install />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/intel" element={<IntelMap />} />
              <Route path="/intel/sources" element={<SourceRegistry />} />
              <Route path="/intel/review" element={<ReviewQueue />} />
              <Route path="/intel/monitor" element={<MonitorWall />} />
              <Route path="/intel/traffic" element={<TrafficLayer />} />
              <Route path="/intel/events" element={<EventsFeed />} />
              <Route path="/intel/incidents" element={<Incidents />} />
              <Route path="/intel/watchlists" element={<Watchlists />} />
              <Route path="/intel/health" element={<SourceHealth />} />
              <Route path="/intel/connectors" element={<Connectors />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppErrorBoundary>
      <Toaster />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <MapSyncProvider>
          <AppContent />
        </MapSyncProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
