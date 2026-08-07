import AppRoutes from "./routes/AppRoutes.jsx";
import FirstLoadLoader from "./components/common/FirstLoadLoader.jsx";
import MotionSystem from "./components/common/MotionSystem.jsx";
import ScrollToTop from "./components/common/ScrollToTop.jsx";

export default function App() {
  return (
    <>
      <FirstLoadLoader />
      <MotionSystem />
      <ScrollToTop />
      <AppRoutes />
    </>
  );
}
