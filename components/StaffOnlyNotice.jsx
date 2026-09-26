import { ButtonLink, PageHeader } from "@/components/ui";

// Shown in place of an internal document when the visitor is not signed in as program staff (#142).
export default function StaffOnlyNotice({ title }) {
  return (
    <main className="section">
      <PageHeader
        eyebrow="Staff only"
        title={title}
        lede="This is an internal document for band staff. Sign in to the staff workspace, then open this link again."
        actions={<ButtonLink href="/admin">Staff sign-in</ButtonLink>}
      >
        <p>Looking for band information? Start with <a href="/this-week">This week</a> or the <a href="/calendar">band calendar</a>.</p>
      </PageHeader>
    </main>
  );
}
