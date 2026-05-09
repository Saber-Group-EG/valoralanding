import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Swal from 'sweetalert2';
import { checkExistingApplicant } from '../api/formsApi';
import { useTranslation } from '../i18n/hooks/useTranslation';
import { getJobPositions } from '../store/slices/jobPositionsSlice';
import { getDefaultOgImage, getFullUrl, SITE_NAME } from '../utils/ogMeta';
import Footer from '../components/footer';

type ApplicantRecord = Record<string, any>;

type AppliedDetail = {
	jobTitle: string;
	companyName: string;
	submittedDate: string;
};

const extractStringFromRich = (val: any): string => {
	if (val == null) return '';
	if (typeof val === 'string') return val;
	if (Array.isArray(val)) return val.map(extractStringFromRich).join(' ');
	if (typeof val === 'object') {
		if (typeof val.text === 'string') return val.text;
		if (val.ops && Array.isArray(val.ops)) {
			return val.ops.map((op: any) => (typeof op.insert === 'string' ? op.insert : '')).join('');
		}
		if (val.blocks && Array.isArray(val.blocks)) {
			return val.blocks.map((b: any) => extractStringFromRich(b.text || b.data || b)).join('\n');
		}
		if (typeof val.html === 'string') return val.html.replace(/<[^>]+>/g, '');
		return '';
	}
	return String(val);
};

const extractApplicantRecords = (payload: any): ApplicantRecord[] => {
	const data = payload?.data ?? payload;

	if (Array.isArray(data)) return data;
	if (Array.isArray(data?.applicants)) return data.applicants;
	if (Array.isArray(data?.items)) return data.items;

	if (data && typeof data === 'object' && (data._id || data.id)) {
		return [data];
	}

	return [];
};

const hasAppliedBefore = (payload: any): boolean => {
	const data = payload?.data ?? payload;

	if (typeof payload?.exists === 'boolean') return payload.exists;
	if (typeof data?.exists === 'boolean') return data.exists;
	if (typeof data?.appliedBefore === 'boolean') return data.appliedBefore;
	if (typeof data?.found === 'boolean') return data.found;

	const totalCount = Number(payload?.TotalCount ?? data?.TotalCount ?? 0);
	if (!Number.isNaN(totalCount) && totalCount > 0) return true;

	if (Array.isArray(data)) return data.length > 0;
	if (Array.isArray(data?.applicants)) return data.applicants.length > 0;
	if (Array.isArray(data?.items)) return data.items.length > 0;

	if (data && typeof data === 'object') {
		return Boolean(data._id || data.id);
	}

	return false;
};

const escapeHtml = (value: string | number = ''): string => {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
};

const CheckPreviousApplication: React.FC = () => {
	const navigate = useNavigate();
	const dispatch = useDispatch<any>();
	const { t, isArabic } = useTranslation();
	const {
		positions = [],
		loading = false,
		error = null,
		company = null,
	} = useSelector((state: any) => state.jobPositions || {});

	const [checkEmail, setCheckEmail] = useState('');
	const [checkPhone, setCheckPhone] = useState('');
	const [isCheckingApplicant, setIsCheckingApplicant] = useState(false);

	useEffect(() => {
		if (positions.length === 0) {
			dispatch(getJobPositions());
		}
	}, [dispatch, positions.length]);

	const companyMeta = useMemo(() => {
		const firstPosition = positions[0];
		const rawCompany = company || firstPosition?.companyId || firstPosition?.company || null;

		if (!rawCompany) {
			return { companyId: '', companyName: '' };
		}

		if (typeof rawCompany === 'string') {
			return { companyId: rawCompany, companyName: '' };
		}

		return {
			companyId: rawCompany._id || rawCompany.id || '',
			companyName: rawCompany.name || '',
		};
	}, [company, positions]);

	const getLocalizedText = (field: any): string => {
		if (!field) return '';
		if (typeof field === 'string') return field;
		if (typeof field === 'object') {
			const localized = isArabic ? (field.ar || field.en || '') : (field.en || field.ar || '');
			return extractStringFromRich(localized);
		}
		return '';
	};

	const formatSubmittedDate = (value: unknown): string => {
		if (typeof value !== 'string' || !value.trim()) return '-';

		const parsedDate = new Date(value);
		if (Number.isNaN(parsedDate.getTime())) return value;

		return parsedDate.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	const getAppliedDetails = (payload: any): AppliedDetail[] => {
		const records = extractApplicantRecords(payload);
		const fallbackCompanyName = getLocalizedText(companyMeta.companyName).trim();

		const details: AppliedDetail[] = records.map((record: ApplicantRecord) => {
			const jobTitleSource =
				record?.jobPositionId?.title ||
				record?.jobPosition?.title ||
				record?.jobTitle ||
				record?.title;

			const companySource =
				record?.companyId?.name ||
				record?.company?.name ||
				record?.jobPositionId?.companyId?.name ||
				record?.jobPosition?.companyId?.name ||
				record?.companyName ||
				companyMeta.companyName;

			const translatedCompany = getLocalizedText(companySource).trim();
			const companyName =
				translatedCompany && !/^[a-f0-9]{24}$/i.test(translatedCompany)
					? translatedCompany
					: fallbackCompanyName || '-';

			return {
				jobTitle: getLocalizedText(jobTitleSource).trim() || '-',
				companyName,
				submittedDate: formatSubmittedDate(record?.submittedAt || record?.createdAt || record?.date),
			};
		});

		return Array.from(
			new Map<string, AppliedDetail>(
				details.map((detail: AppliedDetail) => [
					`${detail.jobTitle}|${detail.companyName}|${detail.submittedDate}`,
					detail,
				])
			).values()
		);
	};

	const getAppliedJobTitles = (payload: any): string[] => {
		const records = extractApplicantRecords(payload);

		const titles = records
			.map((record: ApplicantRecord) => {
				const jobTitleSource =
					record?.jobPositionId?.title ||
					record?.jobPosition?.title ||
					record?.jobTitle ||
					record?.title;

				return getLocalizedText(jobTitleSource).trim();
			})
			.filter(Boolean);

		return Array.from(new Set(titles));
	};

	const handleCheckApplicant = async () => {
		const email = checkEmail.trim();
		const phone = checkPhone.trim();
		const companyId = (companyMeta.companyId || '').trim();

		if (!email || !phone) {
			await Swal.fire({
				icon: 'error',
				title: t('joinUs:checkApplicationStatus') || 'Check Application Status',
				text: t('joinUs:emailPhoneRequired') || 'Please enter both email and phone number.',
				confirmButtonColor: '#e42e2b',
			});
			return;
		}

		if (!companyId) {
			await Swal.fire({
				icon: 'info',
				title: t('joinUs:checkApplicationStatus') || 'Check Application Status',
				text:
					t('joinUs:notAppliedYet') ||
					'No previous application was found with this information.',
				confirmButtonColor: '#e42e2b',
			});
			return;
		}

		setIsCheckingApplicant(true);

		try {
			const payload = await checkExistingApplicant({
				email,
				companyId,
				phone,
			});

			const alreadyApplied = hasAppliedBefore(payload);
			const appliedJobTitles = getAppliedJobTitles(payload);
			const appliedDetails = getAppliedDetails(payload);

			const message = alreadyApplied
				? appliedJobTitles.length > 0
					? t('joinUs:alreadyAppliedWithPositions', {
							positions: appliedJobTitles.join(', '),
						}) || `You already applied before for: ${appliedJobTitles.join(', ')}.`
					: t('joinUs:alreadyApplied') || 'You have already applied before.'
				: t('joinUs:notAppliedYet') || 'No previous application was found with this information.';

			if (alreadyApplied && appliedDetails.length > 0) {
				const detailsHtml = appliedDetails
					.map(
						(detail) =>
							`<li style="margin-bottom: 10px; text-align: ${
								isArabic ? 'right' : 'left'
							};"><div><strong>${escapeHtml(
								t('joinUs:position') || 'Position'
							)}:</strong> ${escapeHtml(detail.jobTitle)}</div><div><strong>${escapeHtml(
								t('joinUs:company') || 'Company'
							)}:</strong> ${escapeHtml(detail.companyName)}</div><div><strong>${escapeHtml(
								t('joinUs:applicationDate') || 'Application Date'
							)}:</strong> ${escapeHtml(detail.submittedDate)}</div></li>`
					)
					.join('');

				await Swal.fire({
					icon: 'success',
					title: t('joinUs:checkApplicationStatus') || 'Check Application Status',
					html: `<p style="margin-bottom: 10px; text-align: ${
						isArabic ? 'right' : 'left'
					}">${escapeHtml(message)}</p><ul style="margin:0; padding-${
						isArabic ? 'right' : 'left'
					}:18px;">${detailsHtml}</ul>`,
					confirmButtonColor: '#e42e2b',
				});
			} else {
				await Swal.fire({
					icon: alreadyApplied ? 'success' : 'warning',
					title: t('joinUs:checkApplicationStatus') || 'Check Application Status',
					text: message,
					confirmButtonColor: '#e42e2b',
				});
			}

			setCheckEmail('');
			setCheckPhone('');
		} catch (err: any) {
			await Swal.fire({
				icon: 'error',
				title: t('joinUs:checkApplicationStatus') || 'Check Application Status',
				text:
					err?.response?.data?.message ||
					err?.message ||
					t('joinUs:statusCheckFailed') ||
					'Unable to check application status right now.',
				confirmButtonColor: '#e42e2b',
			});
		} finally {
			setIsCheckingApplicant(false);
		}
	};

	const pageUrl = getFullUrl('/join-us/check-application');
	const ogImage = getDefaultOgImage();
	const companyName = getLocalizedText(companyMeta.companyName);

	return (
		<>
			<Helmet>
				<link
					rel="stylesheet"
					href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap"
				/>
				<title>{`${t('joinUs:checkApplicationStatus') || 'Check Application Status'} - ${SITE_NAME}`}</title>
				<meta
					name="description"
					content={
						t('joinUs:checkStatusSubtitle') ||
						`Check whether you have already applied for jobs at ${SITE_NAME}.`
					}
				/>
				<meta property="og:type" content="website" />
				<meta property="og:site_name" content={SITE_NAME} />
				<meta property="og:url" content={pageUrl} />
				<meta
					property="og:title"
					content={`${t('joinUs:checkApplicationStatus') || 'Check Application Status'} - ${SITE_NAME}`}
				/>
				<meta
					property="og:description"
					content={
						t('joinUs:checkStatusSubtitle') ||
						`Check whether you have already applied for jobs at ${SITE_NAME}.`
					}
				/>
				{ogImage && (
					<>
						<meta property="og:image" content={ogImage} />
						<meta property="og:image:url" content={ogImage} />
						<meta property="og:image:secure_url" content={ogImage} />
						<meta property="og:image:type" content="image/png" />
						<meta property="og:image:width" content="1200" />
						<meta property="og:image:height" content="630" />
						<meta
							property="og:image:alt"
							content={`${t('joinUs:checkApplicationStatus') || 'Check Application Status'} - ${SITE_NAME}`}
						/>
					</>
				)}
				<meta name="twitter:card" content="summary_large_image" />
				<meta
					name="twitter:title"
					content={`${t('joinUs:checkApplicationStatus') || 'Check Application Status'} - ${SITE_NAME}`}
				/>
				<meta
					name="twitter:description"
					content={
						t('joinUs:checkStatusSubtitle') ||
						`Check whether you have already applied for jobs at ${SITE_NAME}.`
					}
				/>
				{ogImage && <meta name="twitter:image" content={ogImage} />}
			</Helmet>

			<section
				style={{ fontFamily: "'Cairo', sans-serif" }}
				className="py-20 md:py-32 relative overflow-hidden min-h-screen"
			>
				<div className="absolute inset-0 opacity-5 pointer-events-none">
					<div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
					<div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />
				</div>

				<div className="container relative mx-auto px-4 md:px-6 max-w-3xl">
					<button
						onClick={() => navigate('/join-us')}
						className="mb-8 flex items-center gap-2 text-white bg-primary-500 hover:bg-primary-600 px-4 py-2 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
						</svg>
						<span className="font-semibold">{t('joinUs:backToJobs') || 'Back to Job Positions'}</span>
					</button>

					<div className="glass rounded-2xl p-8 md:p-10 shadow-xl border border-white/40 dark:border-dark-700">
						<div className={`mb-8 ${isArabic ? 'text-right' : 'text-left'}`}>
							<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-5">
								<span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
								<span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
									{t('joinUs:checkApplicationStatus') || 'Check Application Status'}
								</span>
							</div>

							<h1 className="text-3xl md:text-4xl font-bold text-light-900 dark:text-white mb-3">
								{t('joinUs:checkApplicationStatus') || 'Check Application Status'}
							</h1>

							<p className="text-light-600 dark:text-light-300 text-base mb-2">
								{t('joinUs:checkStatusSubtitle') ||
									'See whether you already submitted an application using your email and phone number.'}
							</p>

							<p className="text-sm text-light-500 dark:text-light-400">
								<strong>{t('joinUs:company') || 'Company'}:</strong>{' '}
								{companyName || t('joinUs:companyUnavailable') || 'Not available right now'}
							</p>
						</div>

						{loading && positions.length === 0 ? (
							<div className="text-center py-10">
								<div className="inline-flex items-center gap-3">
									<svg
										className="animate-spin h-6 w-6 text-primary-500"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
									<span className="text-light-700 dark:text-light-300 font-medium">
										{t('joinUs:loading') || 'Loading job positions...'}
									</span>
								</div>
							</div>
						) : (
							<>
								{error && positions.length === 0 && (
									<div className="mb-6 p-4 rounded-xl border border-red-300 bg-red-50 text-red-700 text-sm">
										{t('joinUs:statusCheckFailed') || 'Unable to load company data at the moment.'}
									</div>
								)}

								<div className="grid md:grid-cols-2 gap-5 mb-6">
									<div className="group">
										<label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
											{t('joinUs:email') || 'Email'} <span className="text-red-500">*</span>
										</label>
										<input
											type="email"
											value={checkEmail}
											onChange={(e) => setCheckEmail(e.target.value)}
											disabled={isCheckingApplicant}
											placeholder={t('joinUs:email') || 'Email'}
											className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200 disabled:opacity-60"
										/>
									</div>

									<div className="group">
										<label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
											{t('joinUs:phone') || 'Phone'} <span className="text-red-500">*</span>
										</label>
										<input
											type="tel"
											value={checkPhone}
											onChange={(e) => setCheckPhone(e.target.value)}
											disabled={isCheckingApplicant}
											placeholder={t('joinUs:phone') || 'Phone'}
											className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200 disabled:opacity-60"
										/>
									</div>
								</div>

								<p className={`text-sm text-light-500 dark:text-light-400 mb-6 ${isArabic ? 'text-right' : 'text-left'}`}>
									{t('joinUs:checkStatusHint') ||
										'Enter the same email and phone number you used in your previous application.'}
								</p>

								<div className={`flex flex-wrap gap-3 ${isArabic ? 'justify-start' : 'justify-end'}`}>
									<button
										type="button"
										onClick={() => navigate('/join-us')}
										disabled={isCheckingApplicant}
										className="btn-outline disabled:opacity-60"
									>
										{t('joinUs:backToJobs') || 'Back to Job Positions'}
									</button>

									<button
										type="button"
										onClick={handleCheckApplicant}
										disabled={isCheckingApplicant}
										className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
									>
										{isCheckingApplicant && (
											<svg
												className="animate-spin h-4 w-4"
												fill="none"
												viewBox="0 0 24 24"
											>
												<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
												<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
											</svg>
										)}
										<span>
											{isCheckingApplicant
												? t('joinUs:checking') || 'Checking...'
												: t('joinUs:check') || 'Check'}
										</span>
									</button>
								</div>
							</>
						)}
					</div>
				</div>
			</section>

			<Footer />
		</>
	);
};

export default CheckPreviousApplication;
