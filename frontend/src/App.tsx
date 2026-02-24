import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import { QueryProvider } from "./context/QueryProvider";
import { ZoomProvider } from "./context/ZoomContext";
import ErrorBoundary from "./components/ErrorBoundary";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const HelpDocs = lazy(() => import("./pages/HelpDocs"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const App = () => {
  return (
    <ErrorBoundary>
      <ZoomProvider>
        <QueryProvider>
          <AuthProvider>
            <RealtimeProvider>
              <Suspense fallback={<PageLoader />}>
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<Navigate to="/admin" replace />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/help" element={<HelpDocs />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ErrorBoundary>
              </Suspense>
            </RealtimeProvider>
          </AuthProvider>
        </QueryProvider>
      </ZoomProvider>
    </ErrorBoundary>
  );
};

export default App;
