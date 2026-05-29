// Shared bar across all /admin/* pages so every staff dashboard can get back to
// the hub. Intentionally minimal (server component, just a link) — does not touch
// any dashboard's auth or data logic.
export default function AdminLayout({ children }) {
  return (
    <>
      <div style={bar}>
        <a href="/admin" style={link}>← Staff Home</a>
      </div>
      {children}
    </>
  );
}

const bar = {
  borderBottom: "1px solid #ded4bf",
  background: "#fffaf0",
  padding: "6px 16px",
  fontFamily: "system-ui, sans-serif"
};
const link = { color: "#7b1829", fontSize: 13, fontWeight: 600, textDecoration: "none" };
