/**
 * IP Address Tracker – Vanilla JS
 * Uses ipapi.co free endpoint (no API key required for basic use)
 */

(() => {
  "use strict";

  // ---------- DOM Elements ----------
  const form = document.getElementById("searchForm");
  const input = document.getElementById("ipInput");
  const searchBtn = document.getElementById("searchBtn");
  const clearBtn = document.getElementById("clearBtn");
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = themeToggle.querySelector(".theme-icon");

  const errorBox = document.getElementById("errorBox");
  const loadingSkeleton = document.getElementById("loadingSkeleton");
  const resultSection = document.getElementById("resultSection");
  const emptyState = document.getElementById("emptyState");

  const resultIp = document.getElementById("resultIp");
  const resultLocation = document.getElementById("resultLocation");
  const resultIsp = document.getElementById("resultIsp");
  const resultTimezone = document.getElementById("resultTimezone");
  const resultCoords = document.getElementById("resultCoords");
  const mapsLink = document.getElementById("mapsLink");
  const mapImage = document.getElementById("mapImage");
  const mapPlaceholder = document.getElementById("mapPlaceholder");

  const copyBtn = document.getElementById("copyBtn");
  const shareBtn = document.getElementById("shareBtn");

  const historySection = document.getElementById("historySection");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  const toast = document.getElementById("toast");

  // ---------- State ----------
  let currentData = null;
  const HISTORY_KEY = "ip-tracker-history";
  const THEME_KEY = "ip-tracker-theme";
  const MAX_HISTORY = 8;

  // ---------- Init ----------
  function init() {
    loadTheme();
    renderHistory();
    // Auto-fetch visitor's own IP
    fetchIpData("");
  }

  // ---------- Theme ----------
  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    setTheme(theme);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleDarkMode() {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  }

  // ---------- API ----------
  async function fetchIpData(query) {
    showLoading();
    hideError();

    try {
      // Empty query → own IP. Otherwise use the provided IP/domain.
      const url = query
        ? `https://ipapi.co/${encodeURIComponent(query.trim())}/json/`
        : "https://ipapi.co/json/";

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }

      const data = await res.json();

      // ipapi.co returns error field on failure
      if (data.error) {
        throw new Error(data.reason || "Invalid IP or domain");
      }

      // Normalize data
      const normalized = {
        ip: data.ip || "—",
        city: data.city || "",
        region: data.region || data.region_code || "",
        country: data.country_name || data.country || "",
        countryCode: data.country_code || "",
        isp: data.org || data.asn || "—",
        timezone: data.timezone || "—",
        lat: data.latitude,
        lon: data.longitude,
        query: query || data.ip
      };

      currentData = normalized;
      displayResult(normalized);
      addToHistory(normalized);
    } catch (err) {
      console.error(err);
      showError(err.message || "Unable to fetch IP data. Please try again.");
      showEmpty();
    } finally {
      hideLoading();
    }
  }

  // ---------- UI Helpers ----------
  function showLoading() {
    loadingSkeleton.hidden = false;
    resultSection.hidden = true;
    emptyState.hidden = true;
    errorBox.hidden = true;
  }

  function hideLoading() {
    loadingSkeleton.hidden = true;
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  function hideError() {
    errorBox.hidden = true;
  }

  function showEmpty() {
    resultSection.hidden = true;
    emptyState.hidden = false;
  }

  function displayResult(data) {
    emptyState.hidden = true;
    resultSection.hidden = false;

    resultIp.textContent = data.ip;

    // Location with flag emoji if possible
    const flag = countryCodeToFlag(data.countryCode);
    const locationParts = [data.city, data.region, data.country].filter(Boolean);
    resultLocation.textContent = locationParts.length
      ? `${flag} ${locationParts.join(", ")}`
      : "—";

    resultIsp.textContent = data.isp;
    resultTimezone.textContent = data.timezone;

    if (data.lat != null && data.lon != null) {
      resultCoords.textContent = `${Number(data.lat).toFixed(4)}, ${Number(data.lon).toFixed(4)}`;
      mapsLink.href = `https://www.google.com/maps?q=${data.lat},${data.lon}`;
      mapsLink.hidden = false;
      updateMap(data.lat, data.lon);
    } else {
      resultCoords.textContent = "—";
      mapsLink.hidden = true;
      mapImage.hidden = true;
      mapPlaceholder.hidden = false;
    }
  }

  function updateMap(lat, lon) {
    // Static map via OpenStreetMap (no API key needed)
    // Using a simple static image service pattern
    const zoom = 10;
    const width = 640;
    const height = 280;

    // OpenStreetMap static alternative via openstreetmap.org export style
    // For reliability we use a free static map endpoint pattern
    const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lon},red-pushpin`;

    mapImage.src = mapUrl;
    mapImage.onload = () => {
      mapImage.hidden = false;
      mapPlaceholder.hidden = true;
    };
    mapImage.onerror = () => {
      // Fallback: just hide image and show placeholder
      mapImage.hidden = true;
      mapPlaceholder.hidden = false;
      mapPlaceholder.innerHTML = `<span>📍 ${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}</span>`;
    };
  }

  function countryCodeToFlag(code) {
    if (!code || code.length !== 2) return "🌐";
    const offset = 127397;
    return String.fromCodePoint(
      ...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset)
    );
  }

  // ---------- History (localStorage) ----------
  function getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Could not save history", e);
    }
  }

  function addToHistory(data) {
    let list = getHistory();
    // Remove existing same IP
    list = list.filter(item => item.ip !== data.ip);
    // Add to front
    list.unshift({
      ip: data.ip,
      city: data.city,
      country: data.country,
      countryCode: data.countryCode,
      time: new Date().toISOString()
    });
    // Limit
    if (list.length > MAX_HISTORY) list = list.slice(0, MAX_HISTORY);
    saveHistory(list);
    renderHistory();
  }

  function removeFromHistory(ip) {
    let list = getHistory().filter(item => item.ip !== ip);
    saveHistory(list);
    renderHistory();
  }

  function clearHistory() {
    saveHistory([]);
    renderHistory();
  }

  function renderHistory() {
    const list = getHistory();
    if (list.length === 0) {
      historySection.hidden = true;
      return;
    }

    historySection.hidden = false;
    historyList.innerHTML = list
      .map(item => {
        const flag = countryCodeToFlag(item.countryCode);
        const place = [item.city, item.country].filter(Boolean).join(", ") || "Unknown";
        const time = formatRelativeTime(item.time);
        return `
          <li class="history-item">
            <div class="history-info">
              <span class="history-ip">${escapeHtml(item.ip)}</span>
              <span class="history-meta">${flag} ${escapeHtml(place)} · ${time}</span>
            </div>
            <div class="history-actions">
              <button class="btn btn-sm btn-secondary" data-action="research" data-ip="${escapeHtml(item.ip)}" title="Search again">↺</button>
              <button class="btn btn-sm btn-secondary" data-action="remove" data-ip="${escapeHtml(item.ip)}" title="Remove">✕</button>
            </div>
          </li>
        `;
      })
      .join("");
  }

  function formatRelativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- User Actions ----------
  function handleSearch(e) {
    e.preventDefault();
    const value = input.value.trim();
    fetchIpData(value);
  }

  function handleClear() {
    input.value = "";
    input.focus();
    // Optionally re-fetch own IP
    fetchIpData("");
  }

  async function copyToClipboard() {
    if (!currentData?.ip) return;
    try {
      await navigator.clipboard.writeText(currentData.ip);
      showToast("IP copied to clipboard");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = currentData.ip;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("IP copied");
    }
  }

  async function shareResult() {
    if (!currentData) return;
    const text = `IP: ${currentData.ip}\nLocation: ${[currentData.city, currentData.country].filter(Boolean).join(", ")}\nISP: ${currentData.isp}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "IP Address Info",
          text
        });
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Result copied to clipboard");
      } catch {
        showToast("Sharing not supported");
      }
    }
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    // force reflow
    toast.offsetHeight;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => (toast.hidden = true), 250);
    }, 2200);
  }

  // ---------- Event Listeners ----------
  form.addEventListener("submit", handleSearch);
  clearBtn.addEventListener("click", handleClear);
  themeToggle.addEventListener("click", toggleDarkMode);
  copyBtn.addEventListener("click", copyToClipboard);
  shareBtn.addEventListener("click", shareResult);
  clearHistoryBtn.addEventListener("click", clearHistory);

  historyList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const ip = btn.dataset.ip;
    if (btn.dataset.action === "research") {
      input.value = ip;
      fetchIpData(ip);
    } else if (btn.dataset.action === "remove") {
      removeFromHistory(ip);
    }
  });

  // Keyboard: Esc clears input
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      input.blur();
    }
  });

  // ---------- Start ----------
  document.addEventListener("DOMContentLoaded", init);
})();
