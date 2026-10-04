import React from "react";
import {createRoot} from "react-dom/client";
import App from "./App.jsx";
import PhoneController from "./PhoneController.jsx";
import "./styles.css";
import "./phone.css";

const path=window.location.pathname;
const Page=path==="/drone"?App:PhoneController;
createRoot(document.getElementById("root")).render(<React.StrictMode><Page/></React.StrictMode>);