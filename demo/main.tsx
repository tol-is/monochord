import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/styles.css";
import "./demo.css";
import { App } from "./App";

createRoot(document.getElementById("app")!).render(<StrictMode><App /></StrictMode>);
