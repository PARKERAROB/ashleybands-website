// Shared slide lookup + renderer for the Band of Heroes display and controller.
import { slides } from "./slides";

export const byId = new Map(slides.map((s) => [s.id, s]));

export function renderSlide(slide) {
  if (!slide) return null;
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
