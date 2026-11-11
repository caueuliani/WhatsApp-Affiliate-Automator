import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ projectId: "gen-lang-client-0126630129" });
const db = getFirestore();
db.settings({ databaseId: 'ai-studio-whatsappaffiliat-a485c61f-1427-4cf4-acdf-7a5e74dd052f' });
db.collection('users').get().then(snap => console.log('success', snap.size)).catch(e => console.error('error', e));
