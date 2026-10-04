import React from "react";
import {createRoot} from "react-dom/client";
import App from "./App.jsx";
import PhoneController from "./PhoneController.jsx";
import "./styles.css";
import "./phone.css";

const Page=(window.location.pathname==="/flight-control"||window.location.pathname==="/phone")?PhoneController:App;
createRoot(document.getElementById("root")).render(<React.StrictMode><Page/></React.StrictMode>);