import { IncidentHero } from "@/components/incident/incident-hero";
import { incidents, PRIMARY_INCIDENT_ID } from "@/lib/mock-data";
export default function PublicDemoPage() {
  const incident = incidents.find((item) => item.id === PRIMARY_INCIDENT_ID)!;
  return <IncidentHero incident={incident} simulationOnly />;
}
