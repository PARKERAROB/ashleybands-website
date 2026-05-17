const nextConfig = {
  async redirects() {
    return [
      { source: "/info/corporate-sponsorship", destination: "/sponsors", permanent: true },
      { source: "/info/family-sponsorship", destination: "/sponsors", permanent: true }
    ];
  }
};

export default nextConfig;
