import Register from "@/components/Register";
import { getDomainInventory } from "@/lib/domain-inventory";

export const dynamic = "force-dynamic";

export default async function Page() {
  const inventory = await getDomainInventory();
  const warning = inventory.source !== "live" || inventory.stale;
  return (
    <main className="shell">
      <header className="masthead">
        <h1>map</h1>
        <span>ethanyanxu.com</span>
      </header>

      <p className="inventory-status" data-warning={warning}>
        {inventory.sites.length} configured subdomains
        {warning ? " · showing the last saved inventory" : " · inventory updated"}
        {" · "}
        <time dateTime={inventory.updatedAt}>
          {new Date(inventory.updatedAt).toLocaleString("en-CA", {
            timeZone: "America/Toronto",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })}
        </time>
        {inventory.stale ? " · sync is overdue" : ""}
      </p>
      <Register sites={inventory.sites} />
    </main>
  );
}
