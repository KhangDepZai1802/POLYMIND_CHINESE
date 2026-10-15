"use client";
import { createContext, useContext } from "react";

export const ClassWorkspaceRefreshContext = createContext<() => void>(() => {});
export function useClassWorkspaceRefresh() {
  return useContext(ClassWorkspaceRefreshContext);
}
