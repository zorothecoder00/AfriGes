import type { ReactNode } from "react";
import PointageWidget from "@/components/PointageWidget";
import RiaAccessShortcuts from "@/components/RiaAccessShortcuts";

export default function UserDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PointageWidget />
      <RiaAccessShortcuts />
    </>
  );
}
