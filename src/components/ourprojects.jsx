import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "../i18n/hooks/useTranslation";
import { getProjects } from "../store/slices/projectsSlice";
import alRabwaLogo from "../assets/logos/Al Rabwa.png";
import alnorWAlbrkhLogo from "../assets/logos/Alnor w Albrkh.png";
import alrehabLogo from "../assets/logos/Alrehab.png";
import americanaLogo from "../assets/logos/Americana.png";
import armedForcesLogo from "../assets/logos/Armed Forces Engineering Authority.png";
import cleopatraLogo from "../assets/logos/Cleopatra.png";
import continentalLogo from "../assets/logos/Continental.png";
import diarQataryLogo from "../assets/logos/Diar Qatary.png";
import dmcLogo from "../assets/logos/DMC.png";
import eldohaaLogo from "../assets/logos/Eldohaa.png";
import elleheimyLogo from "../assets/logos/Elleheimy.png";
import hiltonLogo from "../assets/logos/HiltonHotels.png";
import kempinskiLogo from "../assets/logos/Kempinski.png";
import kenanaLogo from "../assets/logos/Kenana.png";
import madinatySportingClubLogo from "../assets/logos/Madinaty Sporting Club.png";
import madinatyLogo from "../assets/logos/Madinaty.png";
import mallTantaLogo from "../assets/logos/Mall Tanta.png";
import marakezLogo from "../assets/logos/Marakez.png";
import marriottLogo from "../assets/logos/Marriott.svg.png";
import mountainViewLogo from "../assets/logos/Mountain View.png";
import movenpickLogo from "../assets/logos/Movenpick.png";
import radissonBluLogo from "../assets/logos/Radisson Blu.png";
import renaissanceLogo from "../assets/logos/Renaissance.png";
import stRegisLogo from "../assets/logos/ST Regis.png";
import steigenbergerLogo from "../assets/logos/Steigenberger.png";
import tmgLogo from "../assets/logos/TMG.png";
import zero31Logo from "../assets/logos/ZERO31.png";
import { team } from "../data/team";
import { getEnSlug } from "../utils/slug";

const   OurProjects = () => {
  const { t, isArabic } = useTranslation();
  const dispatch = useDispatch();
  const { rawProjects, loading: apiLoading, error: apiError } = useSelector(
    (state) => state.projects
  );
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [visibleProjects, setVisibleProjects] = useState(6);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  // Fetch projects from Redux on component mount
  useEffect(() => {
    dispatch(getProjects());
  }, [dispatch]);

  // Manual scroll handlers (used by left/right buttons)
  const scrollByAmount = () => {
    const el = scrollRef.current;
    if (!el) return 400;
    return Math.max(300, Math.round(el.clientWidth * 0.7));
  };

  const scrollLeft = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: -scrollByAmount(), behavior: "smooth" });
  };

  const scrollRight = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: scrollByAmount(), behavior: "smooth" });
  };

  // Project categories/filters
  const filters = [
    { id: "all", label: t("projects:all") || "All Projects" },
    { id: "residential", label: t("projects:residential") || "Residential" },
    { id: "commercial", label: t("projects:commercial") || "Commercial" },
  ];

  // Sorting options
  const sortOptions = [
    { id: "newest", label: t("projects:newest") || "Newest First" },
    {
      id: "price_high",
      label: t("projects:priceHigh") || "Price: High to Low",
    },
    { id: "price_low", label: t("projects:priceLow") || "Price: Low to High" },
    { id: "size", label: t("projects:size") || "Largest First" },
  ];


  // Partners / portfolio logos with names
  const partners = [
    { src: alRabwaLogo, name: "Al Rabwa" },
    { src: alnorWAlbrkhLogo, name: "Alnor w Albrkh" },
    { src: alrehabLogo, name: "Alrehab" },
    { src: americanaLogo, name: "Americana" },
    { src: armedForcesLogo, name: "Armed Forces Engineering Authority" },
    { src: cleopatraLogo, name: "Cleopatra" },
    { src: continentalLogo, name: "Continental" },
    { src: diarQataryLogo, name: "Diar Qatary" },
    { src: dmcLogo, name: "DMC" },
    { src: eldohaaLogo, name: "Eldohaa" },
    { src: elleheimyLogo, name: "Elleheimy" },
    { src: hiltonLogo, name: "Hilton Hotels" },
    { src: kempinskiLogo, name: "Kempinski" },
    { src: kenanaLogo, name: "Kenana" },
    { src: madinatySportingClubLogo, name: "Madinaty Sporting Club" },
    { src: madinatyLogo, name: "Madinaty" },
    { src: mallTantaLogo, name: "Mall Tanta" },
    { src: marakezLogo, name: "Marakez" },
    { src: marriottLogo, name: "Marriott" },
    { src: mountainViewLogo, name: "Mountain View" },
    { src: movenpickLogo, name: "Movenpick" },
    { src: radissonBluLogo, name: "Radisson Blu" },
    { src: renaissanceLogo, name: "Renaissance" },
    { src: stRegisLogo, name: "ST Regis" },
    { src: steigenbergerLogo, name: "Steigenberger" },
    { src: tmgLogo, name: "TMG" },
    { src: zero31Logo, name: "ZERO31" },
  ];

  // Helper to get localized text
  const getLocalizedText = (field) => {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (typeof field === "object") {
      return isArabic ? (field.ar || field.en || "") : (field.en || field.ar || "");
    }
    return "";
  };

  

  // Robust location extractor: check common fields where location might be stored
  const getProjectLocation = (proj) => {
    if (!proj) return "";
    const candidates = [
      proj.locationDescription,
      proj.location,
      proj.address,
      proj.locationName,
      proj.city,
      proj.area,
      proj.country,
      proj.town,
      proj.region,
      proj.company?.address,
      proj.company?.location,
      proj.location?.name,
    ];
    for (const c of candidates) {
      const v = getLocalizedText(c);
      if (v) return v;
      if (typeof c === "string" && c.trim()) return c;
    }
    return "";
  };

  // map raw projects -> localized UI shape (memoized so we don't recompute unnecessarily)
  const mappedProjects = useMemo(() => {
    if (!rawProjects) return [];
    return rawProjects.map((project) => {
      // normalize categories: display strings and key identifiers (lowercase English when available)
      const displayCategories = (project.projectType || []).map((c) => {
        if (!c) return "";
        if (typeof c === "string") {
          const key = String(c).toLowerCase().trim();
          const translated = t(`projects:${key}`);
          return translated || c;
        }
        if (typeof c === "object") {
          return getLocalizedText(c.name || c) || (c.en || c.ar || "");
        }
        return "";
      }).filter(Boolean);

      const categoryKeys = (project.projectType || []).map((c) => {
        if (!c) return "";
        if (typeof c === "string") return c.toLowerCase();
        if (typeof c === "object") {
          const candidate = c.en || c.name || c.ar || "";
          return String(candidate).toLowerCase();
        }
        return "";
      }).filter(Boolean);

      // extract payment info: prefer project.payment, otherwise search units for any payment entry
      let unitPaymentRaw = null;
      if (project.payment) {
        unitPaymentRaw = Array.isArray(project.payment) ? project.payment[0] : project.payment;
      }
      if (!unitPaymentRaw && Array.isArray(project.units)) {
        for (const u of project.units) {
          if (!u) continue;
          if (u.payment) {
            unitPaymentRaw = Array.isArray(u.payment) ? (u.payment[0] || null) : u.payment;
            if (unitPaymentRaw) break;
          }
        }
      }

      // Parse deposit - handle percentage, decimal, or currency amount
      let depositPercent = null;
      if (unitPaymentRaw && unitPaymentRaw.deposit != null) {
        const depositValue = Number(unitPaymentRaw.deposit);
        if (!Number.isFinite(depositValue) || depositValue <= 0) {
          depositPercent = null;
        } else if (depositValue <= 1) {
          // decimal like 0.35 -> 35%
          depositPercent = Math.round(depositValue * 100);
        } else if (depositValue <= 100) {
          // already a percentage
          depositPercent = Math.round(depositValue);
        } else {
          // deposit looks like a currency amount (e.g., 400000). Try to compute percent from unit price if available
          const unitPriceRaw = project.units && project.units[0] && (project.units[0].price || project.units[0].pricePerMeter);
          let computedPercent = null;
          if (unitPriceRaw) {
            const unitPrice = Number(project.units[0].price) || null;
            if (unitPrice && Number.isFinite(unitPrice) && unitPrice > 0) {
              computedPercent = Math.round((depositValue / unitPrice) * 100);
            } else if (project.area && project.units[0].pricePerMeter) {
              const ppm = Number(project.units[0].pricePerMeter);
              const areaNum = Number(project.area) || null;
              if (ppm && areaNum) {
                const estUnitPrice = ppm * areaNum;
                computedPercent = Math.round((depositValue / estUnitPrice) * 100);
              }
            }
          }
          if (computedPercent && computedPercent > 0 && computedPercent <= 100) {
            depositPercent = computedPercent;
          } else {
            // fallback: if value is ridiculously large, treat as whole percent capped at 100
            depositPercent = Math.min(100, Math.round(depositValue));
          }
        }
      }

      const numberOfInstallments = unitPaymentRaw && (unitPaymentRaw.numberOfInstallments != null) ? unitPaymentRaw.numberOfInstallments : null;

      return {
        id: project._id,
        slug: project.slug || project._id,
        title: getLocalizedText(project.name),
        category: displayCategories,
        categoryKeys,
        status: project.currentPhase?.toLowerCase().includes("construction")
          ? "ongoing"
          : project.currentPhase?.toLowerCase().includes("finishing") || project.currentPhase?.toLowerCase().includes("complete")
          ? "completed"
          : "upcoming",
        type: (categoryKeys && categoryKeys[0]) || "residential",
        price: `${project.units?.[0]?.pricePerMeter ? `EGP ${parseInt(project.units[0].pricePerMeter).toLocaleString()} per m²` : "Contact for price"}`,
        priceValue: parseFloat(project.units?.[0]?.pricePerMeter) || 0,
        size: project.area ? `${project.area} m²` : "N/A",
        location: getProjectLocation(project) || "Egypt",
        image: project.mainImage || project.exteriorGallery?.[0] || "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?ixlib=rb-4.0.3&auto=format&fit=crop&w=2068&q=80",
        completion: project.deliveryDate || project.createdAt,
        units: project.availableUnits || "N/A",
        features: project.features?.map((f) => getLocalizedText(f.name)) || [],
        featured: false,
        depositPercent,
        numberOfInstallments,
      };
    });
  }, [rawProjects, isArabic, t]);

  // Filter and sort projects
  const filteredProjects = mappedProjects
    .filter((project) => {
      if (selectedFilter === "all") return true;
      // check normalized category keys or type
      return (
        (project.categoryKeys && project.categoryKeys.includes(selectedFilter)) ||
        project.type === selectedFilter
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price_high":
          return b.priceValue - a.priceValue;
        case "price_low":
          return a.priceValue - b.priceValue;
        case "size":
          return parseInt(b.size) - parseInt(a.size);
        default: // newest
          return new Date(b.completion) - new Date(a.completion);
      }
    });

  const projectsToShow = filteredProjects.slice(0, visibleProjects);
  const hasMoreProjects = visibleProjects < filteredProjects.length;

  const loadMoreProjects = () => {
    setIsLoading(true);
    setTimeout(() => {
      setVisibleProjects((prev) => prev + 6);
      setIsLoading(false);
    }, 800);
  };

  const handleFilterChange = (filterId) => {
    setSelectedFilter(filterId);
    setVisibleProjects(6); // Reset to initial count
  };

  return (
    <section className="py-20 -mt-50 md:py-32 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div
          className={`max-w-4xl mx-auto text-center mb-12 ${
            isArabic ? "rtl" : ""
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
            <span className="text-sm font-semibold text-primary-500">
              {t("projects:tagline") || "Premium Developments"}
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-light-900 dark:text-white mb-6">
            {t("projects:title") || "Our Premium Projects"}
          </h2>

          <p className="text-xl text-light-600 dark:text-light-300 leading-relaxed max-w-3xl mx-auto">
            {t("projects:subtitle") ||
              "Discover VALORA's portfolio of premium real estate developments, each crafted with exceptional quality and enduring value."}
          </p>
        </div>

        {/* Filters & Sorting */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => handleFilterChange(filter.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    selectedFilter === filter.id
                      ? "bg-primary-500 text-white shadow-lg"
                      : "bg-light-100 dark:bg-dark-800 text-light-700 dark:text-light-300 hover:bg-light-200 dark:hover:bg-dark-700"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

           
          </div>

          {/* Active Filters Info */}
          <div className="flex items-center justify-between text-sm text-light-600 dark:text-light-400">
            <div>
              {t("projects:showing") || "Showing"}{" "}
              <span className="font-semibold text-primary-500">
                {projectsToShow.length}
              </span>{" "}
              {t("projects:of") || "of"}{" "}
              <span className="font-semibold">{filteredProjects.length}</span>{" "}
              {t("projects:projects") || "projects"}
            </div>
            <div className="flex items-center gap-2">
              {selectedFilter !== "all" && (
                <button
                  onClick={() => handleFilterChange("all")}
                  className="flex items-center gap-1 text-primary-500 hover:text-primary-600"
                >
                  <span>{t("projects:clearFilters") || "Clear filters"}</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* API Loading State */}
        {apiLoading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-3">
              <svg
                className="animate-spin h-8 w-8 text-primary-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-lg font-medium text-light-700 dark:text-light-300">
                {t("projects:loadingProjects") || "Loading projects..."}
              </span>
            </div>
          </div>
        )}

        {/* API Error State */}
        {apiError && !apiLoading && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-light-900 dark:text-white mb-4">
              {t("projects:errorLoading") || "Error Loading Projects"}
            </h3>
            <p className="text-light-600 dark:text-light-400 max-w-md mx-auto mb-8">
              {apiError}
            </p>
          </div>
        )}

        {/* Projects Grid */}
        {!apiLoading && !apiError && (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-8 mb-16">
          {projectsToShow.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isArabic={isArabic}
            />
          ))}
          </div>

        {/* Load More Button */}
        {hasMoreProjects && (
          <div className="text-center">
            <button
              onClick={loadMoreProjects}
              disabled={isLoading}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {t("projects:loading") || "Loading..."}
                </>
              ) : (
                <>
                  {t("projects:loadMore") || "Load More Projects"}
                  <svg
                    className={`w-5 h-5 transform transition-transform ${
                      isArabic ? "rtl:rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}

        {/* Empty State */}
        {projectsToShow.length === 0 && !apiLoading && !apiError && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-light-100 dark:bg-dark-800 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-light-400 dark:text-dark-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-light-900 dark:text-white mb-4">
              {t("projects:noProjects") || "No Projects Found"}
            </h3>
            <p className="text-light-600 dark:text-light-400 max-w-md mx-auto mb-8">
              {t("projects:noProjectsDesc") ||
                "Try adjusting your filters to find what you're looking for."}
            </p>
            <button
              onClick={() => handleFilterChange("all")}
              className="btn-primary"
            >
              {t("projects:viewAllProjects") || "View All Projects"}
            </button>
          </div>
        )}
          </>
        )}

        {/* Partners / Our Portfolio (Arabic title) */}
        <div className="mt-16">
          <h3 className="text-3xl font-bold text-center mb-6">
            {isArabic ? "شركاء نجاحنا" : "Our Portfolio"}
          </h3>

            <div className="max-w-6xl mx-auto relative">
            <button
              onClick={scrollLeft}
              aria-label="Scroll left"
              className="absolute -left-20 top-1/2 transform -translate-y-1/2 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-white hover:scale-110 transition-transform shadow-2xl flex items-center justify-center ring-1 ring-primary-600/30 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={scrollRight}
              aria-label="Scroll right"
              className="absolute -right-20 top-1/2 transform -translate-y-1/2 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-white hover:scale-110 transition-transform shadow-2xl flex items-center justify-center ring-1 ring-primary-600/30 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div
              ref={scrollRef}
              className="overflow-x-auto scrollbar-hide pl-16 pr-16"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <div className="flex gap-6 pb-4 min-w-max items-center">
                {partners.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-center p-4 bg-white/50 dark:bg-dark-700 rounded-lg w-56 h-36 flex-shrink-0"
                  >
                    <img
                      src={p.src}
                      alt={p.name}
                      className="h-24 object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Our Team */}
        {/* <div className="mt-12">
          <h3 className="text-3xl font-bold text-center mb-6">
            {isArabic ? "فريقنا" : "Our Team"}
          </h3>

          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap justify-center gap-6">
              {team.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col items-center text-center p-4 bg-white/50 dark:bg-dark-700 rounded-lg w-64"
                >
                  <img
                    src={m.photo}
                    alt={m.name}
                    className="w-32 h-32 object-cover rounded-full mb-3"
                  />
                  <h4 className="font-semibold text-light-900 dark:text-white">
                    {m.name}
                  </h4>
                  <p className="text-sm text-light-700 dark:text-light-300">
                    {m.position}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div> */}
      </div>
    </section>
  );
};

// Project Card Component
const ProjectCard = ({ project, isArabic }) => {
  const { t } = useTranslation();
  // Use project ID as the primary slug to ensure uniqueness across all projects
  const linkSlug = project.id;
  const hasPaymentBadges =
    project.depositPercent != null || project.numberOfInstallments != null;
  return (
    <Link to={`/projects/${linkSlug}`} className="block">
      <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-dark-800 shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
        {/* Status Badge */}
        <div className="absolute top-4 left-4 z-20">
          <span
            className={`px-4 py-2 rounded-full text-xs font-semibold shadow-sm ${
              project.status === "completed"
                ? "bg-secondary-50 text-primary-500"
                : project.status === "ongoing"
                ? "bg-secondary-50 text-primary-500"
                : "bg-secondary-50 text-primary-500"
            }`}
          >
            {project.status === "completed"
              ? t("projects:completed") || "Completed"
              : project.status === "ongoing"
              ? t("projects:ongoing") || (isArabic ? "تحت الإنشاء" : "Under Construction")
              : t("projects:upcoming") || "Upcoming"}
          </span>
        </div>

        {/* Featured Badge */}
        {project.featured && (
          <div className="absolute top-4 right-4 z-10">
            <span className="px-3 py-1 rounded-full bg-primary-500/20 text-primary-500 text-xs font-semibold">
              Featured
            </span>
          </div>
        )}

        {/* Image */}
        <div className="h-64 overflow-hidden relative">
          <img
            src={project.image}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 z-25 "
            loading="lazy"
          />
          <div className="absolute inset-0 bg-linear-to-t from-dark-900/60 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="p-6 relative project-content">
          {/* Payment Badges */}
          {hasPaymentBadges && (
            <div className={`badges-container  ${isArabic ? "badges--rtl" : "badges--ltr badges--en"}`}>
              {/* Arabic badges */}
              {isArabic && project.depositPercent != null && (
                <div className="badge badge--ar badge--md badge--deposit">
                  <div className="badge__label">مقــدم</div>
                  <div className="badge__value">{project.depositPercent}%</div>
                </div>
              )}

              {isArabic && project.numberOfInstallments != null && (
                <div className="badge badge--ar badge--md badge--installments">
                  <div className="badge__label">تقسيط</div>
                  <div className="badge__label">حتــــــــي</div>
                  <div className="badge__sub">{project.numberOfInstallments} شهر</div>
                </div>
              )}

              {/* English badges (independent classes) */}
              {!isArabic && project.numberOfInstallments != null && (
                <div className="badge badge--en badge--md badge--installments">
                  <div className="badge__label--up">UP TO</div>
                  <div className="badge__value--en">{project.numberOfInstallments}</div>
                  <div className="badge__sub--en">Month</div>
                </div>
              )}
              {!isArabic && project.depositPercent != null && (
                <div className="badge badge--en badge--md badge--deposit">
                  <div className="badge__label--down">DOWN</div>
                  <div className="badge__label--payment">Payment</div>
                  <div className="badge__value--en">{project.depositPercent}%</div>
                </div>
              )}

            </div>
          )}
          
{/* Category Tags */}
          <div className="flex flex-wrap gap-2 mb-3 project-tags">
            {project.category.map((cat, index) => (
              <span
                key={index}
                className={`project-tag bg-light-100 dark:bg-dark-700 text-light-600 dark:text-light-400`}
              >
                {cat}
              </span>
            ))}
          </div>
          {/* Title & Location */}
          <h3 className="text-xl font-bold text-primary-500 dark:text-white mb-2 group-hover:text-primary-500 transition-colors project-title">
            {project.title}
          </h3>

          <div
            className={`flex items-center gap-2 text-light-600 dark:text-light-400 mb-4 project-location ${
              hasPaymentBadges
                ? isArabic
                  ? "project-location--with-badges-rtl"
                  : "project-location--with-badges-ltr"
                : ""
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-sm">{project.location}</span>
          </div>

          {/* Description */}
          <p className="text-light-700 dark:text-light-300 text-sm mb-6 line-clamp-2">
            {project.description}
          </p>
        </div>
      </div>
    </Link>
  );
};

export default OurProjects;
