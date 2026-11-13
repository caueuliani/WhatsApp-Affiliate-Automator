/**
 * Tradução de códigos públicos do Firebase Auth.
 * Nunca mostramos error.message sem tratamento, pois ela pode conter detalhes internos.
 */
export type LoginFailure = { code: string; message: string };

const KNOWN: Record<string, string> = {
  "auth/unauthorized-domain": "O endereço deste site ainda não está autorizado para login Google no Firebase Authentication.",
  "auth/operation-not-allowed": "O provedor de login Google está desativado no Firebase Authentication deste projeto.",
  "auth/popup-blocked": "Seu navegador bloqueou a janela do Google. Permita pop-ups para este site e tente novamente.",
  "auth/popup-closed-by-user": "A janela de login Google foi fechada antes de concluir a autenticação.",
  "auth/cancelled-popup-request": "Outra tentativa de login interrompeu esta operação. Clique apenas uma vez e tente novamente.",
  "auth/network-request-failed": "Não foi possível se comunicar com o Firebase. Confira a internet e tente novamente.",
  "auth/invalid-api-key": "A configuração da chave pública do Firebase está inválida. O administrador precisa revisar o projeto.",
  "auth/app-not-authorized": "O aplicativo não está autorizado a utilizar esta chave Firebase. Verifique as restrições da chave no Google Cloud.",
  "auth/too-many-requests": "O Firebase limitou temporariamente as tentativas. Aguarde e tente novamente mais tarde.",
  "auth/account-exists-with-different-credential": "Este e-mail já está vinculado a outro método de login. Verifique a conta Google escolhida.",
  "auth/internal-error": "O Firebase retornou um erro interno. Tente novamente e informe o código ao administrador."
};

export function describeGoogleLoginError(error: unknown): LoginFailure {
  const candidate = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  const code = typeof candidate === "string" && /^auth\/[a-z0-9-]{1,80}$/.test(candidate) ? candidate : "auth/unknown";
  return {
    code,
    message: KNOWN[code] ?? "Não foi possível concluir o login Google. Anote o código abaixo para diagnóstico."
  };
}
