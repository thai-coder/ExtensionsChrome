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

  const CA_CITY_ALIASES = {
    "angels": "Angels Camp",
    "angelscamp": "Angels Camp",
    "cityofindustry": "Industry",
    "industrycity": "Industry",
    "mtshasta": "Mount Shasta",
    "mountshasta": "Mount Shasta",
    "sanbuenaventura": "Ventura",
    "hollywood": "Los Angeles",
    "westhollywood": "West Hollywood",
    "northhollywood": "Los Angeles",
    "studiocity": "Los Angeles",
    "shermanoaks": "Los Angeles",
    "encino": "Los Angeles",
    "vannuys": "Los Angeles",
    "venice": "Los Angeles",
    "tarzana": "Los Angeles",
    "woodlandhills": "Los Angeles",
    "reseda": "Los Angeles",
    "chatsworth": "Los Angeles",
    "northridge": "Los Angeles",
    "sanpedro": "Los Angeles",
    "marinadelrey": "Los Angeles",
    "eastlosangeles": "Los Angeles",
    "altadena": "Los Angeles",
    "rowlandheights": "Los Angeles",
    "haciendaheights": "Los Angeles",
    "castaic": "Los Angeles",
    "valencia": "Santa Clarita",
    "stevensonranch": "Los Angeles",
    "canyoncountry": "Santa Clarita",
    "centurycity": "Los Angeles",
    "belair": "Los Angeles",
    "brentwoodla": "Los Angeles",
    "pacificpalisades": "Los Angeles",
    "playadelrey": "Los Angeles",
    "playavista": "Los Angeles"
  };

  function normalizeGeoKey(value) {
    if (!value) return "";
    return String(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function getCitiesList() {
    if (typeof window !== "undefined" && Array.isArray(window.CA_CITY_COUNTY)) {
      return window.CA_CITY_COUNTY;
    }
    if (typeof globalThis !== "undefined" && Array.isArray(globalThis.CA_CITY_COUNTY)) {
      return globalThis.CA_CITY_COUNTY;
    }
    return [];
  }

  function lookupCityOffline(cityInput) {
    if (!cityInput) return null;
    const clean = String(cityInput).trim();
    const key = normalizeGeoKey(clean);
    if (!key) return null;

    const cities = getCitiesList();

    // 1. Kiểm tra alias trước
    const aliasTarget = CA_CITY_ALIASES[key];
    if (aliasTarget) {
      const aliasKey = normalizeGeoKey(aliasTarget);
      const hit = cities.find(x => normalizeGeoKey(x.city) === aliasKey);
      if (hit) return hit;
    }

    // 2. Tra cứu trực tiếp theo normalized key
    const directHit = cities.find(x => normalizeGeoKey(x.city) === key);
    if (directHit) return directHit;

    // 3. Tra cứu bỏ tiền tố "city of" / "town of"
    const stripped = key.replace(/^(cityof|townof)/, "");
    if (stripped && stripped !== key) {
      const strippedHit = cities.find(x => normalizeGeoKey(x.city) === stripped);
      if (strippedHit) return strippedHit;
    }

    return null;
  }

  function getCountyKeyFromCountyName(countyName) {
    if (!countyName) return "orange";
    const lower = countyName.toLowerCase();
    if (lower.includes("orange")) return "orange";
    if (lower.includes("los angeles")) return "losAngeles";
    if (lower.includes("riverside")) return "riverside";
    if (lower.includes("san bernardino")) return "sanBernardino";

    return lower
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join("");
  }

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
     * Tra cứu offline thành phố từ từ điển 483 thành phố CA
     */
    static lookupCity(cityName) {
      return lookupCityOffline(cityName);
    }

    /**
     * Phân tích địa chỉ và trả về thông tin Quận & Thành phố tương ứng
     * Hỗ trợ địa chỉ đầy đủ hoặc rút gọn: [Số nhà tên đường], [Thành phố]
     * @param {string} address 
     * @returns {Object}
     */
    static detect(address) {
      if (!address) return { countyKey: "orange", ...CA_COUNTY_DATABASE.orange, confidence: "default" };

      const trimmedAddress = String(address).trim();
      const lower = trimmedAddress.toLowerCase();

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

      // 1. PHÂN TÍCH ĐỊA CHỈ CÓ DẤU PHẨY [Street], [City] hoặc [Street], [City], [State Zip]
      if (trimmedAddress.includes(",")) {
        const parts = trimmedAddress.split(",").map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          // Lấy đoạn thứ 2 (chứa City)
          let cityCandidate = parts[1]
            .replace(/\b(ca|california|usa)\b/gi, "")
            .replace(/\b\d{5}(-\d{4})?\b/g, "")
            .trim();

          const cityHit = lookupCityOffline(cityCandidate);
          if (cityHit) {
            const countyKey = getCountyKeyFromCountyName(cityHit.county);
            const countyBase = CA_COUNTY_DATABASE[countyKey] || {
              name: `${cityHit.county} County`,
              state: "CA",
              countySlug: `${cityHit.countySlug}-county`,
              assessorUrl: `https://www.google.com/search?q=${encodeURIComponent(cityHit.county + " County Assessor")}`
            };

            return {
              countyKey: countyKey,
              ...countyBase,
              countyName: `${cityHit.county} County`,
              matchedCity: cityHit.city.toLowerCase(),
              citySlug: cityHit.citySlug,
              jurisdiction: cityHit.jurisdiction,
              confidence: "offline_comma_city"
            };
          }

          // Thử thêm đoạn thứ 3 nếu có
          if (parts.length >= 3) {
            let cityCandidate3 = parts[2]
              .replace(/\b(ca|california|usa)\b/gi, "")
              .replace(/\b\d{5}(-\d{4})?\b/g, "")
              .trim();
            const cityHit3 = lookupCityOffline(cityCandidate3);
            if (cityHit3) {
              const countyKey = getCountyKeyFromCountyName(cityHit3.county);
              const countyBase = CA_COUNTY_DATABASE[countyKey] || {
                name: `${cityHit3.county} County`,
                state: "CA",
                countySlug: `${cityHit3.countySlug}-county`
              };
              return {
                countyKey: countyKey,
                ...countyBase,
                countyName: `${cityHit3.county} County`,
                matchedCity: cityHit3.city.toLowerCase(),
                citySlug: cityHit3.citySlug,
                jurisdiction: cityHit3.jurisdiction,
                confidence: "offline_comma_city_p3"
              };
            }
          }
        }
      }

      // 2. Kiểm tra trực tiếp tên Quận trong chuỗi
      if (lower.includes("orange county") || lower.includes("orange, ca")) {
        return { countyKey: "orange", ...CA_COUNTY_DATABASE.orange, confidence: "high_county_text" };
      }
      if (lower.includes("los angeles county") || lower.includes("la county")) {
        return { countyKey: "losAngeles", ...CA_COUNTY_DATABASE.losAngeles, confidence: "high_county_text" };
      }
      if (lower.includes("riverside county")) {
        return { countyKey: "riverside", ...CA_COUNTY_DATABASE.riverside, confidence: "high_county_text" };
      }
      if (lower.includes("san bernardino county")) {
        return { countyKey: "sanBernardino", ...CA_COUNTY_DATABASE.sanBernardino, confidence: "high_county_text" };
      }

      // 3. Quét qua từ điển 483 thành phố (Offline match)
      const cities = getCitiesList();
      for (const item of cities) {
        const regex = new RegExp(`\\b${item.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
        if (regex.test(trimmedAddress)) {
          const countyKey = getCountyKeyFromCountyName(item.county);
          const countyBase = CA_COUNTY_DATABASE[countyKey] || {
            name: `${item.county} County`,
            state: "CA",
            countySlug: `${item.countySlug}-county`,
            assessorUrl: `https://www.google.com/search?q=${encodeURIComponent(item.county + " County Assessor")}`
          };

          return {
            countyKey: countyKey,
            ...countyBase,
            countyName: `${item.county} County`,
            matchedCity: item.city.toLowerCase(),
            citySlug: item.citySlug,
            jurisdiction: item.jurisdiction,
            confidence: "offline_city_match"
          };
        }
      }

      // 4. Kiểm tra theo Zipcode 5 số
      const zipMatch = trimmedAddress.match(/\b(9\d{4})\b/);
      if (zipMatch) {
        const zip = zipMatch[1];
        for (const [key, county] of Object.entries(CA_COUNTY_DATABASE)) {
          if (county.zipPrefixes && county.zipPrefixes.some(p => zip.startsWith(p))) {
            return { countyKey: key, ...county, matchedZip: zip, confidence: "zip_match" };
          }
        }
      }

      // 5. Kiểm tra nếu chỉ có số nhà + tên đường (thiếu Thành phố / Zip)
      const isStreetOnly = /^\d+\s+[a-z0-9\s.#\/-]+$/i.test(trimmedAddress) && !trimmedAddress.includes(",");
      if (isStreetOnly) {
        return { 
          countyKey: "unknown", 
          name: "Không Xác Định", 
          state: "CA",
          countySlug: "unknown",
          confidence: "missing_city_warning", 
          isStreetOnly: true,
          isUnknown: true 
        };
      }

      // Default fallback: Không tìm thấy thông tin phù hợp
      return { 
        countyKey: "unknown", 
        name: "Không Xác Định", 
        state: "CA",
        countySlug: "unknown",
        confidence: "unknown", 
        isUnknown: true 
      };
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
