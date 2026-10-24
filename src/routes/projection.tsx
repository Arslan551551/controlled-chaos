import { createFileRoute } from "@tanstack/react-router";

import { ProjectionPage } from "@/components/pages/ProjectionPage";

export const Route = createFileRoute("/projection")({
  head: () => ({ meta: [{ title: "PO Projection · Controlled Chaos" }] }),
  component: ProjectionPage,
});
