import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';

// --- THE FIX IS HERE: "export const" ---
export const store = configureStore({
  reducer: { auth: authReducer },
});