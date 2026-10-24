import { createFileRoute } from "@tanstack/react-router";

import { PaymentsPage } from "@/components/pages/PaymentsPage";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "Payment Planner · Controlled Chaos" }] }),
  component: PaymentsPage,
});
