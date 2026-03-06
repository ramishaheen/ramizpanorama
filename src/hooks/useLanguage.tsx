import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Lang = "en" | "ar";

interface LanguageContextType {
  lang: Lang;
  isArabic: boolean;
  toggle: () => void;
  t: (en: string, ar: string) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  isArabic: false,
  toggle: () => {},
  t: (en) => en,
  dir: "ltr",
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("en");

  const toggle = useCallback(() => setLang((l) => (l === "en" ? "ar" : "en")), []);
  const isArabic = lang === "ar";
  const t = useCallback((en: string, ar: string) => (lang === "ar" ? ar : en), [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ lang, isArabic, toggle, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

// Translation dictionary for common UI strings
export const translations: Record<string, { en: string; ar: string }> = {
  // Header
  "dashboard.title": { en: "Geopolitical Intelligence Dashboard", ar: "لوحة الاستخبارات الجيوسياسية" },
  "alerts.muted": { en: "Alerts Muted", ar: "التنبيهات مكتومة" },
  "alerts.on": { en: "Alerts On", ar: "التنبيهات مفعّلة" },
  "status.online": { en: "ONLINE", ar: "متصل" },

  // StatsBar
  "stat.airspace": { en: "Airspace Alerts", ar: "تنبيهات المجال الجوي" },
  "stat.vessels": { en: "Tracked Vessels", ar: "السفن المتعقبة" },
  "stat.missiles": { en: "Missiles Active", ar: "صواريخ نشطة" },
  "stat.impacts": { en: "Impacts / Intercepts", ar: "إصابات / اعتراضات" },
  "stat.alerts": { en: "Active Alerts", ar: "تنبيهات نشطة" },
  "stat.risk": { en: "Risk Index", ar: "مؤشر المخاطر" },
  "stat.daily_cost": { en: "Daily War Cost", ar: "تكلفة الحرب اليومية" },
  "stat.total_cost": { en: "Total Est. Cost", ar: "التكلفة الإجمالية المقدرة" },
  "stat.calculating": { en: "Calculating war costs…", ar: "جاري حساب تكاليف الحرب…" },

  // Sections
  "section.intel_feed": { en: "Intel Feed", ar: "موجز الاستخبارات" },
  "section.live": { en: "LIVE", ar: "مباشر" },
  "section.citizen_security": { en: "Citizen Security Indicators", ar: "مؤشرات أمن المواطنين" },
  "section.ai_powered": { en: "AI-Powered", ar: "مدعوم بالذكاء الاصطناعي" },
  "section.sector_predictions": { en: "AI Sector Predictions", ar: "توقعات القطاعات بالذكاء الاصطناعي" },
  "section.by_country": { en: "BY COUNTRY", ar: "حسب الدولة" },
  "section.war_updates": { en: "War Intelligence", ar: "استخبارات الحرب" },
  "section.news": { en: "Live News Feed", ar: "موجز الأخبار المباشرة" },
  "section.risk_gauge": { en: "Risk Score", ar: "درجة المخاطر" },
  "section.commodities": { en: "Commodity Tracker", ar: "متتبع السلع" },
  "section.predictions": { en: "AI Predictions", ar: "توقعات الذكاء الاصطناعي" },
  "section.layers": { en: "Map Layers", ar: "طبقات الخريطة" },
  "section.timeline": { en: "Timeline", ar: "الجدول الزمني" },

  // Actions
  "action.refresh": { en: "Refresh", ar: "تحديث" },
  "action.intel": { en: "Intel", ar: "استخبارات" },
  "action.hide": { en: "Hide", ar: "إخفاء" },
  "action.loading": { en: "Loading intel…", ar: "جاري تحميل المعلومات…" },

  // Layers
  "layer.airspace": { en: "Airspace", ar: "المجال الجوي" },
  "layer.maritime": { en: "Maritime", ar: "بحري" },
  "layer.alerts": { en: "Alerts", ar: "تنبيهات" },
  "layer.rockets": { en: "Rockets", ar: "صواريخ" },
  "layer.heatmap": { en: "Heatmap", ar: "خريطة حرارية" },

  // Disclaimer
  "disclaimer": { en: "DISCLAIMER: This dashboard is for educational and informational purposes only.", ar: "تنويه: هذه اللوحة لأغراض تعليمية وإعلامية فقط." },
};
