"use client";

import Link from "next/link";
import { PORTAL_SIGNED_OUT_MESSAGE, portalSignInHref } from "@/lib/portalFamilyMessages";

function currentPath() {
  if (typeof window === "undefined") return "/portal/review";
  return `${window.location.pathname}${window.location.search}`;
}

// Shows a portal error. When the family was signed out, it adds a button that
// signs them back in and returns them to this page.
export default function PortalErrorMessage({ message, className = "portal-field-error", as: Tag = "span" }) {
  if (!message) return null;
  if (message !== PORTAL_SIGNED_OUT_MESSAGE) return <Tag className={className}>{message}</Tag>;
  return (
    <Tag className={className} role="alert">
      {message}{" "}
      <Link className="portal-action-link" href={portalSignInHref(currentPath())}>Sign in again</Link>
    </Tag>
  );
}
