/**
 * Traductions communes de l'interface AfriGes.
 * Couvre la navigation, les actions et les messages fréquents.
 * Usage : import { useT } from "@/contexts/AppSettingsContext"
 */
   
export type Langue = "fr" | "en" | "ar";

export const translations = {
  // ── Navigation ─────────────────────────────────────────────────────────────
  nav_dashboard:      { fr: "Tableau de bord",    en: "Dashboard",         ar: "لوحة التحكم"     },
  nav_membres:        { fr: "Membres",             en: "Members",           ar: "الأعضاء"          },
  nav_gestionnaires:  { fr: "Gestionnaires",       en: "Managers",          ar: "المسيّرون"        },
  nav_clients:        { fr: "Clients",             en: "Clients",           ar: "العملاء"          },
  nav_messages:       { fr: "Messages",            en: "Messages",          ar: "الرسائل"          },
  nav_packs:          { fr: "Packs clients",       en: "Client packs",      ar: "الحزم"            },
  nav_ventes:         { fr: "Ventes",              en: "Sales",             ar: "المبيعات"         },
  nav_stock:          { fr: "Gestion du stock",    en: "Stock management",  ar: "إدارة المخزون"   },
  nav_pdv:            { fr: "Points de vente",     en: "Sales points",      ar: "نقاط البيع"      },
  nav_superadmin:     { fr: "Administration système", en: "System admin",   ar: "إدارة النظام"    },

  // ── Actions courantes ───────────────────────────────────────────────────────
  action_add:         { fr: "Ajouter",             en: "Add",               ar: "إضافة"            },
  action_edit:        { fr: "Modifier",            en: "Edit",              ar: "تعديل"            },
  action_delete:      { fr: "Supprimer",           en: "Delete",            ar: "حذف"              },
  action_save:        { fr: "Sauvegarder",         en: "Save",              ar: "حفظ"              },
  action_cancel:      { fr: "Annuler",             en: "Cancel",            ar: "إلغاء"            },
  action_confirm:     { fr: "Confirmer",           en: "Confirm",           ar: "تأكيد"            },
  action_close:       { fr: "Fermer",              en: "Close",             ar: "إغلاق"            },
  action_search:      { fr: "Rechercher",          en: "Search",            ar: "بحث"              },
  action_filter:      { fr: "Filtres",             en: "Filters",           ar: "تصفية"            },
  action_export:      { fr: "Exporter",            en: "Export",            ar: "تصدير"            },
  action_retry:       { fr: "Réessayer",           en: "Retry",             ar: "إعادة المحاولة"   },
  action_next:        { fr: "Suivant",             en: "Next",              ar: "التالي"           },
  action_prev:        { fr: "Précédent",           en: "Previous",          ar: "السابق"           },
  action_new_op:      { fr: "Nouvelle opération",  en: "New operation",     ar: "عملية جديدة"      },
  action_logout:      { fr: "Déconnexion",         en: "Sign out",          ar: "تسجيل الخروج"     },

  // ── Statuts ────────────────────────────────────────────────────────────────
  status_actif:       { fr: "Actif",               en: "Active",            ar: "نشط"              },
  status_inactif:     { fr: "Inactif",             en: "Inactive",          ar: "غير نشط"          },
  status_suspendu:    { fr: "Suspendu",            en: "Suspended",         ar: "موقوف"            },
  status_en_attente:  { fr: "En attente",          en: "Pending",           ar: "قيد الانتظار"     },
  status_complete:    { fr: "Complété",            en: "Completed",         ar: "مكتمل"            },
  status_annule:      { fr: "Annulé",              en: "Cancelled",         ar: "ملغى"             },
  status_ouvert:      { fr: "Ouvert",              en: "Open",              ar: "مفتوح"            },
  status_ferme:       { fr: "Fermé",               en: "Closed",            ar: "مغلق"             },

  // ── En-têtes de tableau ─────────────────────────────────────────────────────
  col_name:           { fr: "Nom",                 en: "Name",              ar: "الاسم"            },
  col_firstname:      { fr: "Prénom",              en: "First name",        ar: "الاسم الأول"      },
  col_email:          { fr: "Email",               en: "Email",             ar: "البريد الإلكتروني"},
  col_role:           { fr: "Rôle",                en: "Role",              ar: "الدور"            },
  col_date:           { fr: "Date",                en: "Date",              ar: "التاريخ"          },
  col_actions:        { fr: "Actions",             en: "Actions",           ar: "الإجراءات"        },
  col_status:         { fr: "Statut",              en: "Status",            ar: "الحالة"           },
  col_amount:         { fr: "Montant",             en: "Amount",            ar: "المبلغ"           },
  col_member:         { fr: "Membre",              en: "Member",            ar: "العضو"            },
  col_contact:        { fr: "Contact",             en: "Contact",           ar: "الاتصال"          },

  // ── Messages système ───────────────────────────────────────────────────────
  msg_loading:        { fr: "Chargement…",         en: "Loading…",          ar: "جارٍ التحميل…"    },
  msg_error:          { fr: "Erreur de chargement",en: "Loading error",     ar: "خطأ في التحميل"   },
  msg_no_result:      { fr: "Aucun résultat",      en: "No results",        ar: "لا توجد نتائج"    },
  msg_confirm_delete: { fr: "Confirmer la suppression", en: "Confirm deletion", ar: "تأكيد الحذف"  },
  msg_irreversible:   { fr: "Cette action est irréversible.", en: "This action cannot be undone.", ar: "هذا الإجراء لا يمكن التراجع عنه." },

  // ── Rôles ──────────────────────────────────────────────────────────────────
  role_user:          { fr: "Utilisateur",         en: "User",              ar: "مستخدم"           },
  role_admin:         { fr: "Administrateur",      en: "Administrator",     ar: "مدير"             },
  role_superadmin:    { fr: "Super Administrateur",en: "Super Administrator",ar:"مدير عام"         },

  // ── Dashboard ──────────────────────────────────────────────────────────────
  dash_title:         { fr: "Tableau de bord",     en: "Dashboard",         ar: "لوحة التحكم"     },
  dash_subtitle:      { fr: "Vue d'ensemble des activités AfriGes", en: "AfriGes activity overview", ar: "نظرة عامة على أنشطة أفريجيس" },
  dash_activity:      { fr: "Activité du jour",    en: "Today's activity",  ar: "نشاط اليوم"      },
  dash_modules:       { fr: "Modules système",     en: "System modules",    ar: "وحدات النظام"    },
  dash_alerts:        { fr: "Alertes opérationnelles", en: "Operational alerts", ar: "تنبيهات تشغيلية" },
  dash_reports:       { fr: "Rapports rapides",    en: "Quick reports",     ar: "تقارير سريعة"    },
  dash_period_7:      { fr: "7 derniers jours",    en: "Last 7 days",       ar: "آخر 7 أيام"      },
  dash_period_30:     { fr: "30 derniers jours",   en: "Last 30 days",      ar: "آخر 30 يومًا"    },
  dash_period_90:     { fr: "90 derniers jours",   en: "Last 90 days",      ar: "آخر 90 يومًا"    },
  
  // ── Dashboard / Indicateurs & Stats ─────────────────────────────────────────
  dash_logout:                   { fr: "Se déconnecter",              en: "Log out",                    ar: "تسجيل الخروج" },
  dash_evolution_versements:     { fr: "Evolution des versements",    en: "Payment evolution",          ar: "تطور المدفوعات" },
  dash_montants_journaliers:     { fr: "Montants journaliers (versements packs)", en: "Daily amounts (pack payments)", ar: "المبالغ اليومية (مدفوعات الحزم)" },
  dash_versements_packs:         { fr: "Versements packs",            en: "Pack payments",             ar: "مدفوعات الحزم" },
  dash_souscriptions_creees:     { fr: "Souscriptions créées",        en: "Subscriptions created",      ar: "الاشتراكات المُنشأة" },
  dash_repartition_statut:       { fr: "Répartition par statut",      en: "Distribution by status",    ar: "التوزيع حسب الحالة" },
  dash_souscriptions:            { fr: "Souscriptions",               en: "Subscriptions",             ar: "الاشتراكات" },
  dash_actives:                  { fr: "Actives",                     en: "Active",                     ar: "نشطة" },
  dash_completes:                { fr: "Complètes",                   en: "Completed",                  ar: "مكتملة" },
  dash_annulees:                 { fr: "Annulées",                    en: "Cancelled",                  ar: "ملغاة" },
  dash_indicateurs_jour:         { fr: "Indicateurs clés du jour",    en: "Key indicators of the day",  ar: "المؤشرات الرئيسية لليوم" },
  dash_alertes_op:               { fr: "Alertes opérationnelles",     en: "Operational alerts",        ar: "تنبيهات تشغيلية" },
  dash_points_attention:         { fr: "Points d’attention en temps réel", en: "Real-time attention points", ar: "نقاط الانتباه في الوقت الحقيقي" },
  dash_caisse:                   { fr: "Caisse",                      en: "Cash register",             ar: "الصندوق" },
  dash_fcfa_0:                   { fr: "F CFA 0",                     en: "XOF 0",                     ar: "٠ فرنك إف سي إف إيه" },
  dash_sessions_ouvertes:        { fr: "1 session(s) ouverte(s)",    en: "1 session(s) open",         ar: "١ جلسة مفتوحة" },

  // ── Stock / Produits ────────────────────────────────────────────────────────
  dash_stock:                    { fr: "Stock",                        en: "Stock",                      ar: "المخزون" },
  dash_alertes_stock:            { fr: "3 alerte(s)",                  en: "3 alert(s)",                ar: "٣ تنبيه/تنبيهات" },
  dash_produits_seuil:           { fr: "Produits sous le seuil",       en: "Products below threshold",  ar: "منتجات تحت الحد الأدنى" },

  // ── Ventes ─────────────────────────────────────────────────────────────────
  dash_ventes:                    { fr: "Ventes",                      en: "Sales",                     ar: "المبيعات" },
  dash_fcfa_ventes:               { fr: "F CFA 0",                     en: "XOF 0",                     ar: "٠ فرنك إف سي إف إيه" },
  dash_ventes_directes:           { fr: "0 vente(s) directe(s)",       en: "0 direct sale(s)",          ar: "٠ بيع مباشر" },

  // ── Approvisionnement ─────────────────────────────────────────────────────
  dash_appro:                     { fr: "Appro",                        en: "Supply",                     ar: "التزويد" },
  dash_en_attente:                { fr: "0 en attente",                 en: "0 pending",                 ar: "٠ في الانتظار" },
  dash_receptions_valider:        { fr: "Réceptions à valider",        en: "Receptions to validate",    ar: "استلامات للتحقق" },

  // ── Modules ───────────────────────────────────────────────────────────────
  dash_modules_systeme:           { fr: "Modules système",             en: "System modules",            ar: "وحدات النظام" },
  dash_modules_configures:        { fr: "10 modules configurés",       en: "10 modules configured",    ar: "١٠ وحدات مُكوَّنة" },

  // ── Statistiques générales ─────────────────────────────────────────────────
  dash_actifs:                     { fr: "Actifs",                      en: "Active",                     ar: "نشطاء" },
  dash_inactifs:                   { fr: "Inactifs",                    en: "Inactive",                   ar: "غير نشطاء" },

  // ── Autres modules / équipes ──────────────────────────────────────────────
  dash_agents_terrain:             { fr: "Agents de terrain",           en: "Field agents",               ar: "الوكلاء الميدانيون" },
  dash_assemblees_dividendes:      { fr: "Assemblées & Dividendes",     en: "Assemblies & Dividends",    ar: "الجمعيات & الأرباح" },
  dash_caisse_paiements:           { fr: "Caisse & Paiements",          en: "Cash & Payments",           ar: "الصندوق & المدفوعات" },
  dash_comptabilite_gestion_stock: { fr: "Comptabilité Gestion du stock", en: "Accounting & Stock Management", ar: "المحاسبة وإدارة المخزون" },
} as const;

export type TranslationKey = keyof typeof translations;

export function translate(key: TranslationKey, langue: Langue): string {
  return translations[key]?.[langue] ?? translations[key]?.["fr"] ?? key;
}
