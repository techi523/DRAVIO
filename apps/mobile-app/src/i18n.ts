import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// the translations
// (tip move them in a JSON file and import them,
// or even better, manage them separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
  en: {
    translation: {
      "Connecting to Telecom routing registry...": "Connecting to Telecom routing registry...",
      "Network Core Offline": "Network Core Offline",
      "RETRY NODE SYNC": "RETRY NODE SYNC",
      "Become an Internet Provider": "Become an Internet Provider",
      "Route Buyer traffic through secure WireGuard tunnels and turn unused bandwidth into earnings.": "Route Buyer traffic through secure WireGuard tunnels and turn unused bandwidth into earnings.",
      "START SELLING BANDWIDTH": "START SELLING BANDWIDTH",
      "Network Quality Scan": "Network Quality Scan",
      "We are analyzing your carrier signal and ping jitter to optimize routing tunnels.": "We are analyzing your carrier signal and ping jitter to optimize routing tunnels.",
      "Checking ping latency & bandwidth capacity...": "Checking ping latency & bandwidth capacity...",
      "ANALYZE CONNECTION": "ANALYZE CONNECTION",
      "Configure Telecom Node": "Configure Telecom Node",
      "Define your internet plan parameters and pricing thresholds.": "Define your internet plan parameters and pricing thresholds.",
      "MAX DATA LIMIT TO SHARE": "MAX DATA LIMIT TO SHARE",
      "PRICING STRUCTURE": "PRICING STRUCTURE",
      "Per GB": "Per GB",
      "Per Hour": "Per Hour",
      "MAX CONCURRENT BUYERS": "MAX CONCURRENT BUYERS",
      "START BROADCASTING": "START BROADCASTING",
      "TODAY'S EARNINGS": "TODAY'S EARNINGS",
      "STOP BROADCAST": "STOP BROADCAST",
      "CONNECTED BUYERS": "CONNECTED BUYERS",
      "ROUTED VOLUME": "ROUTED VOLUME",
      "UPTIME": "UPTIME",
      "Active Connection Registry": "Active Connection Registry",
      "Waiting for Buyers to discover & connect to your node...": "Waiting for Buyers to discover & connect to your node...",
      "⚠️ Broadcast Active. Buyers are securely routing traffic.": "⚠️ Broadcast Active. Buyers are securely routing traffic.",
      "GB": "GB",
      "Clients": "Clients"
    }
  }
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: "en", // language to use, more information here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
    // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
    // if you're using a language detector, do not define the lng option

    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
