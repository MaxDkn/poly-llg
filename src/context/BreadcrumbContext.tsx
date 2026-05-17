"use client";
import { createContext, useContext, useState } from "react";

export type BreadcrumbItem = { label: string; href?: string };

type Ctx = { items: BreadcrumbItem[]; setItems: (v: BreadcrumbItem[]) => void };

const BreadcrumbContext = createContext<Ctx>({ items: [], setItems: () => {} });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[]>([]);
  return (
    <BreadcrumbContext.Provider value={{ items, setItems }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}
