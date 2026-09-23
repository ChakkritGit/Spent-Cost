"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { EntrySheet } from "@/components/entry-sheet";
import { Icon, type IconName } from "@/components/icons";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "ภาพรวม", icon: "dashboard" },
  { href: "/plans", label: "แผน", icon: "plans" },
  { href: "/calendar", label: "ปฏิทิน", icon: "calendar" },
  { href: "/settings", label: "ตั้งค่า", icon: "settings" },
];

export function Mark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span aria-hidden className="size-[18px] bg-brand" />
      <span className="font-mono text-xs font-bold tracking-[0.08em]">SPENT/COST</span>
    </span>
  );
}

/** Bottom bar with the + in its centre below lg; a ruled sidebar from lg up. The + opens the one-off entry sheet. */
export function Nav({ categories, today }: { categories: string[]; today: string }) {
  const pathname = usePathname();
  const [adding, setAdding] = useState(false);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const tab = ({ href, label, icon }: (typeof LINKS)[number]) => (
    <Link
      key={href}
      href={href}
      aria-current={active(href) ? "page" : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 text-[11px] ${
        active(href) ? "font-semibold text-brand shadow-[inset_0_3px_0_var(--brand)]" : "text-muted"
      }`}
    >
      <Icon name={icon} />
      {label}
    </Link>
  );

  return (
    <>
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 bottom-0 z-20 grid h-[calc(68px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-ink bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {LINKS.slice(0, 2).map(tab)}
        <div className="grid place-items-center">
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="เพิ่มรายการ"
            className="-mt-8 grid size-14 place-items-center border border-ink bg-brand text-on-brand"
          >
            <Icon name="plus" size={24} stroke={2} />
          </button>
        </div>
        {LINKS.slice(2).map(tab)}
      </nav>

      <nav aria-label="เมนูหลัก" className="fixed inset-y-0 start-0 z-20 hidden w-56 flex-col border-e border-ink bg-surface lg:flex">
        <Mark className="h-16 border-b border-ink px-5" />
        <ul className="flex flex-col">
          {LINKS.map(({ href, label, icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={`flex h-12 items-center gap-3 border-b border-hair px-5 text-sm ${
                  active(href) ? "bg-brand-soft font-semibold text-brand shadow-[inset_3px_0_0_var(--brand)]" : ""
                }`}
              >
                <Icon name={icon} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="m-5 flex h-12 items-center justify-center gap-2 border border-ink bg-brand font-mono text-xs font-bold text-on-brand"
        >
          <Icon name="plus" size={16} stroke={2} />
          เพิ่มรายการ
        </button>
      </nav>

      <EntrySheet open={adding} onClose={() => setAdding(false)} categories={categories} today={today} />
    </>
  );
}
