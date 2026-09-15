import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AlertsPage } from "./pages/AlertsPage";
import { ChatPage } from "./pages/ChatPage";
import { DataQualityPage } from "./pages/DataQualityPage";
import { FailuresPage } from "./pages/FailuresPage";
import { HomePage } from "./pages/HomePage";
import { PipelinesPage } from "./pages/PipelinesPage";
import { RunExplorerPage } from "./pages/RunExplorerPage";
import { TrendsPage } from "./pages/TrendsPage";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="trends" element={<TrendsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="pipelines" element={<PipelinesPage />} />
            <Route path="failures" element={<FailuresPage />} />
            <Route path="data-quality" element={<DataQualityPage />} />
            <Route path="runs" element={<RunExplorerPage />} />
            <Route path="chat" element={<ChatPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
