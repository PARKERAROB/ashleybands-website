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
    instrument: <><path d="M7 5h7v9.5a3.5 3.5 0 1 1-2-3.15V4l5-1v3" /><path d="M7 8h5" /></>,
    shirt: <><path d="M8 4 3.5 6.5 6 11l2-1v10h8V10l2 1 2.5-4.5L16 4c-.8 1.2-2.1 2-4 2S8.8 5.2 8 4Z" /></>,
    funding: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5c-.8-.7-1.9-1-3.2-1-1.8 0-3 .9-3 2.2 0 3.2 6.1 1.7 6.1 4.8 0 1.3-1.3 2.2-3.2 2.2-1.5 0-2.8-.5-3.7-1.3M12 5.5v13" /></>
  };

  return <span className="portal-section-icon"><svg {...common}>{art[type] || art.person}</svg></span>;
}
