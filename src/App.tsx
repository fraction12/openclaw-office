import { AppShell } from "@/components/layout/AppShell";
import { FloorPlan } from "@/components/office-2d/FloorPlan";
import { useGatewayConnection } from "@/hooks/useGatewayConnection";

export function App() {
  const gatewayUrl =
    import.meta.env.VITE_GATEWAY_URL || "ws://localhost:18789";
  const gatewayToken = import.meta.env.VITE_GATEWAY_TOKEN || "";

  useGatewayConnection({ url: gatewayUrl, token: gatewayToken });

  return (
    <AppShell>
      <FloorPlan />
    </AppShell>
  );
}
