import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen flex-col bg-gray-950 text-gray-100">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <main className="relative flex-1 overflow-hidden">{children}</main>
        <Sidebar />
      </div>
    </div>
  );
}
