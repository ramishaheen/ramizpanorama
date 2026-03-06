import { useLanguage } from "@/hooks/useLanguage";

export const Disclaimer = () => {
  const { t } = useLanguage();
  return (
    <div className="px-4 py-1.5 border-t border-border bg-card/50">
      <p className="text-[9px] text-muted-foreground text-center font-mono">
        ⚠ {t(
          "DISCLAIMER: This system uses publicly available OSINT data for analytical purposes only. Not for operational, military, or targeting use. All data sources are public domain.",
          "تنويه: يستخدم هذا النظام بيانات استخبارات مفتوحة المصدر لأغراض تحليلية فقط. ليس للاستخدام العملياتي أو العسكري أو الاستهداف. جميع مصادر البيانات متاحة للعامة."
        )}
      </p>
    </div>
  );
};
