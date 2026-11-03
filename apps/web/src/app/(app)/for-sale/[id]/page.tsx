import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { ListingDetail } from "@/features/for-sale/listing-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl">
      <VerifiedGate>
        <ListingDetail id={id} />
      </VerifiedGate>
    </div>
  );
}
