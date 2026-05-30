const nextConfig = {
  async redirects() {
    return [
      { source: "/info/corporate-sponsorship", destination: "/sponsors", permanent: true },
      { source: "/info/family-sponsorship", destination: "/sponsors", permanent: true },
      // Retired routes (IA cleanup 2026-05-29). /members was a dead placeholder;
      // /sitemap-page was a nav crutch now that the nav is structured.
      { source: "/members", destination: "/portal", permanent: false },
      { source: "/sitemap-page", destination: "/", permanent: false }
    ];
  }
};

export default nextConfig;
