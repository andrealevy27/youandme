import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSectionDef } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using You&Me — the network for building startups.",
};

const sections: LegalSectionDef[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: (
      <p>
        By creating an account or using You&amp;Me you agree to these Terms and our <Link href="/privacy">Privacy Policy</Link>. If you use You&amp;Me
        on behalf of a company, you confirm you&apos;re authorised to accept these Terms for it.
      </p>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility and accounts",
    body: (
      <ul>
        <li>You must be at least 18 years old and able to form a binding contract.</li>
        <li>Use your real identity. One person, one account.</li>
        <li>Keep your credentials secure — you&apos;re responsible for activity on your account.</li>
        <li>While You&amp;Me is invite-only, access may require a valid invite.</li>
      </ul>
    ),
  },
  {
    id: "conduct",
    title: "How to behave",
    body: (
      <>
        <p>You&amp;Me is a professional network. You agree not to:</p>
        <ul>
          <li>Misrepresent who you are, your experience, or your startup.</li>
          <li>Harass, discriminate against, threaten or spam other members.</li>
          <li>Scrape, bulk-export or automate access to other members&apos; data.</li>
          <li>Use the network to solicit for unrelated commercial purposes or recruit members off-platform to avoid fees.</li>
          <li>Post illegal content or content that infringes others&apos; rights.</li>
          <li>Attempt to break, probe or bypass our security or rate limits.</li>
        </ul>
        <p>We may remove content, limit features, suspend or close accounts that break these rules. You can report people and content from any profile or conversation.</p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <p>
        You own what you post. You grant You&amp;Me a limited licence to host, display and process it to operate the service — for example to show your
        profile according to your visibility settings and to compute matches. This licence ends when you delete the content or your account, except
        for anonymised records described in our Privacy Policy.
      </p>
    ),
  },
  {
    id: "matching",
    title: "Matching and AI",
    body: (
      <>
        <p>
          Compatibility scores, recommendations and AI answers are guidance to help you decide who to meet — not guarantees about any person or
          outcome. Always do your own diligence before starting a company, sharing equity, or signing agreements with anyone you meet on You&amp;Me.
        </p>
        <p>AI features can make mistakes. They only surface real members, but explanations may be imperfect.</p>
      </>
    ),
  },
  {
    id: "consultants",
    title: "Consultants and bookings",
    body: (
      <>
        <ul>
          <li>
            Consultants are independent professionals, not employees or agents of You&amp;Me. They are responsible for their services, qualifications
            and any required licences.
          </li>
          <li>
            When you book a session, you enter into an agreement directly with the consultant. You&amp;Me facilitates booking and payment and charges a
            platform fee, shown before you pay.
          </li>
          <li>Cancellation and refund terms are shown on each service before booking.</li>
          <li>Reviews must reflect a genuine completed booking.</li>
        </ul>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments",
    body: (
      <p>
        Payments are processed by Stripe and are subject to Stripe&apos;s terms. Consultants receive payouts through Stripe Connect. We don&apos;t store
        card details. Prices include or exclude taxes as displayed at checkout.
      </p>
    ),
  },
  {
    id: "ip",
    title: "Our intellectual property",
    body: <p>The You&amp;Me name, logo, software and design are ours. Don&apos;t copy, modify or reverse-engineer them except as allowed by law.</p>,
  },
  {
    id: "termination",
    title: "Ending your use",
    body: (
      <p>
        You can delete your account at any time from Settings. We may suspend or terminate access if you break these Terms or if required by law.
        Sections that by their nature should survive termination (such as liability limits) will survive.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers and liability",
    body: (
      <>
        <p>
          You&amp;Me is provided &ldquo;as is&rdquo;. We don&apos;t guarantee that you&apos;ll find a cofounder, that any member is who they say they
          are, or that the service will always be available or error-free.
        </p>
        <p>
          To the extent permitted by law, You&amp;Me is not liable for indirect or consequential losses, or for disputes between members, and our total
          liability is limited to the amount you paid us in the 12 months before the claim.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: <p>We may update these Terms. If a change is significant we&apos;ll tell you in the app or by email before it takes effect.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions? Email <a href="mailto:hello@youandme.company">hello@youandme.company</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="September 2026"
      intro={
        <p>
          These Terms set the ground rules for using You&amp;Me. We&apos;ve tried to keep them short and readable — the goal is a trusted network where
          founders, operators and experts can build together.
        </p>
      }
      sections={sections}
    />
  );
}
