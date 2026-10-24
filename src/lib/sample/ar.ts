// Sample AR data (QuickBooks open invoices) for salons and wholesale customers.
// Distributor invoices are not duplicated here — the AR page reads them from
// the distributor data. Owners are the internal people who manage each account.

import type { ArInvoice, ReminderLogEntry, ReminderRules } from "../engine/ar.ts";

const REP_NE = {
  ownerId: "E-SR1",
  ownerName: "Salon Rep – Northeast",
  ownerEmail: "rep.northeast@controlledchaoshair.com",
};
const REP_SE = {
  ownerId: "E-SR2",
  ownerName: "Salon Rep – Southeast",
  ownerEmail: "rep.southeast@controlledchaoshair.com",
};
const FIN = {
  ownerId: "E-DMF",
  ownerName: "Deputy Manager Finance",
  ownerEmail: "finance@controlledchaoshair.com",
};

const usd = { currency: "USD" as const, fxToUsd: 1 };

export const arInvoices: ArInvoice[] = [
  // Salons (invoiced in QuickBooks on Net 30)
  {
    id: "31102",
    customerId: "SAL-01",
    customerName: "Crown & Coil Studio",
    customerType: "Salon",
    ...REP_NE,
    date: "2026-09-28",
    dueDate: "2026-10-28",
    amount: 2650,
    paid: 0,
    ...usd,
  },
  {
    id: "31060",
    customerId: "SAL-02",
    customerName: "Glow Studios",
    customerType: "Salon",
    ...REP_NE,
    date: "2026-10-09",
    dueDate: "2026-11-08",
    amount: 4600,
    paid: 0,
    ...usd,
  },
  {
    id: "30988",
    customerId: "SAL-02",
    customerName: "Glow Studios",
    customerType: "Salon",
    ...REP_NE,
    date: "2026-06-11",
    dueDate: "2026-07-11",
    amount: 3900,
    paid: 2900,
    ...usd,
  },
  {
    id: "31015",
    customerId: "SAL-03",
    customerName: "The Curl Bar",
    customerType: "Salon",
    ...REP_NE,
    date: "2026-08-22",
    dueDate: "2026-09-21",
    amount: 1500,
    paid: 0,
    ...usd,
  },
  {
    id: "31088",
    customerId: "SAL-04",
    customerName: "Texture Lab Salon",
    customerType: "Salon",
    ...REP_NE,
    date: "2026-10-02",
    dueDate: "2026-11-01",
    amount: 3100,
    paid: 0,
    ...usd,
  },
  {
    id: "31041",
    customerId: "SAL-05",
    customerName: "Peachtree Curl Co",
    customerType: "Salon",
    ...REP_SE,
    date: "2026-09-05",
    dueDate: "2026-10-05",
    amount: 3000,
    paid: 1000,
    ...usd,
  },
  {
    id: "30960",
    customerId: "SAL-06",
    customerName: "Magnolia Hair House",
    customerType: "Salon",
    ...REP_SE,
    date: "2026-06-30",
    dueDate: "2026-07-30",
    amount: 1900,
    paid: 0,
    ...usd,
  },
  {
    id: "31110",
    customerId: "SAL-07",
    customerName: "Coastal Coils",
    customerType: "Salon",
    ...REP_SE,
    date: "2026-09-24",
    dueDate: "2026-10-24",
    amount: 1750,
    paid: 0,
    ...usd,
  },
  // Wholesale (non-distributor) customers
  {
    id: "30990",
    customerId: "W-LTC",
    customerName: "Learn The Cut",
    customerType: "Wholesale",
    ...FIN,
    date: "2026-07-20",
    dueDate: "2026-08-19",
    amount: 5400,
    paid: 2400,
    ...usd,
  },
  {
    id: "31070",
    customerId: "W-LTC",
    customerName: "Learn The Cut",
    customerType: "Wholesale",
    ...FIN,
    date: "2026-09-25",
    dueDate: "2026-10-25",
    amount: 3800,
    paid: 0,
    ...usd,
  },
  {
    id: "31095",
    customerId: "W-CBB",
    customerName: "Curl Collective Boutique",
    customerType: "Wholesale",
    ...REP_SE,
    date: "2026-08-30",
    dueDate: "2026-09-29",
    amount: 2250,
    paid: 0,
    ...usd,
  },
];

export const arRules: ReminderRules = {
  daysBeforeDue: 3,
  onDueDate: true,
  overdueEveryDays: 7,
  escalateFinanceAt: 30,
  escalateCeoAt: 60,
  financeEmail: "finance@controlledchaoshair.com",
  ceoEmail: "ceo@controlledchaoshair.com",
};

/** Reminders already sent (so repeats wait for the interval). */
export const arReminderLog: ReminderLogEntry[] = [
  { invoiceId: "31015", sentOn: "2026-10-19", kind: "Overdue", to: REP_NE.ownerEmail },
  { invoiceId: "31041", sentOn: "2026-10-15", kind: "Overdue", to: REP_SE.ownerEmail },
  { invoiceId: "30990", sentOn: "2026-10-20", kind: "Overdue", to: FIN.ownerEmail },
  { invoiceId: "30960", sentOn: "2026-10-12", kind: "Overdue", to: REP_SE.ownerEmail },
];
