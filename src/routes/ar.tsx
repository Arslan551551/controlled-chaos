import { createFileRoute } from "@tanstack/react-router";

import { ArPage } from "@/components/pages/ArPage";

export const Route = createFileRoute("/ar")({
  head: () => ({ meta: [{ title: "AR & Collections · Controlled Chaos" }] }),
  component: ArPage,
});
