import { PageSkeleton } from "@/components/data-display/states";
import { PageContainer } from "@/components/layout/page";

export default function Loading() {
  return (
    <PageContainer>
      <PageSkeleton />
    </PageContainer>
  );
}
