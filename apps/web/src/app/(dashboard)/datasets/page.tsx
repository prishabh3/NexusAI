import { Suspense } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DatasetListView } from "@/features/upload/dataset-list-view";
import { UploadDialog } from "@/features/upload/upload-dialog";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Datasets — NexusAI" };

export default function DatasetsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Datasets"
        description="Upload and manage your analytical datasets."
        actions={
          <UploadDialog>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Upload Dataset
            </Button>
          </UploadDialog>
        }
      />
      <Suspense fallback={<div className="h-40 rounded-lg skeleton" />}>
        <DatasetListView />
      </Suspense>
    </div>
  );
}
