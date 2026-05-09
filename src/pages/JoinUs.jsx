import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/hooks/useTranslation';
import { getJobPositions } from '../store/slices/jobPositionsSlice';
import { getFullUrl, getDefaultOgImage, SITE_NAME } from '../utils/ogMeta';
import Footer from '../components/footer';

const JoinUs = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t, isArabic, mapEmploymentType, mapWorkArrangement } = useTranslation();
  const { positions, loading, error } = useSelector((state) => state.jobPositions);

  // Helper to get localized text
  const extractStringFromRich = (val) => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.map(extractStringFromRich).join(' ');
    if (typeof val === 'object') {
      if (typeof val.text === 'string') return val.text;
      if (val.ops && Array.isArray(val.ops)) return val.ops.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('');
      if (val.blocks && Array.isArray(val.blocks)) return val.blocks.map((b) => extractStringFromRich(b.text || b.data || b)).join('\n');
      if (typeof val.html === 'string') return val.html.replace(/<[^>]+>/g, '');
      return '';
    }
    return String(val);
  };

  const getLocalizedText = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object') {
      const localized = isArabic ? (field.ar || field.en || '') : (field.en || field.ar || '');
      return extractStringFromRich(localized);
    }
    return '';
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Handle job card click - navigate to application form
  const handleApplyClick = (position) => {
    navigate(`/join-us/${position.slug || position._id}`);
  };

  const pageUrl = getFullUrl('/join-us');
  const ogImage = getDefaultOgImage();
  
  return (
    <>
      <section style={{ fontFamily: "'Cairo', sans-serif" }} className="py-20 md:py-32 relative overflow-hidden min-h-screen">
      <Helmet>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap"
        />
        <title>Join Us - VALORA</title>
        <meta name="description" content="Explore career opportunities at VALORA. Join our team and help shape the future of real estate in Egypt." />
        
        {/* Open Graph / Facebook / WhatsApp */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content="Join Us - VALORA" />
        <meta property="og:description" content="Explore career opportunities at VALORA and join our growing team." />
        {ogImage && (
          <>
            <meta property="og:image" content={ogImage} />
            <meta property="og:image:url" content={ogImage} />
            <meta property="og:image:secure_url" content={ogImage} />
            <meta property="og:image:type" content="image/png" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content="Careers at VALORA - Join Our Team" />
          </>
        )}
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Join Us - VALORA" />
        <meta name="twitter:description" content="Explore career opportunities at VALORA and join our growing team." />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className={`max-w-4xl mx-auto text-center mb-16 ${isArabic ? 'rtl' : ''}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
            <span className="text-sm font-semibold text-primary-500">
              {t('joinUs:tagline') || 'Career Opportunities'}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-light-900 dark:text-white mb-6">
            {t('joinUs:title') || 'Join the VALORA Team'}
          </h1>

          <p className="text-xl text-light-600 dark:text-light-300 leading-relaxed max-w-3xl mx-auto">
            {t('joinUs:subtitle') ||
              'Explore exciting career opportunities and become part of our growing team. We are looking for talented individuals to help shape the future of real estate.'}
          </p>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/join-us/check-application')}
              className="btn-outline inline-flex items-center gap-2"
            >
              <span>{t('joinUs:checkApplicationStatus') || 'Check Application Status'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
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
                {t('joinUs:loading') || 'Loading job positions...'}
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
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
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-light-900 dark:text-white mb-4">
              {t('joinUs:noPositions') || 'No available jobs'}
            </h3>
            <p className="text-light-600 dark:text-light-400 max-w-md mx-auto">
              {t('joinUs:noPositionsDesc') ||
                'There are no available jobs at the moment. Please check back later for new opportunities.'}
            </p>
          </div>
        )}

        {/* Job Positions Grid */}
        {!loading && !error && positions.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {positions
              .map((position) => (
                <div
                  key={position._id}
                  className="glass rounded-2xl p-6 hover:transform hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                  onClick={() => handleApplyClick(position)}
                >
                  {/* Job Code Badge */}
                  <div className="flex items-center justify-between mb-4">
                    
                    {position.salaryVisible && position.salary > 0 && (
                      <span className="text-success-500 font-semibold text-sm">
                        {position.salary.toLocaleString()} {t('joinUs:egp') || 'EGP'}
                      </span>
                    )}
                  </div>

                  {/* Job Title */}
                  <h3 className="text-xl font-bold text-light-900 dark:text-white mb-3 group-hover:text-primary-500 transition-colors">
                    {getLocalizedText(position.title)}
                  </h3>

                  {/* Job Description */}
                  <p className="text-light-700 dark:text-light-300 text-sm mb-4 line-clamp-3">
                    {getLocalizedText(position.description)}
                  </p>

                  {/* Job Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-light-600 dark:text-light-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                        <span className="flex items-center gap-2">
                          <span>{mapEmploymentType(position.employmentType) || (isArabic ? 'دوام كامل' : 'Full-time')}</span>
                          {position.workArrangement && (
                            <span className="px-2 py-0.5 rounded-full bg-light-50 dark:bg-dark-800 text-xs font-medium text-light-700 dark:text-light-300">
                              {mapWorkArrangement(position.workArrangement)}
                            </span>
                          )}
                        </span>
                    </div>

                    {position.departmentId?.name && (
                      <div className="flex items-center gap-2 text-sm text-light-600 dark:text-light-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          <span>{getLocalizedText(position.departmentId?.name)}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-light-600 dark:text-light-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                      <span>
                        {position.openPositions} {t('joinUs:openings') || 'openings'}
                      </span>
                    </div>

                    {position.registrationEnd && (
                      <div className="flex items-center gap-2 text-sm text-red-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>
                          {t('joinUs:deadline') || 'Apply before'}: {formatDate(position.registrationEnd)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Apply Button */}
                  <button className="w-full btn-primary flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
                    <span>{t('joinUs:applyNow') || 'Apply Now'}</span>
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
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && positions.length === 0 && (
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
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-light-900 dark:text-white mb-4">
              {t('joinUs:noPositions') || 'No Open Positions'}
            </h3>
            <p className="text-light-600 dark:text-light-400 max-w-md mx-auto">
              {t('joinUs:noPositionsDesc') ||
                'There are no open positions at the moment. Please check back later for new opportunities.'}
            </p>
          </div>
        )}
      </div>
      </section>
      <Footer />
    </>
  );
};

export default JoinUs;
