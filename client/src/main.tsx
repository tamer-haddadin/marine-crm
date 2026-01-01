import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply saved theme on app load
const savedTheme = localStorage.getItem("theme") || "system";
const root = window.document.documentElement;

if (savedTheme === "system") {
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  root.classList.toggle("dark", systemTheme === "dark");
} else {
  root.classList.toggle("dark", savedTheme === "dark");
}

createRoot(document.getElementById("root")!).render(<App />);
