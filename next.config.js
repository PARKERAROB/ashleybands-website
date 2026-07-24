const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
          // TODO CSP: enumerate third-party origins first (Supabase, PayPal, Resend, Anthropic)
        ]
      }
    ];
  },
  async redirects() {
    return [
      {
        source: "/band-camp-handbook",
        destination: "/resources/band-camp/handbook.html",
        permanent: false
      },
      { source: "/info/corporate-sponsorship", destination: "/sponsors", permanent: true },
      { source: "/info/family-sponsorship", destination: "/sponsors", permanent: true },
      // Retired routes (IA cleanup 2026-05-29). /members was a dead placeholder.
      // /sitemap-page REVIVED 2026-07-06 (Rob: reach every page without asking) - linked from the footer.
      { source: "/members", destination: "/portal", permanent: false }
    ];
  }
};

export default nextConfig;
