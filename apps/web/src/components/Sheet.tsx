import { shortAddress } from "@/lib/format";

// A ruled sheet of label/value rows, the layout the evidence and developer
// pages share.

export function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="whitespace-nowrap font-mono text-pen underline decoration-1">
      {children}
    </a>
  );
}

/** A full address on wide screens, shortened on phones; the link always has the full one. */
export function Addr({ href, value }: { href: string; value: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={value} className="font-mono text-pen underline decoration-1">
      <span className="sm:hidden">{shortAddress(value, 8)}</span>
      <span className="hidden break-all sm:inline">{value}</span>
    </a>
  );
}

export function Block({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="text-2xl">{title}</h2>
      {lead && <p className="mt-2 max-w-[64ch] text-muted">{lead}</p>}
      <div className="mt-6 rounded-[2px] border border-rule bg-sheet">
        <div className="perforation mx-4 mt-3" aria-hidden />
        {children}
      </div>
    </section>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-rule px-4 py-3 last:border-b-0 sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
