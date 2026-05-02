import SiteNav from "@/components/SiteNav";
import "./styles.css";

export const metadata = {
  title: "Bands of AHS",
  description: "Ashley High School Band information, calendar links, family resources, and assistant."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
