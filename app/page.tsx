import Dashboard from "./components/Dashboard";

export default function Home() {
  return (
    <div className="container">
      <header className="app-header">
        <h1>Signal</h1>
        <span className="tagline">watchlist · AI calls · insider flow</span>
      </header>
      <Dashboard />
    </div>
  );
}
