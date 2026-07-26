"use client"

// Replaces the root layout when it crashes: no providers, no global CSS — keep this self-contained.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "Roboto, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          background: "#FDFDF5",
          color: "#1A1C18",
        }}
      >
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>页面出错了 / Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#44483F", marginBottom: 8 }}>
            应用遇到了意外错误，请重试或刷新页面。
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#44483F", marginBottom: 24 }}>
            The app hit an unexpected error. Please retry or reload the page.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#74796D", marginBottom: 16 }}>digest: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              border: "none",
              borderRadius: 9999,
              padding: "10px 28px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: "#4A8135",
              color: "#FFFFFF",
            }}
          >
            重试 / Try again
          </button>
        </div>
      </body>
    </html>
  )
}
