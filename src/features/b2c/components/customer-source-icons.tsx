import {
  CircleHelp,
  Footprints,
  GraduationCap,
  Sparkles,
  UserPlus,
} from "lucide-react";

export function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path
        d="M15.5 12.05h-2.28v7.95h-3.28v-7.95H8.38V9.3h1.56V7.32c0-1.55.95-2.4 2.33-2.4.66 0 1.36.12 1.36.12v1.5h-.77c-.77 0-1.01.48-1.01.97V9.3h2.64l-.42 2.75z"
        fill="#ffffff"
      />
    </svg>
  );
}

export function ZaloIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect width="24" height="24" rx="6" fill="#0068FF" />
      <path
        d="M5.2 15.2h4.8l-4.2-6v-.4h5.4v1.6H7.4l4.2 6v.4H5.2v-1.6zm7.2 1.4c-1.6 0-2.7-1-2.7-2.5s1.1-2.5 2.7-2.5 2.7 1 2.7 2.5-1.1 2.5-2.7 2.5zm0-1.3c.7 0 1.2-.5 1.2-1.2s-.5-1.2-1.2-1.2-1.2.5-1.2 1.2.5 1.2 1.2 1.2zm4.4 1.3h-1.4V8.5h1.4v8.1zm3.8 0c-1.6 0-2.7-1-2.7-2.5s1.1-2.5 2.7-2.5 2.7 1 2.7 2.5-1.1 2.5-2.7 2.5zm0-1.3c.7 0 1.2-.5 1.2-1.2s-.5-1.2-1.2-1.2-1.2.5-1.2 1.2.5 1.2 1.2 1.2z"
        fill="#ffffff"
      />
    </svg>
  );
}

export function TikTokIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.9 2.9 0 01-2.89-2.89 2.9 2.9 0 012.89-2.89c.31 0 .61.05.89.14V8.89a6.38 6.38 0 00-.89-.06 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.06a8.16 8.16 0 004.88 1.63v-3.5a4.85 4.85 0 01-1.1-.5z" />
    </svg>
  );
}

export function CustomerSourceIcon({
  source,
  className = "h-4 w-4",
}: {
  source: string | null;
  className?: string;
}) {
  switch (source) {
    case "facebook":
      return <FacebookIcon className={className} />;
    case "zalo":
      return <ZaloIcon className={className} />;
    case "tiktok":
      return (
        <span
          className="inline-flex items-center justify-center rounded bg-black p-0.5 text-white dark:bg-white dark:text-black"
          aria-hidden="true"
        >
          <TikTokIcon className={className} />
        </span>
      );
    case "referral":
      return <UserPlus className={`${className} text-violet-500`} aria-hidden="true" />;
    case "walk_in":
      return <Footprints className={`${className} text-amber-500`} aria-hidden="true" />;
    case "school":
      return <GraduationCap className={`${className} text-emerald-500`} aria-hidden="true" />;
    case "other":
      return <Sparkles className={`${className} text-rose-500`} aria-hidden="true" />;
    case "unknown":
    case null:
    default:
      return <CircleHelp className={`${className} text-slate-400`} aria-hidden="true" />;
  }
}
