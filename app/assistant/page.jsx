import { Suspense } from "react";
import ChatAssistant from "@/components/ChatAssistant";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = {
  title: "Band Assistant | Bands of AHS"
};

export default function AssistantPage() {
  return (
    <main className="assistant-page">
      <PageHeader
        className="assistant-intro"
        eyebrow="Quick Lookup"
        title="Band Assistant"
        lede="This assistant uses public Ashley Band information only. Private, student-specific, family-specific, or financial-account questions should go directly to Mr. Parker."
      />
      <Suspense fallback={<div className="chat-shell" />}>
        <ChatAssistant />
      </Suspense>
    </main>
  );
}
