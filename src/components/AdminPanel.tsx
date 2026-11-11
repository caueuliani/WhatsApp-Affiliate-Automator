import { useState, useEffect } from "react";
import { Users, CheckCircle2, XCircle, Clock, Search, Loader2 } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, orderBy, query } from "firebase/firestore";

export default function AdminPanel({ token, onClose }: { token: string; onClose: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (uid: string, status: string, trialEndsAt?: number | null) => {
    try {
      const userRef = doc(db, "users", uid);
      const payload: any = { status };
      if (trialEndsAt !== undefined) payload.trialEndsAt = trialEndsAt;
      
      await updateDoc(userRef, payload);
      fetchUsers();
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const grantTrial = (uid: string) => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    updateUserStatus(uid, "trial", Date.now() + sevenDays);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Painel de Administração (SaaS)
        </h2>
        <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
          Voltar ao Dashboard
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 px-4 text-sm font-semibold text-slate-600">Usuário</th>
                <th className="py-3 px-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="py-3 px-4 text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{u.name || "Sem Nome"}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    {u.status === "active" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                      </span>
                    ) : u.status === "trial" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                        <Clock className="w-3.5 h-3.5" /> Trial 
                        {u.trialEndsAt && ` (${new Date(u.trialEndsAt).toLocaleDateString()})`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                        <XCircle className="w-3.5 h-3.5" /> Inativo
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 space-x-2">
                    <button 
                      onClick={() => updateUserStatus(u.uid, "active", null)}
                      className="text-xs font-medium px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded transition-colors"
                    >
                      Aprovar Pago
                    </button>
                    <button 
                      onClick={() => grantTrial(u.uid)}
                      className="text-xs font-medium px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded transition-colors"
                    >
                      Liberar 7 Dias
                    </button>
                    <button 
                      onClick={() => updateUserStatus(u.uid, "inactive", null)}
                      className="text-xs font-medium px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded transition-colors"
                    >
                      Suspender
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
