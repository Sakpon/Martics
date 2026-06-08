// Edge HTTP Basic Auth gate for the /audit/* subtree only (the page + /audit/api/*).
// Placed under functions/audit/, so it runs for every route beneath /audit and
// leaves the public landing / LIFF pages open.
//
// Credentials come from environment variables on the Pages project:
//   BASIC_AUTH_USERNAME (default: martics)
//   BASIC_AUTH_PASSWORD (no default — MUST be set, or the page stays locked)
// Basic Auth is only safe over HTTPS, which Cloudflare provides.

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Martics AIO Audit"' },
  });
}

// Constant-time-ish string compare to avoid trivial timing leaks.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const user = env.BASIC_AUTH_USERNAME || "martics";
  const pass = env.BASIC_AUTH_PASSWORD;

  // Fail closed: if no password is configured, never serve the audit tools.
  if (!pass) {
    return new Response(
      "Audit access is not configured. Set BASIC_AUTH_PASSWORD on the Pages project.",
      { status: 503 },
    );
  }

  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return unauthorized();

  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return unauthorized();
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);
  if (!safeEqual(u, user) || !safeEqual(p, pass)) return unauthorized();

  return next();
}
