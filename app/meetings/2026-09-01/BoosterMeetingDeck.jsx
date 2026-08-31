"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { meetingSlides } from "./slides";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function SourceLine({ children }) {
  if (!children) return null;
  return <p className="meeting-source">Source: {children}</p>;
}

function SlideContent({ slide }) {
  if (slide.kind === "cover") {
    return (
      <div className="meeting-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.image} alt="Minnie Evans Arts Center" className="meeting-cover-image" />
        <div className="meeting-cover-scrim" />
        <div className="meeting-cover-copy">
          <p className="meeting-kicker">{slide.kicker}</p>
          <h1>{slide.title}</h1>
          <p className="meeting-cover-subtitle">{slide.subtitle}</p>
          <p className="meeting-cover-detail">{slide.detail}</p>
        </div>
      </div>
    );
  }

  if (slide.kind === "agenda") {
    return (
      <div className="meeting-frame meeting-frame-agenda">
        <p className="meeting-kicker">{slide.kicker}</p>
        <h2>{slide.title}</h2>
        <div className="meeting-agenda-list">
          {slide.entries.map(([time, label]) => (
            <div className="meeting-agenda-row" key={time}>
              <span>{time}</span>
              <p>{label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (slide.kind === "photo") {
    return (
      <div className="meeting-photo-slide">
        <div className="meeting-photo-copy">
          <p className="meeting-kicker">{slide.kicker}</p>
          <h2>{slide.title}</h2>
          <p className="meeting-lead">{slide.body}</p>
        </div>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.image} alt={slide.caption} />
          <figcaption>{slide.caption}</figcaption>
        </figure>
      </div>
    );
  }

  if (slide.kind === "split") {
    return (
      <div className="meeting-frame">
        <p className="meeting-kicker">{slide.kicker}</p>
        <h2>{slide.title}</h2>
        <div className="meeting-split">
          {[slide.left, slide.right].map((side) => (
            <section key={side.label}>
              <p className="meeting-split-label">{side.label}</p>
              {side.number ? <strong className="meeting-split-number">{side.number}</strong> : null}
              <ul>
                {side.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>
        <SourceLine>{slide.source}</SourceLine>
      </div>
    );
  }

  if (slide.kind === "list") {
    return (
      <div className="meeting-frame meeting-frame-list">
        <p className="meeting-kicker">{slide.kicker}</p>
        <h2>{slide.title}</h2>
        {slide.lead ? <p className="meeting-lead">{slide.lead}</p> : null}
        <ul className="meeting-bullets">
          {slide.bullets.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <SourceLine>{slide.source}</SourceLine>
      </div>
    );
  }

  if (slide.kind === "stats") {
    return (
      <div className="meeting-frame">
        <p className="meeting-kicker">{slide.kicker}</p>
        <h2>{slide.title}</h2>
        <div className="meeting-stats">
          {slide.stats.map(([number, label]) => (
            <div key={label}>
              <strong>{number}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {slide.note ? <p className="meeting-note">{slide.note}</p> : null}
        <SourceLine>{slide.source}</SourceLine>
      </div>
    );
  }

  if (slide.kind === "hero-number") {
    return (
      <div className="meeting-frame meeting-frame-number">
        <p className="meeting-kicker">{slide.kicker}</p>
        <h2>{slide.title}</h2>
        <div className={slide.url ? "meeting-number-with-qr" : ""}>
          <div>
            <strong className="meeting-hero-number">{slide.number}</strong>
            <p className="meeting-hero-subtitle">{slide.subtitle}</p>
          </div>
          {slide.url ? <div className="meeting-number-qr"><QRCodeSVG value={slide.url} size={280} bgColor="#fffaf0" fgColor="#4f101c" /><span>Scan to commit and pay</span><a href={slide.url}>{slide.urlLabel}</a></div> : null}
        </div>
        <p className="meeting-number-body">{slide.body}</p>
        <SourceLine>{slide.source}</SourceLine>
      </div>
    );
  }

  if (slide.kind === "schedule") {
    return (
      <div className="meeting-frame">
        <p className="meeting-kicker">{slide.kicker}</p>
        <h2>{slide.title}</h2>
        <div className="meeting-schedule">
          {slide.entries.map(([date, amount, label]) => (
            <div key={`${date}-${label}`}>
              <span className="meeting-schedule-date">{date}</span>
              <strong>{amount}</strong>
              <p>{label}</p>
            </div>
          ))}
        </div>
        {slide.note ? <p className="meeting-note">{slide.note}</p> : null}
      </div>
    );
  }

  if (slide.kind === "action") {
    return (
      <div className="meeting-frame">
        <p className="meeting-kicker">{slide.kicker}</p>
        <h2>{slide.title}</h2>
        <div className="meeting-actions">
          {slide.actions.map(([number, label, text]) => (
            <div key={number}>
              <strong>{number}</strong>
              <h3>{label}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <p className="meeting-note">{slide.note}</p>
      </div>
    );
  }

  if (slide.kind === "section") {
    return (
      <div className={`meeting-section-slide meeting-section-${slide.theme || "default"}`}>
        <p className="meeting-kicker">{slide.kicker}</p>
        <h2>{slide.title}</h2>
        <p>{slide.subtitle}</p>
      </div>
    );
  }

  if (slide.kind === "flyer") {
    return (
      <div className="meeting-flyer-slide">
        <div className="meeting-flyer-copy">
          <p className="meeting-kicker">{slide.kicker}</p>
          <h2>{slide.title}</h2>
          <ul className="meeting-bullets">
            {slide.bullets.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <SourceLine>{slide.source}</SourceLine>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.image} alt="CFS Mattress Fundraiser flyer" />
      </div>
    );
  }

  if (slide.kind === "qr") {
    return (
      <div className="meeting-qr-slide">
        <div>
          <p className="meeting-kicker">{slide.kicker}</p>
          <h2>{slide.title}</h2>
          <p className="meeting-lead">{slide.body}</p>
          <a href={slide.url}>{slide.urlLabel}</a>
        </div>
        <div className="meeting-qr-code">
          <QRCodeSVG value={slide.url} size={420} bgColor="#fffaf0" fgColor="#4f101c" />
          <span>Scan and share</span>
        </div>
      </div>
    );
  }

  if (slide.kind === "video") {
    return (
      <div className="meeting-video-slide">
        <p className="meeting-kicker">{slide.kicker}</p>
        <h2>{slide.title}</h2>
        <a className="meeting-video-launch" href={slide.fallback} target="_blank" rel="noreferrer">
          <span aria-hidden="true">▶</span>
          <strong>{slide.buttonLabel}</strong>
          <small>Vimeo opens in a new tab</small>
        </a>
        <p className="meeting-note">{slide.note}</p>
      </div>
    );
  }

  return (
    <div className="meeting-close-slide">
      <p className="meeting-kicker">{slide.kicker}</p>
      <h2>{slide.title}</h2>
      <p>{slide.subtitle}</p>
    </div>
  );
}

export default function BoosterMeetingDeck() {
  const [index, setIndex] = useState(0);
  const [overview, setOverview] = useState(false);
  const touchStart = useRef(null);

  const goTo = useCallback((nextIndex) => {
    const safeIndex = clamp(nextIndex, 0, meetingSlides.length - 1);
    setIndex(safeIndex);
    const url = new URL(window.location.href);
    url.searchParams.set("slide", String(safeIndex + 1));
    window.history.replaceState({}, "", url);
  }, []);

  useEffect(() => {
    const requested = Number(new URL(window.location.href).searchParams.get("slide"));
    if (Number.isFinite(requested) && requested >= 1) {
      const frame = window.requestAnimationFrame(() => {
        setIndex(clamp(requested - 1, 0, meetingSlides.length - 1));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, []);

  useEffect(() => {
    function onKey(event) {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        goTo(index + 1);
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === "Home") {
        goTo(0);
      } else if (event.key === "End") {
        goTo(meetingSlides.length - 1);
      } else if (event.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.();
      } else if (event.key.toLowerCase() === "o") {
        setOverview((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index]);

  const slide = meetingSlides[index];
  const progress = ((index + 1) / meetingSlides.length) * 100;

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  }

  return (
    <main
      className="meeting-deck-root"
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current == null) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
        if (Math.abs(delta) > 55) goTo(index + (delta < 0 ? 1 : -1));
        touchStart.current = null;
      }}
    >
      <div className="meeting-progress" style={{ width: `${progress}%` }} />
      <div className={`meeting-slide meeting-slide-kind-${slide.kind}`} aria-live="polite">
        <SlideContent slide={slide} />
      </div>

      <div className="meeting-controls" aria-label="Presentation controls">
        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous slide">←</button>
        <button type="button" onClick={() => setOverview(true)} className="meeting-slide-count">
          {index + 1} / {meetingSlides.length}
        </button>
        <button type="button" onClick={() => goTo(index + 1)} disabled={index === meetingSlides.length - 1} aria-label="Next slide">→</button>
        <button type="button" onClick={toggleFullscreen} aria-label="Toggle fullscreen">⛶</button>
      </div>

      {overview ? (
        <div className="meeting-overview" role="dialog" aria-modal="true" aria-label="Slide overview">
          <div className="meeting-overview-header">
            <div>
              <p className="meeting-kicker">Slide overview</p>
              <h2>Tuesday Booster Meeting</h2>
            </div>
            <button type="button" onClick={() => setOverview(false)} aria-label="Close overview">×</button>
          </div>
          <div className="meeting-overview-list">
            {meetingSlides.map((item, itemIndex) => (
              <button
                type="button"
                key={item.id}
                className={itemIndex === index ? "is-current" : ""}
                onClick={() => { goTo(itemIndex); setOverview(false); }}
              >
                <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                <div>
                  <small>{item.section}</small>
                  <strong>{item.title}</strong>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
