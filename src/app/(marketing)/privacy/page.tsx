import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSectionDef } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What You&Me collects, why, how AI features use it, and the controls you have.",
};

const sections: LegalSectionDef[] = [
  {
    id: "data-we-collect",
    title: "Data we collect",
    body: (
      <>
        <p>We collect what you give us to make matching and collaboration work, plus the minimum technical data needed to run the service.</p>
        <ul>
          <li>
            <strong>Account data</strong> — your name, email address, password (stored only as a salted hash), and sign-in method if you use Google,
            Apple or LinkedIn.
          </li>
          <li>
            <strong>Profile data</strong> — photo, headline, bio, location, skills, experience, education, industries, roles you&apos;re interested in,
            availability and commitment level.
          </li>
          <li>
            <strong>Startup data</strong> — startups you create or join: name, description, stage, industries, team members and roles, needs and open
            roles.
          </li>
          <li>
            <strong>Working-style quiz answers</strong> — your answers to the working-style and personality questions and the resulting scores.
          </li>
          <li>
            <strong>Activity on the network</strong> — people you express interest in or pass on, matches, connections, follows, saved items, reports
            and blocks.
          </li>
          <li>
            <strong>Messages</strong> — the content of messages you send in direct, match, startup and booking conversations.
          </li>
          <li>
            <strong>Bookings</strong> — consultant sessions you book or deliver: service, time, participants, price and status, and reviews you
            write.
          </li>
          <li>
            <strong>Payments</strong> — payments are processed by Stripe. We store only Stripe identifiers (such as payment, customer and connected
            account IDs) and amounts. <strong>We never receive or store your card number or bank details.</strong>
          </li>
          <li>
            <strong>Technical data</strong> — session records (IP address, browser user agent), security logs and first-party product analytics
            events used to keep the service reliable and understand which features are used.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use-data",
    title: "How we use your data",
    body: (
      <ul>
        <li>To create and show your profile and startup pages according to your visibility settings.</li>
        <li>To calculate compatibility and produce daily recommendations, including the explanation of why someone was suggested.</li>
        <li>To deliver messages, notifications, bookings and payouts.</li>
        <li>To keep the network safe: preventing abuse, reviewing reports, enforcing our Terms and rate-limiting misuse.</li>
        <li>To operate, secure and improve the service, using first-party, aggregated usage data.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "How AI features use your data",
    body: (
      <>
        <p>
          You&amp;Me uses AI (currently a model provided by Anthropic) for the You&amp;Me AI concierge and to phrase match explanations. It is built
          with strict limits:
        </p>
        <ul>
          <li>
            The AI never reads our database directly. It can only call a fixed set of tools that run <strong>as you</strong> and return the same
            public, permitted fields you could see yourself — visibility settings and blocks always apply.
          </li>
          <li>
            Match explanations are generated only from structured facts (such as complementary skills, shared industries or commitment level) — not
            from private messages.
          </li>
          <li>Your private messages are not used by AI features, and we do not use your data to train AI models.</li>
          <li>
            People and consultants shown in AI answers always come from real results returned by those tools; the AI cannot invent a profile for
            display.
          </li>
          <li>
            When no AI provider is configured, features run in a clearly labelled &ldquo;basic mode&rdquo; that uses rules and templates instead.
          </li>
        </ul>
        <p>Your prompts to the concierge are stored in your account so you can revisit conversations, and you can delete them.</p>
      </>
    ),
  },
  {
    id: "visibility",
    title: "Visibility and your controls",
    body: (
      <>
        <p>You decide who sees what. From Settings → Privacy &amp; visibility you can:</p>
        <ul>
          <li>Choose whether your profile is discoverable, and hide yourself from cofounder recommendations.</li>
          <li>Control which profile fields and startups are public, visible to members, or private.</li>
          <li>Block people, which hides you from each other and stops messages.</li>
          <li>Choose which notifications and emails you receive.</li>
        </ul>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share data with",
    body: (
      <>
        <p>
          We don&apos;t sell your personal data and we don&apos;t share it with advertisers. We share data only with service providers that help us
          run You&amp;Me, under contracts that limit their use of it:
        </p>
        <ul>
          <li>Hosting, database and file storage providers.</li>
          <li>Stripe, for payments and consultant payouts.</li>
          <li>Our email delivery provider, for account and notification emails.</li>
          <li>Our AI provider, only for the requests described above.</li>
          <li>Google, Apple or LinkedIn, only if you choose to sign in with them.</li>
        </ul>
        <p>We may also disclose data where required by law, or to protect the safety of our members.</p>
      </>
    ),
  },
  {
    id: "export",
    title: "Exporting your data",
    body: <p>You can download a copy of your data — profile, startups, quiz answers, messages, bookings and more — from Settings → Data export, at any time.</p>,
  },
  {
    id: "deletion",
    title: "Deleting your account",
    body: (
      <>
        <p>
          You can delete your account from Settings. When you do, we remove your profile, quiz answers, preferences, recommendations and saved items,
          and end all sessions.
        </p>
        <p>
          Some records involve other people or legal obligations. Messages you sent in shared conversations, reviews and completed bookings are{" "}
          <strong>anonymised</strong> — kept without your name, photo or contact details — so other members&apos; histories stay intact. Payment
          records are retained as required for tax and accounting.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <>
        <p>We keep this deliberately minimal:</p>
        <ul>
          <li>
            <strong>Essential cookies</strong> — to keep you signed in securely (session cookies) and, where applicable, to remember an invite code
            during signup. The service can&apos;t work without them.
          </li>
          <li>
            <strong>Local storage</strong> — your light/dark theme preference and whether you&apos;ve dismissed our cookie notice. This stays in your
            browser.
          </li>
        </ul>
        <p>
          We do not use advertising cookies or third-party tracking pixels. Because we only use what&apos;s strictly necessary, there&apos;s nothing to
          opt in to.
        </p>
      </>
    ),
  },
  {
    id: "security-retention",
    title: "Security and retention",
    body: (
      <p>
        We protect data with encryption in transit, hashed passwords, server-side authorization checks and access logging for administrative
        actions. We keep data for as long as your account is active and as needed for the purposes above, then delete or anonymise it.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <p>
        Depending on where you live, you may have the right to access, correct, export, or delete your data, and to object to or restrict certain
        processing. Most of this you can do yourself in Settings; for anything else, contact us and we&apos;ll respond within the time required by
        law.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about privacy? Email <a href="mailto:privacy@youandme.company">privacy@youandme.company</a>. We&apos;ll post changes to this policy on this
        page and notify you in the app when they&apos;re significant. See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 2026"
      intro={
        <p>
          You&amp;Me helps people find the right people to build startups with. That only works if you trust us with information about you. This
          policy explains, in plain language, what we collect, how we use it — including in AI features — and the controls you have.
        </p>
      }
      sections={sections}
    />
  );
}
