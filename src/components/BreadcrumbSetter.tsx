"use client";
import { useEffect } from "react";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import type { BreadcrumbItem } from "@/context/BreadcrumbContext";

export function BreadcrumbSetter({ items }: { items: BreadcrumbItem[] }) {
  const { setItems } = useBreadcrumb();
  useEffect(() => {
    setItems(items);
    return () => setItems([]);
  }, []);
  return null;
}
