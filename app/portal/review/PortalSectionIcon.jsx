export default function PortalSectionIcon({ type }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true
  };

  const art = {
    person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" /></>,
    instrument: <><path d="M3 10h8l7-4v12l-7-4H3Z" /><path d="M18 9h3M18 15h3M6 10V7M9 10V7M12 9V6" /><path d="M5 14v3h5" /></>,
    shirt: <><path d="M8 4 3.5 6.5 6 11l2-1v10h8V10l2 1 2.5-4.5L16 4c-.8 1.2-2.1 2-4 2S8.8 5.2 8 4Z" /></>,
    funding: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5c-.8-.7-1.9-1-3.2-1-1.8 0-3 .9-3 2.2 0 3.2 6.1 1.7 6.1 4.8 0 1.3-1.3 2.2-3.2 2.2-1.5 0-2.8-.5-3.7-1.3M12 5.5v13" /></>
  };

  return <span className="portal-section-icon"><svg {...common}>{art[type] || art.person}</svg></span>;
}
