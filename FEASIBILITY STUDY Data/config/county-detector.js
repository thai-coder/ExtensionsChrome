/**
 * FEASIBILITY STUDY Data - California County Detector & Router
 * Tự động nhận diện Quận & Thành phố của California từ địa chỉ (City & Zipcode)
 */

(function () {
  if (typeof window !== "undefined" && window.CountyDetector) return;

  const CA_COUNTY_DATABASE = {
    orange: {
      name: "Orange County",
      state: "CA",
      countySlug: "orange-county",
      cities: [
        "westminster", "garden grove", "anaheim", "santa ana", "irvine", 
        "huntington beach", "orange", "fullerton", "costa mesa", "mission viejo", 
        "newport beach", "buena park", "tustin", "lake forest", "fountain valley", 
        "placentia", "aliso viejo", "cypress", "rancho santa margarita", "brea", 
        "stanton", "san juan capistrano", "dana point", "laguna niguel", "laguna hills", 
        "seal beach", "los alamitos", "laguna beach", "la palma", "villa park"
      ],
      zipPrefixes: ["926", "927", "928"],
      assessorUrl: "https://webapps.ocgis.com/oclandinsights/map-viewer?id=2",
      getParcelMapUrl: (apn) => {
        const clean = (apn || "").replace(/[^0-9]/g, "");
        return `https://webapps.ocgis.com/oclandinsights/map-viewer?id=2&apn=${clean}`;
      }
    },
    losAngeles: {
      name: "Los Angeles County",
      state: "CA",
      countySlug: "los-angeles-county",
      cities: [
        "los angeles", "lancaster", "long beach", "glendale", "santa clarita", 
        "pasadena", "torrance", "pomona", "palmdale", "downey", "inglewood", 
        "west covina", "norwalk", "burbank", "compton", "south gate", "carson", 
        "santa monica", "whittier", "hawthorne", "alhambra", "lakewood", "bellflower", 
        "baldwin park", "lynwood", "redondo beach", "pico rivera", "montebello", 
        "monterey park", "gardena", "huntington park", "arcadia", "diamond bar", 
        "paramount", "rosemead", "glendora", "cerritos", "la mirada", "covina", 
        "azusa", "bell gardens", "rancho palos verdes", "san gabriel", "culver city"
      ],
      zipPrefixes: ["900", "901", "902", "903", "904", "905", "906", "907", "908", "910", "911", "912", "913", "914", "915", "916", "917", "918", "935"],
      assessorUrl: "https://portal.assessor.lacounty.gov/parceldetail",
      getParcelMapUrl: (apn) => {
        const clean = (apn || "").replace(/[^0-9]/g, "");
        return `https://portal.assessor.lacounty.gov/parceldetail/${clean}`;
      }
    },
    riverside: {
      name: "Riverside County",
      state: "CA",
      countySlug: "riverside-county",
      cities: ["riverside", "moreno valley", "corona", "murrieta", "temecula", "jurupa valley", "indio", "hemet", "perris", "palm springs"],
      zipPrefixes: ["925", "922"],
      assessorUrl: "https://ca-riverside-acr.civicplus.pro/",
      getParcelMapUrl: (apn) => `https://ca-riverside-acr.civicplus.pro/`
    },
    sanBernardino: {
      name: "San Bernardino County",
      state: "CA",
      countySlug: "san-bernardino-county",
      cities: ["san bernardino", "fontana", "ontario", "rancho cucamonga", "victorville", "rialto", "hesperia", "chino", "chino hills", "upland"],
      zipPrefixes: ["923", "924", "917"],
      assessorUrl: "https://www.arcgis.com/apps/webappviewer/index.html?id=e704eb0429f448c4a45a5d115e5102a2",
      getParcelMapUrl: (apn) => `https://www.arcgis.com/apps/webappviewer/index.html?id=e704eb0429f448c4a45a5d115e5102a2`,
      cityProfiles: {
        ontario: {
          cityName: "Ontario",
          jurisdiction: "City of Ontario",
          zoning: "CITY OF ONTARIO",
          zoningDesc: "City of Ontario",
          zoningUrl: "http://www.ci.ontario.ca.us/",
          officialUrl: "http://www.ci.ontario.ca.us/"
        }
      }
    }
  };

  const CITY_SPECIFIC_PROFILES = {
    ontario: {
      cityName: "Ontario",
      countyKey: "sanBernardino",
      countyName: "San Bernardino County",
      jurisdiction: "City of Ontario",
      zoning: "CITY OF ONTARIO",
      zoningDistrict: "CITY OF ONTARIO",
      zoningDesc: "City of Ontario",
      zoningCode: "CITY OF ONTARIO",
      zoningCodeUrl: "http://www.ci.ontario.ca.us/",
      officialUrl: "http://www.ci.ontario.ca.us/"
    }
  };

  class CountyDetector {
    /**
     * Phân tích địa chỉ và trả về thông tin Quận & Thành phố tương ứng
     * @param {string} address 
     * @returns {Object}
     */
    static detect(address) {
      if (!address) return { countyKey: "orange", ...CA_COUNTY_DATABASE.orange, confidence: "default" };

      const lower = address.toLowerCase();

      // 0. Kiểm tra trực tiếp City Profiles đặc biệt (như City of Ontario)
      for (const [cityKey, profile] of Object.entries(CITY_SPECIFIC_PROFILES)) {
        const regex = new RegExp(`\\b${cityKey}\\b`, "i");
        if (regex.test(lower)) {
          const county = CA_COUNTY_DATABASE[profile.countyKey] || CA_COUNTY_DATABASE.sanBernardino;
          return {
            countyKey: profile.countyKey,
            ...county,
            ...profile,
            matchedCity: profile.cityName.toLowerCase(),
            confidence: "city_profile_match"
          };
        }
      }

      // 1. Kiểm tra trực tiếp tên Quận trong chuỗi
      if (lower.includes("orange county") || lower.includes("orange, ca")) {
        return { countyKey: "orange", ...CA_COUNTY_DATABASE.orange, confidence: "high" };
      }
      if (lower.includes("los angeles county") || lower.includes("la county")) {
        return { countyKey: "losAngeles", ...CA_COUNTY_DATABASE.losAngeles, confidence: "high" };
      }
      if (lower.includes("riverside county")) {
        return { countyKey: "riverside", ...CA_COUNTY_DATABASE.riverside, confidence: "high" };
      }
      if (lower.includes("san bernardino county")) {
        return { countyKey: "sanBernardino", ...CA_COUNTY_DATABASE.sanBernardino, confidence: "high" };
      }

      // 2. Kiểm tra theo tên Thành Phố
      for (const [key, county] of Object.entries(CA_COUNTY_DATABASE)) {
        for (const city of county.cities) {
          const regex = new RegExp(`\\b${city}\\b`, "i");
          if (regex.test(lower)) {
            const cityProf = (county.cityProfiles && county.cityProfiles[city]) || null;
            return {
              countyKey: key,
              ...county,
              ...(cityProf || {}),
              matchedCity: city,
              confidence: "city_match"
            };
          }
        }
      }

      // 3. Kiểm tra theo Zipcode 5 số
      const zipMatch = address.match(/\b(9\d{4})\b/);
      if (zipMatch) {
        const zip = zipMatch[1];
        for (const [key, county] of Object.entries(CA_COUNTY_DATABASE)) {
          if (county.zipPrefixes.some(p => zip.startsWith(p))) {
            return { countyKey: key, ...county, matchedZip: zip, confidence: "zip_match" };
          }
        }
      }

      // Default fallback là Orange County
      return { countyKey: "orange", ...CA_COUNTY_DATABASE.orange, confidence: "fallback" };
    }

    /**
     * Tạo URL chuẩn xác mở thẳng bản đồ Gridics PropZone với APN/Folio
     * @param {string} address 
     * @param {string} apn 
     * @returns {string}
     */
    static getPropZoneUrl(address, apn) {
      const cleanApn = (apn || "").replace(/[^0-9A-Za-z]/g, "");
      const info = CountyDetector.detect(address);
      const countySlug = info.countySlug || (info.countyKey === "orange" ? "orange-county" : (info.countyKey === "losAngeles" ? "los-angeles-county" : "orange-county"));
      const stateCode = (info.state || "CA").toLowerCase();
      
      let citySlug = "";
      if (info.matchedCity) {
        citySlug = info.matchedCity.replace(/\s+/g, "-");
      } else if (address) {
        const parts = address.split(",");
        if (parts.length >= 2) {
          citySlug = parts[1].trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
        }
      }

      if (citySlug) {
        return `https://propzone.gridics.com/city/us/${stateCode}/${countySlug}/${citySlug}?leftOverlay=properties${cleanApn ? `&folio=${cleanApn}` : ''}`;
      }

      return `https://propzone.gridics.com/city/us/${stateCode}/${countySlug}?leftOverlay=properties${cleanApn ? `&folio=${cleanApn}` : ''}`;
    }

    /**
     * Tạo URL chuẩn xác cho bản đồ Parcel / Plat Map dựa trên Quận / Thành phố nhận diện từ địa chỉ
     * @param {string} address 
     * @param {string} apn 
     * @returns {string}
     */
    static getParcelPlatMapUrl(address, apn) {
      const info = CountyDetector.detect(address);
      const cleanApn = (apn || "").replace(/[^0-9]/g, "");

      if (info.countyKey === "orange") {
        return cleanApn 
          ? `https://webapps.ocgis.com/oclandinsights/map-viewer?id=2&apn=${cleanApn}`
          : `https://webapps.ocgis.com/oclandinsights/map-viewer?id=2`;
      }
      if (info.countyKey === "losAngeles") {
        return cleanApn 
          ? `https://portal.assessor.lacounty.gov/parceldetail/${cleanApn}`
          : `https://portal.assessor.lacounty.gov/`;
      }
      if (info.countyKey === "riverside") {
        return `https://ca-riverside-acr.civicplus.pro/`;
      }
      if (info.countyKey === "sanBernardino") {
        return `https://www.arcgis.com/apps/webappviewer/index.html?id=e704eb0429f448c4a45a5d115e5102a2`;
      }
      return info.assessorUrl || "https://webapps.ocgis.com/oclandinsights/map-viewer?id=2";
    }
  }

  if (typeof window !== "undefined") {
    window.CA_COUNTY_DATABASE = CA_COUNTY_DATABASE;
    window.CountyDetector = CountyDetector;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.CA_COUNTY_DATABASE = CA_COUNTY_DATABASE;
    globalThis.CountyDetector = CountyDetector;
  }
  if (typeof module !== "undefined") {
    module.exports = { CA_COUNTY_DATABASE, CountyDetector };
  }
})();
