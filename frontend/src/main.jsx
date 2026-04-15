import React, { useState } from "react";
import ReactDOM from "react-dom/client";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "1rem",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: "56px", height: "56px",
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            borderRadius: "12px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem",
          }}>
            <span style={{ fontSize: "24px" }}>📄</span>
          </div>
          <h1 style={{ margin: 0, color: "#4f46e5", fontSize: "1.5rem", fontWeight: 700 }}>
            MPDO Tracker
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
            Municipal Planning and Development Office
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: "white",
          borderRadius: "16px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          padding: "2rem",
        }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", color: "#111" }}>Welcome Back</h2>
          <p style={{ margin: "0 0 1.5rem", color: "#6b7280" }}>Sign in to your account to continue</p>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "6px", fontSize: "0.875rem" }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@alubijid.gov.ph"
              style={{
                width: "100%", padding: "10px 14px", border: "1px solid #d1d5db",
                borderRadius: "8px", fontSize: "0.95rem", boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "6px", fontSize: "0.875rem" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%", padding: "10px 14px", border: "1px solid #d1d5db",
                borderRadius: "8px", fontSize: "0.95rem", boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <button
            style={{
              width: "100%", padding: "12px", background: "#4f46e5",
              color: "white", border: "none", borderRadius: "8px",
              fontSize: "1rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            Sign In
          </button>
        </div>

        {/* Demo Credentials */}
        <div style={{
          marginTop: "1.5rem", background: "white",
          borderRadius: "12px", padding: "1.25rem",
          border: "2px solid #e0e7ff",
        }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.875rem", color: "#4f46e5", fontWeight: 600 }}>
            Admin Account:
          </p>
          <p style={{ margin: "2px 0", fontSize: "0.85rem", color: "#374151" }}>
            Email: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px" }}>
              demo@alubijid.gov.ph
            </code>
          </p>
          <p style={{ margin: "2px 0", fontSize: "0.85rem", color: "#374151" }}>
            Password: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px" }}>
              demo123
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
