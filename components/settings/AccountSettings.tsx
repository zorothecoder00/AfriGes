"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  Camera, Trash2, Loader2, Mail, Phone, MapPin, Lock, ShieldCheck,
  Save, UserCircle2, BadgeCheck, Eye, EyeOff, KeyRound,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  photo: string | null;
  telephone: string | null;
  adresse: string | null;
  role: string | null;
  gestionnaireRole: string | null;
  dateAdhesion: string;
  hasPassword: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const prettifyRole = (r: string | null) =>
  r ? r.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "—";

const initials = (prenom: string, nom: string) =>
  `${prenom?.[0] ?? ""}${nom?.[0] ?? ""}`.toUpperCase() || "?";

/**
 * Recadre l'image au centre en carré et la réduit à `size` px, puis renvoie un
 * data URL JPEG compressé (léger → stockable en base sans souci serverless).
 */
function fileToSquareDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponible"));
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Composant ──────────────────────────────────────────────────────────────────

export default function AccountSettings() {
  const { data: session, update } = useSession();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Formulaire profil
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  // ── Chargement initial ──────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me/profile");
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        if (!alive) return;
        const p = j.data as ProfileData;
        setProfile(p);
        setPrenom(p.prenom); setNom(p.nom); setEmail(p.email);
        setTelephone(p.telephone ?? ""); setAdresse(p.adresse ?? "");
        setPhoto(p.photo);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Impossible de charger le profil");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const profileDirty = useMemo(() => {
    if (!profile) return false;
    return (
      prenom.trim() !== profile.prenom ||
      nom.trim() !== profile.nom ||
      email.trim().toLowerCase() !== profile.email.toLowerCase() ||
      (telephone.trim() || "") !== (profile.telephone ?? "") ||
      (adresse.trim() || "") !== (profile.adresse ?? "") ||
      photoDirty
    );
  }, [profile, prenom, nom, email, telephone, adresse, photoDirty]);

  // ── Photo ───────────────────────────────────────────────────────────────────
  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choisissez un fichier image"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image trop lourde (max 8 Mo)"); return; }
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      setPhoto(dataUrl);
      setPhotoDirty(true);
    } catch {
      toast.error("Impossible de traiter cette image");
    }
  };

  const removePhoto = () => {
    if (!photo) return;
    setPhoto(null);
    setPhotoDirty(true);
  };

  // ── Bouton « Utiliser mon compte Google » ────────────────────────────────────
  // Reprend l'email exact du compte connecté (pour un compte Google, c'est le
  // Gmail exact → évite les fautes de frappe qui casseraient la connexion Google).
  const useGoogleEmail = () => {
    const g = session?.user?.email;
    if (!g) { toast.error("Aucun email de compte disponible"); return; }
    setEmail(g);
    toast.success("Email de votre compte repris");
  };

  // ── Enregistrement du profil ──────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!profile) return;
    if (!prenom.trim() || !nom.trim()) { toast.error("Nom et prénom sont requis"); return; }
    if (!email.trim()) { toast.error("L'email est requis"); return; }

    const payload: Record<string, unknown> = {};
    if (prenom.trim() !== profile.prenom) payload.prenom = prenom.trim();
    if (nom.trim() !== profile.nom) payload.nom = nom.trim();
    if (email.trim().toLowerCase() !== profile.email.toLowerCase()) payload.email = email.trim();
    if ((telephone.trim() || "") !== (profile.telephone ?? "")) payload.telephone = telephone.trim();
    if ((adresse.trim() || "") !== (profile.adresse ?? "")) payload.adresse = adresse.trim();
    if (photoDirty) payload.photo = photo;

    if (Object.keys(payload).length === 0) { toast.info("Aucune modification"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      const updated = j.data as ProfileData;
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      setPhotoDirty(false);
      // Rafraîchit la session pour que l'avatar / le nom se mettent à jour partout.
      await update();
      toast.success("Profil mis à jour ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // ── Changement de mot de passe ────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) { toast.error("Renseignez le mot de passe actuel et le nouveau"); return; }
    if (newPassword.length < 8) { toast.error("Le nouveau mot de passe doit faire au moins 8 caractères"); return; }
    if (newPassword !== confirmPassword) { toast.error("La confirmation ne correspond pas"); return; }

    setPwdSaving(true);
    try {
      const r = await fetch("/api/user/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Mot de passe changé — reconnexion requise");
      // Le changement incrémente tokenVersion : l'ancienne session est invalidée.
      setTimeout(() => signOut({ callbackUrl: "/auth/login?password=changed" }), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors du changement");
    } finally {
      setPwdSaving(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement de vos paramètres…
      </div>
    );
  }
  if (!profile) {
    return <div className="text-center py-24 text-slate-400">Profil indisponible.</div>;
  }

  const roleLabel = prettifyRole(profile.gestionnaireRole ?? profile.role);

  return (
    <div className="space-y-6">

      {/* ── Carte identité / photo ─────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-emerald-500 to-teal-600" />
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl ring-4 ring-white bg-slate-100 overflow-hidden flex items-center justify-center shadow-md">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Photo de profil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-400">{initials(prenom, nom)}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-colors"
                title="Changer la photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
            </div>

            <div className="flex-1 min-w-0 sm:pb-1">
              <h3 className="text-lg font-bold text-slate-800 truncate">{prenom} {nom}</h3>
              <p className="text-sm text-slate-500 flex items-center gap-1.5">
                <BadgeCheck className="w-4 h-4 text-emerald-500" /> {roleLabel}
              </p>
            </div>

            {photo && (
              <button
                type="button"
                onClick={removePhoto}
                className="self-start sm:self-end inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Retirer la photo
              </button>
            )}
          </div>

          {/* Nom / prénom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <Field label="Prénom" icon={<UserCircle2 className="w-4 h-4" />}>
              <input value={prenom} onChange={(e) => setPrenom(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Nom" icon={<UserCircle2 className="w-4 h-4" />}>
              <input value={nom} onChange={(e) => setNom(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>
      </section>

      {/* ── Carte coordonnées ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-slate-400" />
          <h3 className="font-bold text-slate-800">Coordonnées</h3>
        </div>

        {/* Email + bouton Google */}
        <Field label="Adresse email" icon={<Mail className="w-4 h-4" />}>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className={inputCls} placeholder="vous@exemple.com"
            />
            <button
              type="button"
              onClick={useGoogleEmail}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              title="Reprendre l'email exact de mon compte Google connecté"
            >
              <GoogleIcon /> Utiliser mon compte Google
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Pour la connexion via Google, saisissez l&apos;adresse Gmail exacte de votre compte
            (le bouton la reprend automatiquement).
          </p>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Téléphone" icon={<Phone className="w-4 h-4" />}>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputCls} placeholder="+228 …" />
          </Field>
          <Field label="Adresse" icon={<MapPin className="w-4 h-4" />}>
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={inputCls} placeholder="Ville, quartier…" />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {profileDirty && <span className="text-xs text-amber-600">Modifications non enregistrées</span>}
          <button
            onClick={handleSaveProfile}
            disabled={saving || !profileDirty}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer les modifications
          </button>
        </div>
      </section>

      {/* ── Carte sécurité (mot de passe) ──────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-400" />
          <h3 className="font-bold text-slate-800">Sécurité</h3>
        </div>

        {profile.hasPassword ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Mot de passe actuel" icon={<Lock className="w-4 h-4" />}>
                <input type={showPwd ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} autoComplete="current-password" />
              </Field>
              <Field label="Nouveau mot de passe" icon={<KeyRound className="w-4 h-4" />}>
                <input type={showPwd ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
              </Field>
              <Field label="Confirmer" icon={<KeyRound className="w-4 h-4" />}>
                <input type={showPwd ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setShowPwd((s) => !s)} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPwd ? "Masquer" : "Afficher"} les mots de passe
              </button>
              <button
                onClick={handleChangePassword}
                disabled={pwdSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                {pwdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Changer le mot de passe
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Après le changement, vous serez déconnecté et devrez vous reconnecter avec le nouveau mot de passe.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            Ce compte se connecte via Google : aucun mot de passe local n&apos;est défini.
          </p>
        )}
      </section>
    </div>
  );
}

// ─── Sous-composants / styles ────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors";

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
        {icon}{label}
      </span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
