import { PageHeader } from "@/components/page-header";

/*
 * What each page shows while its data is on the way (the routes' loading.tsx).
 * Same header, rules and heights as the real page, so nothing jumps when it
 * lands; only the figures are grey bars.
 */

function Bar({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden style={style} className={`block animate-pulse bg-hair motion-reduce:animate-none ${className}`} />;
}

function Loading({ title, aside, action, children }: { title: string; aside?: boolean; action?: boolean; children: React.ReactNode }) {
  return (
    <div aria-busy="true">
      <PageHeader
        title={title}
        aside={aside ? <span className="h-11 w-40 border border-ink bg-surface" /> : undefined}
        action={action ? <Bar className="h-11 w-24" /> : undefined}
      />
      <p className="sr-only" role="status">กำลังโหลด…</p>
      {children}
    </div>
  );
}

function Heading({ title, className = "" }: { title: string; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between border-b border-ink px-4 pb-2.5 ${className}`}>
      <h2 className="headline text-xl font-bold">{title}</h2>
      <Bar className="h-3 w-20" />
    </div>
  );
}

function Rows({ count }: { count: number }) {
  return (
    <ul>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3 border-b border-hair px-4 py-3.5">
          <Bar className="h-4 w-6" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Bar className="h-4 w-2/5" />
            <Bar className="h-3 w-1/4" />
          </div>
          <Bar className="h-4 w-14" />
          <span className="size-6 border border-hair" />
        </li>
      ))}
    </ul>
  );
}

export function DashboardSkeleton() {
  return (
    <Loading title="ภาพรวม" aside>
      <section className="flex flex-col gap-3.5 border-b border-ink bg-surface px-4 py-5">
        <span className="label">หนี้คงเหลือ — DEBT REMAINING</span>
        <Bar className="h-[60px] w-60" />
        <div className="ticks h-3.5 border border-ink" />
        <Bar className="h-3 w-44" />
      </section>
      <section className="grid grid-cols-2 border-b border-ink">
        {["border-e border-b", "border-b", "border-e", ""].map((edge, i) => (
          <div key={i} className={`flex flex-col gap-2 border-ink p-4 ${edge}`}>
            <Bar className="h-3 w-20" />
            <Bar className="h-7 w-28" />
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-3 border-b border-ink px-4 py-5">
        <h2 className="headline text-xl font-bold">ใช้จ่าย 6 เดือน</h2>
        <div className="flex h-40 max-w-lg items-end gap-3">
          {[45, 70, 55, 90, 60, 80].map((h, i) => (
            <Bar key={i} className="flex-1" style={{ height: `${h}%` }} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3 border-b border-ink px-4 py-5">
        <h2 className="headline text-xl font-bold">ตามหมวดหมู่</h2>
        <Bar className="h-6 w-full" />
      </section>
      <div className="pt-5">
        <Heading title="รายการเดือนนี้" className="mx-4 px-0" />
        <Rows count={4} />
      </div>
    </Loading>
  );
}

export function PlansSkeleton() {
  return (
    <Loading title="แผนและหนี้" action>
      <Heading title="หนี้" className="pt-6" />
      {[0, 1].map((i) => (
        <article key={i} className="flex flex-col gap-2.5 border-b border-ink bg-surface p-4">
          <div className="flex justify-between gap-3">
            <Bar className="h-5 w-32" />
            <Bar className="h-3 w-28" />
          </div>
          <Bar className="h-9 w-44" />
          <div className="ticks h-3.5 border border-ink" />
          <Bar className="h-3 w-52" />
        </article>
      ))}
      <Heading title="รายการประจำ" className="pt-6" />
      <Rows count={3} />
    </Loading>
  );
}

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export function CalendarSkeleton() {
  return (
    <Loading title="ปฏิทิน" aside>
      <div aria-hidden className="grid grid-cols-7 border-b border-ink bg-surface">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-2 text-center font-mono text-[11px] text-muted">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 bg-surface">
        {Array.from({ length: 35 }, (_, i) => (
          <span key={i} className="h-16 border-b border-e border-hair p-1.5">
            <Bar className="h-3 w-4" />
          </span>
        ))}
      </div>
      <div className="border-y border-ink px-4 py-3">
        <Bar className="h-3 w-48" />
      </div>
    </Loading>
  );
}

export function SettingsSkeleton() {
  return (
    <Loading title="ตั้งค่า">
      {[0, 1, 2, 3].map((i) => (
        <section key={i} className="flex flex-col gap-2.5 border-b border-ink px-4 py-5">
          <Bar className="h-6 w-36" />
          <Bar className="h-3 w-4/5" />
          <Bar className="h-11 w-32" />
        </section>
      ))}
    </Loading>
  );
}
