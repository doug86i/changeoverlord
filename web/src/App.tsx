import { Routes, Route, NavLink, Outlet } from "react-router-dom";
import { useTheme } from "./theme/ThemeContext";
import { AuthGate } from "./auth/AuthGate";
import { EventsPage } from "./pages/EventsPage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { StageDetailPage } from "./pages/StageDetailPage";
import { StageDayPage } from "./pages/StageDayPage";
import { ClockPage } from "./pages/ClockPage";
import { ClockDayPage } from "./pages/ClockDayPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";

function Layout() {
  const { toggle, theme } = useTheme();
  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "0.75rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <NavLink
          to="/"
          style={({ isActive }) => ({
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: "0.85rem",
            color: isActive ? "var(--color-brand)" : "var(--color-text)",
          })}
        >
          Changeoverlord
        </NavLink>
        <nav style={{ display: "flex", gap: "1rem", flex: 1 }}>
          <NavLink to="/">Events</NavLink>
          <NavLink to="/clock">Clock</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <button type="button" onClick={toggle} title="Toggle theme">
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </header>
      <main
        style={{
          flex: 1,
          padding: "1.25rem",
          maxWidth: 960,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <Outlet />
      </main>
      <footer
        className="muted"
        style={{
          borderTop: "1px solid var(--color-border)",
          padding: "0.75rem 1.25rem",
          textAlign: "center",
          fontSize: "0.8rem",
        }}
      >
        Powered by{" "}
        <a href="https://www.doughunt.co.uk/" target="_blank" rel="noreferrer">
          Doug Hunt Sound &amp; Light
        </a>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <AuthGate>
            <Layout />
          </AuthGate>
        }
      >
        <Route index element={<EventsPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="stages/:stageId" element={<StageDetailPage />} />
        <Route path="stage-days/:stageDayId" element={<StageDayPage />} />
        <Route path="clock" element={<ClockPage />} />
        <Route path="clock/day/:stageDayId" element={<ClockDayPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
