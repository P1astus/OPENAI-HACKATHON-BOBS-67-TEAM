"use client";

import { Building2, ClipboardList, Handshake, ReceiptText, ShieldBan, UserRoundPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewer } from "@/lib/hooks";
import { CompaniesPanel } from "./companies-panel";
import { InvoicesPanel } from "./invoices-panel";
import { TicketsPanel } from "./tickets-panel";

const tabs = [
  { value: "tickets", label: "Tickets", icon: ClipboardList },
  { value: "invoices", label: "Invoices", icon: ReceiptText },
  { value: "companies", label: "Companies", icon: Building2 },
  { value: "partners", label: "Partners", icon: Handshake },
  { value: "potential", label: "Potential partners", icon: UserRoundPlus },
  { value: "blacklist", label: "Blacklist", icon: ShieldBan },
] as const;

export function OperationsTabs() {
  const viewer = useViewer("admin");

  return (
    <Tabs key={viewer} defaultValue="tickets" className="min-w-0 gap-5">
      <TabsList
        aria-label="Operations"
        className="shadow-soft grid w-full grid-cols-2 gap-1 rounded-[14px] bg-card p-1 group-data-horizontal/tabs:h-auto sm:grid-cols-3 lg:grid-cols-6"
      >
        {tabs.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="h-11 min-h-11 justify-start px-3 text-sm data-active:bg-primary/10 data-active:text-primary data-active:shadow-none sm:justify-center"
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="tickets"><TicketsPanel /></TabsContent>
      <TabsContent value="invoices"><InvoicesPanel /></TabsContent>
      <TabsContent value="companies"><CompaniesPanel view="companies" /></TabsContent>
      <TabsContent value="partners"><CompaniesPanel view="partners" /></TabsContent>
      <TabsContent value="potential"><CompaniesPanel view="potential" /></TabsContent>
      <TabsContent value="blacklist"><CompaniesPanel view="blacklist" /></TabsContent>
    </Tabs>
  );
}
