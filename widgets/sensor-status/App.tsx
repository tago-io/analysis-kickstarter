import { useWidgetData } from "@tago-io/custom-widget-react";
import { useDictionary } from "../shared/use-dictionary.ts";
import { readCounts } from "./read-counts.ts";
import { GaugeCard } from "./components/GaugeCard.tsx";

const WIDGET_KEYS = [
  "WIDGET_REGISTERED",
  "WIDGET_TOTAL_DEVICES_REGISTERED",
  "WIDGET_ONLINE",
  "WIDGET_SENSORS_REPORTING",
  "WIDGET_OFFLINE",
  "WIDGET_SENSORS_SILENT",
] as const;

const EN_BASELINE: Record<string, string> = {
  WIDGET_REGISTERED: "Registered",
  WIDGET_TOTAL_DEVICES_REGISTERED: "Total devices registered",
  WIDGET_ONLINE: "Online",
  WIDGET_SENSORS_REPORTING: "Sensors reporting",
  WIDGET_OFFLINE: "Offline",
  WIDGET_SENSORS_SILENT: "Sensors silent",
};

export default function App() {
  const { isLoading, records } = useWidgetData();
  const { t } = useDictionary(WIDGET_KEYS, { baseline: EN_BASELINE });
  const counts = readCounts(records);
  const total = counts.registered ?? 0;

  return (
    <div
      className="@container/widget h-dvh w-dvw overflow-x-hidden overflow-y-auto bg-[rgb(43,43,43)] p-2"
      style={{ fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}
    >
      <div className="grid min-h-full w-full grid-cols-1 gap-2 @[400px]/widget:h-full @[400px]/widget:grid-cols-3">
        <GaugeCard
          label={t("WIDGET_REGISTERED")}
          subtitle={t("WIDGET_TOTAL_DEVICES_REGISTERED")}
          value={counts.registered}
          ratio={1}
          color="rgb(91,141,238)"
          isLoading={isLoading}
        />
        <GaugeCard
          label={t("WIDGET_ONLINE")}
          subtitle={t("WIDGET_SENSORS_REPORTING")}
          value={counts.online}
          ratio={total > 0 && counts.online != null ? counts.online / total : 0}
          color="rgb(82,196,140)"
          isLoading={isLoading}
        />
        <GaugeCard
          label={t("WIDGET_OFFLINE")}
          subtitle={t("WIDGET_SENSORS_SILENT")}
          value={counts.offline}
          ratio={total > 0 && counts.offline != null ? counts.offline / total : 0}
          color="rgb(245,166,35)"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
