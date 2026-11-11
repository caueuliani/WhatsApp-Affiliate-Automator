import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const app = initializeApp({ projectId: 'gen-lang-client-0126630129' });
const db = getFirestore(app);
db.settings({ databaseId: 'ai-studio-whatsappaffiliat-a485c61f-1427-4cf4-acdf-7a5e74dd052f' });
db.collection('test').doc('test').set({ hello: 'world' })
  .then(() => { console.log('success'); process.exit(0); })
  .catch(e => { console.error('Error:', e); process.exit(1); });
