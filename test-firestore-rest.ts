async function test() {
  // Just testing the URL format
  const projectId = "gen-lang-client-0126630129";
  const databaseId = "ai-studio-whatsappaffiliat-a485c61f-1427-4cf4-acdf-7a5e74dd052f";
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/test`;
  console.log(url);
}
test();
