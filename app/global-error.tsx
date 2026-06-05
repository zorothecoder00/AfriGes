"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "sans-serif", padding: "2rem", background: "#fafafa" }}>
        <div style={{ maxWidth: 600, margin: "auto", background: "#fff", borderRadius: 12, padding: "2rem", boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}>
          <h1 style={{ color: "#dc2626", marginTop: 0 }}>Erreur application</h1>
          <p style={{ color: "#374151" }}>
            Une exception s&apos;est produite côté client.
          </p>
          {error?.message && (
            <pre style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "1rem", overflowX: "auto", fontSize: 13, color: "#991b1b" }}>
              {error.message}
            </pre>
          )}
          {error?.digest && (
            <p style={{ fontSize: 12, color: "#9ca3af" }}>Digest : {error.digest}</p>
          )}
          {error?.stack && (
            <details style={{ marginTop: "1rem" }}>
              <summary style={{ cursor: "pointer", color: "#6b7280", fontSize: 13 }}>Stack trace</summary>
              <pre style={{ background: "#f3f4f6", borderRadius: 8, padding: "1rem", overflowX: "auto", fontSize: 11, color: "#374151", marginTop: 8 }}>
                {error.stack}
              </pre>
            </details>
          )}
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
            <button
              onClick={reset}
              style={{ padding: "0.5rem 1.25rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
            >
              Réessayer
            </button>
            <a
              href="/"
              style={{ padding: "0.5rem 1.25rem", background: "#e5e7eb", color: "#374151", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}
            >
              Accueil
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
