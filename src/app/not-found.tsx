import Link from 'next/link';
import { DEFAULT_CLIENT_ID } from '@/data/clients';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <div className="eyebrow">Not found</div>
      <h1 className="mt-2 font-serif text-[24px] font-semibold text-ink">
        That page is not part of the simulator
      </h1>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
        The address may refer to a client record that is not in the sample set. The three sample
        engagements are reachable from the dashboard.
      </p>
      <Link
        href={`/clients/${DEFAULT_CLIENT_ID}/dashboard`}
        className="mt-5 inline-block w-fit rounded-[3px] border border-accent bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-2"
      >
        Return to the dashboard
      </Link>
    </main>
  );
}
