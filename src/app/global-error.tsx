"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h2>Something went wrong</h2>
        <p style={{ color: "#666" }}>The error has been reported automatically.</p>
        <button
          onClick={reset}
          style={{
            marginTop: "1rem",padding: "0.5rem 1.5rem",
            border: "1px solid #ccc", borderRadius: 6, cursor: "pointer",
            background: "#f5f5f0",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
