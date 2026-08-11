import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LangProvider } from "./i18n";
import "./index.css";

const wurzel = document.getElementById("root");
if (!wurzel) throw new Error("Element #root fehlt in index.html");

createRoot(wurzel).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
);
