import Link from "next/link";
import styles from "./Button.module.css";

const VARIANTS = new Set(["primary", "secondary", "quiet"]);

function buttonClass(variant, className) {
  const tone = VARIANTS.has(variant) ? variant : "primary";
  return [styles.button, styles[tone], className].filter(Boolean).join(" ");
}

// Site pages go through next/link. Files (.ics, .pdf), anchors, mailto:, webcal: and other sites use <a>.
function isAppRoute(href) {
  if (typeof href !== "string") return true;
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  const path = href.split(/[?#]/)[0];
  return !/\.[a-z0-9]+$/i.test(path);
}

/**
 * A real <button>. variant: "primary" | "secondary" | "quiet". At least 44px tall.
 */
export default function Button({ variant = "primary", type = "button", className, children, ...rest }) {
  return (
    <button type={type} className={buttonClass(variant, className)} {...rest}>
      {children}
    </button>
  );
}

/**
 * A link that looks like a button. Same variants as Button.
 */
export function ButtonLink({ href, variant = "primary", className, children, ...rest }) {
  const cls = buttonClass(variant, className);
  if (isAppRoute(href)) {
    return (
      <Link href={href} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls} {...rest}>
      {children}
    </a>
  );
}
