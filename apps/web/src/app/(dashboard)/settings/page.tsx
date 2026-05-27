import { PageHeader } from "@/components/layout/page-header";
import { SettingsView } from "@/features/settings/settings-view";

export const metadata = { title: "Settings — NexusAI" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure AI models, storage limits, and notification preferences."
      />
      <SettingsView />
    </div>
  );
}
