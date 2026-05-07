
import axios from 'axios';

const BASE_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
export const IMG_BASE_URL = process.env.NEXT_PUBLIC_IMG_URL || 'http://localhost:5000/data/images';

export const api = axios.create({
  baseURL: BASE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const endpoints = {
  ai: {
    predict: '/ai/predict',
    damageIncident: '/ai/damage/incident',
  },
  citizen: {
    report: '/citizen/report',
  },
  admin: {
    reports: '/admin/reports',
    workers: '/admin/workers',
  },
  workflow: {
    assign: '/workflow/tasks/assign',
    workerTasks: (workerId: string) => `/workflow/worker/my-tasks/${workerId}`,
    workerProfile: (workerId: string) => `/workflow/worker/profile/${workerId}`,
    complete: '/workflow/worker/complete',
    verify: '/workflow/verify/verify',
    verifyLogs: '/workflow/verify/logs',
    disputes: '/workflow/verify/disputes',
    cameraSweep: '/workflow/verify/camera-sweep',
  },
};
