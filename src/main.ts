import { renderApp } from "./ui/App";
import "./styles.css";

function start() {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("OpenLayer root element was not found.");
  }

  renderApp(rootElement);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
