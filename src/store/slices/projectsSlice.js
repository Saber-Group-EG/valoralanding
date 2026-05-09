import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunk to fetch projects
export const getProjects = createAsyncThunk(
  'projects/getProjects',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_CRM_BACKEND_URL}/project/public`,
        {
          params: {
            deleted: false,
            company: import.meta.env.VITE_CRM_COMPANY_ID,
            PageCount: 10,
            page: 1,
            sort: "-createdAt",
          },
        }
      );
      return response.data.data || [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
  {
    condition: (force = false, { getState }) => {
      const { projects } = getState();
      // Allow force refresh or fetch if we don't have projects
      if (force) return true;
      if (projects.rawProjects.length > 0) {
        return false;
      }
    },
  }
);

const projectsSlice = createSlice({
  name: 'projects',
  initialState: {
    rawProjects: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.rawProjects = (action.payload || []).filter(
          (project) => project?.isVisible === true
        );
        state.error = null;
      })
      .addCase(getProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch projects';
        state.rawProjects = [];
      });
  },
});

export const { clearError } = projectsSlice.actions;

export default projectsSlice.reducer;
