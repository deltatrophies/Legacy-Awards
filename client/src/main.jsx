import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { legacyApi } from "./services/apiClient.js";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./styles/global/base.css";

window.LegacyAPI = legacyApi;

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
