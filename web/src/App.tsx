import { useState, useCallback, useMemo } from "react";
import { resolveMyStageTodayPath } from "./lib/myStageToday";
import { Routes, Route, NavLink, Outlet, useMatch, useNavigate, useLocation } from "react-router-dom";
import { ClockNavProvider, useClockNav } from "./ClockNavContext";
import { useTheme } from "./theme/ThemeContext";
import { AuthGate } from "./auth/AuthGate";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { SearchDialog } from "./components/SearchDialog";
import { KeyboardShortcutsOverlay, useGlobalShortcuts } from "./components/KeyboardShortcuts";
import { EventsPage } from "./pages/EventsPage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { StageDetailPage } from "./pages/StageDetailPage";
import { StageDayPage } from "./pages/StageDayPage";
import { ClockPage } from "./pages/ClockPage";
import { ClockDayPage } from "./pages/ClockDayPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";
import { PatchPage } from "./pages/PatchPage";
import { PatchTemplateEditorPage } from "./pages/PatchTemplateEditorPage";
import { PerformanceFilesPage } from "./pages/PerformanceFilesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { StageChatDock } from "./components/StageChatDock";
import { HeaderEventLogo } from "./components/HeaderEventLogo";

function Layout() {
  const { toggle, theme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { preferredStageDayId } = useClockNav();
  const clockHref = useMemo(
    () => (preferredStageDayId ? `/clock/day/${preferredStageDayId}` : "/clock"),
    [preferredStageDayId],
  );
  const clockNavActive = pathname === "/clock" || pathname.startsWith("/clock/");
  const patchView = useMatch("/patch/:performanceId");
  const templateEditView = useMatch("/patch-templates/:templateId/edit");
  const wideMain = Boolean(patchView || templateEditView);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const [myStageBusy, setMyStageBusy] = useState(false);

  const goMyStageToday = useCallback(async () => {
    setMyStageBusy(true);
    try {
      const path = await resolveMyStageTodayPath();
      navigate(path);
      closeMenu();
    } finally {
      setMyStageBusy(false);
    }
  }, [navigate, closeMenu]);

  const goClock = useCallback(() => {
    navigate(clockHref);
  }, [navigate, clockHref]);

  useGlobalShortcuts({
    onSearch: openSearch,
    onHelp: openHelp,
    navigate,
    onMyStageToday: goMyStageToday,
    onClockNavigate: goClock,
  });

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <ConnectionStatus />
      <header className="app-header">
        <div className="header-row">
          <div className="header-brand-cluster">
            <HeaderEventLogo />
            <NavLink to="/" className="brand-link" onClick={closeMenu}>
              Changeoverlord
            </NavLink>
          </div>
          <button
            type="button"
            className="hamburger"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>
          <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`}>
            <NavLink to="/" onClick={closeMenu} end>
              Events
            </NavLink>
            <button
              type="button"
              className="primary nav-my-stage"
              disabled={myStageBusy}
              aria-label="My stage today — open today’s running order for your stage (server date; uses last visit when it’s today)"
              title="Open today’s stage-day running order for your stage (server date). Uses last visit when it’s today."
              onClick={() => void goMyStageToday()}
            >
              {myStageBusy ? "…" : "My stage today"}
            </button>
            <NavLink
              to={clockHref}
              className={({ isActive }) =>
                isActive || clockNavActive ? "active" : undefined
              }
              onClick={closeMenu}
            >
              Clock
            </NavLink>
            <NavLink to="/settings" onClick={closeMenu}>Settings</NavLink>
          </nav>
          <button
            type="button"
            className="icon-btn"
            aria-label="Search — press slash or Ctrl+K"
            title="Search (/ or Ctrl+K)"
            onClick={openSearch}
            style={{ fontSize: "0.9rem" }}
          >
            🔍
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title="Toggle theme"
            className="theme-toggle"
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </header>
      <main
        id="main-content"
        className={wideMain ? "main-wide" : "main-narrow"}
      >
        <Outlet />
      </main>
      <footer className="app-footer muted">
        Powered by{" "}
        <a href="https://www.doughunt.co.uk/" target="_blank" rel="noreferrer">
          Doug Hunt Sound &amp; Light
        </a>
      </footer>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcutsOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <StageChatDock />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <AuthGate>
              <ClockNavProvider>
                <Layout />
              </ClockNavProvider>
            </AuthGate>
          }
        >
          <Route index element={<EventsPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="stages/:stageId" element={<StageDetailPage />} />
          <Route path="stage-days/:stageDayId" element={<StageDayPage />} />
          <Route path="clock" element={<ClockPage />} />
          <Route path="clock/day/:stageDayId" element={<ClockDayPage />} />
          <Route path="patch/:performanceId" element={<PatchPage />} />
          <Route
            path="performances/:performanceId/files"
            element={<PerformanceFilesPage />}
          />
          <Route
            path="patch-templates/:templateId/edit"
            element={<PatchTemplateEditorPage />}
          />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
