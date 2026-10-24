import { createFileRoute } from "@tanstack/react-router";

import { VendorPage } from "@/components/pages/VendorPage";

export const Route = createFileRoute("/vendor")({
  head: () => ({ meta: [{ title: "PO & Vendor Management · Controlled Chaos" }] }),
  component: VendorPage,
});
