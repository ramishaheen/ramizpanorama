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
  "section.risk_gauge": { en: "AI Risk Index", ar: "مؤشر المخاطر بالذكاء الاصطناعي" },
  "section.commodities": { en: "Commodity & Crypto Prices", ar: "أسعار السلع والعملات الرقمية" },
  "section.predictions": { en: "AI Trade Predictions", ar: "توقعات التداول بالذكاء الاصطناعي" },
  "section.layers": { en: "Layers", ar: "طبقات" },
  "section.timeline": { en: "Timeline", ar: "الجدول الزمني" },

  // Actions
  "action.refresh": { en: "Refresh", ar: "تحديث" },
  "action.intel": { en: "Intel", ar: "استخبارات" },
  "action.hide": { en: "Hide", ar: "إخفاء" },
  "action.loading": { en: "Loading intel…", ar: "جاري تحميل المعلومات…" },
  "action.expand": { en: "Expand", ar: "توسيع" },
  "action.sitrep": { en: "SITREP", ar: "تقرير الوضع" },

  // Layers
  "layer.airspace": { en: "Airspace", ar: "المجال الجوي" },
  "layer.maritime": { en: "Maritime", ar: "بحري" },
  "layer.alerts": { en: "Alerts", ar: "تنبيهات" },
  "layer.rockets": { en: "Rockets", ar: "صواريخ" },
  "layer.heatmap": { en: "Heatmap", ar: "خريطة حرارية" },
  "layer.earthquakes": { en: "Earthquakes", ar: "زلازل" },
  "layer.wildfires": { en: "Wildfires", ar: "حرائق الغابات" },
  "layer.weather": { en: "Weather Radar", ar: "رادار الطقس" },
  "layer.conflicts": { en: "Conflicts/Protests", ar: "نزاعات/احتجاجات" },

  // Risk levels
  "risk.critical": { en: "CRITICAL", ar: "حرج" },
  "risk.elevated": { en: "ELEVATED", ar: "مرتفع" },
  "risk.moderate": { en: "MODERATE", ar: "متوسط" },
  "risk.low": { en: "LOW", ar: "منخفض" },
  "risk.last_update": { en: "LAST UPDATE", ar: "آخر تحديث" },

  // Chart labels
  "chart.airspace": { en: "Airspace", ar: "المجال الجوي" },
  "chart.maritime": { en: "Maritime", ar: "بحري" },
  "chart.diplomatic": { en: "Diplomatic", ar: "دبلوماسي" },
  "chart.sentiment": { en: "Sentiment", ar: "المعنويات" },

  // Missile alert
  "missile.detected": { en: "⚠ MISSILE LAUNCH DETECTED", ar: "⚠ تم رصد إطلاق صاروخ" },
  "missile.designation": { en: "Designation", ar: "التسمية" },
  "missile.origin": { en: "Origin", ar: "المصدر" },
  "missile.target": { en: "Target Region", ar: "المنطقة المستهدفة" },

  // News
  "news.channels": { en: "channels", ar: "قناة" },
  "news.all": { en: "All", ar: "الكل" },

  // War updates
  "war.ai_live": { en: "AI-Live", ar: "ذكاء اصطناعي مباشر" },
  "war.gathering": { en: "Gathering intelligence…", ar: "جاري جمع المعلومات…" },

  // Citizen Security
  "citizen.active_threats": { en: "Active Threats", ar: "تهديدات نشطة" },
  "citizen.analyzing": { en: "Analyzing regional security…", ar: "جاري تحليل الأمن الإقليمي…" },
  "citizen.safety_score": { en: "Safety Score", ar: "درجة الأمان" },
  "citizen.current_status": { en: "Current Status", ar: "الحالة الراهنة" },

  // AI Predictions
  "pred.analyzing": { en: "Analyzing intel…", ar: "جاري تحليل المعلومات…" },
  "pred.auto_refresh": { en: "Auto-refresh: 60s", ar: "تحديث تلقائي: 60 ثانية" },
  "pred.updated": { en: "Updated", ar: "تم التحديث" },

  // Commodities
  "commodity.simulated": { en: "Oil & Gold simulated • Crypto via CoinGecko • Updates every 15–30s", ar: "النفط والذهب محاكاة • العملات الرقمية عبر CoinGecko • تحديث كل 15-30 ثانية" },

  // Sector predictions
  "sector.analyzing": { en: "Analyzing regional sectors…", ar: "جاري تحليل القطاعات الإقليمية…" },
  "sector.all_sectors": { en: "All Sectors", ar: "جميع القطاعات" },
  "sector.outlook": { en: "Outlook", ar: "التوقعات" },
  "sector.opportunities": { en: "Opportunities", ar: "الفرص" },
  "sector.risks": { en: "Risks", ar: "المخاطر" },
  "sector.impact": { en: "Impact", ar: "التأثير" },
  "sector.confidence": { en: "Confidence", ar: "الثقة" },

  // Notification detail
  "notif.source": { en: "Source", ar: "المصدر" },
  "notif.coords": { en: "Coords", ar: "الإحداثيات" },

  // Disclaimer
  "disclaimer": { en: "DISCLAIMER: This system uses publicly available OSINT data for analytical purposes only. Not for operational, military, or targeting use. All data sources are public domain.", ar: "تنويه: يستخدم هذا النظام بيانات استخبارات مفتوحة المصدر لأغراض تحليلية فقط. ليس للاستخدام العملياتي أو العسكري أو الاستهداف. جميع مصادر البيانات متاحة للعامة." },

  // AI predictions disclaimer
  "pred.disclaimer": { en: "⚠ DISCLAIMER: The information and predictions presented herein are generated by artificial intelligence for general informational and educational purposes only. They do not constitute, and should not be construed as, financial advice, investment recommendations, or an offer or solicitation to buy or sell any securities, commodities, or digital assets.", ar: "⚠ تنويه: المعلومات والتوقعات المقدمة هنا مُولّدة بالذكاء الاصطناعي لأغراض إعلامية وتعليمية عامة فقط. لا تشكّل نصيحة مالية أو توصية استثمارية أو عرض لشراء أو بيع أي أصول رقمية." },

  // War Escalation
  "section.escalation": { en: "War Escalation Engine", ar: "محرك تصعيد الحرب" },
  "stat.satellites": { en: "Satellites Tracked", ar: "الأقمار الصناعية المتعقبة" },
};
