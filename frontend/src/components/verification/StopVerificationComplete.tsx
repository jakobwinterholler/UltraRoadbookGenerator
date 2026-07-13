import VerificationStatusIcon from "./VerificationStatusIcon";

interface StopVerificationCompleteProps {
  verified: number;
  rejected: number;
  onReviewResupply: () => void;
  title?: string;
  description?: string;
}

export default function StopVerificationComplete({
  verified,
  rejected,
  onReviewResupply,
  title = "Verification complete",
  description,
}: StopVerificationCompleteProps) {
  const defaultDescription = `${verified} verified stop${verified === 1 ? "" : "s"}${rejected > 0 ? ` · ${rejected} rejected` : ""}. Your resupply plan reflects the stops you trust.`;

  return (
    <div className="rounded-2xl border border-line bg-card p-8 text-center shadow-card">
      <div className="flex justify-center" aria-hidden>
        <VerificationStatusIcon status="verified" size="lg" className="!h-10 !w-10 [&_svg]:!h-5 [&_svg]:!w-5" />
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description ?? defaultDescription}</p>
      <button
        type="button"
        onClick={onReviewResupply}
        className="mt-6 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
      >
        View verified plan
      </button>
    </div>
  );
}
