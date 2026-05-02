import { Suspense } from "react";
import ChatAssistant from "@/components/ChatAssistant";

export const metadata = {
  title: "Band Assistant | Bands of AHS"
};

export default function AssistantPage() {
  return (
    <main className="assistant-page">
      <section className="assistant-intro">
        <p className="eyebrow">Quick Lookup</p>
        <h1>Band Assistant</h1>
        <p>
          This assistant uses public Ashley Band information only. Private, student-specific,
          family-specific, or financial-account questions should go directly to Mr. Parker.
        </p>
      </section>
      <Suspense fallback={<div className="chat-shell" />}>
        <ChatAssistant />
      </Suspense>
    </main>
  );
}
