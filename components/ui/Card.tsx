"use client";

import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: ReactNode;
  hoverable?: boolean;
}

export default function Card({ title, action, hoverable = false, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-white border border-slate-200 shadow-sm
        dark:bg-slate-800 dark:border-slate-700
        ${hoverable ? "transition-shadow hover:shadow-md" : ""}
        ${className}`}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          {title && <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>}
          {action}
        </div>
      )}
      <div className={title || action ? "px-5 pb-5" : "p-5"}>{children}</div>
    </div>
  );
}
