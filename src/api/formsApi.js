import axios from 'axios';

const FORM_API_URL = import.meta.env.VITE_FORM_URL || 'https://application-maker.onrender.com/api';

const formClient = axios.create({
  baseURL: FORM_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

const asTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const extractMessageFromPayload = (payload) => {
  if (payload == null) return '';

  if (typeof payload === 'string') {
    return payload.trim();
  }

  if (Array.isArray(payload)) {
    return payload
      .map((entry) => extractMessageFromPayload(entry))
      .filter(Boolean)
      .join('\n');
  }

  if (typeof payload === 'object') {
    const directCandidates = [
      payload.message,
      payload.error,
      payload.msg,
      payload.detail,
      payload.title,
      payload.reason,
      payload.description,
    ];

    for (const candidate of directCandidates) {
      const message = extractMessageFromPayload(candidate);
      if (message) return message;
    }

    if (Array.isArray(payload.errors)) {
      const errorsMessage = payload.errors
        .map((entry) => extractMessageFromPayload(entry))
        .filter(Boolean)
        .join('\n');

      if (errorsMessage) return errorsMessage;
    }

    try {
      const serialized = JSON.stringify(payload);
      if (serialized && serialized !== '{}') return serialized;
    } catch (serializationError) {
      // Ignore serialization failures and continue fallback handling.
    }
  }

  return '';
};

export const getApiErrorMessage = (error, fallbackMessage = 'Request failed') => {
  const backendMessage = extractMessageFromPayload(error?.response?.data);
  if (backendMessage) return backendMessage;

  const runtimeMessage = asTrimmedString(error?.message);
  if (runtimeMessage) return runtimeMessage;

  return fallbackMessage;
};

export async function submitApplicant(payload) {
  try {
    const res = await formClient.post('/public/applicants', payload);
    return res.data;
  } catch (err) {
    // rethrow for caller to handle
    throw err;
  }
}

export async function checkExistingApplicant(params) {
  try {
    const res = await formClient.get('/public/applicants', { params });
    return res.data;
  } catch (err) {
    // rethrow for caller to handle
    throw err;
  }
}

export default { submitApplicant, checkExistingApplicant, getApiErrorMessage };