"use client";
import { AuthProvider } from "./AuthProvider";
import { BreadcrumbProvider } from "@/context/BreadcrumbContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BreadcrumbProvider>
      <AuthProvider>{children}</AuthProvider>
    </BreadcrumbProvider>
  );
}
