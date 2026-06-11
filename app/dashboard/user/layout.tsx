import type { ReactNode } from "react";
import PointageWidget from "@/components/PointageWidget";

export default function UserDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PointageWidget />
    </>
  );
}
