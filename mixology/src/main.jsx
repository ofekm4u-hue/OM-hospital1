import React from "react";
import { createRoot } from "react-dom/client";
import MixologyHub from "./MixologyHub.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MixologyHub />
  </React.StrictMode>
);
