import { createFileRoute } from "@tanstack/react-router";

import { ToolsPage } from "@/components/pages/ToolsPage";

export const Route = createFileRoute("/tools")({
  head: () => ({ meta: [{ title: "Tools & Subscriptions · Controlled Chaos" }] }),
  component: ToolsPage,
});
