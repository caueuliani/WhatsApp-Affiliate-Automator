import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
const app = initializeApp({ projectId: 'gen-lang-client-0126630129' });
const auth = getAuth(app);
console.log('auth initialized');
