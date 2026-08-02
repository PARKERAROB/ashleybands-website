import RegimentOsClient from "./RegimentOsClient";

export const metadata = {
  title: "Regiment OS Review | Ashley Bands",
  description: "Private working view of the Screaming Eagle Regiment operating system.",
  robots: { index: false, follow: false }
};

export default function RegimentOsPage() {
  return <RegimentOsClient />;
}
