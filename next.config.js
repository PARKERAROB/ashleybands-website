const nextConfig = {
  async redirects() {
    return [
      { source: "/info/corporate-sponsorship", destination: "/sponsors", permanent: true },
      { source: "/info/family-sponsorship", destination: "/sponsors", permanent: true },
      // Retired routes (IA cleanup 2026-05-29). /members was a dead placeholder.
      // /sitemap-page REVIVED 2026-07-06 (Rob: reach every page without asking) - linked from the footer.
      { source: "/members", destination: "/portal", permanent: false }
    ];
  }
};

export default nextConfig;
