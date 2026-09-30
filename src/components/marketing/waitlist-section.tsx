import { WaitlistForm } from "./waitlist-form";

export function WaitlistSection() {
  return (
    <div className="px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <p className="text-[13px] font-medium text-brand-ink">Waitlist</p>
          <h1 className="mt-3 text-[36px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[48px]">
            Good networks grow carefully.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-muted sm:text-[17px]">
            We&apos;re opening You&amp;Me in waves so every match stays worth your time. Tell us a little about you.
          </p>
        </div>
        <div className="mt-10 rounded-[24px] border border-border bg-card p-6 shadow-soft sm:p-8">
          <WaitlistForm />
        </div>
      </div>
    </div>
  );
}
