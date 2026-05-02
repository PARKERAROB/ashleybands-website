import SiteNav from "@/components/SiteNav";
import "./styles.css";

export const metadata = {
  title: "Bands of AHS",
  description: "Ashley High School Band information, calendar links, family resources, and assistant."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
