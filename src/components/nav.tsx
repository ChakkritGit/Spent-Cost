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
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/90 backdrop-blur sm:static sm:border-b sm:border-t-0">
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
  );
}
