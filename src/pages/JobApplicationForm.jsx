import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { Formik, Form, Field } from 'formik';
import { Checkbox, FormHelperText } from '@mui/material';
import * as Yup from 'yup';
import axios from 'axios';
import {
  submitApplicant,
  checkExistingApplicant,
  getApiErrorMessage, // <-- Imported new utility
} from '../api/formsApi';
import Swal from 'sweetalert2';
import { useTranslation } from '../i18n/hooks/useTranslation';
import { getJobPositions } from '../store/slices/jobPositionsSlice';
import valoraLogo from '../assets/logos/INSIDE LOGO.png'; // Keep the original import
import { getFullUrl, getDefaultOgImage, SITE_NAME } from '../utils/ogMeta';
import Footer from '../components/footer';

const JobApplicationForm = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t, isArabic, mapEmploymentType, mapWorkArrangement } =
    useTranslation();
  const { positions, loading, company } = useSelector(
    (state) => state.jobPositions
  );

  const [repeatableGroups, setRepeatableGroups] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState({});

  const allowedProfilePhotoMimeTypes = ['image/jpeg', 'image/png'];
  const allowedProfilePhotoExtensions = ['.jpg', '.jpeg', '.png'];
  const allowedCvMimeTypes = ['application/pdf'];
  const allowedCvExtensions = ['.pdf'];
  // --- New Constants from first code ---
  const maxProfilePhotoFileSizeInBytes = 5 * 1024 * 1024;
  const maxCvFileSizeInBytes = 10 * 1024 * 1024;
  const maxExpectedSalaryValue = 100000;
  // ------------------------------------

  const jobPosition = positions.find((pos) => pos.slug === slug);
  // --- New Logic for orderedCustomFields from first code ---
  const orderedCustomFields = Array.isArray(jobPosition?.customFields)
    ? [...jobPosition.customFields].sort((a, b) => {
        const aOrder = Number.isFinite(Number(a?.displayOrder))
          ? Number(a.displayOrder)
          : Number.MAX_SAFE_INTEGER;
        const bOrder = Number.isFinite(Number(b?.displayOrder))
          ? Number(b.displayOrder)
          : Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      })
    : [];
  // -------------------------------------------------------

  const baseFieldDefaults = {
    fullName: { visible: true, required: true },
    email: { visible: true, required: true },
    phone: { visible: true, required: true },
    gender: { visible: true, required: true },
    birthDate: { visible: true, required: true },
    address: { visible: true, required: true },
    profilePhoto: { visible: true, required: true },
    cvFilePath: { visible: true, required: false },
    expectedSalary: {
      visible: Boolean(jobPosition?.salaryFieldVisible),
      required: Boolean(jobPosition?.salaryFieldVisible),
    },
  };

  const getBaseFieldConfig = (fieldName) => {
    const fallback = baseFieldDefaults[fieldName] || {
      visible: true,
      required: false,
    };
    const configured = jobPosition?.fieldConfig?.[fieldName] || {};
    const visible = configured.visible ?? fallback.visible;
    // Hidden fields must never be treated as required.
    const required = Boolean(
      visible && (configured.required ?? fallback.required)
    );
    return {
      visible: Boolean(visible),
      required,
    };
  };

  const isBaseFieldVisible = (fieldName) =>
    getBaseFieldConfig(fieldName).visible;
  const isBaseFieldRequired = (fieldName) =>
    getBaseFieldConfig(fieldName).required;

  useEffect(() => {
    if (positions.length === 0) {
      dispatch(getJobPositions());
    }
  }, [dispatch, positions.length]);

  useEffect(() => {
    if (jobPosition) {
      // initialize acceptedTerms map for per-term acceptance
      const termsMap = {};
      jobPosition.termsAndConditions?.forEach((t, i) => {
        const id = t._id || `term_${i}`;
        termsMap[id] = false;
      });
      setAcceptedTerms(termsMap);

      const groups = {};
      // --- Updated to use orderedCustomFields and include 'groupField' & 'repeatable_group' ---
      orderedCustomFields
        ?.filter(
          (field) =>
            field.inputType === 'groupField' ||
            field.inputType === 'repeatable_group'
        )
        .forEach((field) => {
          const fieldKey = getFieldKey(field) || field.name || field.fieldId;
          if (!fieldKey) return;
          groups[fieldKey] = [{}];
        });
      setRepeatableGroups(groups);
      // ---------------------------------------------------------------------------------------
    }
  }, [jobPosition]);

  // Helper function to get the field key (convert label to readable key)
  const getFieldKey = (field) => {
    if (!field) return '';
    if (typeof field === 'string') {
      return String(field)
        .toLowerCase()
        .trim()
        .replace(/[^\w\s\u0600-\u06FF]/g, '')
        .replace(/\s+/g, '_');
    }

    const stableCandidate =
      field.fieldId || field.name || field.id || field._id;
    const keySource = stableCandidate || getLocalizedText(field.label);
    if (!keySource) return '';

    // Use stable ids when available; fallback to a normalized label.
    return String(keySource)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0600-\u06FF]/g, '') // Remove special chars but keep Arabic
      .replace(/\s+/g, '_'); // Replace spaces with underscores
  };

  // Helper to always derive the English key (use `en` label when present)
  const getFieldKeyEn = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return getFieldKey(field);
    // field may be the full field object; prefer its `label` object
    const labelObj = field.label || field;
    const enLabel =
      typeof labelObj === 'object'
        ? labelObj.en || labelObj.ar || field.name || field.fieldId || ''
        : '';
    const labelText = extractStringFromRich(enLabel);
    if (!labelText) return getFieldKey(field);
    return labelText
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0600-\u06FF]/g, '')
      .replace(/\s+/g, '_');
  };

  const extractStringFromRich = (val) => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.map(extractStringFromRich).join(' ');
    if (typeof val === 'object') {
      if (typeof val.text === 'string') return val.text;
      if (val.ops && Array.isArray(val.ops))
        return val.ops
          .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
          .join('');
      if (val.blocks && Array.isArray(val.blocks))
        return val.blocks
          .map((b) => extractStringFromRich(b.text || b.data || b))
          .join('\n');
      if (typeof val.html === 'string') return val.html.replace(/<[^>]+>/g, '');
      return '';
    }
    return String(val);
  };

  const getLocalizedText = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object') {
      const localized = isArabic
        ? field.ar || field.en || ''
        : field.en || field.ar || '';
      return extractStringFromRich(localized);
    }
    return '';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // --- New/Improved scrollToFirstError from first code ---
  const scrollToFirstError = (errors) => {
    const firstErrorKey = Object.keys(errors)[0];
    if (firstErrorKey) {
      let fieldName = firstErrorKey;

      // Handle nested errors (customResponses.fieldName)
      if (
        firstErrorKey === 'customResponses' &&
        typeof errors[firstErrorKey] === 'object'
      ) {
        const nestedKey = Object.keys(errors[firstErrorKey])[0];
        fieldName = `customResponses.${nestedKey}`;
      }

      // Special-case the profile photo input: scroll to its label for better UX
      let errorElement = null;
      if (fieldName === 'profilePhotoFile') {
        errorElement =
          document.querySelector('label[for="profile-photo-upload"]') ||
          document.getElementById('profile-photo-upload');
      }

      // Try to find the field by name attribute as fallback
      if (!errorElement) {
        errorElement =
          document.querySelector(`[name="${fieldName}"]`) ||
          document.querySelector(`[name="${firstErrorKey}"]`) ||
          document.querySelector(`[data-error="${firstErrorKey}"]`);
      }

      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus the field after scrolling
        setTimeout(() => {
          try {
            // Make sure element is focusable (for labels) and visually highlighted so user stays there
            if (errorElement && errorElement.setAttribute) {
              errorElement.setAttribute('tabindex', '-1');
              errorElement.classList.add(
                'ring-4',
                'ring-primary-500/30',
                'ring-offset-2'
              );
            }
            errorElement.focus && errorElement.focus();

            // Keep the highlight and focus for a few seconds then clean up
            setTimeout(() => {
              try {
                if (errorElement && errorElement.removeAttribute) {
                  errorElement.removeAttribute('tabindex');
                }
                if (errorElement && errorElement.classList) {
                  errorElement.classList.remove(
                    'ring-4',
                    'ring-primary-500/30',
                    'ring-offset-2'
                  );
                }
              } catch (e) {}
            }, 4000);
          } catch (e) {
            /* ignore */
          }
        }, 300);
      }
    }
  };
  // -------------------------------------------------------

  const leftRotate32 = (value, shift) =>
    ((value << shift) | (value >>> (32 - shift))) >>> 0;

  const sha1FallbackHex = (input) => {
    const messageBytes = new TextEncoder().encode(input);
    const originalBitLength = messageBytes.length * 8;

    const withOne = new Uint8Array(messageBytes.length + 1);
    withOne.set(messageBytes);
    withOne[messageBytes.length] = 0x80;

    const paddedLength = Math.ceil((withOne.length + 8) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(withOne);

    const view = new DataView(padded.buffer);
    const highBits = Math.floor(originalBitLength / 0x100000000);
    const lowBits = originalBitLength >>> 0;
    view.setUint32(paddedLength - 8, highBits, false);
    view.setUint32(paddedLength - 4, lowBits, false);

    let h0 = 0x67452301;
    let h1 = 0xefcdab89;
    let h2 = 0x98badcfe;
    let h3 = 0x10325476;
    let h4 = 0xc3d2e1f0;

    const words = new Uint32Array(80);

    for (let blockStart = 0; blockStart < paddedLength; blockStart += 64) {
      for (let i = 0; i < 16; i += 1) {
        words[i] = view.getUint32(blockStart + i * 4, false);
      }

      for (let i = 16; i < 80; i += 1) {
        words[i] = leftRotate32(
          words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16],
          1
        );
      }

      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;

      for (let i = 0; i < 80; i += 1) {
        let f;
        let k;

        if (i < 20) {
          f = (b & c) | (~b & d);
          k = 0x5a827999;
        } else if (i < 40) {
          f = b ^ c ^ d;
          k = 0x6ed9eba1;
        } else if (i < 60) {
          f = (b & c) | (b & d) | (c & d);
          k = 0x8f1bbcdc;
        } else {
          f = b ^ c ^ d;
          k = 0xca62c1d6;
        }

        const temp = (leftRotate32(a, 5) + f + e + k + words[i]) >>> 0;
        e = d;
        d = c;
        c = leftRotate32(b, 30);
        b = a;
        a = temp;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
    }

    return [h0, h1, h2, h3, h4]
      .map((num) => num.toString(16).padStart(8, '0'))
      .join('');
  };

  const buildSha1Hex = async (input) => {
    const subtle = globalThis.crypto?.subtle;

    if (subtle?.digest) {
      const data = new TextEncoder().encode(input);
      const hashBuffer = await subtle.digest('SHA-1', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }

    return sha1FallbackHex(input);
  };

  // --- Improved uploadToCloudinary with retries and progress from first code ---
  const uploadToCloudinary = async (file, retries = 3, delayMs = 1000) => {
    const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      throw new Error('Cloudinary credentials not configured');
    }

    const isImage = file.type.startsWith('image/');
    const uploadUrl = isImage
      ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
      : `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(uploadUrl, formData, {
          timeout: 180000, // 60 second timeout
          onUploadProgress: (progressEvent) => {
            const titleEl = document.querySelector('.swal2-title');
            if (!titleEl) return;

            const label = isImage
              ? t('joinUs:uploadingPhoto') || 'Uploading photo'
              : t('joinUs:uploadingCV') || 'Uploading CV';

            // progressEvent.total can be 0 or undefined if server omits Content-Length
            if (progressEvent.total && progressEvent.total > 0) {
              const percent = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              titleEl.textContent = `${label}... ${percent}%`;
            } else {
              // Fallback: show uploaded MB instead of percentage
              const uploadedMB = (progressEvent.loaded / (1024 * 1024)).toFixed(
                1
              );
              titleEl.textContent = `${label}... ${uploadedMB} MB`;
            }
          },
        });
        return response.data.secure_url;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        const isNetworkError = !error.response; // no response = network/timeout issue

        if (isNetworkError && !isLastAttempt) {
          // Wait before retrying (1s, 2s, 4s...)
          await new Promise((resolve) =>
            setTimeout(resolve, delayMs * attempt)
          );
          continue;
        }

        const serverMessage = getApiErrorMessage(
          error,
          error?.message || 'File upload failed'
        );
        throw new Error(serverMessage);
      }
    }
  };
  // --------------------------------------------------------------------------

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const hasAllowedExtension = (fileName, extensions) => {
    const normalizedName = (fileName || '').toLowerCase();
    return extensions.some((ext) => normalizedName.endsWith(ext));
  };

  // --- New file size validation helpers ---
  const isFileWithinSizeLimit = (file, maxSizeInBytes) => {
    if (!file || typeof file.size !== 'number') return false;
    return file.size <= maxSizeInBytes;
  };

  const getDisplayFileName = (file, maxLength = 15, previewLength = 12) => {
    const rawName = typeof file?.name === 'string' ? file.name.trim() : '';
    if (!rawName) return '';
    return rawName.length > maxLength
      ? `${rawName.substring(0, previewLength)}...`
      : rawName;
  };
  // ---------------------------------------

  const isAllowedProfilePhotoFile = (file) => {
    if (!file) return false;
    const normalizedType = (file.type || '').toLowerCase();
    return (
      allowedProfilePhotoMimeTypes.includes(normalizedType) ||
      hasAllowedExtension(file.name, allowedProfilePhotoExtensions)
    );
  };

  const isAllowedCvFile = (file) => {
    if (!file) return false;
    const normalizedType = (file.type || '').toLowerCase();
    return (
      allowedCvMimeTypes.includes(normalizedType) ||
      hasAllowedExtension(file.name, allowedCvExtensions)
    );
  };

  // --- New helper functions from first code for rich validation ---
  const createTrimmedStringSchema = () =>
    Yup.string().transform((value, originalValue) => {
      if (typeof originalValue !== 'string') return value;
      return originalValue.trim();
    });

  const hasMeaningfulValue = (value) => {
    if (value === undefined || value === null) return false;
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  };

  const hasAnyFilledValue = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    return Object.values(value).some((entry) => hasMeaningfulValue(entry));
  };

  const stringifyForDisplay = (value, maxChars = 20000) => {
    try {
      const serialized = JSON.stringify(value, null, 2);
      if (serialized.length <= maxChars) return serialized;
      return `${serialized.slice(0, maxChars)}\n... [truncated]`;
    } catch (error) {
      return String(value);
    }
  };

  const getAllowedChoiceValues = (choices = []) => {
    return choices
      .map((choice) => getLocalizedText(choice))
      .map((value) =>
        typeof value === 'string' ? value.trim() : String(value || '').trim()
      )
      .filter((value) => value !== '');
  };

  const mergeGroupRows = (primaryRows, secondaryRows) => {
    const first = Array.isArray(primaryRows) ? primaryRows : [];
    const second = Array.isArray(secondaryRows) ? secondaryRows : [];
    const maxLength = Math.max(first.length, second.length);

    if (maxLength === 0) return [];

    return Array.from({ length: maxLength }, (_, index) => {
      const secondRow = second[index];
      const firstRow = first[index];

      const normalizedSecond =
        secondRow && typeof secondRow === 'object' && !Array.isArray(secondRow)
          ? secondRow
          : {};
      const normalizedFirst =
        firstRow && typeof firstRow === 'object' && !Array.isArray(firstRow)
          ? firstRow
          : {};

      return {
        ...normalizedSecond,
        ...normalizedFirst,
      };
    });
  };

  const getFirstErrorText = (errorNode) => {
    if (!errorNode) return '';
    if (typeof errorNode === 'string') return errorNode;

    if (Array.isArray(errorNode)) {
      for (const item of errorNode) {
        const nestedError = getFirstErrorText(item);
        if (nestedError) return nestedError;
      }
      return '';
    }

    if (typeof errorNode === 'object') {
      for (const key of Object.keys(errorNode)) {
        const nestedError = getFirstErrorText(errorNode[key]);
        if (nestedError) return nestedError;
      }
    }

    return '';
  };

  const getFirstErrorPath = (errorNode, prefix = '') => {
    if (!errorNode) return '';

    if (typeof errorNode === 'string') {
      return prefix;
    }

    if (Array.isArray(errorNode)) {
      for (let index = 0; index < errorNode.length; index += 1) {
        const childPrefix = prefix ? `${prefix}.${index}` : String(index);
        const path = getFirstErrorPath(errorNode[index], childPrefix);
        if (path) return path;
      }
      return '';
    }

    if (typeof errorNode === 'object') {
      for (const key of Object.keys(errorNode)) {
        const childPrefix = prefix ? `${prefix}.${key}` : key;
        const path = getFirstErrorPath(errorNode[key], childPrefix);
        if (path) return path;
      }
    }

    return '';
  };

  const toReadableLabel = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const escapeHtml = (value = '') => {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  };

  const getTranslatedOrFallback = (key, fallback) => {
    const translated = t(key);
    if (typeof translated !== 'string') return fallback;

    const trimmed = translated.trim();
    if (!trimmed) return fallback;

    const keyWithoutNamespace = key.includes(':') ? key.split(':').pop() : key;
    if (trimmed === key || trimmed === keyWithoutNamespace) return fallback;

    return translated;
  };

  const isRequiredFlagEnabled = (value) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'true' || normalized === '1';
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    return value === true;
  };

  const isRequiredValidationMessage = (message) => {
    if (typeof message !== 'string') return false;
    const normalized = message.toLowerCase();
    return normalized.includes('required') || normalized.includes('مطلوب');
  };

  const getCustomFieldKeyFromPath = (path = '') => {
    if (typeof path !== 'string' || !path.startsWith('customResponses.'))
      return '';
    const pathParts = path.split('.');
    return pathParts[1] || '';
  };

  const getFixHintByInputType = (inputType, fallbackLabel) => {
    switch (inputType) {
      case 'email':
        return getTranslatedOrFallback(
          'joinUs:fixHintEmail',
          'Enter a valid email address, for example name@example.com.'
        );
      case 'number':
        return getTranslatedOrFallback(
          'joinUs:fixHintNumber',
          'Enter numbers only (no letters or symbols).'
        );
      case 'url':
        return getTranslatedOrFallback(
          'joinUs:fixHintUrl',
          'Enter a full URL starting with http:// or https://.'
        );
      case 'date':
        return getTranslatedOrFallback(
          'joinUs:fixHintDate',
          'Choose a valid date that is not in the future.'
        );
      case 'dropdown':
      case 'select':
      case 'radio':
        return getTranslatedOrFallback(
          'joinUs:fixHintSelection',
          'Select one of the available options.'
        );
      case 'checkbox':
        return getTranslatedOrFallback(
          'joinUs:fixHintCheckbox',
          'Tick the checkbox to continue.'
        );
      case 'tags':
        return getTranslatedOrFallback(
          'joinUs:fixHintTags',
          'Add at least one tag and press Enter or Add.'
        );
      case 'groupField':
      case 'repeatable_group':
        return getTranslatedOrFallback(
          'joinUs:fixHintGroup',
          'Complete all required fields in this section.'
        );
      default:
        return getTranslatedOrFallback(
          'joinUs:fixHintDefault',
          `Review ${fallbackLabel || 'this field'} and provide a valid value.`
        );
    }
  };

  const getFieldValidationDetails = (errorPath) => {
    const baseFields = {
      fullName: {
        label: t('joinUs:fullName') || 'Full Name',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintFullName',
          'Enter your full name using letters and spaces only.'
        ),
      },
      email: {
        label: t('joinUs:email') || 'Email',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintEmail',
          'Enter a valid email address, for example name@example.com.'
        ),
      },
      phone: {
        label: t('joinUs:phone') || 'Phone',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintPhone',
          'Enter an 11-digit Egyptian number starting with 010, 011, 012, or 015.'
        ),
      },
      address: {
        label: t('joinUs:address') || 'Address',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintAddress',
          'Enter a complete address with enough details.'
        ),
      },
      birthDate: {
        label: t('joinUs:dateOfBirth') || 'Birth Date',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintDate',
          'Choose a valid date that is not in the future.'
        ),
      },
      gender: {
        label: t('joinUs:gender') || 'Gender',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintSelection',
          'Select one of the available options.'
        ),
      },
      expectedSalary: {
        label: t('joinUs:expectedSalary') || 'Expected Salary',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintSalary',
          'Enter numbers only and keep the value within the allowed range.'
        ),
      },
      profilePhotoFile: {
        label: t('joinUs:photo') || 'Profile Photo',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintPhoto',
          'Upload a JPG or PNG photo up to 5 MB.'
        ),
      },
      cvFile: {
        label: t('joinUs:uploadCV') || 'CV',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintCv',
          'Upload a PDF file up to 10 MB.'
        ),
      },
      agreedToTerms: {
        label: t('joinUs:termsAndConditions') || 'Terms and Conditions',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintTerms',
          'Accept all required terms and conditions to continue.'
        ),
      },
    };

    if (!errorPath || typeof errorPath !== 'string') {
      return {
        label: t('joinUs:applicationForm') || 'Application Form',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintDefault',
          'Review highlighted fields and provide valid values.'
        ),
      };
    }

    if (Object.prototype.hasOwnProperty.call(baseFields, errorPath)) {
      return baseFields[errorPath];
    }

    if (errorPath.startsWith('jobSpecsResponses.')) {
      return {
        label: t('joinUs:jobSpecs') || 'Job Specifications',
        hint: getTranslatedOrFallback(
          'joinUs:fixHintJobSpecs',
          'Review the job specifications and update your response.'
        ),
      };
    }

    if (errorPath.startsWith('customResponses.')) {
      const pathParts = errorPath.split('.');
      const customFieldKey = pathParts[1] || '';
      const customFieldDefinition = orderedCustomFields.find(
        (field) => getFieldKey(field) === customFieldKey
      );

      const customFieldLabel =
        getLocalizedText(customFieldDefinition?.label) ||
        toReadableLabel(customFieldKey) ||
        'Custom Field';

      const isRepeatable =
        customFieldDefinition?.inputType === 'repeatable_group';
      const firstNestedPart = pathParts[2];
      const hasRowIndex = /^\d+$/.test(firstNestedPart || '');
      const nestedSubKey = hasRowIndex ? pathParts[3] : firstNestedPart;

      if (
        (customFieldDefinition?.inputType === 'groupField' || isRepeatable) &&
        nestedSubKey
      ) {
        const subFieldDefinition = (
          customFieldDefinition.groupFields || []
        ).find((subField) => getFieldKey(subField) === nestedSubKey);
        const subFieldLabel =
          getLocalizedText(subFieldDefinition?.label) ||
          toReadableLabel(nestedSubKey) ||
          'Field';

        const rowSuffix = hasRowIndex
          ? ` (${getTranslatedOrFallback('joinUs:entry', 'Entry')} ${Number(firstNestedPart) + 1})`
          : '';

        return {
          label: `${customFieldLabel} - ${subFieldLabel}${rowSuffix}`,
          hint: getFixHintByInputType(
            subFieldDefinition?.inputType,
            subFieldLabel
          ),
        };
      }

      return {
        label: customFieldLabel,
        hint: getFixHintByInputType(
          customFieldDefinition?.inputType,
          customFieldLabel
        ),
      };
    }

    return {
      label:
        toReadableLabel(errorPath) ||
        t('joinUs:applicationForm') ||
        'Application Form',
      hint: getTranslatedOrFallback(
        'joinUs:fixHintDefault',
        'Review highlighted fields and provide valid values.'
      ),
    };
  };
  // ----------------------------------------------------------------

  // --- Completely revamped and enhanced createValidationSchema from first code ---
  const createCustomFieldSchema = (
    fieldDefinition,
    fieldLabel,
    isRequired = false
  ) => {
    const requiredMsg = `${fieldLabel} ${t('joinUs:isRequired') || 'is required'}`;

    switch (fieldDefinition?.inputType) {
      case 'email': {
        let schema = createTrimmedStringSchema().email(
          t('joinUs:invalidEmail') || 'Please enter a valid email address'
        );
        if (isRequired) schema = schema.required(requiredMsg);
        return schema;
      }

      case 'number': {
        let schema = createTrimmedStringSchema().test(
          'valid-number',
          t('joinUs:invalidNumber') || 'Please enter a valid number',
          (value) => {
            if (!value) return true;
            return /^-?\d+(\.\d+)?$/.test(value);
          }
        );
        if (isRequired) schema = schema.required(requiredMsg);
        return schema;
      }

      case 'url': {
        let schema = createTrimmedStringSchema().url(
          t('joinUs:invalidUrl') || 'Please enter a valid URL'
        );
        if (isRequired) schema = schema.required(requiredMsg);
        return schema;
      }

      case 'date': {
        let schema = Yup.date()
          .nullable()
          .transform((value, originalValue) => {
            if (
              originalValue === '' ||
              originalValue === null ||
              originalValue === undefined
            )
              return null;
            return value;
          })
          .typeError(t('joinUs:invalidDate') || 'Please enter a valid date')
          .max(
            new Date(),
            t('joinUs:invalidFutureDate') || 'Date cannot be in the future'
          );

        if (isRequired) schema = schema.required(requiredMsg);
        return schema;
      }

      case 'dropdown':
      case 'select':
      case 'radio': {
        const allowedChoices = getAllowedChoiceValues(
          fieldDefinition?.choices || []
        );
        let schema = createTrimmedStringSchema().test(
          'valid-choice',
          t('joinUs:invalidSelection') || 'Please select a valid option',
          (value) => {
            if (!value) return true;
            return allowedChoices.includes(value);
          }
        );

        if (isRequired) schema = schema.required(requiredMsg);
        return schema;
      }

      case 'textarea': {
        let schema = createTrimmedStringSchema().max(
          2000,
          t('joinUs:textTooLong') || 'This field is too long'
        );

        if (isRequired) {
          schema = schema
            .required(requiredMsg)
            .min(
              2,
              t('joinUs:textTooShort') || 'Please enter at least 2 characters'
            );
        }

        return schema;
      }

      default: {
        let schema = createTrimmedStringSchema().max(
          255,
          t('joinUs:textTooLong') || 'This field is too long'
        );

        if (isRequired) {
          schema = schema
            .required(requiredMsg)
            .min(
              2,
              t('joinUs:textTooShort') || 'Please enter at least 2 characters'
            );
        }

        return schema;
      }
    }
  };

  const createValidationSchema = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const oldestAllowedBirthDate = new Date(today);
    oldestAllowedBirthDate.setFullYear(today.getFullYear() - 100);

    const schemaShape = {
      agreedToTerms: Yup.boolean()
        .oneOf([true], t('joinUs:acceptTerms') || 'You must accept the terms')
        .required(t('joinUs:acceptTerms') || 'You must accept the terms'),
      customResponses: Yup.object(),
    };

    if (isBaseFieldVisible('profilePhoto')) {
      let profilePhotoSchema = Yup.mixed()
        .nullable()
        .test(
          'image-only',
          t('joinUs:invalidPhotoType') ||
            'Only JPG, JPEG, and PNG files are allowed',
          (file) => !file || isAllowedProfilePhotoFile(file)
        )
        .test(
          'photo-size',
          t('joinUs:photoTooLarge') || 'Photo file size must be 5 MB or less',
          (file) =>
            !file || isFileWithinSizeLimit(file, maxProfilePhotoFileSizeInBytes)
        );

      if (isBaseFieldRequired('profilePhoto')) {
        profilePhotoSchema = profilePhotoSchema.required(
          t('joinUs:photoRequired') ||
            `${t('joinUs:photo') || 'Photo'} ${t('joinUs:isRequired') || 'is required'}`
        );
      } else {
        profilePhotoSchema = profilePhotoSchema.nullable();
      }

      schemaShape.profilePhotoFile = profilePhotoSchema;
    }

    if (isBaseFieldVisible('cvFilePath')) {
      let cvSchema = Yup.mixed()
        .nullable()
        .test(
          'pdf-only',
          t('joinUs:invalidCVType') || 'Only PDF files are allowed',
          (file) => !file || isAllowedCvFile(file)
        )
        .test(
          'cv-size',
          t('joinUs:cvTooLarge') || 'CV file size must be 10 MB or less',
          (file) => !file || isFileWithinSizeLimit(file, maxCvFileSizeInBytes)
        );

      if (isBaseFieldRequired('cvFilePath')) {
        cvSchema = cvSchema.required(
          t('joinUs:cvRequired') ||
            `${t('joinUs:uploadCV') || 'CV'} ${t('joinUs:isRequired') || 'is required'}`
        );
      }

      schemaShape.cvFile = cvSchema;
    }

    if (isBaseFieldVisible('fullName')) {
      let fullNameSchema = createTrimmedStringSchema()
        .min(
          2,
          t('joinUs:fullNameTooShort') ||
            'Full name must be at least 2 characters'
        )
        .max(
          100,
          t('joinUs:fullNameTooLong') ||
            'Full name must be 100 characters or less'
        )
        .matches(/^[A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s.'’-]*$/, {
          message:
            t('joinUs:invalidFullName') ||
            'Full name can only include letters, spaces, apostrophes, dots, and hyphens',
          excludeEmptyString: true,
        });

      if (isBaseFieldRequired('fullName')) {
        fullNameSchema = fullNameSchema.required(
          `${t('joinUs:fullName') || 'Full Name'} ${t('joinUs:isRequired') || 'is required'}`
        );
      }
      schemaShape.fullName = fullNameSchema;
    }

    if (isBaseFieldVisible('email')) {
      let emailSchema = createTrimmedStringSchema().email(
        t('joinUs:invalidEmail') || 'Invalid email'
      );
      if (isBaseFieldRequired('email')) {
        emailSchema = emailSchema.required(
          `${t('joinUs:email') || 'Email'} ${t('joinUs:isRequired') || 'is required'}`
        );
      }
      schemaShape.email = emailSchema;
    }

    if (isBaseFieldVisible('phone')) {
      let phoneSchema = createTrimmedStringSchema().matches(/^01[0125]\d{8}$/, {
        message: t('joinUs:invalidPhone') || 'Invalid phone number',
        excludeEmptyString: true,
      });

      if (isBaseFieldRequired('phone')) {
        phoneSchema = phoneSchema.required(
          `${t('joinUs:phone') || 'Phone'} ${t('joinUs:isRequired') || 'is required'}`
        );
      }

      schemaShape.phone = phoneSchema;
    }

    if (isBaseFieldVisible('address')) {
      let addressSchema = createTrimmedStringSchema()
        .min(
          5,
          t('joinUs:addressTooShort') || 'Address must be at least 5 characters'
        )
        .max(
          250,
          t('joinUs:addressTooLong') || 'Address must be 250 characters or less'
        );

      if (isBaseFieldRequired('address')) {
        addressSchema = addressSchema.required(
          `${t('joinUs:address') || 'Address'} ${t('joinUs:isRequired') || 'is required'}`
        );
      }
      schemaShape.address = addressSchema;
    }

    if (isBaseFieldVisible('birthDate')) {
      let birthDateSchema = Yup.date()
        .nullable()
        .transform((value, originalValue) =>
          originalValue === '' ? null : value
        )
        .typeError(
          t('joinUs:invalidBirthDate') || 'Please enter a valid birth date'
        )
        .max(
          today,
          t('joinUs:futureBirthDate') || 'Birth date cannot be in the future'
        )
        .min(
          oldestAllowedBirthDate,
          t('joinUs:invalidBirthDateRange') ||
            'Birth date seems too far in the past'
        );

      if (isBaseFieldRequired('birthDate')) {
        birthDateSchema = birthDateSchema.required(
          `${t('joinUs:dateOfBirth') || 'Birth Date'} ${t('joinUs:isRequired') || 'is required'}`
        );
      }

      schemaShape.birthDate = birthDateSchema;
    }

    if (isBaseFieldVisible('gender')) {
      let genderSchema = createTrimmedStringSchema().oneOf(
        ['Male', 'Female'],
        t('joinUs:invalidGender') || 'Please select a valid gender'
      );

      if (isBaseFieldRequired('gender')) {
        genderSchema = genderSchema.required(
          `${t('joinUs:gender') || 'Gender'} ${t('joinUs:isRequired') || 'is required'}`
        );
      }
      schemaShape.gender = genderSchema;
    }

    if (isBaseFieldVisible('expectedSalary')) {
      let expectedSalarySchema = createTrimmedStringSchema()
        .test(
          'digits-only',
          t('joinUs:invalidSalary') ||
            'Please enter a valid salary (numbers only)',
          (val) => {
            if (val === undefined || val === null) return true;
            const s = String(val).trim();
            if (s === '') return true;
            return /^\d+$/.test(s);
          }
        )
        .test(
          'salary-range',
          t('joinUs:invalidSalaryRange') ||
            `Expected salary must be between 1 and ${maxExpectedSalaryValue.toLocaleString()}`,
          (val) => {
            if (val === undefined || val === null) return true;
            const s = String(val).trim();
            if (s === '') return true;
            const numericValue = Number(s);
            return (
              Number.isInteger(numericValue) &&
              numericValue >= 1 &&
              numericValue <= maxExpectedSalaryValue
            );
          }
        );

      if (isBaseFieldRequired('expectedSalary')) {
        expectedSalarySchema = expectedSalarySchema.required(
          `${t('joinUs:expectedSalary') || 'Expected Salary'} ${t('joinUs:isRequired') || 'is required'}`
        );
      }

      schemaShape.expectedSalary = expectedSalarySchema;
    }

    let schema = Yup.object().shape(schemaShape);

    // Build a detailed shape for customResponses to enforce required custom fields,
    // including groupField and repeatable_group types.
    const customShape = {};

    orderedCustomFields.forEach((field) => {
      const fieldKey = getFieldKey(field);
      const fieldLabel = getLocalizedText(field.label) || fieldKey;
      const fieldIsRequired = isRequiredFlagEnabled(field.isRequired);

      // Helper for a generic required message
      const requiredMsg = `${fieldLabel} ${t('joinUs:isRequired') || 'is required'}`;

      switch (field.inputType) {
        case 'tags': {
          if (fieldIsRequired) {
            customShape[fieldKey] = Yup.array()
              .min(1, requiredMsg)
              .required(requiredMsg);
          } else {
            customShape[fieldKey] = Yup.array();
          }
          break;
        }

        case 'groupField': {
          // Single object with subfields
          const groupShape = {};
          const requiredSubKeySets = [];

          (field.groupFields || []).forEach((sub) => {
            const subKey = getFieldKey(sub);
            const subLabel = getLocalizedText(sub.label) || subKey;
            const subFieldId =
              typeof sub?.fieldId === 'string' ? sub.fieldId.trim() : '';
            const keyCandidates = Array.from(
              new Set([subKey, subFieldId].filter(Boolean))
            );

            if (isRequiredFlagEnabled(sub.isRequired)) {
              requiredSubKeySets.push(keyCandidates);
            }

            // Requiredness for subfields is enforced conditionally in the object-level test.
            groupShape[subKey] = createCustomFieldSchema(sub, subLabel, false);
          });

          const objSchema = Yup.object()
            .shape(groupShape)
            .test('group-required', requiredMsg, (val) => {
              const externalGroupValueRaw = Array.isArray(
                repeatableGroups[fieldKey]
              )
                ? repeatableGroups[fieldKey][0]
                : undefined;
              const formikGroup =
                val && typeof val === 'object' && !Array.isArray(val)
                  ? val
                  : {};
              const externalGroup =
                externalGroupValueRaw &&
                typeof externalGroupValueRaw === 'object' &&
                !Array.isArray(externalGroupValueRaw)
                  ? externalGroupValueRaw
                  : {};
              const candidate = { ...externalGroup, ...formikGroup };

              const hasRequiredSubfields = requiredSubKeySets.length > 0;
              const shouldEnforceRequiredSubfields = Boolean(
                fieldIsRequired ||
                hasRequiredSubfields ||
                hasAnyFilledValue(candidate)
              );
              if (!shouldEnforceRequiredSubfields) return true;

              if (!candidate || !hasAnyFilledValue(candidate)) return false;

              // If the group has no required subfields, any non-empty group value is acceptable.
              if (requiredSubKeySets.length === 0) return true;

              return requiredSubKeySets.every((keySet) =>
                keySet.some((key) => hasMeaningfulValue(candidate?.[key]))
              );
            });

          customShape[fieldKey] = objSchema;
          break;
        }

        case 'repeatable_group': {
          // Array of objects; enforce min length if required and per-item required subfields
          const itemShape = {};
          const requiredSubKeySets = [];

          (field.groupFields || []).forEach((sub) => {
            const subKey = getFieldKey(sub);
            const subLabel = getLocalizedText(sub.label) || subKey;
            const subFieldId =
              typeof sub?.fieldId === 'string' ? sub.fieldId.trim() : '';
            const keyCandidates = Array.from(
              new Set([subKey, subFieldId].filter(Boolean))
            );

            if (isRequiredFlagEnabled(sub.isRequired)) {
              requiredSubKeySets.push(keyCandidates);
            }

            // Requiredness for subfields is enforced per filled row.
            itemShape[subKey] = createCustomFieldSchema(sub, subLabel, false);
          });

          // Keep the per-item shape but allow empty objects; when the group is marked required,
          // ensure at least one item has all required subfields filled.
          const perItemSchema = Yup.object()
            .shape(itemShape)
            .test(
              'repeatable-item-required-subfields',
              requiredMsg,
              function validateRepeatableItem(item) {
                const currentPath =
                  typeof this?.path === 'string' ? this.path : '';
                const rowIndexMatch = currentPath.match(/\[(\d+)\]$/);
                const rowIndex = rowIndexMatch ? Number(rowIndexMatch[1]) : -1;
                const externalRows = Array.isArray(repeatableGroups[fieldKey])
                  ? repeatableGroups[fieldKey]
                  : [];
                const externalItemRaw =
                  rowIndex >= 0 ? externalRows[rowIndex] : undefined;

                const normalizedItem =
                  item && typeof item === 'object' && !Array.isArray(item)
                    ? item
                    : {};
                const normalizedExternalItem =
                  externalItemRaw &&
                  typeof externalItemRaw === 'object' &&
                  !Array.isArray(externalItemRaw)
                    ? externalItemRaw
                    : {};
                const mergedItem = {
                  ...normalizedExternalItem,
                  ...normalizedItem,
                };

                if (!hasAnyFilledValue(mergedItem)) return true;
                if (requiredSubKeySets.length === 0) return true;

                return requiredSubKeySets.every((keySet) =>
                  keySet.some((key) => hasMeaningfulValue(mergedItem?.[key]))
                );
              }
            );

          let arrSchema = Yup.array().of(perItemSchema);

          const hasRequiredSubfields = requiredSubKeySets.length > 0;

          if (fieldIsRequired || hasRequiredSubfields) {
            arrSchema = arrSchema.test(
              'repeatable-required',
              requiredMsg,
              (arr) => {
                // Also check the local repeatableGroups state (where the inputs write their values)
                const external = repeatableGroups[fieldKey];
                const merged = mergeGroupRows(arr, external);

                const checkArray = (a) => {
                  if (!a || !Array.isArray(a) || a.length === 0) return false;

                  return a.some((item) => {
                    if (!hasAnyFilledValue(item)) return false;
                    if (requiredSubKeySets.length === 0) return true;

                    return requiredSubKeySets.every((keySet) =>
                      keySet.some((key) => {
                        const v =
                          item &&
                          Object.prototype.hasOwnProperty.call(item, key)
                            ? item[key]
                            : undefined;
                        return hasMeaningfulValue(v);
                      })
                    );
                  });
                };

                // If formik value passes, good
                if (checkArray(arr)) return true;

                // Otherwise, check the external repeatableGroups state
                if (checkArray(external)) return true;

                // Final fallback: check merged rows from both sources.
                if (checkArray(merged)) return true;

                return false;
              }
            );
          }

          customShape[fieldKey] = arrSchema;
          break;
        }

        case 'checkbox': {
          if (fieldIsRequired) {
            customShape[fieldKey] = Yup.boolean()
              .oneOf([true], requiredMsg)
              .required(requiredMsg);
          } else {
            customShape[fieldKey] = Yup.boolean();
          }
          break;
        }

        default: {
          // text, textarea, dropdown, radio, date, number, url, etc.
          customShape[fieldKey] = createCustomFieldSchema(
            field,
            fieldLabel,
            fieldIsRequired
          );
          break;
        }
      }
    });

    if (Object.keys(customShape).length > 0) {
      schema = schema.shape({
        customResponses: Yup.object().shape(customShape),
      });
    }

    return schema;
  };
  // --------------------------------------------------------------------------

  // --- Completely revamped handleFormSubmit with all new logic from first code ---
  const handleFormSubmit = async (values, { setSubmitting }) => {
    try {
      await createValidationSchema().validate(values, { abortEarly: false });
    } catch (validationError) {
      const firstIssue =
        Array.isArray(validationError?.inner) &&
        validationError.inner.length > 0
          ? validationError.inner.find((issue) => Boolean(issue?.message)) ||
            validationError.inner[0]
          : validationError;

      const firstErrorPath = firstIssue?.path || '';
      const firstErrorMessage =
        firstIssue?.message ||
        t('joinUs:validationError') ||
        'Please review the highlighted fields';
      const { label: firstErrorFieldLabel } =
        getFieldValidationDetails(firstErrorPath);
      const fixFieldTitlePrefix = getTranslatedOrFallback(
        'joinUs:fixFieldTitle',
        isArabic ? 'يرجى تصحيح هذا الحقل' : 'Please fix this field'
      );

      await Swal.fire({
        icon: 'warning',
        title: `${fixFieldTitlePrefix}: ${firstErrorFieldLabel}`,
        text: firstErrorMessage,
        confirmButtonText: t('common:ok') || 'OK',
        confirmButtonColor: '#f59e0b',
      });

      setSubmitting(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const applicantEmail = isBaseFieldVisible('email')
        ? (values.email || '').trim()
        : '';
      const applicantPhone = isBaseFieldVisible('phone')
        ? (values.phone || '').trim()
        : '';
      const rawCompanyId =
        jobPosition?.companyId?._id ||
        jobPosition?.companyId ||
        jobPosition?.company?._id ||
        jobPosition?.company ||
        company?._id ||
        '';
      const companyId =
        typeof rawCompanyId === 'string'
          ? rawCompanyId
          : rawCompanyId?._id || '';

      let hasPreviousApplication = false;
      if (applicantEmail || applicantPhone) {
        const existingApplicantResponse = await checkExistingApplicant({
          email: applicantEmail,
          companyId,
          phone: applicantPhone,
        });

        const existingApplicants = Array.isArray(
          existingApplicantResponse?.data
        )
          ? existingApplicantResponse.data
          : [];
        hasPreviousApplication =
          existingApplicants.length > 0 ||
          Number(existingApplicantResponse?.TotalCount || 0) > 0;
      }

      if (hasPreviousApplication) {
        const proceedResult = await Swal.fire({
          icon: 'warning',
          title: isArabic ? 'تم التقديم مسبقًا' : 'Previous Application Found',
          text: isArabic
            ? 'لقد قمت بالتقديم على هذه الشركة من قبل. هل تريد إكمال التقديم مرة أخرى؟'
            : 'You already applied for this company before. Do you want to proceed with this application?',
          showCancelButton: true,
          confirmButtonText:
            t('common:Yes') || (isArabic ? 'نعم، أكمل' : 'Yes, proceed'),
          cancelButtonText: t('common:No') || (isArabic ? 'لا' : 'No'),
          confirmButtonColor: '#f59e0b',
          cancelButtonColor: '#6b7280',
        });

        if (!proceedResult.isConfirmed) {
          return;
        }
      }

      const finalCustomResponses = { ...values.customResponses };

      // Always process declared group fields so none are missed due state-key drift.
      orderedCustomFields
        .filter(
          (field) =>
            field.inputType === 'groupField' ||
            field.inputType === 'repeatable_group'
        )
        .forEach((field) => {
          const fieldKey = getFieldKey(field);
          if (!fieldKey) return;

          const stateGroupsRaw = Array.isArray(repeatableGroups[fieldKey])
            ? repeatableGroups[fieldKey]
            : [];
          const formikValue = finalCustomResponses[fieldKey];

          if (field.inputType === 'groupField') {
            const formikGroup =
              formikValue &&
              typeof formikValue === 'object' &&
              !Array.isArray(formikValue)
                ? formikValue
                : null;
            const stateGroup = stateGroupsRaw[0] || null;
            const mergedGroup = formikGroup || stateGroup || {};

            finalCustomResponses[fieldKey] = hasAnyFilledValue(mergedGroup)
              ? mergedGroup
              : {};
            return;
          }

          const validFormikGroups = Array.isArray(formikValue)
            ? formikValue.filter((group) => hasAnyFilledValue(group))
            : [];
          const validStateGroups = stateGroupsRaw.filter((group) =>
            hasAnyFilledValue(group)
          );

          finalCustomResponses[fieldKey] =
            validFormikGroups.length > 0 ? validFormikGroups : validStateGroups;
        });

      // Upload files to Cloudinary first
      let profilePhotoUrl = '';
      let cvUrl = '';

      if (isBaseFieldVisible('profilePhoto') && values.profilePhotoFile) {
        Swal.fire({
          title: t('joinUs:uploadingPhoto') || 'Uploading photo...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
        profilePhotoUrl = await uploadToCloudinary(values.profilePhotoFile);
        Swal.close();
      }

      if (isBaseFieldVisible('cvFilePath') && values.cvFile) {
        Swal.fire({
          title: t('joinUs:uploadingCV') || 'Uploading CV...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
        cvUrl = await uploadToCloudinary(values.cvFile);
        Swal.close();
      }

      // Convert customResponses values to English labels (always send `en`)
      const englishCustomResponses = { ...finalCustomResponses };

      orderedCustomFields.forEach((field) => {
        const fieldKey = getFieldKey(field);
        if (
          !Object.prototype.hasOwnProperty.call(
            englishCustomResponses,
            fieldKey
          )
        )
          return;

        const normalizeValue = (val, def) => {
          if (val == null) return val;
          if (Array.isArray(val)) return val.map((v) => normalizeValue(v, def));
          if (typeof val === 'object') {
            // group object or nested values
            const out = {};
            Object.keys(val).forEach((k) => {
              const subDef =
                (def.groupFields || []).find((s) => getFieldKey(s) === k) || {};
              out[k] = normalizeValue(val[k], subDef);
            });
            return out;
          }

          // Primitive value (string/number/boolean)
          // If field defines choices, try to map selected label back to the English choice
          if (def && Array.isArray(def.choices) && def.choices.length > 0) {
            const match = def.choices.find((choice) => {
              const en = extractStringFromRich(
                typeof choice === 'object' ? choice.en || choice : choice
              );
              const ar = extractStringFromRich(
                typeof choice === 'object' ? choice.ar || choice : choice
              );
              return (
                String(en) === String(val) ||
                String(ar) === String(val) ||
                String(choice) === String(val)
              );
            });
            if (match) {
              return extractStringFromRich(
                typeof match === 'object' ? match.en || match : match
              );
            }
          }

          return val;
        };

        englishCustomResponses[fieldKey] = normalizeValue(
          englishCustomResponses[fieldKey],
          field
        );
      });

      // Remap keys (and nested subkeys) to English-based keys
      // Wrap each sent answer with its input `type` alongside the actual `answer` value.
      const remappedCustomResponses = {};
      orderedCustomFields.forEach((field) => {
        const locKey = getFieldKey(field);
        const enKey = getFieldKeyEn(field) || locKey;
        if (
          !Object.prototype.hasOwnProperty.call(englishCustomResponses, locKey)
        )
          return;

        const val = englishCustomResponses[locKey];

        const wrap = (inputType, value) => ({ type: inputType || 'text', answer: value });

        if (
          field.inputType === 'groupField' &&
          val &&
          typeof val === 'object' &&
          !Array.isArray(val)
        ) {
          const mapped = {};
          (field.groupFields || []).forEach((sub) => {
            const subLoc = getFieldKey(sub);
            const subEn = getFieldKeyEn(sub) || subLoc;
            if (Object.prototype.hasOwnProperty.call(val, subLoc))
              mapped[subEn] = wrap(sub.inputType, val[subLoc]);
          });
          remappedCustomResponses[enKey] = mapped;
          return;
        }

        if (field.inputType === 'repeatable_group' && Array.isArray(val)) {
          remappedCustomResponses[enKey] = val.map((item) => {
            if (!item || typeof item !== 'object') return wrap(field.inputType, item);
            const mappedItem = {};
            (field.groupFields || []).forEach((sub) => {
              const subLoc = getFieldKey(sub);
              const subEn = getFieldKeyEn(sub) || subLoc;
              if (Object.prototype.hasOwnProperty.call(item, subLoc))
                mappedItem[subEn] = wrap(sub.inputType, item[subLoc]);
            });
            return mappedItem;
          });
          return;
        }

        // Default: primitive or array of primitives — wrap with the field inputType
        remappedCustomResponses[enKey] = wrap(field.inputType, val);
      });

      // Include any leftover keys that weren't described in customFields as-is
      const locKeySet = new Set(orderedCustomFields.map((f) => getFieldKey(f)));
      Object.keys(englishCustomResponses).forEach((k) => {
        // skip keys that were local keys handled above
        if (locKeySet.has(k)) return;
        remappedCustomResponses[k] = englishCustomResponses[k];
      });

      // Use the base URL from env only
      // Send JSON payload with Cloudinary URLs
      // Convert jobSpecsResponses object (map) to array of { jobSpecId, answer }
      const jobSpecsResponsesArray = [];
      if (
        values.jobSpecsResponses &&
        typeof values.jobSpecsResponses === 'object'
      ) {
        Object.keys(values.jobSpecsResponses).forEach((key) => {
          const answer = !!values.jobSpecsResponses[key];

          // Default jobSpecId is the key; prefer resolving from jobPosition.jobSpecs
          let jobSpecId = key;
          let enLabel = '';

          // If key was the generated `spec_{index}`, try to pick by index first
          const match = key.match(/^spec_(\d+)$/);
          if (
            match &&
            jobPosition?.jobSpecs &&
            jobPosition.jobSpecs[parseInt(match[1], 10)]
          ) {
            const s = jobPosition.jobSpecs[parseInt(match[1], 10)];
            jobSpecId = typeof s === 'string' ? s : s._id || s.id || jobSpecId;
            if (typeof s === 'object') {
              enLabel = extractStringFromRich(
                s.spec?.en || s.en || s.label?.en || ''
              );
            }
          } else if (jobPosition?.jobSpecs) {
            // Find spec by id in the jobPosition.jobSpecs array and read its english label
            const found = jobPosition.jobSpecs.find((s) => {
              const sid = typeof s === 'string' ? s : s._id || s.id || '';
              return String(sid) === String(key);
            });
            if (found) {
              const s = found;
              jobSpecId =
                typeof s === 'string' ? s : s._id || s.id || jobSpecId;
              if (typeof s === 'object') {
                enLabel = extractStringFromRich(
                  s.spec?.en || s.en || s.label?.en || ''
                );
              }
            }
          }

          // Push only allowed fields (`jobSpecId` and `answer`) — server validation rejects extra `spec`
          jobSpecsResponsesArray.push({ jobSpecId, answer });
        });
      }

      const normalizeOptionalValue = (value) => {
        if (value === undefined || value === null) return undefined;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          return trimmed === '' ? undefined : trimmed;
        }
        return value;
      };

      const withVisibility = (fieldName, value) => {
        if (!isBaseFieldVisible(fieldName)) return undefined;
        return normalizeOptionalValue(value);
      };

      const payload = {
        jobPositionId: jobPosition._id,
        fullName: withVisibility('fullName', values.fullName),
        email: withVisibility('email', applicantEmail),
        phone: withVisibility('phone', applicantPhone),
        address: withVisibility('address', values.address),
        birthDate: withVisibility('birthDate', values.birthDate),
        gender: withVisibility('gender', values.gender),
        status: "pending",
        expectedSalary: withVisibility('expectedSalary', values.expectedSalary),
        profilePhoto: withVisibility('profilePhoto', profilePhotoUrl),
        cvFilePath: withVisibility('cvFilePath', cvUrl),
        customResponses: Object.keys(remappedCustomResponses || {}).length
          ? remappedCustomResponses
          : englishCustomResponses,
        jobSpecsResponses: jobSpecsResponsesArray,
      };

      const response = await submitApplicant(payload);

      await Swal.fire({
        icon: 'success',
        title:
          t('joinUs:applicationSubmitted') || t('joinUs:success') || 'Success!',
        text:
          t('joinUs:applicationSubmittedDesc') ||
          response?.data?.message ||
          'Application submitted successfully!',
        confirmButtonText: t('common:ok') || 'OK',
        confirmButtonColor: '#10b981',
      });

      navigate('/join-us');
    } catch (error) {
      console.debug('Error submitting application:', error);
      console.debug('Error response:', error.response?.data);
      const exactErrorMessage = getApiErrorMessage(
        error,
        t('joinUs:submissionError') || 'Failed to submit application'
      );

      const backendPayload = error?.response?.data;
      const backendFullError =
        typeof backendPayload === 'string' && backendPayload.trim()
          ? backendPayload
          : backendPayload !== undefined
            ? stringifyForDisplay(backendPayload)
            : exactErrorMessage;

      const useHtmlErrorBody =
        backendPayload !== undefined && typeof backendPayload !== 'string';

      Swal.close();
      await Swal.fire({
        icon: 'error',
        title: t('joinUs:error') || 'Error',
        text: useHtmlErrorBody ? undefined : backendFullError,
        html: useHtmlErrorBody
          ? `<pre style="max-height:260px;overflow:auto;background:#0f172a;color:#e2e8f0;padding:10px;border-radius:8px;text-align:${isArabic ? 'right' : 'left'};white-space:pre-wrap;word-break:break-word;">${escapeHtml(backendFullError)}</pre>`
          : undefined,
        confirmButtonText: t('common:ok') || 'OK',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setIsSubmitting(false);
      setSubmitting(false);
    }
  };
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <section className="py-20 md:py-32 min-h-screen flex items-center justify-center">
        <div className="text-center bg-white dark:bg-dark-900 p-8 rounded-2xl shadow-lg">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-light-200 border-t-primary-600 mx-auto"></div>
          <p className="mt-6 text-light-700 dark:text-light-300 font-semibold text-lg">
            {t('joinUs:loading') || 'Loading...'}
          </p>
        </div>
      </section>
    );
  }

  if (!jobPosition) {
    return (
      <section className="py-20 md:py-32 min-h-screen flex items-center justify-center">
        <div className="text-center bg-white dark:bg-dark-900 p-12 rounded-2xl shadow-lg max-w-md">
          <h2 className="text-3xl font-bold text-red-600 mb-3">
            {t('joinUs:jobNotFound') || 'Job Position Not Found'}
          </h2>
          <p className="text-light-600 dark:text-light-400 mb-6">
            {t('joinUs:jobNotFoundDesc') ||
              'The job position you are looking for does not exist.'}
          </p>
          <button onClick={() => navigate('/join-us')} className="btn-primary">
            {t('joinUs:backToJobs') || 'Back to Job Positions'}
          </button>
        </div>
      </section>
    );
  }

  if (
    !jobPosition.isActive ||
    new Date(jobPosition.registrationEnd) < new Date()
  ) {
    return (
      <section className="py-20 md:py-32 min-h-screen flex items-center justify-center">
        <div className="bg-white dark:bg-dark-900 p-12 rounded-2xl shadow-lg max-w-md text-center">
          <h2 className="text-3xl font-bold text-red-600 mb-4">
            {t('joinUs:applicationsClosed') || 'Applications Closed'}
          </h2>
          <p className="text-light-600 dark:text-light-400 text-lg">
            {!jobPosition.isActive
              ? t('joinUs:inactiveJob') || 'This position is no longer active.'
              : t('joinUs:registrationEnded') ||
                'Registration period has ended.'}
          </p>
        </div>
      </section>
    );
  }

  const initialValues = {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    gender: '',
    expectedSalary: '',
    profilePhotoFile: null,
    cvFile: null,
    agreedToTerms: false,
    customResponses:
      orderedCustomFields.reduce((acc, field) => {
        const fieldKey = getFieldKey(field);
        if (field.inputType === 'tags') {
          acc[fieldKey] = [];
        } else if (field.inputType === 'repeatable_group') {
          acc[fieldKey] = [];
        } else if (field.inputType === 'groupField') {
          acc[fieldKey] = {};
        } else {
          acc[fieldKey] = '';
        }
        return acc;
      }, {}) || {},
    jobSpecsResponses:
      jobPosition?.jobSpecs?.reduce((acc, spec, idx) => {
        const id = (spec && (spec._id || spec.id)) || `spec_${idx}`;
        acc[id] = false;
        return acc;
      }, {}) || {},
  };

  const pageUrl = getFullUrl(`/join-us/${slug}`);
  const ogImage = getDefaultOgImage();
  const jobTitle = jobPosition
    ? jobPosition.title || jobPosition.name
    : 'Position';

  return (
    <>
      <Helmet>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap"
        />
        <title>
          {jobPosition
            ? `${t('joinUs:applicationForm') || 'Apply'} • ${jobTitle} - ${SITE_NAME}`
            : `${t('joinUs:applicationForm') || 'Job Application'} - ${SITE_NAME}`}
        </title>
        <meta
          name="description"
          content={
            jobPosition
              ? t('joinUs:subtitle') ||
                `Apply for the position of ${jobTitle} at ${SITE_NAME}.`
              : t('joinUs:applicationForm') ||
                `Submit your job application to join the ${SITE_NAME} team.`
          }
        />

        {/* Open Graph / Facebook / WhatsApp */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:url" content={pageUrl} />
        <meta
          property="og:title"
          content={
            jobPosition
              ? `${t('joinUs:applicationForm') || 'Apply'} • ${jobTitle} - ${SITE_NAME}`
              : `${t('joinUs:applicationForm') || 'Job Application'} - ${SITE_NAME}`
          }
        />
        <meta
          property="og:description"
          content={
            jobPosition
              ? t('joinUs:subtitle') ||
                `Join ${SITE_NAME} as ${jobTitle}. Apply now!`
              : t('joinUs:applicationForm') ||
                `Submit your job application to join the ${SITE_NAME} team.`
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
              content={`Apply for ${jobTitle} at ${SITE_NAME}`}
            />
          </>
        )}

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content={
            jobPosition
              ? `${t('joinUs:applicationForm') || 'Apply'} • ${jobTitle} - ${SITE_NAME}`
              : `${t('joinUs:applicationForm') || 'Job Application'} - ${SITE_NAME}`
          }
        />
        <meta
          name="twitter:description"
          content={
            jobPosition
              ? t('joinUs:subtitle') ||
                `Join ${SITE_NAME} as ${jobTitle}. Apply now!`
              : t('joinUs:applicationForm') ||
                `Submit your job application to join the ${SITE_NAME} team.`
          }
        />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>
      <section
        style={{ fontFamily: "'Cairo', sans-serif" }}
        className="py-20 md:py-32 relative overflow-hidden min-h-screen"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container relative mx-auto px-4 md:px-6 max-w-4xl">
          {/* Back Button */}
          <button
            onClick={() => navigate('/join-us')}
            className="mb-8 flex items-center gap-2 text-white bg-primary-500 hover:bg-primary-600 px-4 py-2 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span className="font-semibold">
              {t('joinUs:backToJobs') || 'Back to Job Positions'}
            </span>
          </button>

          {/* Job Header Card */}
          <div className="glass rounded-2xl p-8 mb-8 text-center">
            <img
              src={valoraLogo}
              alt={`${SITE_NAME} Logo`}
              className="w-48 mx-auto mb-6"
            />
            {/* Company description (localized) and contact email below the logo */}
            {(() => {
              const companyDesc = getLocalizedText(
                jobPosition.companyId?.description ||
                  jobPosition.company?.description ||
                  company?.description
              );
              const contactEmail =
                jobPosition.companyId?.contactEmail ||
                jobPosition.companyId?.email ||
                company?.contactEmail ||
                company?.email ||
                jobPosition.company?.contactEmail ||
                jobPosition.company?.email ||
                '';
              return (
                <div className="mb-4 text-center max-w-xl mx-auto">
                  {companyDesc ? (
                    <p className="text-lg text-light-600 dark:text-light-300 mb-2">
                      {companyDesc}
                    </p>
                  ) : null}
                  {contactEmail ? (
                    <div>
                      <a
                        href={`mailto:${contactEmail}`}
                        className="text-sm text-primary-500 font-semibold block"
                      >
                        {contactEmail}
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            <h1 className="text-4xl font-bold text-primary-500 mb-4">
              {getLocalizedText(jobPosition.title)}
            </h1>
            <p className="text-light-600 dark:text-light-400 mb-3">
              {getLocalizedText(jobPosition.companyId?.name)} •{' '}
              {getLocalizedText(jobPosition.departmentId?.name) || ''}
            </p>
            {(jobPosition.employmentType || jobPosition.workArrangement) && (
              <div
                className={`flex items-center justify-center gap-3 mb-3 ${isArabic ? 'flex-row-reverse' : ''}`}
              >
                {jobPosition.employmentType && (
                  <span className="px-3 py-1 rounded-full bg-light-50 dark:bg-dark-800 text-sm font-medium text-light-700 dark:text-light-300">
                    {mapEmploymentType(jobPosition.employmentType)}
                  </span>
                )}

                {jobPosition.workArrangement && (
                  <span className="px-3 py-1 rounded-full bg-light-50 dark:bg-dark-800 text-sm font-medium text-light-700 dark:text-light-300">
                    {mapWorkArrangement(jobPosition.workArrangement)}
                  </span>
                )}
              </div>
            )}
            {jobPosition.salaryVisible && jobPosition.salary && (
              <p className="text-success-600 font-semibold mb-3">
                {t('joinUs:salary') || 'Salary'}:{' '}
                {jobPosition.salary.toLocaleString()} {t('joinUs:egp') || 'EGP'}
              </p>
            )}
            <div className="flex items-center justify-center gap-4 flex-wrap text-sm text-light-600 dark:text-light-400">
              <span>
                {t('joinUs:deadline') || 'Apply before'}:{' '}
                {formatDate(jobPosition.registrationEnd)}
              </span>
              <span>•</span>
              <span>
                {jobPosition.openPositions} {t('joinUs:openings') || 'openings'}
              </span>
            </div>
            {Object.keys(acceptedTerms).length > 0 &&
              Object.values(acceptedTerms).every(Boolean) && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-500/10 border border-success-500 text-success-600 text-sm font-semibold mx-auto">
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>{t('joinUs:termsApproved') || 'Terms approved'}</span>
                </div>
              )}
          </div>

          {/* Job Description */}
          {jobPosition.description &&
            Object.keys(jobPosition.description).length > 0 && (
              <div className="mb-6 p-6 glass rounded-xl border-l-4 border-primary-600">
                <h3 className="font-bold text-lg text-light-800 dark:text-white mb-3">
                  {t('joinUs:jobDescription') || 'Job Description'}
                </h3>
                <p className="text-light-600 dark:text-light-300 leading-relaxed">
                  {getLocalizedText(jobPosition.description)}
                </p>
              </div>
            )}

          <Formik
            initialValues={initialValues}
            validationSchema={createValidationSchema()}
            onSubmit={handleFormSubmit}
          >
            {(formikProps) => {
              const {
                values,
                errors,
                touched,
                setFieldValue,
                isSubmitting: formikIsSubmitting,
                setTouched,
                validateForm,
                submitForm,
                submitCount,
              } = formikProps;
              const cvFullFileName =
                typeof values.cvFile?.name === 'string'
                  ? values.cvFile.name.trim()
                  : '';
              const cvDisplayFileName = getDisplayFileName(values.cvFile);

              const handleSubmitWithScroll = async (e) => {
                if (e && e.preventDefault) e.preventDefault();
                const formErrors = await validateForm();
                if (Object.keys(formErrors).length > 0) {
                  scrollToFirstError(formErrors);

                  // derive first error message (handle nested customResponses)
                  const firstErrorMessage =
                    getFirstErrorText(formErrors) ||
                    t('joinUs:validationError') ||
                    'Please review the highlighted fields';
                  const firstErrorPath = getFirstErrorPath(formErrors);
                  const { label: firstErrorFieldLabel } =
                    getFieldValidationDetails(firstErrorPath);

                  const customFieldKey =
                    getCustomFieldKeyFromPath(firstErrorPath);
                  const customFieldDefinition = orderedCustomFields.find(
                    (field) => getFieldKey(field) === customFieldKey
                  );
                  const isGroupTypeField =
                    customFieldDefinition?.inputType === 'groupField' ||
                    customFieldDefinition?.inputType === 'repeatable_group';

                  if (isGroupTypeField && customFieldKey) {
                    const firstSubField =
                      customFieldDefinition?.groupFields?.[0];
                    const firstSubKey = getFieldKey(firstSubField);

                    if (
                      customFieldDefinition.inputType === 'repeatable_group'
                    ) {
                      const existingFormikRows = Array.isArray(
                        values.customResponses?.[customFieldKey]
                      )
                        ? values.customResponses[customFieldKey]
                        : [];
                      const existingUiRows = Array.isArray(
                        repeatableGroups[customFieldKey]
                      )
                        ? repeatableGroups[customFieldKey]
                        : [];
                      const rowsToUse =
                        existingFormikRows.length > 0
                          ? existingFormikRows
                          : existingUiRows.length > 0
                            ? existingUiRows
                            : [{}];

                      if (existingFormikRows.length === 0) {
                        setFieldValue(
                          `customResponses.${customFieldKey}`,
                          rowsToUse
                        );
                      }

                      if (existingUiRows.length === 0) {
                        setRepeatableGroups((prev) => ({
                          ...prev,
                          [customFieldKey]: rowsToUse,
                        }));
                      }

                      if (firstSubKey) {
                        setTimeout(() => {
                          const firstQuestion = document.querySelector(
                            `[name="customResponses.${customFieldKey}.0.${firstSubKey}"]`
                          );
                          firstQuestion?.focus?.();
                        }, 80);
                      }
                    } else {
                      const existingFormikGroup =
                        values.customResponses?.[customFieldKey];
                      const normalizedFormikGroup =
                        existingFormikGroup &&
                        typeof existingFormikGroup === 'object' &&
                        !Array.isArray(existingFormikGroup)
                          ? existingFormikGroup
                          : {};

                      setFieldValue(
                        `customResponses.${customFieldKey}`,
                        normalizedFormikGroup
                      );
                      setRepeatableGroups((prev) => {
                        const existingRows = Array.isArray(prev[customFieldKey])
                          ? prev[customFieldKey]
                          : [];
                        return {
                          ...prev,
                          [customFieldKey]: [
                            existingRows[0] || normalizedFormikGroup || {},
                          ],
                        };
                      });

                      if (firstSubKey) {
                        setTimeout(() => {
                          const firstQuestion = document.querySelector(
                            `[name="customResponses.${customFieldKey}.${firstSubKey}"]`
                          );
                          firstQuestion?.focus?.();
                        }, 80);
                      }
                    }
                  }

                  let swalIssueText = firstErrorMessage;
                  if (isRequiredValidationMessage(firstErrorMessage)) {
                    if (isGroupTypeField) {
                      swalIssueText = getTranslatedOrFallback(
                        'joinUs:atLeastOneGroupEntryRequired',
                        `Please add at least one entry in ${firstErrorFieldLabel} and complete the required questions.`
                      );
                    } else {
                      swalIssueText = getTranslatedOrFallback(
                        'joinUs:requiredFieldEmptyAlert',
                        `You cannot leave ${firstErrorFieldLabel} empty.`
                      );
                    }
                  }

                  // mark touched for all error fields so validation messages appear
                  const allTouched = {};
                  const markTouched = (obj, prefix = '') => {
                    Object.keys(obj || {}).forEach((k) => {
                      const path = prefix ? `${prefix}.${k}` : k;
                      allTouched[path] = true;
                      if (typeof obj[k] === 'object' && !Array.isArray(obj[k]))
                        markTouched(obj[k], path);
                    });
                  };
                  markTouched(formErrors);
                  setTouched(allTouched, false);

                  setTimeout(() => {
                    const fixFieldTitlePrefix = getTranslatedOrFallback(
                      'joinUs:fixFieldTitle',
                      isArabic
                        ? 'يرجى تصحيح هذا الحقل'
                        : 'Please fix this field'
                    );

                    Swal.fire({
                      icon: 'warning',
                      title: `${fixFieldTitlePrefix}: ${firstErrorFieldLabel}`,
                      text: swalIssueText,
                      confirmButtonText: t('common:ok') || 'OK',
                      confirmButtonColor: '#f59e0b',
                    });
                  }, 300);
                  return;
                }

                await submitForm();
              };

              return (
                <Form
                  className="glass rounded-2xl p-8"
                  onSubmit={handleSubmitWithScroll}
                  noValidate
                >
                  <h2 className="text-2xl font-bold text-light-900 dark:text-white mb-6">
                    {t('joinUs:applicationForm') || 'Application Form'}
                  </h2>

                  {/* Job Specifications (inside Form so Formik context is available) */}
                  {jobPosition.jobSpecs && jobPosition.jobSpecs.length > 0 && (
                    <div className="mb-6 p-6 bg-light-50 dark:bg-dark-800 rounded-xl border-2 border-light-200 dark:border-dark-600">
                      <h3 className="font-bold text-lg text-light-800 dark:text-white mb-4">
                        {t('joinUs:jobSpecs') || 'Job Specifications'}
                      </h3>
                      <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                        {jobPosition.jobSpecs.map((spec, i) => {
                          const specId =
                            (spec && (spec._id || spec.id)) || `spec_${i}`;
                          return (
                            <div
                              key={specId}
                              className="flex items-start gap-2"
                            >
                              <span className="shrink-0 w-5 h-5 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                                {i + 1}
                              </span>
                              <label className="flex items-center justify-between w-full gap-3 cursor-pointer">
                                <span
                                  className={`flex-1 text-sm text-light-700 dark:text-light-300 ${isArabic ? 'text-right' : 'text-left'}`}
                                >
                                  {getLocalizedText(spec.spec || spec)}
                                </span>
                                <div className="flex items-center ml-4">
                                  <Field
                                    type="checkbox"
                                    name={`jobSpecsResponses.${specId}`}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-7 rounded-lg bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 peer-checked:bg-primary-500 peer-focus:ring-4 peer-focus:ring-primary-500/30 transition-all duration-300 flex items-center justify-center peer-checked:[&>svg]:scale-100 shadow-md">
                                    <svg
                                      className="w-4 h-4 text-white scale-0 transition-transform duration-200"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  </div>
                                </div>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Profile Photo Upload - Circular */}
                  {isBaseFieldVisible('profilePhoto') && (
                    <div className="flex justify-center mb-8">
                      <input
                        type="file"
                        id="profile-photo-upload"
                        name="profilePhotoFile"
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        hidden
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const selectedFile = e.target.files[0];
                            if (isAllowedProfilePhotoFile(selectedFile)) {
                              setFieldValue('profilePhotoFile', selectedFile);
                            } else {
                              setFieldValue('profilePhotoFile', null);
                              e.target.value = '';
                              Swal.fire({
                                icon: 'warning',
                                title: t('joinUs:photo') || 'Profile Photo',
                                text:
                                  t('joinUs:invalidPhotoType') ||
                                  'Only JPG, JPEG, and PNG files are allowed',
                                confirmButtonText: t('common:ok') || 'OK',
                                confirmButtonColor: '#f59e0b',
                              });
                            }
                          }
                        }}
                      />
                      <label
                        htmlFor="profile-photo-upload"
                        className="cursor-pointer group"
                      >
                        <div className="relative w-28 h-28">
                          {values.profilePhotoFile ? (
                            <div className="w-28 h-28 rounded-full overflow-hidden shadow-xl group-hover:shadow-2xl transition-all">
                              <img
                                src={URL.createObjectURL(
                                  values.profilePhotoFile
                                )}
                                alt="Profile"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-28 h-28 rounded-full bg-primary-50 border-4 border-dashed border-primary-400 flex items-center justify-center group-hover:border-primary-600 group-hover:shadow-xl transition-all">
                              <div className="text-center">
                                <svg
                                  className="w-12 h-12 text-primary-600 mx-auto group-hover:scale-110 transition-transform"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <div className="absolute bottom-2 right-2 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                  <svg
                                    className="w-4 h-4 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-center mt-3 text-light-700 dark:text-light-300 group-hover:text-primary-600 font-semibold transition-colors">
                          {values.profilePhotoFile
                            ? t('joinUs:changePhoto') || 'Change Photo'
                            : t('joinUs:uploadPhoto') || 'Upload Photo'}
                          {isBaseFieldRequired('profilePhoto') && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </p>

                        {errors.profilePhotoFile &&
                          touched.profilePhotoFile && (
                            <p
                              id="profile-photo-error"
                              className="mt-2 text-sm text-red-500 text-center"
                            >
                              {errors.profilePhotoFile}
                            </p>
                          )}
                      </label>
                    </div>
                  )}

                  {/* Personal Information Section */}
                  <div className="md:col-span-2 mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-gradient-to-r from-primary-500/20 via-primary-500/40 to-primary-500/20"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white dark:bg-dark-900 px-6 py-2 rounded-full border-2 border-primary-500/30">
                          <h3 className="text-xl font-bold text-primary-500">
                            {t('joinUs:personalInfo') || 'Personal Information'}
                          </h3>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* Full Name */}
                    {isBaseFieldVisible('fullName') && (
                      <div className="md:col-span-2 group">
                        <label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
                          <div className="flex items-center gap-2">
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
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            {t('joinUs:fullName') || 'Full Name'}{' '}
                            {isBaseFieldRequired('fullName') && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </div>
                        </label>
                        <Field
                          name="fullName"
                          type="text"
                          placeholder={t('joinUs:fullName') || 'Full Name'}
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200"
                        />
                        {errors.fullName && touched.fullName && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.fullName}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Email */}
                    {isBaseFieldVisible('email') && (
                      <div className="group">
                        <label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
                          <div className="flex items-center gap-2">
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
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                            {t('joinUs:email') || 'Email'}{' '}
                            {isBaseFieldRequired('email') && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </div>
                        </label>
                        <Field
                          name="email"
                          type="email"
                          placeholder={t('joinUs:email') || 'Email'}
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200"
                        />
                        {errors.email && touched.email && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Phone */}
                    {isBaseFieldVisible('phone') && (
                      <div className="group">
                        <label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
                          <div className="flex items-center gap-2">
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
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              />
                            </svg>
                            {t('joinUs:phone') || 'Phone'}{' '}
                            {isBaseFieldRequired('phone') && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </div>
                        </label>
                        <Field
                          name="phone"
                          type="tel"
                          inputMode="numeric"
                          pattern="01[0125]\d{8}"
                          minLength={11}
                          maxLength={11}
                          placeholder={t('joinUs:phone') || 'Phone'}
                          onChange={(e) => {
                            const digitsOnly = e.target.value
                              .replace(/\D+/g, '')
                              .slice(0, 11);
                            setFieldValue('phone', digitsOnly);
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const paste =
                              (e.clipboardData || window.clipboardData).getData(
                                'text'
                              ) || '';
                            const digitsOnly = paste
                              .replace(/\D+/g, '')
                              .slice(0, 11);
                            setFieldValue('phone', digitsOnly);
                          }}
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200"
                        />
                        {errors.phone && touched.phone && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.phone}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Expected Salary (visible only if backend enables salaryFieldVisible) */}
                    {isBaseFieldVisible('expectedSalary') && (
                      <div className="group">
                        <label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
                          <div className="flex items-center gap-2">
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
                                d="M12 8c-3 0-5 2-5 5v3h10v-3c0-3-2-5-5-5z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 2v4"
                              />
                            </svg>
                            {t('joinUs:expectedSalary') || 'Expected Salary'}{' '}
                            {isBaseFieldRequired('expectedSalary') && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </div>
                        </label>
                        <input
                          name="expectedSalary"
                          inputMode="numeric"
                          pattern="\d*"
                          type="text"
                          value={values.expectedSalary ?? ''}
                          placeholder={
                            t('joinUs:expectedSalaryPlaceholder') ||
                            t('joinUs:expectedSalary') ||
                            'Expected Salary'
                          }
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D+/g, '');
                            setFieldValue('expectedSalary', digits);
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const paste =
                              (e.clipboardData || window.clipboardData).getData(
                                'text'
                              ) || '';
                            const digits = paste.replace(/\D+/g, '');
                            setFieldValue('expectedSalary', digits);
                          }}
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200"
                        />
                        {errors.expectedSalary && touched.expectedSalary && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.expectedSalary}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Address */}
                    {isBaseFieldVisible('address') && (
                      <div className="md:col-span-2 group">
                        <label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
                          <div className="flex items-center gap-2">
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
                            {t('joinUs:address') || 'Address'}{' '}
                            {isBaseFieldRequired('address') && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </div>
                        </label>
                        <Field
                          as="textarea"
                          name="address"
                          rows={3}
                          placeholder={t('joinUs:address') || 'Address'}
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200 resize-y"
                        />
                        {errors.address && touched.address && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.address}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Birth Date */}
                    {isBaseFieldVisible('birthDate') && (
                      <div className="group">
                        <label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
                          <div className="flex items-center gap-2">
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
                                d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            {t('joinUs:dateOfBirth') || 'Birth Date'}{' '}
                            {isBaseFieldRequired('birthDate') && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </div>
                        </label>
                        <Field
                          name="birthDate"
                          type="date"
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200"
                        />
                        <p className="text-xs text-light-500 dark:text-light-400 mt-1">
                          {isArabic ? 'dd/mm/yyyy' : 'mm/dd/yyyy'}
                        </p>
                        {errors.birthDate && touched.birthDate && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.birthDate}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Gender */}
                    {isBaseFieldVisible('gender') && (
                      <div className="group">
                        <label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
                          <div className="flex items-center gap-2">
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
                                d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zM6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"
                              />
                            </svg>
                            {t('joinUs:gender') || 'Gender'}{' '}
                            {isBaseFieldRequired('gender') && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </div>
                        </label>
                        <Field
                          as="select"
                          name="gender"
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200 cursor-pointer"
                        >
                          <option value="">Please Select</option>
                          <option value="Male">
                            {t('joinUs:male') || 'Male'}
                          </option>
                          <option value="Female">
                            {t('joinUs:female') || 'Female'}
                          </option>
                        </Field>
                        {errors.gender && touched.gender && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.gender}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CV Upload - Circular */}
                  {isBaseFieldVisible('cvFilePath') && (
                    <div className="flex justify-center mb-8">
                      <input
                        type="file"
                        id="cv-upload"
                        accept=".pdf,application/pdf"
                        hidden
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const selectedFile = e.target.files[0];
                            if (!isAllowedCvFile(selectedFile)) {
                              setFieldValue('cvFile', null);
                              e.target.value = '';
                              Swal.fire({
                                icon: 'warning',
                                title: t('joinUs:uploadCV') || 'CV',
                                text:
                                  t('joinUs:invalidCVType') ||
                                  'Only PDF files are allowed',
                                confirmButtonText: t('common:ok') || 'OK',
                                confirmButtonColor: '#f59e0b',
                              });
                              return;
                            }

                            if (
                              !isFileWithinSizeLimit(
                                selectedFile,
                                maxCvFileSizeInBytes
                              )
                            ) {
                              setFieldValue('cvFile', null);
                              e.target.value = '';
                              Swal.fire({
                                icon: 'warning',
                                title: t('joinUs:uploadCV') || 'CV',
                                text:
                                  t('joinUs:cvTooLarge') ||
                                  'CV file size must be 10 MB or less',
                                confirmButtonText: t('common:ok') || 'OK',
                                confirmButtonColor: '#f59e0b',
                              });
                              return;
                            }

                            setFieldValue('cvFile', selectedFile);
                          }
                        }}
                      />
                      <label
                        htmlFor="cv-upload"
                        className="cursor-pointer group"
                      >
                        <div className="relative w-28 h-28">
                          {values.cvFile ? (
                            <div className="w-28 h-28 rounded-full shadow-xl group-hover:shadow-2xl transition-all bg-success-50 flex flex-col items-center justify-center p-2">
                              <svg
                                className="w-10 h-10 text-success-600"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <p
                                className="text-xs text-success-700 font-semibold mt-1 text-center wrap-break w-full px-1"
                                title={
                                  cvFullFileName || t('joinUs:uploadCV') || 'CV'
                                }
                              >
                                {cvDisplayFileName ||
                                  t('joinUs:uploadCV') ||
                                  'CV'}
                              </p>
                            </div>
                          ) : (
                            <div className="w-28 h-28 rounded-full bg-secondary-50 border-4 border-dashed border-secondary-400 flex items-center justify-center group-hover:border-secondary-600 group-hover:shadow-xl transition-all">
                              <div className="text-center">
                                <svg
                                  className="w-12 h-12 text-secondary-600 mx-auto group-hover:scale-110 transition-transform"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <div className="absolute bottom-2 right-2 w-8 h-8 bg-secondary-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                  <svg
                                    className="w-4 h-4 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-center mt-3 text-light-700 dark:text-light-300 group-hover:text-secondary-600 font-semibold transition-colors">
                          {values.cvFile ? (
                            t('joinUs:changeCV') || 'Change CV'
                          ) : (
                            <>
                              {t('joinUs:uploadCV') || 'Upload CV'}{' '}
                              {isBaseFieldRequired('cvFilePath') ? (
                                <span className="text-red-500 ml-1">*</span>
                              ) : (
                                <span className="text-xs text-light-500 dark:text-light-400">
                                  (
                                  {t('joinUs:optional') ||
                                    (isArabic ? 'اختياري' : 'Optional')}
                                  )
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      </label>
                    </div>
                  )}

                  {/* Dynamic Custom Fields */}
                  {orderedCustomFields.length > 0 && (
                    <>
                      <div className="md:col-span-2 mb-6">
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t-2 border-gradient-to-r from-primary-500/20 via-primary-500/40 to-primary-500/20"></div>
                          </div>
                          <div className="relative flex justify-center">
                            <span className="bg-white dark:bg-dark-900 px-6 py-2 rounded-full border-2 border-primary-500/30">
                              <h3 className="text-xl font-bold text-primary-500">
                                {t('joinUs:additionalInfo') ||
                                  'Additional Information'}
                              </h3>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-6 mb-8">
                        {orderedCustomFields.map((field) => {
                          const fieldKey = getFieldKey(field);
                          const fieldName = `customResponses.${fieldKey}`;

                          if (
                            (field.inputType === 'groupField' ||
                              field.inputType === 'repeatable_group') &&
                            field.groupFields
                          ) {
                            const isSingleGroupField =
                              field.inputType === 'groupField';
                            const stateGroups = Array.isArray(
                              repeatableGroups[fieldKey]
                            )
                              ? repeatableGroups[fieldKey]
                              : [];
                            const formikGroups = Array.isArray(
                              values.customResponses?.[fieldKey]
                            )
                              ? values.customResponses[fieldKey]
                              : [];
                            const rawGroups =
                              formikGroups.length > 0
                                ? formikGroups
                                : stateGroups.length > 0
                                  ? stateGroups
                                  : [{}];
                            const groupsToRender = isSingleGroupField
                              ? [rawGroups[0] || {}]
                              : rawGroups;
                            const groupFieldErrorText = getFirstErrorText(
                              errors.customResponses?.[fieldKey]
                            );

                            return (
                              <div key={fieldKey} className="w-full">
                                <div className="p-6 rounded-2xl bg-primary-500/5 border-2 border-primary-500/20">
                                  <h4 className="text-lg font-bold text-light-900 dark:text-white mb-4 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-primary-500 rounded-full"></div>
                                    {getLocalizedText(field.label)}
                                    {isRequiredFlagEnabled(
                                      field.isRequired
                                    ) && (
                                      <span className="text-red-500 ml-1">
                                        *
                                      </span>
                                    )}
                                  </h4>

                                  {groupsToRender.map((group, groupIndex) => (
                                    <div
                                      key={groupIndex}
                                      className="mb-4 p-4 bg-white dark:bg-dark-800 rounded-xl border border-light-200 dark:border-dark-600"
                                    >
                                      <div className="grid grid-cols-1 gap-4 mb-3">
                                        {field.groupFields.map((subField) => {
                                          const subFieldKey =
                                            getFieldKey(subField);
                                          const subFieldName =
                                            isSingleGroupField
                                              ? `customResponses.${fieldKey}.${subFieldKey}`
                                              : `customResponses.${fieldKey}.${groupIndex}.${subFieldKey}`;
                                          const rawSubFieldValue =
                                            group?.[subFieldKey];
                                          const stringSubFieldValue =
                                            rawSubFieldValue === undefined ||
                                            rawSubFieldValue === null
                                              ? ''
                                              : String(rawSubFieldValue);
                                          const updateGroupSubFieldValue = (
                                            nextValue
                                          ) => {
                                            // Update Formik at the exact nested path to avoid stale array snapshots.
                                            setFieldValue(
                                              subFieldName,
                                              nextValue
                                            );

                                            // Keep local group state in sync for UI/payload fallback logic.
                                            setRepeatableGroups((prev) => {
                                              const existingRows =
                                                Array.isArray(prev[fieldKey])
                                                  ? [...prev[fieldKey]]
                                                  : [];

                                              if (!existingRows[groupIndex])
                                                existingRows[groupIndex] = {};

                                              existingRows[groupIndex] = {
                                                ...existingRows[groupIndex],
                                                [subFieldKey]: nextValue,
                                              };

                                              return {
                                                ...prev,
                                                [fieldKey]: existingRows,
                                              };
                                            });
                                          };

                                          return (
                                            <div key={subFieldKey}>
                                              <label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
                                                {getLocalizedText(
                                                  subField.label
                                                )}
                                                {isRequiredFlagEnabled(
                                                  subField.isRequired
                                                ) && (
                                                  <span className="text-red-500 ml-1">
                                                    *
                                                  </span>
                                                )}
                                              </label>
                                              {subField.inputType ===
                                              'textarea' ? (
                                                <textarea
                                                  name={subFieldName}
                                                  rows={3}
                                                  value={stringSubFieldValue}
                                                  onChange={(e) =>
                                                    updateGroupSubFieldValue(
                                                      e.target.value
                                                    )
                                                  }
                                                  required={isRequiredFlagEnabled(
                                                    subField.isRequired
                                                  )}
                                                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200 resize-y"
                                                />
                                              ) : (subField.inputType ===
                                                  'dropdown' ||
                                                  subField.inputType ===
                                                    'select' ||
                                                  subField.inputType ===
                                                    'radio') &&
                                                Array.isArray(
                                                  subField.choices
                                                ) &&
                                                subField.choices.length > 0 ? (
                                                <select
                                                  name={subFieldName}
                                                  value={stringSubFieldValue}
                                                  onChange={(e) =>
                                                    updateGroupSubFieldValue(
                                                      e.target.value
                                                    )
                                                  }
                                                  required={isRequiredFlagEnabled(
                                                    subField.isRequired
                                                  )}
                                                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200 cursor-pointer"
                                                >
                                                  <option value="">
                                                    {t('joinUs:selectOption') ||
                                                      'Please Select'}
                                                  </option>
                                                  {subField.choices.map(
                                                    (choice, choiceIndex) => (
                                                      <option
                                                        key={
                                                          choice._id ||
                                                          choiceIndex
                                                        }
                                                        value={getLocalizedText(
                                                          choice
                                                        )}
                                                      >
                                                        {getLocalizedText(
                                                          choice
                                                        )}
                                                      </option>
                                                    )
                                                  )}
                                                </select>
                                              ) : subField.inputType ===
                                                'checkbox' ? (
                                                <label className="inline-flex items-center gap-3">
                                                  <input
                                                    name={subFieldName}
                                                    type="checkbox"
                                                    checked={Boolean(
                                                      rawSubFieldValue
                                                    )}
                                                    onChange={(e) =>
                                                      updateGroupSubFieldValue(
                                                        e.target.checked
                                                      )
                                                    }
                                                    required={isRequiredFlagEnabled(
                                                      subField.isRequired
                                                    )}
                                                    className="h-5 w-5 rounded border-light-300 text-primary-500 focus:ring-primary-500"
                                                  />
                                                  <span className="text-sm text-light-700 dark:text-light-300">
                                                    {getLocalizedText(
                                                      subField.label
                                                    )}
                                                  </span>
                                                </label>
                                              ) : (
                                                <input
                                                  name={subFieldName}
                                                  type={
                                                    [
                                                      'date',
                                                      'email',
                                                      'number',
                                                      'url',
                                                      'tel',
                                                    ].includes(
                                                      subField.inputType
                                                    )
                                                      ? subField.inputType
                                                      : 'text'
                                                  }
                                                  value={stringSubFieldValue}
                                                  onChange={(e) =>
                                                    updateGroupSubFieldValue(
                                                      e.target.value
                                                    )
                                                  }
                                                  required={isRequiredFlagEnabled(
                                                    subField.isRequired
                                                  )}
                                                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200"
                                                />
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {!isSingleGroupField &&
                                        groupsToRender.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updatedGroups =
                                                groupsToRender.filter(
                                                  (_, i) => i !== groupIndex
                                                );
                                              setRepeatableGroups((prev) => ({
                                                ...prev,
                                                [fieldKey]: updatedGroups,
                                              }));
                                              setFieldValue(
                                                fieldName,
                                                updatedGroups
                                              );
                                            }}
                                            className="text-red-500 hover:text-red-600 text-sm font-semibold flex items-center gap-1"
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
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                              />
                                            </svg>
                                            {t('joinUs:remove') || 'Remove'}
                                          </button>
                                        )}
                                    </div>
                                  ))}

                                  {!isSingleGroupField && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedGroups = [
                                          ...groupsToRender,
                                          {},
                                        ];
                                        setRepeatableGroups((prev) => ({
                                          ...prev,
                                          [fieldKey]: updatedGroups,
                                        }));
                                        setFieldValue(fieldName, updatedGroups);
                                      }}
                                      className="mt-3 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
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
                                          d="M12 4v16m8-8H4"
                                        />
                                      </svg>
                                      {t('joinUs:addMore') || 'Add More'}
                                    </button>
                                  )}

                                  {groupFieldErrorText &&
                                    (touched.customResponses?.[fieldKey] ||
                                      submitCount > 0) && (
                                      <p className="mt-2 text-sm text-red-500">
                                        {groupFieldErrorText}
                                      </p>
                                    )}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={fieldKey}>
                              <label className="block text-sm font-semibold text-light-900 dark:text-white mb-2">
                                {getLocalizedText(field.label)}
                                {isRequiredFlagEnabled(field.isRequired) && (
                                  <span className="text-red-500 ml-1">*</span>
                                )}
                              </label>

                              {[
                                'text',
                                'email',
                                'number',
                                'date',
                                'url',
                                'tel',
                                'time',
                                'datetime-local',
                                'month',
                                'password',
                              ].includes(field.inputType) && (
                                <>
                                  <Field
                                    name={fieldName}
                                    type={field.inputType}
                                    placeholder={getLocalizedText(field.label)}
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200"
                                  />
                                  {errors.customResponses?.[fieldKey] &&
                                    touched.customResponses?.[fieldKey] && (
                                      <p className="mt-1 text-sm text-red-500">
                                        {errors.customResponses[fieldKey]}
                                      </p>
                                    )}
                                </>
                              )}

                              {field.inputType === 'textarea' && (
                                <>
                                  <Field
                                    as="textarea"
                                    name={fieldName}
                                    rows={4}
                                    placeholder={getLocalizedText(field.label)}
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200 resize-y"
                                  />
                                  {errors.customResponses?.[fieldKey] &&
                                    touched.customResponses?.[fieldKey] && (
                                      <p className="mt-1 text-sm text-red-500">
                                        {errors.customResponses[fieldKey]}
                                      </p>
                                    )}
                                </>
                              )}

                              {(field.inputType === 'dropdown' ||
                                field.inputType === 'select') && (
                                <>
                                  <Field
                                    as="select"
                                    name={fieldName}
                                    value={
                                      values.customResponses?.[fieldKey] ?? ''
                                    }
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200 cursor-pointer"
                                  >
                                    <option value="" disabled>
                                      Please Select
                                    </option>
                                    {(Array.isArray(field.choices)
                                      ? field.choices
                                      : []
                                    ).map((choice, idx) => (
                                      <option
                                        key={idx}
                                        value={getLocalizedText(choice)}
                                      >
                                        {getLocalizedText(choice)}
                                      </option>
                                    ))}
                                  </Field>
                                  {errors.customResponses?.[fieldKey] &&
                                    touched.customResponses?.[fieldKey] && (
                                      <p className="mt-1 text-sm text-red-500">
                                        {errors.customResponses[fieldKey]}
                                      </p>
                                    )}
                                </>
                              )}

                              {field.inputType === 'radio' &&
                                Array.isArray(field.choices) &&
                                field.choices.length > 0 && (
                                  <div className="space-y-2">
                                    {field.choices.map((choice, idx) => (
                                      <label
                                        key={idx}
                                        className="flex items-center gap-3 cursor-pointer group"
                                      >
                                        <div className="relative flex items-center shrink-0">
                                          <Field
                                            type="radio"
                                            name={fieldName}
                                            value={getLocalizedText(choice)}
                                            className="sr-only peer"
                                          />
                                          <div className="w-6 h-6 rounded-full bg-white dark:bg-dark-800 peer-checked:bg-primary-500 peer-focus:ring-4 peer-focus:ring-primary-500/20 transition-all duration-300 flex items-center justify-center group-hover:scale-105 peer-checked:[&>div]:scale-100 shadow-md">
                                            <div className="w-2.5 h-2.5 bg-white rounded-full scale-0 transition-transform duration-200"></div>
                                          </div>
                                        </div>
                                        <span className="flex-1 text-sm font-medium text-light-900 dark:text-white select-none">
                                          {getLocalizedText(choice)}
                                        </span>
                                      </label>
                                    ))}
                                    {errors.customResponses?.[fieldKey] &&
                                      touched.customResponses?.[fieldKey] && (
                                        <p className="mt-1 text-sm text-red-500">
                                          {errors.customResponses[fieldKey]}
                                        </p>
                                      )}
                                  </div>
                                )}

                              {field.inputType === 'checkbox' && (
                                <label className="flex items-start gap-3 cursor-pointer group">
                                  <div className="relative flex items-center shrink-0 mt-0.5">
                                    <Field
                                      type="checkbox"
                                      name={fieldName}
                                      className="sr-only peer"
                                    />
                                    <div className="w-6 h-6 rounded-lg bg-white dark:bg-dark-800 peer-checked:bg-primary-500 peer-focus:ring-4 peer-focus:ring-primary-500/20 transition-all duration-300 flex items-center justify-center group-hover:scale-105 peer-checked:[&>svg]:scale-100 shadow-md">
                                      <svg
                                        className="w-4 h-4 text-white scale-0 transition-transform duration-200"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={3}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                  <span className="flex-1 text-sm font-medium text-light-900 dark:text-white select-none">
                                    {getLocalizedText(field.label)}
                                  </span>
                                </label>
                              )}

                              {field.inputType === 'tags' && (
                                <div>
                                  <div className="flex gap-2 mb-3">
                                    <input
                                      type="text"
                                      placeholder={
                                        t('joinUs:tagsPlaceholder') ||
                                        'Enter a tag'
                                      }
                                      className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const value = e.target.value.trim();
                                          if (value) {
                                            const currentTags =
                                              values.customResponses?.[
                                                fieldKey
                                              ] || [];
                                            const tagsArray = Array.isArray(
                                              currentTags
                                            )
                                              ? currentTags
                                              : [];
                                            if (!tagsArray.includes(value)) {
                                              setFieldValue(fieldName, [
                                                ...tagsArray,
                                                value,
                                              ]);
                                            }
                                            e.target.value = '';
                                          }
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        const input =
                                          e.target.previousElementSibling;
                                        const value = input.value.trim();
                                        if (value) {
                                          const currentTags =
                                            values.customResponses?.[
                                              fieldKey
                                            ] || [];
                                          const tagsArray = Array.isArray(
                                            currentTags
                                          )
                                            ? currentTags
                                            : [];
                                          if (!tagsArray.includes(value)) {
                                            setFieldValue(fieldName, [
                                              ...tagsArray,
                                              value,
                                            ]);
                                          }
                                          input.value = '';
                                        }
                                      }}
                                      className="px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shrink-0"
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
                                          d="M12 4v16m8-8H4"
                                        />
                                      </svg>
                                      {t('joinUs:addTag') || 'Add'}
                                    </button>
                                  </div>
                                  {values.customResponses?.[fieldKey] &&
                                    Array.isArray(
                                      values.customResponses[fieldKey]
                                    ) &&
                                    values.customResponses[fieldKey].length >
                                      0 && (
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        {values.customResponses[fieldKey].map(
                                          (tag, idx) => (
                                            <div
                                              key={idx}
                                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-500/10 border-2 border-primary-500/30 rounded-full text-sm font-medium text-light-900 dark:text-white"
                                            >
                                              <span>{tag}</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newTags =
                                                    values.customResponses[
                                                      fieldKey
                                                    ].filter(
                                                      (_, i) => i !== idx
                                                    );
                                                  setFieldValue(
                                                    fieldName,
                                                    newTags
                                                  );
                                                }}
                                                className="hover:text-red-500 transition-colors"
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
                                                    d="M6 18L18 6M6 6l12 12"
                                                  />
                                                </svg>
                                              </button>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                  <p className="text-xs text-light-500 dark:text-light-400">
                                    {t('joinUs:tagsHint') ||
                                      'Press Enter or click Add button to add tags'}
                                  </p>
                                  {errors.customResponses?.[fieldKey] &&
                                    touched.customResponses?.[fieldKey] && (
                                      <p className="mt-1 text-sm text-red-500">
                                        {errors.customResponses[fieldKey]}
                                      </p>
                                    )}
                                </div>
                              )}

                              {![
                                'text',
                                'email',
                                'number',
                                'date',
                                'url',
                                'tel',
                                'time',
                                'datetime-local',
                                'month',
                                'password',
                                'textarea',
                                'dropdown',
                                'select',
                                'radio',
                                'checkbox',
                                'tags',
                              ].includes(field.inputType) && (
                                <>
                                  <Field
                                    name={fieldName}
                                    type="text"
                                    placeholder={
                                      getLocalizedText(field.label) ||
                                      field.fieldId ||
                                      'Field value'
                                    }
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border-2 border-light-200 dark:border-dark-600 text-light-900 dark:text-white placeholder-light-400 dark:placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-200"
                                  />
                                  {errors.customResponses?.[fieldKey] &&
                                    touched.customResponses?.[fieldKey] && (
                                      <p className="mt-1 text-sm text-red-500">
                                        {errors.customResponses[fieldKey]}
                                      </p>
                                    )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Terms and Conditions */}
                  {jobPosition.termsAndConditions &&
                    jobPosition.termsAndConditions.length > 0 && (
                      <div className="mb-8">
                        <div
                          className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm"
                          dir={isArabic ? 'rtl' : 'ltr'}
                        >
                          <div className="border-l-4 border-primary-500 pl-4 mb-6">
                            <h3 className="text-xl font-bold text-gray-900">
                              {t('joinUs:termsAndConditions') ||
                                'Terms and Conditions'}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {t('joinUs:terms.instructions') ||
                                'Please review and accept each term individually to proceed.'}
                            </p>
                          </div>

                          <div className="space-y-3 mb-6 max-h-80 overflow-y-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
                            {jobPosition.termsAndConditions.map(
                              (term, index) => {
                                const termId = term._id || `term_${index}`;
                                const isAccepted = !!acceptedTerms[termId];

                                return (
                                  <div
                                    key={termId}
                                    className={`relative flex items-start p-4 rounded-lg border-2 transition-all duration-200 ${isAccepted ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-primaryLight hover:shadow-sm'}`}
                                  >
                                    <div className="flex items-center h-6 mt-0.5">
                                      <Checkbox
                                        checked={isAccepted}
                                        onChange={(e) => {
                                          const next = {
                                            ...acceptedTerms,
                                            [termId]: e.target.checked,
                                          };
                                          setAcceptedTerms(next);
                                          setFieldValue(
                                            'agreedToTerms',
                                            Object.values(next).every(Boolean)
                                          );
                                        }}
                                        required
                                        sx={{
                                          color: 'var(--color-primary-500)',
                                          padding: '4px',
                                          border: '1px solid rgba(0,0,0,0.06)',
                                          borderRadius: '6px',
                                          '&.Mui-checked': {
                                            color: 'var(--color-primary-600)',
                                          },
                                          '& .MuiSvgIcon-root': {
                                            fontSize: 30,
                                          },
                                        }}
                                      />
                                    </div>

                                    <div
                                      className={`flex-1 ${isArabic ? 'mr-3 text-right' : 'ml-3 text-left'}`}
                                    >
                                      <label className="cursor-pointer">
                                        <span
                                          className={`text-sm leading-relaxed block ${isAccepted ? 'text-green-900 font-medium' : 'text-gray-700'}`}
                                        >
                                          <span className="font-semibold text-gray-900">
                                            {index + 1}.
                                          </span>{' '}
                                          {getLocalizedText(term)}
                                        </span>
                                      </label>
                                    </div>

                                    {isAccepted && (
                                      <div className="flex items-center h-6 mt-0.5">
                                        <svg
                                          className="w-5 h-5 text-green-600"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            )}
                          </div>

                          <div className="mt-6">
                            {(() => {
                              const allAccepted =
                                Object.keys(acceptedTerms).length > 0 &&
                                Object.values(acceptedTerms).every(Boolean);
                              const acceptedCount =
                                Object.values(acceptedTerms).filter(
                                  Boolean
                                ).length;
                              const total =
                                jobPosition.termsAndConditions.length;

                              return (
                                <div
                                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${allAccepted ? 'bg-green-50 border-green-500' : 'bg-amber-50 border-amber-400'}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`flex items-center justify-center w-10 h-10 rounded-full ${allAccepted ? 'bg-green-500' : 'bg-amber-500'}`}
                                    >
                                      {allAccepted ? (
                                        <svg
                                          className="w-6 h-6 text-white"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      ) : (
                                        <svg
                                          className="w-6 h-6 text-white"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      )}
                                    </div>
                                    <div>
                                      <p
                                        className={`font-semibold ${allAccepted ? 'text-green-900' : 'text-amber-900'}`}
                                      >
                                        {allAccepted
                                          ? t('joinUs:terms.allAccepted') ||
                                            'All terms accepted'
                                          : t('joinUs:terms.pending') ||
                                            'Pending acceptance'}
                                      </p>
                                      <p
                                        className={`text-sm ${allAccepted ? 'text-green-700' : 'text-amber-700'}`}
                                      >
                                        {acceptedCount}{' '}
                                        {t('joinUs:terms.of') || 'of'} {total}{' '}
                                        {t('joinUs:terms.termsAccepted') ||
                                          'terms accepted'}
                                      </p>
                                    </div>
                                  </div>
                                  {allAccepted && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full">
                                      <span className="text-xs font-bold text-green-800 uppercase tracking-wide">
                                        {t('joinUs:terms.ready') || 'Ready'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {errors.agreedToTerms && touched.agreedToTerms && (
                            <FormHelperText
                              error                              sx={{
                                textAlign: isArabic ? 'right' : 'left',
                                mt: 1,
                              }}
                            >
                              {errors.agreedToTerms}
                            </FormHelperText>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Submit Button */}
                  <div className="mt-8 pt-6">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-gradient-to-r from-primary-500/20 via-primary-500/40 to-primary-500/20"></div>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={formikIsSubmitting || isSubmitting}
                      className="w-full px-8 py-4 rounded-xl bg-primary-500 text-white font-bold text-lg shadow-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-3"
                    >
                      {formikIsSubmitting || isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                          <span>
                            {t('joinUs:submitting') || 'Submitting...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span>
                            {t('joinUs:submitApplication') ||
                              'Submit Application'}
                          </span>
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
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </Form>
              );
            }}
          </Formik>
        </div>
      </section>
      <Footer />
    </>
  );
};

export default JobApplicationForm;