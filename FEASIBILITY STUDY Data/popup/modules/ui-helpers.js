/**
 * FEASIBILITY STUDY Data - UI Helpers & Formatters Module
 * Quản lý các tiện ích Toast, gán dữ liệu DOM, format đơn vị đo (ft, sqft) và bóc tách thông tin Garage.
 */

(function () {
  let toastTimer = null;

  const FsUiHelpers = {
    /**
     * Hiển thị thông báo Toast góc dưới màn hình
     * @param {string} msg 
     * @param {number} duration 
     */
    showToast(msg, duration = 2500) {
      const toast = document.getElementById("toast");
      if (!toast) return;
      if (toastTimer) clearTimeout(toastTimer);
      toast.textContent = msg;
      toast.classList.remove("hidden");
      toastTimer = setTimeout(() => toast.classList.add("hidden"), duration);
    },

    /**
     * Gán text cho phần tử DOM an toàn và tự động xử lý màu sắc
     * @param {string} elementId 
     * @param {any} value 
     */
    setText(elementId, value) {
      const el = document.getElementById(elementId);
      if (!el) return;
      if (value === undefined || value === null || value === "" || value === "-") {
        el.textContent = "-";
        el.style.color = "#64748b";
      } else {
        el.textContent = String(value);
        el.style.color = "";
      }
    },

    /**
     * Format diện tích dạng số sang chuỗi có đơn vị ft²
     * @param {number|string} val 
     * @returns {string}
     */
    formatSqFt(val) {
      if (val === undefined || val === null || val === "" || val === "-") return "-";
      if (typeof val === "number") return `${val.toLocaleString()} ft²`;
      return String(val);
    },

    /**
     * Format chiều dài sang chuỗi có đơn vị ft
     * @param {number|string} val 
     * @returns {string}
     */
    formatFt(val) {
      if (val === undefined || val === null || val === "" || val === "-") return "-";
      if (typeof val === "number") return `${val} ft`;
      return String(val);
    },

    /**
     * Phân tích chuỗi mô tả Garage/Parking thành các trường thông số chi tiết
     * @param {string} raw 
     * @returns {object}
     */
    parseGarageParking(raw) {
      if (!raw || raw === "-" || /^(none|n\/a|0)$/i.test(String(raw).trim())) {
        return {
          garageSpaces: 0,
          drivewaySpaces: 0,
          garageArea: null,
          garageDimension: null,
          drivewayArea: null,
          totalParkingArea: null,
          formattedSummary: "-"
        };
      }

      const str = String(raw).trim();
      let garageSpaces = 0;
      let drivewaySpaces = 0;

      const garageMatch = str.match(/(\d+)\s*[-\s]?car\s*(?:attached|detached)?\s*(?:garage|covered)?/i)
        || str.match(/(\d+)\s*(?:garage|covered)\s*spaces?/i)
        || str.match(/garage(?:\s*spaces?)?[\s:\-–—]{1,5}(\d+)/i)
        || str.match(/garage[^\d]{0,15}(\d+)\s*chỗ/i);
      if (garageMatch && garageMatch[1]) {
        garageSpaces = parseInt(garageMatch[1], 10);
      } else if (/garage/i.test(str)) {
        garageSpaces = 2;
      }

      const driveMatch = str.match(/(\d+)\s*[-\s]?car\s*driveway/i)
        || str.match(/(\d+)\s*driveway\s*spaces?/i);
      if (driveMatch && driveMatch[1]) {
        drivewaySpaces = parseInt(driveMatch[1], 10);
      }

      if (garageSpaces === 0 && drivewaySpaces === 0) {
        const spMatch = str.match(/(\d+)\s*(?:spaces?|cars?|parking)/i);
        if (spMatch && spMatch[1]) garageSpaces = parseInt(spMatch[1], 10);
      }

      let garageArea = 0;
      let garageDimension = "";
      if (garageSpaces === 1) {
        garageArea = 240;
        garageDimension = "12×20 ft";
      } else if (garageSpaces === 2) {
        garageArea = 484;
        garageDimension = "22×22 ft";
      } else if (garageSpaces === 3) {
        garageArea = 704;
        garageDimension = "32×22 ft";
      } else if (garageSpaces >= 4) {
        garageArea = garageSpaces * 240;
        garageDimension = `${garageSpaces} × (12×20 ft)`;
      }

      const drivewayArea = drivewaySpaces * 240;
      const totalParkingArea = (garageArea || 0) + (drivewayArea || 0);

      return {
        garageSpaces,
        drivewaySpaces,
        garageArea: garageArea || null,
        garageDimension: garageDimension || null,
        drivewayArea: drivewayArea || null,
        totalParkingArea: totalParkingArea || null
      };
    }
  };

  window.FsUiHelpers = FsUiHelpers;
})();
