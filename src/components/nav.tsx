"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ภาพรวม" },
  { href: "/plans", label: "รายการประจำ" },
  { href: "/calendar", label: "ปฏิทิน" },
  { href: "/settings", label: "ตั้งค่า" },
];

// The FAB always points at the dashboard's own entry form (`(app)/page.tsx`,
// #add-entry) rather than opening a modal — same form, same saveEntry action,
// just brought into view. No new data flow, no client state.
function Fab() {
  return (
    <Link
      href="/#add-entry"
      aria-label="เพิ่มรายการใหม่"
      className="shadow-fab -mt-7 flex size-14 shrink-0 items-center justify-center rounded-full bg-action text-3xl font-semibold text-action-fg"
    >
      <span aria-hidden="true">+</span>
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [left, right] = [links.slice(0, 2), links.slice(2)];

  const renderLink = ({ href, label }: (typeof links)[number], className: string) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`${className} ${active ? "font-medium text-accent" : "text-muted"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* Sidebar, lg and up. Chrome, not a content card — a shadow would cast
          the wrong direction against a fixed edge, so this keeps the hairline
          the --line token exists for. */}
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
                  className={`rounded-btn block px-3 py-3 text-sm ${active ? "bg-accent-soft font-medium text-accent" : "text-muted"}`}
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
          target on the four links — do not adjust without re-measuring. The
          centre cell is fixed-width (the FAB itself, not a flex-1 share) so
          it never eats into that measured label budget. */}
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/90 backdrop-blur sm:static sm:border-b sm:border-t-0 lg:hidden"
      >
        <ul className="mx-auto flex max-w-2xl items-center">
          {left.map(({ href, label }) => (
            <li key={href} className="flex-1">
              {renderLink({ href, label }, "block px-1 py-3.5 text-center text-xs sm:px-3 sm:py-3 sm:text-sm")}
            </li>
          ))}
          <li className="flex shrink-0 basis-14 justify-center">
            <Fab />
          </li>
          {right.map(({ href, label }) => (
            <li key={href} className="flex-1">
              {renderLink({ href, label }, "block px-1 py-3.5 text-center text-xs sm:px-3 sm:py-3 sm:text-sm")}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
