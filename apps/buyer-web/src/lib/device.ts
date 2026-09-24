"use client";

/**
 * Stable per-browser hardware identifier used as the billing `hardwareId`
 * when starting a paid session from the web app. Generated once and kept in
 * localStorage so a browser is charged against a consistent identity.
 */
export function getBrowserDeviceId(): string {
  if (typeof window === "undefined") return "web-server-session";
  let id = window.localStorage.getItem("dravio_device_id");
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem("dravio_device_id", id);
  }
  return id;
}