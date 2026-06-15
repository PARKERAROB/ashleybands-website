// Shared slide lookup + renderer for the Band of Heroes display and controller.
import { slides } from "./slides";
import { programSlides } from "./program";

// Concert program cards (ids 1001+) lead into the adventure deck (ids 1..102).
export const deck = [...programSlides, ...slides];
export const byId = new Map(deck.map((s) => [s.id, s]));

export function renderSlide(slide) {
  if (!slide) return null;
  if (slide.kind === "image") {
    return (
      <>
        {/* blurred, scaled copy of the poster fills the stage (YouTube portrait look) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="boh-flyer-bg" src={slide.image} alt="" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="boh-flyer-img" src={slide.image} alt={slide.alt || ""} />
      </>
    );
  }
  if (slide.kind === "program") {
    return (
      <>
        <span className="boh-prog-title">{slide.title}</span>
        <span className="boh-prog-composer">
          {slide.composer}{slide.life ? ` (${slide.life})` : ""}
        </span>
        {slide.year && <span className="boh-prog-year">{slide.year}</span>}
      </>
    );
  }
  if (slide.kind === "intermission") {
    return <span className="boh-prog-intermission">{slide.title}</span>;
  }
  if (slide.kind === "cover") {
    const [title, ...sub] = slide.lines;
    return (
      <>
        <span className="boh-cover-title">{title}</span>
        {sub.map((line, i) => (
          <span key={i} className="boh-cover-sub">{line}</span>
        ))}
      </>
    );
  }
  if (slide.kind === "title") {
    const hasArticle = slide.lines[0]?.toUpperCase() === "THE";
    const name = hasArticle ? slide.lines.slice(1) : slide.lines;
    return (
      <>
        {hasArticle && <span className="boh-title-the">The</span>}
        {name.map((line, i) => (
          <span key={i} className="boh-title-name">{line}</span>
        ))}
      </>
    );
  }
  return slide.lines.map((line, i) => (
    <span key={i} className="boh-line">{line}</span>
  ));
}
