import axios from 'axios';

const api = axios.create({ baseURL: 'http://127.0.0.1:8001' });

export const fetchHealth        = ()                    => api.get('/stats/health');
export const fetchModelStats    = ()                    => api.get('/stats/model');
export const fetchLive          = (source, limit)       => api.get('/live/fetch', { params: { source, limit } });
export const fetchLiveSources   = ()                    => api.get('/live/sources');
export const predictSingle      = (body)                => api.post('/predict/single', body);
export const predictBulk        = (body)                => api.post('/predict/bulk', body);
export const uploadTLE          = (formData)            => api.post('/upload/tle', formData);
export const getRiskScore       = (line1, line2, name)  => api.get('/risk/score',        { params: { line1, line2, name } });
export const getTrajectory      = (line1, line2, name)  => api.get('/trajectory/predict', { params: { line1, line2, name } });
