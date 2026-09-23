"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "@/components/icons";

/**
 * A native modal <dialog>: focus trap, Escape and the inert page behind come
 * from the browser. A bottom sheet on a phone, a centred panel from sm up
 * (dialog.sheet in globals.css). A tap on the backdrop closes it — the only
 * click whose target is the dialog element itself.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="flex items-center justify-between border-b border-ink py-1 pe-1 ps-4">
        <h2 id={titleId} className="headline text-2xl">{title}</h2>
        <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-11 place-items-center">
          <Icon name="close" />
        </button>
      </div>
      {open && children}
    </dialog>
  );
}
