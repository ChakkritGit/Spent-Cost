"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ภาพรวม" },
  { href: "/plans", label: "รายการประจำ" },
  { href: "/calendar", label: "ปฏิทิน" },
  { href: "/settings", label: "ตั้งค่า" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar, lg and up */}
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-line bg-card p-4 lg:flex"
      >
        <p className="px-3 pb-6 text-lg font-semibold tracking-tight">รายจ่าย</p>
        <ul className="flex flex-col gap-1">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-3 text-sm ${active ? "bg-accent-soft font-medium text-accent" : "text-muted"}`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom bar, below lg. Measured: text-xs sm:text-sm, px-2 sm:px-3,
          py-3.5 sm:py-3 hold both the one-line label wrap and the 44px tap
          target — do not adjust without re-measuring. */}
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/90 backdrop-blur sm:static sm:border-b sm:border-t-0 lg:hidden"
      >
        <ul className="mx-auto flex max-w-2xl">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`block px-2 py-3.5 text-center text-xs sm:px-3 sm:py-3 sm:text-sm ${active ? "font-medium text-accent" : "text-muted"}`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
