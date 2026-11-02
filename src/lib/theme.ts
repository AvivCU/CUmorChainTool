export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

// Runs in <head> before first paint so the page never flashes the wrong
// theme. Also keeps "System" in sync if the OS switches while open.
export const THEME_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var m=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){var p=localStorage.getItem(k)||"system";var d=p==="dark"||(p==="system"&&m.matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")};a();m.addEventListener("change",a)}catch(e){}})()`;
