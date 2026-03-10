import { IntelLayout } from "@/components/intel/IntelLayout";

const IntelMapPage = () => {
  return (
    <IntelLayout>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-mono font-bold text-foreground">GLOBAL INTEL MAP</h1>
          <p className="text-sm text-muted-foreground">Source markers, events, clustering — coming in Phase 2</p>
        </div>
      </div>
    </IntelLayout>
  );
};

export default IntelMapPage;
