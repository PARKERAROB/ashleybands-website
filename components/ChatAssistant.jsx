"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const welcome = {
  role: "assistant",
  content:
    "Ask a question about Ashley Bands. I can help with calendar links, the Family Portal, required items, concert attire, trips, marching band, fundraising, and general program information."
};

function parseAssistantContent(data) {
  const raw = (data?.content || []).map((block) => block.text || "").join("").trim();
  if (!raw) return { text: "I could not generate a response. Please try again.", flagged: true };

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    if (cleaned.startsWith("{")) {
      const parsed = JSON.parse(cleaned);
      return {
        text: parsed.answer || raw,
        flagged: Boolean(parsed.flagged)
      };
    }
  } catch {
    return { text: raw, flagged: false };
  }

  return { text: raw, flagged: false };
}

export default function ChatAssistant() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState([welcome]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef(null);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      askQuestion(q);
    }
  }, [searchParams]);

  async function askQuestion(text) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setMessages((current) => [...current, { role: "user", content: trimmed }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "The assistant is unavailable.");
      const parsed = parseAssistantContent(data);
      setMessages((current) => [...current, { role: "assistant", content: parsed.text, flagged: parsed.flagged }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error.message || "The assistant is unavailable right now. Please contact Mr. Parker directly.",
          flagged: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;
    setQuestion("");
    await askQuestion(trimmed);
  }

  return (
    <section className="chat-shell">
      <div className="chat-top">
        <span className="status-dot" />
        <span>Public band information assistant</span>
      </div>
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
            <div className="chat-bubble">
              {message.role === "assistant" ? (
                <div className="chat-markdown"><ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} disallowedElements={["img"]}>{message.content}</ReactMarkdown></div>
              ) : message.content}
              {message.flagged ? (
                <div className="flag-note">This may need a direct answer from Mr. Parker.</div>
              ) : null}
            </div>
          </div>
        ))}
        {isLoading ? (
          <div className="chat-message assistant">
            <div className="chat-bubble">Checking the public band information...</div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about dates, attire, the portal, trips, marching band..."
          maxLength={1000}
          aria-label="Question"
        />
        <button type="submit" disabled={isLoading || !question.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
