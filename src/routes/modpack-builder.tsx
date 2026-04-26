import { ModpackBuilderPage } from "@/features/modpack-builder/modpack-builder-page";

type ModpackBuilderRouteProps = {
  packId: string;
  onBack: () => void;
};

export function ModpackBuilderRoute({ packId, onBack }: ModpackBuilderRouteProps) {
  return <ModpackBuilderPage packId={packId} onBack={onBack} />;
}
