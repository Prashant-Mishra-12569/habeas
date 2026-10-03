import Link from "next/link";

// Placeholder until the styleguide is approved; the real home page comes next.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-8">
      <p className="text-lg font-bold">Habeas</p>
      <h1 className="mt-10 text-3xl sm:text-4xl">Your tokens can be frozen and taken. You should know why.</h1>
      <p className="mt-4 max-w-[64ch]">
        Habeas adds a fair process to freezes and take-backs on Stellar: a public reason, a deadline to answer and a neutral reviewer. If the process stalls, the holder gets their tokens back by default.
      </p>
      <p className="mt-4 max-w-[64ch] text-muted">This site is being built. The look is on the styleguide page.</p>
      <ul className="mt-8 space-y-2">
        <li>
          <Link className="text-pen underline decoration-2 underline-offset-4" href="/styleguide">
            See the styleguide
          </Link>
        </li>
        <li>
          <a className="text-pen underline decoration-2 underline-offset-4" href="https://github.com/Prashant-Mishra-12569/habeas">
            Read the code on GitHub
          </a>
        </li>
      </ul>
    </main>
  );
}
