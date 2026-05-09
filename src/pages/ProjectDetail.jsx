import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import axios from "axios";
import Swal from "sweetalert2";
import { addLead } from "../api";
import { useTranslation } from "../i18n/hooks/useTranslation";
import { getProjects } from "../store/slices/projectsSlice";
import Footer from "../components/footer";
import { getAbsoluteImageUrl, getFullUrl, SITE_NAME } from "../utils/ogMeta";
import { getEnSlug, slugify } from "../utils/slug";

const ProjectDetail = () => {
  const { slug } = useParams();
  const { t, isArabic } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { rawProjects, loading: apiLoading, error: fetchError } = useSelector(
    (state) => state.projects
  );
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeImage, setActiveImage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  // Location data state
  const [countries, setCountries] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [allCities, setAllCities] = useState([]);
  const [cities, setCities] = useState([]);
  
  // Contact form state for Interested section
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    country: "",
    government: "",
    city: "",
    phone: "",
    subject: "",
    projectInterest: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-light-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-light-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow shadow-sm";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Handle cascading location dropdowns
    if (name === "country") {
      fetchGovernorates(value);
    } else if (name === "government") {
      // Filter cities based on selected government
      const filteredCities = allCities.filter((city) => {
        // Handle different possible property names from API
        return city.government === value || 
               city.governmentId === value || 
               city.governorate === value || 
               city.government?._id === value;
      });
      setCities(filteredCities);
      setFormData((prev) => ({ ...prev, city: "" }));
    }
    
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim())
      newErrors.name = t("contact:nameRequired") || "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = t("contact:emailRequired") || "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("contact:emailInvalid") || "Invalid email address";
    }
    if (!formData.country || !formData.country.trim())
      newErrors.country = t("contact:countryRequired") || "Country is required";
    if (!formData.phone.trim())
      newErrors.phone = t("contact:phoneRequired") || "Phone is required";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      console.debug('Form validation errors:', validationErrors);
      
      // Get the first error and scroll to it
      const firstErrorKey = Object.keys(validationErrors)[0];
      const firstErrorMessage = validationErrors[firstErrorKey];
      
      // Scroll to the error field
      const errorElement = document.querySelector(`[name="${firstErrorKey}"]`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          errorElement.focus();
        }, 300);
      }
      
      // Show alert after scroll
      setTimeout(async () => {
        await Swal.fire({
          icon: 'warning',
          title: t('contact:validationError') || 'Validation Error',
          text: firstErrorMessage,
          confirmButtonText: t('common:ok') || 'OK',
          confirmButtonColor: '#f59e0b',
        });
      }, 300);
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email || "",
        phone: formData.phone,
        otherPhones: [],
        status: "Pending",
        addresses: [
          {
            area: "",
            landmark: "",
            street: "",
            deleted: false,
          },
        ],
        country: formData.country || "",
        // Only include government/city when provided to avoid validation errors
        ...(formData.government ? { government: formData.government } : {}),
        ...(formData.city ? { city: formData.city } : {}),
        subCategories: (project && project.subCategories && project.subCategories.length > 0)
          ? project.subCategories
          : [],
        campaigns: [],
        channels: [],
        projects: [project.id],
        files: [],
        prevOrders: [],
        sales: [],
        // Only include message when the user provided content
        ...(formData.message && formData.message.trim() ? { message: { message: formData.message.trim() } } : {}),
        company: import.meta.env.VITE_CRM_COMPANY_ID,
        branch: import.meta.env.VITE_CRM_BRANCH_ID,
        deleted: false,
        isWhatsapp: false,
      };

      await addLead(payload);

      await Swal.fire({
        icon: 'success',
        title: t('contact:successTitle') || 'Message Sent Successfully!',
        text: t('contact:successMessage') || "Thank you for your interest. We'll get back to you within 24 hours.",
        confirmButtonText: t('common:ok') || 'OK',
        confirmButtonColor: '#10b981',
      });

      setSubmitSuccess(true);
      // Reset form but keep Egypt as default country
      const egypt = countries.find((c) => c.name?.toLowerCase() === "egypt" || c.name?.toLowerCase() === "مصر");
      setFormData({
        name: "",
        email: "",
        country: egypt?._id || "",
        government: "",
        city: "",
        phone: "",
        subject: "",
        projectInterest: "",
        message: "",
      });
      if (egypt) {
        fetchGovernorates(egypt._id);
      }
      // ensure the success message is visible (scroll the form container into view)
      setTimeout(() => {
        try {
          formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (e) {
          // ignore
        }
      }, 100);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.debug("Lead submit error:", err);
      console.debug("Error response:", err?.response?.data);
      const errorMessage = err?.response?.data?.message || t("contact:submitError") || "An error occurred. Please try again.";
      setErrors({ submit: errorMessage });
      await Swal.fire({
        icon: 'error',
        title: t('contact:error') || 'Error',
        text: errorMessage,
        confirmButtonText: t('common:ok') || 'OK',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch countries and cities on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_LOCATION_API_URL}/country/public`, {
          params: {
            deleted: false,
            PageCount: 1000,
            page: 1,
          },
        });

        const countriesData = res.data.data || [];
        setCountries(countriesData);

        // Set default country to Egypt
        const egypt = countriesData.find((c) => c.name?.toLowerCase() === "egypt" || c.name?.toLowerCase() === "مصر");
        if (egypt) {
          setFormData((prev) => ({ ...prev, country: egypt._id }));
          // Fetch governorates for Egypt
          fetchGovernorates(egypt._id);
        }
      } catch (err) {
        console.error("Failed to fetch countries:", err);
      }
    };

    const fetchAllCities = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_LOCATION_API_URL}/city/public`, {
          params: {
            deleted: false,
            PageCount: 1000,
            page: 1,
          },
        });

        setAllCities(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch cities:", err);
      }
    };

    fetchCountries();
    fetchAllCities();
  }, []);

  // Fetch governorates when country changes
  const fetchGovernorates = async (countryId) => {
    if (!countryId) {
      setGovernorates([]);
      setCities([]);
      setFormData((prev) => ({ ...prev, government: "", city: "" }));
      return;
    }

    try {
      const res = await axios.get(`${import.meta.env.VITE_LOCATION_API_URL}/government/public`, {
        params: {
          deleted: false,
          PageCount: 1000,
          page: 1,
          country: countryId,
        },
      });

      setGovernorates(res.data.data || []);
      setFormData((prev) => ({ ...prev, government: "", city: "" }));
    } catch (err) {
      console.error("Failed to fetch governorates:", err);
      setGovernorates([]);
    }
  };

  // Helper to get localized text
  const getLocalizedText = (field) => {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (typeof field === "object") {
      return isArabic ? (field.ar || field.en || "") : (field.en || field.ar || "");
    }
    return "";
  };

  const getTypeLabel = (type) => {
    if (!type) return "";
    if (typeof type === "string") {
      const key = String(type).toLowerCase();
      const translated = t(`projects:${key}`);
      return translated || type;
    }
    if (typeof type === "object") {
      return getLocalizedText(type.name || type) || (type.en || type.ar || "");
    }
    return String(type);
  };

  // Robust location extractor mirroring OurProjects
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

  

  // Tabs for project details
  const tabs = [
    { id: "overview", label: t("projectDetail:overview") || "Overview" },
    { id: "units", label: t("projectDetail:units") || "وحدات" },
    { id: "amenities", label: t("projectDetail:amenities") || "Amenities" },
    {
      id: "specifications",
      label: t("projectDetail:specifications") || "Specifications",
    },
    { id: "location", label: t("projectDetail:location") || "Location" },
    // { id: "payment", label: t("projectDetail:payment") || "Payment Plans" },
    { id: "gallery", label: t("projectDetail:gallery") || "Gallery" },
  ];

  useEffect(() => {
    // Dispatch Redux action to fetch projects (Redux will handle caching)
    dispatch(getProjects());
  }, [dispatch]);

  useEffect(() => {
    // Find the project from Redux state
    if (apiLoading) {
      setIsLoading(true);
      return;
    }

    if (rawProjects && rawProjects.length > 0) {
      try {
        const routeSlug = String(decodeURIComponent(slug || "")).toLowerCase();
        const routeSlugRaw = String(slug || "");

        const foundProject = rawProjects.find((p) => {
          const id = String(p._id || "");
          const idLower = id.toLowerCase();
          const rawSlug = String(p.slug || "").toLowerCase();
          const decodedSlug = String(decodeURIComponent(p.slug || "")).toLowerCase();
          const enSlug = String(getEnSlug(p) || "").toLowerCase();
          const nameSlug = String(slugify(getLocalizedText(p.name) || p.name?.en || p.title || "")).toLowerCase();

          // Priority: ID match first (exact and case-insensitive), then slug matches, then name matches
          return (
            id === routeSlugRaw ||
            idLower === routeSlug ||
            rawSlug === routeSlug ||
            decodedSlug === routeSlug ||
            enSlug === routeSlug ||
            nameSlug === routeSlug ||
            rawSlug === routeSlugRaw ||
            enSlug === routeSlugRaw
          );
        });

        if (foundProject) {
          // helpers to extract numeric area values and format
          const extractNumber = (val) => {
            if (val == null) return null;
            if (typeof val === "number") return val;
            if (typeof val === "object") {
              const txt = getLocalizedText(val);
              const m = String(txt).match(/([0-9]+(?:[\.,][0-9]+)?)/);
              return m ? parseFloat(m[1].replace(',', '.')) : null;
            }
            const m = String(val).match(/([0-9]+(?:[\.,][0-9]+)?)/);
            return m ? parseFloat(m[1].replace(',', '.')) : null;
          };

          const formatArea = (num) => {
            if (num == null || num === "") return "N/A";
            try {
              return `${parseInt(num).toLocaleString()}`;
            } catch (e) {
              return `${num}`;
            }
          };
          // build a robust embed URL for the map
          let mapEmbedUrlVar = "https://maps.google.com?q=New%20Cairo%20Egypt&output=embed";
          try {
            const link = foundProject.locationLink;
            if (link) {
              const url = String(link);
              // If it's already an embed URL, use it directly
              if (url.includes("/embed") || url.includes("google.com/maps/embed")) {
                mapEmbedUrlVar = url;
              } else {
                // Try to extract coordinates from URLs like /@lat,lng,zoom
                const coordMatch = url.match(/@(-?[0-9]+\.?[0-9]*),(-?[0-9]+\.?[0-9]*)(?:,([0-9]+)z)?/);
                if (coordMatch) {
                  const lat = coordMatch[1];
                  const lng = coordMatch[2];
                  const zoom = coordMatch[3] || 15;
                  mapEmbedUrlVar = `https://maps.google.com?q=${lat},${lng}&z=${zoom}&output=embed`;
                } else {
                  // If URL contains a query param 'q=' or 'query=' use that
                  const qMatch = url.match(/[?&](?:q|query)=([^&]+)/i);
                  if (qMatch) {
                    mapEmbedUrlVar = `https://maps.google.com?q=${encodeURIComponent(decodeURIComponent(qMatch[1]))}&output=embed`;
                  } else {
                    // For short share links (maps.app.goo.gl) or generic links, use the readable location text if available
                    const locText = getProjectLocation(foundProject);
                    if (locText) {
                      mapEmbedUrlVar = `https://maps.google.com?q=${encodeURIComponent(locText)}&output=embed`;
                    } else {
                      // as a last resort encode the original URL into q
                      mapEmbedUrlVar = `https://maps.google.com?q=${encodeURIComponent(url)}&output=embed`;
                    }
                  }
                }
              }
            } else {
              const locText = getProjectLocation(foundProject);
              if (locText) mapEmbedUrlVar = `https://maps.google.com?q=${encodeURIComponent(locText)}&output=embed`;
            }
          } catch (e) {
            // keep default
          }

          // Prefer explicit project.area from API; fall back to unit area fields
          let areaNumber = extractNumber(foundProject.area);
          if (!areaNumber && Array.isArray(foundProject.units) && foundProject.units.length > 0) {
            for (const u of foundProject.units) {
              // Only check explicit numeric area fields on the unit (avoid parsing `layout`)
              const n = extractNumber(u.area || u.size || u.area_m2 || u.squareMeter || u.square_meters);
              if (n) {
                areaNumber = n;
                break;
              }
            }
          }

          // helper to collect images/arrays while filtering inactive items
          const collectActive = (...lists) =>
            Array.from(
              new Set(
                [].concat(...lists.map((l) => (Array.isArray(l) ? l : []))).filter(Boolean).filter((it) => {
                  if (it == null) return false;
                  if (typeof it === 'object') return it.isActive !== false;
                  return true;
                })
              )
            );

          // normalize units list for display and provide fallbacks when fields are missing
          const normalizedUnits = (foundProject.units || []).filter((u) => u == null ? false : (u.isActive !== false)).map((u) => {
            const unitAreaNum = extractNumber(u.area || u.size || u.area_m2 || u.squareMeter || u.square_meters);

            // try explicit numeric values first
            const explicitPricePerMeter = parseFloat(u.pricePerMeter || u.price || u.price_per_m || null) || null;
            const explicitUnitTotal = parseFloat(u.unitTotalPrice || u.unit_total_price || null) || null;

            // if total price provided but pricePerMeter missing, derive pricePerMeter
            let derivedPricePerMeter = null;
            if (!explicitPricePerMeter && explicitUnitTotal && unitAreaNum) {
              derivedPricePerMeter = explicitUnitTotal / unitAreaNum;
            }

            // fallback to project's first unit pricePerMeter if available
            const projectDefaultPrice = parseFloat(foundProject.units?.[0]?.pricePerMeter) || parseFloat(foundProject.units?.[0]?.price) || null;

            const pricePerMeterNum = explicitPricePerMeter || derivedPricePerMeter || projectDefaultPrice || null;

            // compute unit total price when possible
            const unitTotalPriceNum = explicitUnitTotal || (pricePerMeterNum && unitAreaNum ? pricePerMeterNum * unitAreaNum : null);

            // normalize payment object and fields (show empty until added)
            const paymentRaw = Array.isArray(u.payment) ? (u.payment[0] || null) : (u.payment || null);
            const payment = paymentRaw
              ? {
                  deposit: paymentRaw.deposit != null ? paymentRaw.deposit : null,
                  installmentAmount: paymentRaw.installmentAmount != null ? paymentRaw.installmentAmount : null,
                  numberOfInstallments: paymentRaw.numberOfInstallments != null ? paymentRaw.numberOfInstallments : null,
                }
              : { deposit: null, installmentAmount: null, numberOfInstallments: null };

            const depositDisplay = payment.deposit != null ? `${parseInt(payment.deposit).toLocaleString()}` : null;
            const installmentAmountDisplay = payment.installmentAmount != null ? `${parseInt(payment.installmentAmount).toLocaleString()}` : null;
            const numberOfInstallmentsDisplay = payment.numberOfInstallments != null ? `${payment.numberOfInstallments}` : null;

            return {
              ...u,
              areaNumber: unitAreaNum,
              // friendly area string (no unit suffix here, append in UI)
              area: unitAreaNum ? `${parseInt(unitAreaNum).toLocaleString()}` : (u.area || ""),
              layout: getLocalizedText(u.layout) || u.layout || "",
              // canonical numeric fields to use in UI
              pricePerMeterNum,
              unitTotalPriceNum,
              pricePerMeterDisplay: pricePerMeterNum ? `${parseInt(pricePerMeterNum).toLocaleString()}` : null,
              totalPriceDisplay: unitTotalPriceNum ? `${parseInt(unitTotalPriceNum).toLocaleString()}` : null,
              planViewImages: collectActive(u.planGallery, u.planViewImages, u.planView, u.currentImages),
              features: (Array.isArray(u.features) ? u.features.filter((f) => f == null ? false : (typeof f === 'object' ? f.isActive !== false : true)) : []),
              availableUnitsNormalized: u.availableUnits || foundProject.availableUnits || null,
              payment: {
                raw: paymentRaw,
                deposit: payment.deposit,
                installmentAmount: payment.installmentAmount,
                numberOfInstallments: payment.numberOfInstallments,
                depositDisplay,
                installmentAmountDisplay,
                numberOfInstallmentsDisplay,
              },
            };
          });

          // Map API data to component structure
          const mappedProject = {
            id: foundProject._id,
            slug: foundProject.slug,
            title: getLocalizedText(foundProject.name),
            subtitle: getProjectLocation(foundProject),
            category: foundProject.projectType || [],
            status: foundProject.currentPhase?.toLowerCase().includes("construction") 
              ? "ongoing" 
              : foundProject.currentPhase?.toLowerCase().includes("finishing") || foundProject.currentPhase?.toLowerCase().includes("complete")
              ? "completed"
              : "upcoming",
            type: foundProject.projectType?.[0]?.toLowerCase() || "residential",
            price: foundProject.units?.[0]?.pricePerMeter 
              ? `EGP ${parseInt(foundProject.units[0].pricePerMeter).toLocaleString()} per m²` 
              : "Contact for price",
            priceValue: parseFloat(foundProject.units?.[0]?.pricePerMeter) || 0,
            sizeNumber: areaNumber || "",
            size: formatArea(areaNumber),
            location: getProjectLocation(foundProject) || "Egypt",
            description: getLocalizedText(foundProject.locationDescription) || "",
            fullDescriptionParts: [
              `${getLocalizedText(foundProject.name)} ${t('projectDetail:locatedAt') || 'is located at'} ${getLocalizedText(foundProject.locationDescription)}`,
              foundProject.currentPhase ? `${t('projectDetail:currentPhase') || 'Current phase'}: ${getLocalizedText(foundProject.currentPhase)}` : null,
            ].filter(Boolean),
            images: [
              foundProject.mainImage,
              ...(foundProject.exteriorGallery || []),
              ...(foundProject.interiorGallery || []),
              ...(foundProject.planGallery || []),
            ].filter(Boolean),
            completion: foundProject.deliveryDate ? new Date(foundProject.deliveryDate).getFullYear() : "TBD",
            unitsNumber: foundProject.availableUnits || "N/A",
            units: `${foundProject.availableUnits || "N/A"}`,
            unitsList: normalizedUnits,
            showPrices: !!foundProject.showPrices,
            features: foundProject.features?.map(f => getLocalizedText(f.name)).filter(Boolean) || [],
            amenities: foundProject.features?.map(f => ({
              icon: "✨",
              title: getLocalizedText(f.name),
              description: getLocalizedText(f.description) || ""
            })) || [],
            specifications: [
              { label: t('projects:projectType') || "Project Type", value: (foundProject.projectType && Array.isArray(foundProject.projectType)) ? foundProject.projectType.map((pt) => {
                  if (!pt) return null;
                  if (typeof pt === 'string') {
                    const key = String(pt).toLowerCase();
                    return t(`projects:${key}`) || pt;
                  }
                  return getLocalizedText(pt.name || pt) || (pt.en || pt.ar || null);
                }).filter(Boolean).join(', ') : (foundProject.projectType || "N/A") },
              { label: "Total Area", value: foundProject.area ? `${foundProject.area} m²` : "N/A" },
              { label: "Number of Floors", value: foundProject.numberOfFloors || "N/A" },
              { label: "Available Units", value: foundProject.availableUnits || "N/A" },
              { label: "Current Phase", value: foundProject.currentPhase || "N/A" },
              { label: "Delivery Date", value: foundProject.deliveryDate ? new Date(foundProject.deliveryDate).toLocaleDateString() : "TBD" },
            ],
            paymentPlans: foundProject.units?.flatMap(unit => unit.payment || []).filter(p => p.deposit || p.numberOfInstallments) || [],
            locationFeatures: [
              getLocalizedText(foundProject.locationDescription)
            ].filter(Boolean),
            mapEmbedUrl: mapEmbedUrlVar,
            brochureUrl: "#",
            virtualTourUrl: "#",
            contactPerson: t('projects:contactPerson') || "VALORA Sales Team",
            contactPhone: foundProject.phoneNumbers?.[0] || foundProject.company?.phones?.[0] || "+2 010 2048 9251",
            contactEmail: foundProject.company?.email || "info@valora-egypt.com",
            featured: false,
            subCategories:
              (Array.isArray(foundProject.subCategories) && foundProject.subCategories.length > 0)
                ? foundProject.subCategories.map((s) => (typeof s === "string" ? s : s._id)).filter(Boolean)
                : (foundProject.subCategory
                    ? [(typeof foundProject.subCategory === "string" ? foundProject.subCategory : foundProject.subCategory._id)]
                    : []),
          };

          setProject(mappedProject);
          setFormData((prev) => ({
            ...prev,
            projectInterest: mappedProject.title,
          }));
        } else {
          setProject(null);
          setApiError("Project not found");
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Error processing project:", error);
        setApiError(error.message);
        setProject(null);
        setIsLoading(false);
      }
    } else if (!apiLoading) {
      // No projects loaded and not loading - might be an error
      setIsLoading(false);
    }
  }, [rawProjects, slug, isArabic, apiLoading]);

  // Ensure we start at top when navigating to a project
  useEffect(() => {
    try {
      // Only scroll to top when the user is scrolled down to avoid unexpected jumps
      if (typeof window !== "undefined" && (window.scrollY || window.pageYOffset) > 50) {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    } catch (e) {
      // ignore in environments without window
    }
  }, [slug]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        prevLightboxImage();
      } else if (e.key === "ArrowRight") {
        nextLightboxImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, lightboxIndex, project]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-light-700 dark:text-light-300">
            {t("projectDetail:loading") || "Loading project details..."}
          </p>
        </div>
      </div>
    );
  }

  if (!project || apiError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-light-900 dark:text-white mb-4">
            {t("projectDetail:notFound") || "Project Not Found"}
          </h2>
          {apiError && (
            <p className="text-light-600 dark:text-light-400 mb-4">{apiError}</p>
          )}
          <Link to="/projects" className="btn-primary">
            {t("projectDetail:backToProjects") || "Back to Projects"}
          </Link>
        </div>
      </div>
    );
  }

  const openLightbox = (imageSrc, index = 0) => {
    setLightboxImage(imageSrc);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxImage("");
  };

  const nextLightboxImage = () => {
    const nextIndex = (lightboxIndex + 1) % project.images.length;
    setLightboxIndex(nextIndex);
    setLightboxImage(project.images[nextIndex]);
  };

  const prevLightboxImage = () => {
    const prevIndex = (lightboxIndex - 1 + project.images.length) % project.images.length;
    setLightboxIndex(prevIndex);
    setLightboxImage(project.images[prevIndex]);
  };

  const projectImageUrl = project?.images?.[0] ? getAbsoluteImageUrl(project.images[0]) : null;
  const canonicalSlug = project
    ? getEnSlug(project)
    : decodeURIComponent(slug || "");
  const pageUrl = getFullUrl(`/projects/${canonicalSlug}`);

  return (
    <div className="min-h-screen bg-light-50 dark:bg-dark-900">
      <Helmet>
        <title>{project?.title ? `${project.title} - VALORA` : 'Project Details - VALORA'}</title>
        <meta name="description" content={project?.description || `Discover ${project?.title || 'this amazing project'} in ${project?.location || 'Egypt'}. Premium real estate by VALORA.`} />
        
        {/* Open Graph / Facebook / WhatsApp */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={project?.title ? `${project.title} - VALORA` : 'Project Details - VALORA'} />
        <meta property="og:description" content={project?.description || `Discover ${project?.title || 'this amazing project'} in ${project?.location || 'Egypt'}.`} />
        <meta property="og:url" content={pageUrl} />
        {projectImageUrl && (
          <>
            <meta property="og:image" content={projectImageUrl} />
            <meta property="og:image:url" content={projectImageUrl} />
            <meta property="og:image:secure_url" content={projectImageUrl} />
            <meta property="og:image:type" content="image/jpeg" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={`${project?.title || 'Project'} - Premium Real Estate Project by VALORA`} />
            <meta name="image" content={projectImageUrl} />
          </>
        )}
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={project?.title ? `${project.title} - VALORA` : 'Project Details - VALORA'} />
        <meta name="twitter:description" content={project?.description || `Discover ${project?.title || 'this amazing project'} in ${project?.location || 'Egypt'}.`} />
        {projectImageUrl && <meta name="twitter:image" content={projectImageUrl} />}
      </Helmet>
      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-primary-300 transition-colors z-10"
            aria-label="Close"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Previous Button */}
          <button
            onClick={(e) => { e.stopPropagation(); prevLightboxImage(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full transition-colors z-10"
            aria-label="Previous image"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <img
            src={lightboxImage}
            alt="Expanded view"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Next Button */}
          <button
            onClick={(e) => { e.stopPropagation(); nextLightboxImage(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full transition-colors z-10"
            aria-label="Next image"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          {/* Image Counter */}
          <div className="absolute bottom-4 right-4 bg-black/70 text-white px-4 py-2 rounded-full text-sm z-10">
            {lightboxIndex + 1} / {project.images.length}
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative h-[70vh] md:h-[80vh] overflow-hidden">
        {/* Main Image */}
        <div className="absolute inset-0 cursor-pointer" onClick={() => openLightbox(project.images[0], 0)}>
          <img
            src={project.images[0]}
            alt={project.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/70 to-transparent" />
        </div>

        {/* Navigation */}
        <div className="absolute top-0 left-0 right-0 z-20">
          <div className="container mx-auto px-4 md:px-6 py-6">
            <div className="flex justify-between items-center">
              <Link
                to="/projects"
                className="flex items-center gap-2 text-white hover:text-primary-300 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      isArabic
                        ? "M14 5l7 7m0 0l-7 7m7-7H3"
                        : "M10 19l-7-7m0 0l7-7m-7 7h18"
                    }
                  />
                </svg>
                <span>
                  {t("projectDetail:backToProjects") || "Back to Projects"}
                </span>
              </Link>

              {/* Status Badge */}
              <span
                className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  project.status === "completed"
                    ? "bg-success-500 text-white"
                    : project.status === "ongoing"
                    ? "bg-warning-500 text-white"
                    : "bg-info-500 text-white"
                }`}
              >
                {project.status === "completed"
                  ? t('projects:completed') || "Completed"
                  : project.status === "ongoing"
                  ? t('projects:ongoing') || "Under Construction"
                  : t('projects:upcoming') || "Upcoming"}
              </span>
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="container mx-auto px-4 md:px-6 pb-12">
            <div className="max-w-4xl">
              <div className="mb-6">
                <span className={`project-tag px-4 py-2 bg-primary-500/20 backdrop-blur-sm border border-primary-500/30 text-primary-300 text-sm font-medium`}>
                  {Array.isArray(project.category)
                    ? project.category.map((c) => getTypeLabel(c)).filter(Boolean).join(" • ")
                    : getTypeLabel(project.category)}
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                {project.title}
              </h1>

              <p className="text-xl text-light-200 mb-8 max-w-3xl">
                {project.subtitle}
              </p>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:col-span-2">
                  <div className="text-2xl font-bold text-white mb-1">
                    {project.price}
                  </div>
                  <div className="text-sm text-light-300">{t("projectDetail:startingPrice") || "Starting Price"}</div>
                </div> */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-2xl font-bold text-white mb-1">
                    {t("projectDetail:sqm", { value: project.size || project.sizeNumber || "-" })}
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-2xl font-bold text-white mb-1">
                    {t("projectDetail:delivery", { value: project.completion })}
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-2xl font-bold text-white mb-1">
                    {t("projectDetail:totalUnits", { value: project.unitsNumber || project.units || "N/A" })}
                  </div>
                  <div className="text-sm text-light-300">{t("projectDetail:units") || "Units"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative -mt-20 z-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="glass rounded-3xl overflow-hidden">
            {/* Sticky Navigation Tabs */}
            <div className="sticky top-0 z-30 bg-white dark:bg-dark-800 border-b border-light-200 dark:border-dark-700">
              <div className="flex overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-shrink-0 px-6 py-4 text-sm md:text-base font-medium transition-colors ${
                      activeTab === tab.id
                        ? "text-primary-500 border-b-2 border-primary-500"
                        : "text-light-700 dark:text-light-300 hover:text-primary-500"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6 md:p-8 lg:p-12">
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-3xl font-bold text-light-900 dark:text-white mb-6">
                      {t("projectDetail:projectOverview") || "Project Overview"}
                    </h2>
                    <div className="mb-8 space-y-4">
                      {project.fullDescriptionParts?.map((part, idx) => (
                        <p key={idx} className="text-lg text-light-700 dark:text-light-300 leading-relaxed">
                          {part}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Key Features */}
                  <div>
                    <h3 className="text-2xl font-bold text-light-900 dark:text-white mb-6">
                      {t("projectDetail:keyFeatures") || "Key Features"}
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {project.features.map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-4 rounded-xl bg-light-100 dark:bg-dark-800"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-primary-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                          <span className="text-light-900 dark:text-white">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Units Tab */}
              {activeTab === "units" && (
                <div className="space-y-8">
                  <h2 className="text-3xl font-bold text-light-900 dark:text-white mb-8">
                    {t("projectDetail:availableUnits") || "Available Units"}
                  </h2>

                  {project.unitsList && project.unitsList.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {project.unitsList.map((unit, index) => (
                        <div
                          key={unit._id || index}
                          onClick={() => navigate(`/unit/${unit._id}`, { state: { unit, projectSlug: project.slug, projectName: project.title, showPrices: project.showPrices } })}
                          className="glass rounded-2xl p-6 hover:transform hover:scale-[1.02] transition-all duration-300 cursor-pointer"
                        >
                          {/* Unit Image */}
                          {unit.planViewImages && unit.planViewImages.length > 0 && (
                            <div 
                              className="mb-4 rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={unit.planViewImages[0]}
                                alt={`Unit ${getLocalizedText(unit.layout)}`}
                                className="w-full h-48 object-cover cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); openLightbox(unit.planViewImages[0]); }}
                              />
                            </div>
                          )}

                          {/* Unit Type */}
                          <div className="mb-4">
                            <span className="px-3 py-1 rounded-full bg-primary-500/10 text-primary-500 text-xs font-semibold">
                                {getTypeLabel(unit.type)}
                              </span>
                          </div>

                          {/* Layout */}
                          <h4 className="text-lg font-bold text-light-900 dark:text-white mb-3">
                            {getLocalizedText(unit.layout)}
                          </h4>

                          {/* Unit Details */}
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-light-600 dark:text-light-400">{t("projectDetail:area") || "Area"}:</span>
                              <span className="text-sm font-semibold text-light-900 dark:text-white">
                                {unit.area} {t("projectDetail:sqm2") || "m²"}
                              </span>
                            </div>
                            {project.showPrices && (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-light-600 dark:text-light-400">{t("projectDetail:pricePerSqm") || "Price per m²"}:</span>
                                  <span className="text-sm font-semibold text-primary-500">
                                    {unit.pricePerMeterNum
                                      ? `${t("projectDetail:egp") || "EGP"} ${unit.pricePerMeterDisplay}`
                                      : unit.unitTotalPriceNum
                                      ? `${t("projectDetail:egp") || "EGP"} ${Math.round(unit.unitTotalPriceNum / (unit.areaNumber || 1)).toLocaleString()}`
                                      : (t("projectDetail:contactForPrice") || "Contact for price")}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-light-600 dark:text-light-400">{t("projectDetail:totalPrice") || "Total Price"}:</span>
                                  <span className="text-sm font-semibold text-light-900 dark:text-white">
                                    {unit.unitTotalPriceNum
                                      ? `${t("projectDetail:egp") || "EGP"} ${unit.totalPriceDisplay}`
                                      : (unit.pricePerMeterNum && unit.areaNumber)
                                      ? `${t("projectDetail:egp") || "EGP"} ${Math.round(unit.pricePerMeterNum * unit.areaNumber).toLocaleString()}`
                                      : (t("projectDetail:contactForPrice") || "Contact for price")}
                                  </span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-light-600 dark:text-light-400">{t("projectDetail:floor") || "Floor"}:</span>
                              <span className="text-sm font-semibold text-light-900 dark:text-white">
                                {unit.floor}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-light-600 dark:text-light-400">{t("projectDetail:view") || "View"}:</span>
                              <span className="text-sm font-semibold text-light-900 dark:text-white">
                                  {Array.isArray(unit.view)
                                    ? unit.view.map((v) => getLocalizedText(v) || v).filter(Boolean).join(', ')
                                    : getLocalizedText(unit.view) || unit.view || '-'}
                              </span>
                            </div>
                         
                            {(unit.payment && (unit.payment.deposit != null || unit.payment.installmentAmount != null || unit.payment.numberOfInstallments != null)) && (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-light-600 dark:text-light-400">{t("projectDetail:deposit") || "Deposit"}:</span>
                                  <span className="text-sm font-semibold text-light-900 dark:text-white">
                                    {unit.payment && unit.payment.deposit != null ? `${t("projectDetail:egp") || "EGP"} ${unit.payment.depositDisplay}` : "-"}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-light-600 dark:text-light-400">{t("projectDetail:installmentAmount") || "Installment Amount"}:</span>
                                  <span className="text-sm font-semibold text-light-900 dark:text-white">
                                    {unit.payment && unit.payment.installmentAmount != null ? `${t("projectDetail:egp") || "EGP"} ${unit.payment.installmentAmountDisplay}` : "-"}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-light-600 dark:text-light-400">{t("projectDetail:numberOfInstallments") || "Number of Installments"}:</span>
                                  <span className="text-sm font-semibold text-light-900 dark:text-white">
                                    {unit.payment && unit.payment.numberOfInstallments != null ? unit.payment.numberOfInstallmentsDisplay : "-"}
                                  </span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-light-600 dark:text-light-400">{t("projectDetail:available") || "Available"}:</span>
                              <span className="text-sm font-semibold text-success-500">
                                {unit.availableUnitsNormalized || (t("projectDetail:units") || "N/A")} {t("projectDetail:units") || "وحدات"}
                              </span>
                            </div>
                          </div>

                          {/* Unit Features */}
                          {unit.features && unit.features.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-light-200 dark:border-dark-700">
                              <p className="text-xs font-semibold text-light-700 dark:text-light-300 mb-2">
                                {t("projectDetail:features") || "Features"}:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {unit.features.map((feature, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 bg-light-100 dark:bg-dark-700 text-xs text-light-700 dark:text-light-300 rounded"
                                  >
                                    {getLocalizedText(feature.name)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-light-600 dark:text-light-400">
                        {t("projectDetail:noUnits") || "No units available at the moment."}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Amenities Tab */}
              {activeTab === "amenities" && (
                <div className="space-y-8">
                  <h2 className="text-3xl font-bold text-light-900 dark:text-white mb-8">
                    {t("projectDetail:premiumAmenities") || "Premium Amenities"}
                  </h2>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {project.amenities.map((amenity, index) => (
                      <div
                        key={index}
                        className="glass rounded-2xl p-6 text-center hover:transform hover:scale-[1.02] transition-all duration-300"
                      >
                        <div className="text-3xl mb-4">{amenity.icon}</div>
                        <h4 className="text-xl font-bold text-light-900 dark:text-white mb-2">
                          {amenity.title}
                        </h4>
                        <p className="text-light-700 dark:text-light-300">
                          {amenity.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Specifications Tab */}
              {activeTab === "specifications" && (
                <div className="space-y-8">
                  <h2 className="text-3xl font-bold text-light-900 dark:text-white mb-8">
                    {t("projectDetail:technicalSpecs") ||
                      "Technical Specifications"}
                  </h2>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      {project.specifications
                        .slice(0, Math.ceil(project.specifications.length / 2))
                        .map((spec, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center py-4 border-b border-light-200 dark:border-dark-700"
                          >
                            <span className="text-light-700 dark:text-light-300 font-medium">
                              {spec.label}
                            </span>
                            <span className="text-light-900 dark:text-white font-semibold">
                              {spec.value}
                            </span>
                          </div>
                        ))}
                    </div>
                    <div className="space-y-6">
                      {project.specifications
                        .slice(Math.ceil(project.specifications.length / 2))
                        .map((spec, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center py-4 border-b border-light-200 dark:border-dark-700"
                          >
                            <span className="text-light-700 dark:text-light-300 font-medium">
                              {spec.label}
                            </span>
                            <span className="text-light-900 dark:text-white font-semibold">
                              {spec.value}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Location Tab */}
              {activeTab === "location" && (
                <div className="space-y-8">
                  <h2 className="text-3xl font-bold text-light-900 dark:text-white mb-8">
                    {t("projectDetail:strategicLocation") ||
                      "Strategic Location"}
                  </h2>

                  <div className="grid lg:grid-cols-2 gap-8">
                    {/* Map */}
                    <div className="rounded-xl overflow-hidden border border-light-200 dark:border-dark-700">
                      <iframe
                        src={project.mapEmbedUrl}
                        width="100%"
                        height="400"
                        style={{ border: 0 }}
                        allowFullScreen=""
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title={`${project.title} Location`}
                        className="w-full h-full"
                      />
                    </div>

                    {/* Location Features */}
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-xl font-bold text-light-900 dark:text-white mb-4">
                          {t("projectDetail:keyDistances") || "Key Distances"}
                        </h4>
                        <ul className="space-y-3">
                          {project.locationFeatures.map((feature, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <svg
                                className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              <span className="text-light-700 dark:text-light-300">
                                {feature}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                     
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Plans Tab */}
              {/* {activeTab === "payment" && (
                <div className="space-y-8">
                  <h2 className="text-3xl font-bold text-light-900 dark:text-white mb-8">
                    {t("projectDetail:flexiblePayment") ||
                      "Flexible Payment Plans"}
                  </h2>

                  <div className="grid md:grid-cols-3 gap-6">
                    {project.paymentPlans.map((plan, index) => (
                      <div
                        key={index}
                        className="glass rounded-2xl p-6 text-center"
                      >
                        <div className="text-4xl font-bold text-primary-500 mb-2">
                          {plan.percentage}
                        </div>
                        <h4 className="text-xl font-bold text-light-900 dark:text-white mb-2">
                          {plan.phase}
                        </h4>
                        <p className="text-light-700 dark:text-light-300">
                          {plan.timing}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="glass rounded-2xl p-6">
                    <h4 className="text-xl font-bold text-light-900 dark:text-white mb-4">
                      {t("projectDetail:paymentTerms") || "Payment Terms"}
                    </h4>
                    <ul className="space-y-3 text-light-700 dark:text-light-300">
                      <li className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-primary-500 mt-2"></span>
                        <span>5% down payment upon reservation</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-primary-500 mt-2"></span>
                        <span>Flexible installment plans over 5 years</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-primary-500 mt-2"></span>
                        <span>Bank financing options available</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-primary-500 mt-2"></span>
                        <span>Special discounts for cash payments</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )} */}

              {/* Gallery Tab */}
              {activeTab === "gallery" && (
                <div className="space-y-8">
                  <h2 className="text-3xl font-bold text-light-900 dark:text-white mb-8">
                    {t("projectDetail:projectGallery") || "Project Gallery"}
                  </h2>

                  {/* Thumbnail Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {project.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => openLightbox(image, index)}
                        className="relative overflow-hidden rounded-xl aspect-square group cursor-pointer"
                      >
                        <img
                          src={image}
                          alt={`${project.title} - Image ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-8 glass rounded-3xl p-8 md:p-12">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-3xl font-bold text-light-900 dark:text-white mb-4">
                  {t("projectDetail:interested") ||
                    "Interested in this Project?"}
                </h3>
                <p className="text-lg text-light-700 dark:text-light-300 mb-6">
                  {t("projectDetail:contactDesc") ||
                    "Contact our sales team for more information, site visits, or personalized consultations."}
                </p>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-primary-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span className="text-light-900 dark:text-white font-medium">
                      {project.contactPerson}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-primary-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    <a
                      href={`tel:${project.contactPhone}`}
                      className="text-light-900 dark:text-white hover:text-primary-500"
                    >
                      17740
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-primary-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <a
                      href={`mailto:${project.contactEmail}`}
                      className="text-light-900 dark:text-white hover:text-primary-500"
                    >
                      sales@valora-rs.com
                    </a>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {submitSuccess ? (
                  <div className="p-6 rounded-2xl bg-success-500/10 border border-success-500/20">
                    <h4 className="text-xl font-bold text-success-500">
                      {t("contact:successTitle") ||
                        "Message Sent Successfully!"}
                    </h4>
                    <p className="text-success-600 dark:text-success-400">
                      {t("contact:successMessage") ||
                        "Thank you for contacting VALORA. We'll get back to you within 24 hours."}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        {t("contact:name") || "Full Name"} *
                      </label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={
                          inputClass +
                          (errors.name
                            ? " border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                            : "")
                        }
                        placeholder={
                          t("contact:namePlaceholder") || "Enter your full name"
                        }
                      />
                      {errors.name && (
                        <p className="mt-2 text-sm text-danger-500">
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        {t("contact:email") || "Email"} *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={
                          inputClass +
                          (errors.email
                            ? " border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                            : "")
                        }
                        placeholder={
                          t("contact:emailPlaceholder") || "Enter your email"
                        }
                      />
                      {errors.email && (
                        <p className="mt-2 text-sm text-danger-500">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        {t("contact:country") || "Country"} *
                      </label>
                      <select
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        className={
                          inputClass +
                          (errors.country
                            ? " border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                            : "")
                        }
                      >
                        <option value="">{t("contact:selectCountry") || "Select a country"}</option>
                        {countries.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {errors.country && (
                        <p className="mt-2 text-sm text-danger-500">
                          {errors.country}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        {t("contact:government") || "Governorate"} *
                      </label>
                      <select
                        name="government"
                        value={formData.government}
                        onChange={handleChange}
                        disabled={!formData.country}
                        className={
                          inputClass +
                          (errors.government
                            ? " border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                            : "") +
                          " disabled:opacity-50 disabled:cursor-not-allowed"
                        }
                      >
                        <option value="">{t("contact:selectGovernment") || "Select a governorate"}</option>
                        {governorates.map((g) => (
                          <option key={g._id} value={g._id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                      {errors.government && (
                        <p className="mt-2 text-sm text-danger-500">
                          {errors.government}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        {t("contact:city") || "City"} *
                      </label>
                      <select
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        disabled={!formData.government}
                        className={
                          inputClass +
                          (errors.city
                            ? " border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                            : "") +
                          " disabled:opacity-50 disabled:cursor-not-allowed"
                        }
                      >
                        <option value="">{t("contact:selectCity") || "Select a city"}</option>
                        {cities.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {errors.city && (
                        <p className="mt-2 text-sm text-danger-500">
                          {errors.city}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        {t("contact:phone") || "Phone Number"} *
                      </label>
                      <input
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className={
                          inputClass +
                          (errors.phone
                            ? " border-danger-500 focus:border-danger-500 focus:ring-danger-500"
                            : "")
                        }
                        placeholder={
                          t("contact:phonePlaceholder") ||
                          "Enter your phone number"
                        }
                      />
                      {errors.phone && (
                        <p className="mt-2 text-sm text-danger-500">
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    {/* <div>
                      <label className="text-sm font-medium mb-2 block">
                        {t("contact:projectInterest") || "Project of Interest"}
                      </label>
                      <input
                        name="projectInterest"
                        value={project.title}
                        readOnly
                        className={inputClass}
                      />
                    </div> */}

                    <div>
                      <label htmlFor="message" className="text-sm font-medium mb-2 block">
                        {t("contact:message") || "Message"}
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows="4"
                        placeholder={t("contact:messagePlaceholder") || "Tell us more about your inquiry..."}
                        className={inputClass}
                      />
                    </div>

                   

                    {errors.submit && (
                      <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/20">
                        <p className="text-danger-500 text-sm">
                          {errors.submit}
                        </p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full btn-primary py-3 text-lg"
                    >
                      {isSubmitting
                        ? t("contact:sending") || "Sending..."
                        : t("contact:sendMessage") || "Send Message"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProjectDetail;
