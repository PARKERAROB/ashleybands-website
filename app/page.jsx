"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageCard from "@/components/PageCard";
import MarkdownBlock from "@/components/MarkdownBlock";
import { getSiteData } from "@/lib/siteData";
import Image from "next/image";
import Link from "next/link";

const PROMPTS = [
  "When is the spring concert?",
  "What do students need for band?",
  "How do I subscribe to the calendar?",
  "What does the trip cost?"
];

export default function HomePage() {
  const data = getSiteData();
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/assistant?q=${encodeURIComponent(q)}`);
  }

  function handlePrompt(prompt) {
    router.push(`/assistant?q=${encodeURIComponent(prompt)}`);
  }

  const groups = [
    { category: "Current information", eyebrow: "What is happening now" },
    { category: "Everyday resources", eyebrow: "What students need" },
    { category: "Support the band", eyebrow: "Donations and sponsors" }
  ].map((group) => ({
    ...group,
    pages: data.pages.filter((page) => page.category === group.category)
  }));

  return (
    <main>
      <section className="chat-hero">
        <div className="chat-hero-inner">
          <p className="chat-hero-eyebrow">Eugene Ashley High School · Wilmington, NC</p>
          <h1 className="chat-hero-headline">
            Bands of<br />Ashley High School
          </h1>
          <p className="chat-hero-sub">
            Ask anything about the band program — dates, attire, marching band, trips, and more.
          </p>
          <form className="chat-hero-form" onSubmit={handleSubmit}>
            <input
              className="chat-hero-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about Ashley Bands..."
              autoComplete="off"
            />
            <button className="chat-hero-btn" type="submit" aria-label="Ask">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </form>
          <div className="chat-hero-prompts">
            {PROMPTS.map((p) => (
              <button key={p} className="prompt-pill" type="button" onClick={() => handlePrompt(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      {groups.map((group) => (
        <section className="section" key={group.category}>
          <div className="section-heading">
            <p className="eyebrow">{group.eyebrow}</p>
            <h2>{group.category}</h2>
          </div>
          <div className="card-grid">
            {group.pages.map((page) => (
              <PageCard key={page.slug} page={page} />
            ))}
          </div>
        </section>
      ))}

      <section className="split-section">
        <div>
          <p className="eyebrow">Official Dates</p>
          <h2>Calendar</h2>
          <p>
            The band calendar is the source of truth for dates and times. Subscribe instead of
            downloading a one-time copy so updates appear automatically.
          </p>
          <a className="text-link" href={data.quickLinks[0].href}>Calendar subscription link</a>
        </div>
        <div>
          <p className="eyebrow">Payments and Records</p>
          <h2>My Music Office</h2>
          <p>
            MMO is used for student information, parent contact information, financial accounts,
            equipment records, band communication, and calendar access.
          </p>
          <a className="text-link" href={data.quickLinks[1].href}>Open My Music Office</a>
        </div>
        <div>
          <p className="eyebrow">Spirit Wear</p>
          <h2>Band Shirts Store</h2>
          <p>
            The official Red Band Shirt is required for all band members and used for pep rallies,
            community performances, parades, and informal events.
          </p>
          <a className="text-link" href={data.quickLinks[3].href}>Open Band Shirts Store</a>
        </div>
      </section>
    </main>
  );
}
