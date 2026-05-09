import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { HelmetProvider } from "react-helmet-async";
import i18n from "./i18n";
import MainLayout from "./layouts/MainLayout";
// import ComingSoon from "./pages/ComingSoon"; // temporarily disabled
import Home from "./pages/Home";
import About from "./pages/About";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Unit from "./pages/Unit";
import Contact from "./pages/Contact";
import JoinUs from "./pages/JoinUs";
import JobApplicationForm from "./pages/JobApplicationForm";
import CheckPreviousApplication from "./pages/checkjob";
import NotFound from "./pages/NotFound";

import "./index.css";

function App() {
  return (
    <HelmetProvider>
      <I18nextProvider i18n={i18n}>
        <Router>
          <Routes>
            {/* Coming Soon temporarily disabled. Restore when ready. */}
            <Route element={<MainLayout />}>
              <Route index element={<Home />} />
              <Route path="home" element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:slug" element={<ProjectDetail />} />
              <Route path="unit/:unitId" element={<Unit />} />
              <Route path="contact" element={<Contact />} />
              <Route path="join-us" element={<JoinUs />} />
              <Route path="join-us/check-application" element={<CheckPreviousApplication />} />
              <Route path="join-us/:slug" element={<JobApplicationForm />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Router>
      </I18nextProvider>
    </HelmetProvider>
  );
}

export default App;
