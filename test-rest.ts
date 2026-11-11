import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const projectId = config.projectId;
const databaseId = config.firestoreDatabaseId;

console.log("ProjectId:", projectId, "DatabaseId:", databaseId);
