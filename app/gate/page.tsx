"use client";

import { useState } from "react";

export default function GatePage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      setError("Incorrect secret.");
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 380, paddingTop: 80 }}>
      <header className="app-header">
        <h1>Signal</h1>
      </header>
      <p className="muted small">This instance is protected. Enter the shared secret.</p>
      <form onSubmit={submit} className="panel">
        {error && <div className="error-box">{error}</div>}
        <input
          type="password"
          placeholder="Shared secret"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoFocus
        />
        <button className="btn" style={{ marginTop: 12, width: "100%" }} disabled={loading}>
          {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
