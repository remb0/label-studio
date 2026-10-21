import type { ReactNode } from "react";

export function DockGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-0.5 px-1"
    >
      {children}
    </div>
  );
}
