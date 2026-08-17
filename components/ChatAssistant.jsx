"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  const [knowledge, setKnowledge] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef(null);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    fetch("/chatbot-knowledge.txt")
      .then((res) => res.text())
      .then(setKnowledge)
      .catch(() => setKnowledge(""));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && knowledge && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      askQuestion(q);
    }
  }, [knowledge, searchParams]);

  async function askQuestion(text) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    const systemPrompt = `You are a helpful assistant for the Ashley High School Band Program in Wilmington, NC. Today's date is ${today}.

Your only job is to answer questions using the public band program information provided below.

PUBLIC BAND INFORMATION:
${knowledge || "(No public information loaded. Tell the user to contact Mr. Parker directly.)"}

Rules:
1. Only answer band questions using the information above. Never invent band details.
2. If information is missing, unclear, private, student-specific, financial-account-specific, or family-specific, say that Mr. Parker should be contacted directly.
3. Do not provide private student information, internal notes, accommodation details, balances, or anything that sounds like a non-public record.
4. Keep answers concise and practical.
5. If the question needs Mr. Parker's personal answer, respond as JSON: {"answer":"your helpful response","flagged":true}
6. For answerable questions, respond with plain friendly text.`;

    setIsLoading(true);
    setMessages((current) => [...current, { role: "user", content: trimmed }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, question: trimmed })
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
              {message.content}
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
          aria-label="Question"
        />
        <button type="submit" disabled={isLoading || !question.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
