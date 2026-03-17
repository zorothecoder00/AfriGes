/**
 * Traductions communes de l'interface AfriGes.
 * Couvre la navigation, les actions et les messages fréquents.
 * Usage : import { useT } from "@/contexts/AppSettingsContext"
 */
   
export type Langue = "fr" | "en" | "ar" | "es" | "pt";   

export const translations = {
  // ── Navigation ─────────────────────────────────────────────────────────────
  nav_dashboard:      { fr: "Tableau de bord",    en: "Dashboard",         ar: "لوحة التحكم",        es: "Tablero",              pt: "Painel de Controle" },
  nav_membres:        { fr: "Membres",             en: "Members",           ar: "الأعضاء",           es: "Miembros",             pt: "Membros" },
  nav_gestionnaires:  { fr: "Gestionnaires",       en: "Managers",          ar: "المسيّرون",         es: "Gestores",             pt: "Gerentes" },
  nav_clients:        { fr: "Clients",             en: "Clients",           ar: "العملاء",           es: "Clientes",             pt: "Clientes" },
  nav_messages:       { fr: "Messages",            en: "Messages",          ar: "الرسائل",           es: "Mensajes",             pt: "Mensagens" },
  nav_packs:          { fr: "Packs clients",       en: "Client packs",      ar: "الحزم",             es: "Paquetes clientes",    pt: "Pacotes de Clientes" },
  nav_ventes:         { fr: "Ventes",              en: "Sales",             ar: "المبيعات",           es: "Ventas",               pt: "Vendas" },
  nav_stock:          { fr: "Gestion du stock",    en: "Stock management",  ar: "إدارة المخزون",    es: "Gestión de inventario", pt: "Gestão de Estoque" },
  nav_pdv:            { fr: "Points de vente",     en: "Sales points",      ar: "نقاط البيع",        es: "Puntos de venta",       pt: "Pontos de Venda" },
  nav_superadmin:     { fr: "Administration système", en: "System admin",   ar: "إدارة النظام",     es: "Administración del sistema", pt: "Administração do Sistema" },

  // ── Actions courantes ───────────────────────────────────────────────────────
  action_add:         { fr: "Ajouter",             en: "Add",               ar: "إضافة",            es: "Añadir",              pt: "Adicionar" },
  action_edit:        { fr: "Modifier",            en: "Edit",              ar: "تعديل",            es: "Editar",              pt: "Editar" },
  action_delete:      { fr: "Supprimer",           en: "Delete",            ar: "حذف",              es: "Eliminar",            pt: "Excluir" },
  action_save:        { fr: "Sauvegarder",         en: "Save",              ar: "حفظ",              es: "Guardar",             pt: "Salvar" },
  action_cancel:      { fr: "Annuler",             en: "Cancel",            ar: "إلغاء",            es: "Cancelar",            pt: "Cancelar" },
  action_confirm:     { fr: "Confirmer",           en: "Confirm",           ar: "تأكيد",            es: "Confirmar",           pt: "Confirmar" },
  action_close:       { fr: "Fermer",              en: "Close",             ar: "إغلاق",            es: "Cerrar",              pt: "Fechar" },
  action_search:      { fr: "Rechercher",          en: "Search",            ar: "بحث",              es: "Buscar",              pt: "Pesquisar" },
  action_filter:      { fr: "Filtres",             en: "Filters",           ar: "تصفية",            es: "Filtros",             pt: "Filtros" },
  action_export:      { fr: "Exporter",            en: "Export",            ar: "تصدير",            es: "Exportar",            pt: "Exportar" },
  action_retry:       { fr: "Réessayer",           en: "Retry",             ar: "إعادة المحاولة",   es: "Reintentar",          pt: "Tentar Novamente" },
  action_next:        { fr: "Suivant",             en: "Next",              ar: "التالي",           es: "Siguiente",           pt: "Próximo" },
  action_prev:        { fr: "Précédent",           en: "Previous",          ar: "السابق",           es: "Anterior",            pt: "Anterior" },
  action_new_op:      { fr: "Nouvelle opération",  en: "New operation",     ar: "عملية جديدة",      es: "Nueva operación",     pt: "Nova operação" },
  action_logout:      { fr: "Déconnexion",         en: "Sign out",          ar: "تسجيل الخروج",     es: "Cerrar sesión",       pt: "Sair" },

  // ── Statuts ────────────────────────────────────────────────────────────────
  status_actif:       { fr: "Actif",               en: "Active",            ar: "نشط",              es: "Activo",              pt: "Ativo" },
  status_inactif:     { fr: "Inactif",             en: "Inactive",          ar: "غير نشط",          es: "Inactivo",            pt: "Inativo" },
  status_suspendu:    { fr: "Suspendu",            en: "Suspended",         ar: "موقوف",            es: "Suspendido",          pt: "Suspenso" },
  status_en_attente:  { fr: "En attente",          en: "Pending",           ar: "قيد الانتظار",     es: "Pendiente",           pt: "Pendente" },
  status_complete:    { fr: "Complété",            en: "Completed",         ar: "مكتمل",            es: "Completado",          pt: "Completo" },
  status_annule:      { fr: "Annulé",              en: "Cancelled",         ar: "ملغى",             es: "Cancelado",           pt: "Cancelado" },
  status_ouvert:      { fr: "Ouvert",              en: "Open",              ar: "مفتوح",            es: "Abierto",             pt: "Aberto" },
  status_ferme:       { fr: "Fermé",               en: "Closed",            ar: "مغلق",             es: "Cerrado",             pt: "Fechado" },

  // ── En-têtes de tableau ─────────────────────────────────────────────────────
  col_name:       { fr: "Nom",         en: "Name",         ar: "الاسم",             es: "Nombre",        pt: "Nome" },
  col_firstname:  { fr: "Prénom",      en: "First name",   ar: "الاسم الأول",       es: "Nombre",        pt: "Primeiro nome" },
  col_email:      { fr: "Email",       en: "Email",        ar: "البريد الإلكتروني", es: "Correo",        pt: "Email" },
  col_role:       { fr: "Rôle",        en: "Role",         ar: "الدور",             es: "Rol",           pt: "Função" },
  col_date:       { fr: "Date",        en: "Date",         ar: "التاريخ",           es: "Fecha",         pt: "Data" },
  col_actions:    { fr: "Actions",     en: "Actions",      ar: "الإجراءات",         es: "Acciones",      pt: "Ações" },
  col_status:     { fr: "Statut",      en: "Status",       ar: "الحالة",            es: "Estado",        pt: "Status" },
  col_amount:     { fr: "Montant",     en: "Amount",       ar: "المبلغ",            es: "Monto",         pt: "Montante" },
  col_member:     { fr: "Membre",      en: "Member",       ar: "العضو",             es: "Miembro",       pt: "Membro" },
  col_contact:    { fr: "Contact",     en: "Contact",      ar: "الاتصال",           es: "Contacto",      pt: "Contato" },

  // ── Messages système ───────────────────────────────────────────────────────
   msg_loading:        { fr: "Chargement…",         en: "Loading…",          ar: "جارٍ التحميل…",    es: "Cargando…",           pt: "Carregando…" },
  msg_error:          { fr: "Erreur de chargement",en: "Loading error",     ar: "خطأ في التحميل",   es: "Error de carga",      pt: "Erro ao carregar" },
  msg_no_result:      { fr: "Aucun résultat",      en: "No results",        ar: "لا توجد نتائج",    es: "Sin resultados",      pt: "Nenhum resultado" },
  msg_confirm_delete: { fr: "Confirmer la suppression", en: "Confirm deletion", ar: "تأكيد الحذف", es: "Confirmar eliminación", pt: "Confirmar exclusão" },
  msg_irreversible:   { fr: "Cette action est irréversible.", en: "This action cannot be undone.", ar: "هذا الإجراء لا يمكن التراجع عنه.", es: "Esta acción no se puede deshacer.", pt: "Esta ação não pode ser desfeita." }, 
   
  // ── Rôles ──────────────────────────────────────────────────────────────────
  role_user:       { fr: "Utilisateur",          en: "User",               ar: "مستخدم",          es: "Usuario",         pt: "Usuário" },
  role_admin:      { fr: "Administrateur",       en: "Administrator",      ar: "مدير",            es: "Administrador",   pt: "Administrador" },
  role_superadmin: { fr: "Super Administrateur", en: "Super Administrator", ar: "مدير عام",       es: "Super Administrador", pt: "Super Administrador" },

  // ── Dashboard ──────────────────────────────────────────────────────────────
  dash_title:         { fr: "Tableau de bord",     en: "Dashboard",         ar: "لوحة التحكم",       es: "Tablero",           pt: "Painel de Controle" },
  dash_subtitle:      { fr: "Vue d'ensemble des activités AfriGes", en: "AfriGes activity overview", ar: "نظرة عامة على أنشطة أفريجيس", es: "Resumen de actividades AfriGes", pt: "Visão geral das atividades AfriGes" },
  dash_activity:      { fr: "Activité du jour",    en: "Today's activity",  ar: "نشاط اليوم",       es: "Actividad del día", pt: "Atividade do dia" },
  dash_operations_today: { fr: "Opérations effectuées aujourd'hui",  en: "Operations carried out today",  ar: "العمليات المنجزة اليوم",  es: "Operaciones realizadas hoy",  pt: "Operações realizadas hoje" },
  dash_modules:       { fr: "Modules système",     en: "System modules",    ar: "وحدات النظام",     es: "Módulos del sistema", pt: "Módulos do sistema" },
  dash_alerts:        { fr: "Alertes opérationnelles", en: "Operational alerts", ar: "تنبيهات تشغيلية", es: "Alertas operativas", pt: "Alertas operacionais" },
  dash_reports:       { fr: "Rapports rapides",    en: "Quick reports",     ar: "تقارير سريعة",     es: "Informes rápidos", pt: "Relatórios rápidos" },
  dash_period_7:      { fr: "7 derniers jours",    en: "Last 7 days",       ar: "آخر 7 أيام",      es: "Últimos 7 días",   pt: "Últimos 7 dias" },
  dash_period_30:     { fr: "30 derniers jours",   en: "Last 30 days",      ar: "آخر 30 يومًا",    es: "Últimos 30 días",  pt: "Últimos 30 dias" },
  dash_period_90:     { fr: "90 derniers jours",   en: "Last 90 days",      ar: "آخر 90 يومًا",    es: "Últimos 90 días",  pt: "Últimos 90 dias" },

  // ── Dashboard / Indicateurs & Stats ─────────────────────────────────────────
  dash_logout:                   { fr: "Se déconnecter",              en: "Log out",                    ar: "تسجيل الخروج",           es: "Cerrar sesión",           pt: "Sair" },
  dash_logging_out:              { fr: "Déconnexion...",              en: "Logging out...",           ar: "جارٍ تسجيل الخروج...",    es: "Cerrando sesión...",      pt: "Saindo..."}, 
  dash_evolution_versements:     { fr: "Evolution des versements",    en: "Payment evolution",          ar: "تطور المدفوعات",        es: "Evolución de pagos",      pt: "Evolução dos pagamentos" },
  dash_montants_journaliers:     { fr: "Montants journaliers (versements packs)", en: "Daily amounts (pack payments)", ar: "المبالغ اليومية (مدفوعات الحزم)", es: "Montos diarios (pagos de paquetes)", pt: "Montantes diários (pagamentos de pacotes)" },
  dash_versements_packs:         { fr: "Versements packs",            en: "Pack payments",             ar: "مدفوعات الحزم",         es: "Pagos de paquetes",       pt: "Pagamentos de pacotes" },
  dash_souscriptions_creees:     { fr: "Souscriptions créées",        en: "Subscriptions created",      ar: "الاشتراكات المُنشأة",    es: "Suscripciones creadas",   pt: "Assinaturas criadas" },
  dash_repartition_statut:       { fr: "Répartition par statut",      en: "Distribution by status",    ar: "التوزيع حسب الحالة",     es: "Distribución por estado", pt: "Distribuição por status" },
  dash_souscriptions:            { fr: "Souscriptions",               en: "Subscriptions",             ar: "الاشتراكات",            es: "Suscripciones",           pt: "Assinaturas" },
  dash_no_subscriptions:         { fr: "Aucune souscription",         en: "No subscription",           ar: "لا توجد اشتراكات",      es: "Sin suscripciones",       pt: "Sem assinaturas"},
  dash_actives:                  { fr: "Actives",                     en: "Active",                     ar: "نشطة",                   es: "Activas",                pt: "Ativas" },
  dash_completes:                { fr: "Complètes",                   en: "Completed",                  ar: "مكتملة",                 es: "Completadas",            pt: "Completadas" },
  dash_annulees:                 { fr: "Annulées",                    en: "Cancelled",                  ar: "ملغاة",                  es: "Canceladas",             pt: "Canceladas" },
  dash_indicateurs_jour:         { fr: "Indicateurs clés du jour",    en: "Key indicators of the day",  ar: "المؤشرات الرئيسية لليوم", es: "Indicadores clave del día", pt: "Indicadores-chave do dia" },
  dash_alertes_op:               { fr: "Alertes opérationnelles",     en: "Operational alerts",        ar: "تنبيهات تشغيلية",        es: "Alertas operativas",      pt: "Alertas operacionais" },
  dash_points_attention:         { fr: "Points d’attention en temps réel", en: "Real-time attention points", ar: "نقاط الانتباه في الوقت الحقيقي", es: "Puntos de atención en tiempo real", pt: "Pontos de atenção em tempo real" },
  dash_caisse:                   { fr: "Caisse",                      en: "Cash register",             ar: "الصندوق",                es: "Caja",                    pt: "Caixa" },
  dash_fcfa_0:                   { fr: "F CFA 0",                     en: "XOF 0",                     ar: "٠ فرنك إف سي إف إيه",   es: "F CFA 0",                pt: "F CFA 0" },
  dash_sessions_ouvertes:        { fr: "1 session(s) ouverte(s)",    en: "1 session(s) open",         ar: "١ جلسة مفتوحة",         es: "1 sesión abierta",       pt: "1 sessão aberta" },

  // ── Stock / Produits ────────────────────────────────────────────────────────
  dash_stock:                    { fr: "Stock",                        en: "Stock",                      ar: "المخزون",             es: "Inventario",             pt: "Estoque" },
  dash_alertes_stock:            { fr: "3 alerte(s)",                  en: "3 alert(s)",                ar: "٣ تنبيه/تنبيهات",       es: "3 alerta(s)",            pt: "3 alerta(s)" },
  dash_produits_seuil:           { fr: "Produits sous le seuil",       en: "Products below threshold",  ar: "منتجات تحت الحد الأدنى", es: "Productos por debajo del umbral", pt: "Produtos abaixo do limite" },

  // ── Ventes ─────────────────────────────────────────────────────────────────
  dash_ventes:                    { fr: "Ventes",                      en: "Sales",                     ar: "المبيعات",           es: "Ventas",                 pt: "Vendas" },
  dash_fcfa_ventes:               { fr: "F CFA 0",                     en: "XOF 0",                     ar: "٠ فرنك إف سي إف إيه",   es: "F CFA 0",                pt: "F CFA 0" },
  dash_ventes_directes:           { fr: "0 vente(s) directe(s)",       en: "0 direct sale(s)",          ar: "٠ بيع مباشر",           es: "0 venta(s) directa(s)",  pt: "0 venda(s) direta(s)" },

  // ── Approvisionnement ─────────────────────────────────────────────────────
  dash_appro:                     { fr: "Appro",                        en: "Supply",                     ar: "التزويد",            es: "Suministro",             pt: "Abastecimento" },
  dash_en_attente:                { fr: "0 en attente",                 en: "0 pending",                 ar: "٠ في الانتظار",       es: "0 pendiente",            pt: "0 pendente" },
  dash_receptions_valider:        { fr: "Réceptions à valider",        en: "Receptions to validate",    ar: "استلامات للتحقق",      es: "Recepciones a validar",  pt: "Recepções a validar" },

  // ── Modules ───────────────────────────────────────────────────────────────
  dash_modules_systeme:           { fr: "Modules système",             en: "System modules",            ar: "وحدات النظام",       es: "Módulos del sistema",    pt: "Módulos do sistema" },
  dash_modules_configures:        { fr: "10 modules configurés",       en: "10 modules configured",    ar: "١٠ وحدات مُكوَّنة",    es: "10 módulos configurados", pt: "10 módulos configurados" },
  
  // ── Statistiques générales ─────────────────────────────────────────────────
  dash_versements:                 { fr: "Versements",                  en: "Payments",                   ar: "المدفوعات" ,          es: "Pagos",               pt: "Pagamentos" },
  dash_souscription:              { fr: "Souscriptions",                en: "Subscriptions",                   ar: "الاشتراكات" ,         es: "Suscripciones",       pt: "Subscrições" },
  dash_vente_directe:            { fr: "Ventes directes",             en: "Direct sales",                   ar: "المبيعات المباشرة" ,  es: "Ventas directas",     pt: "Vendas diretas" },
  dash_mouvements_stock:           { fr: "Mouvements stock",            en: "Stock movements",                   ar: "حركات المخزون" ,       es: "Movimientos de stock", pt: "Movimentos de estoque" },
  dash_actifs:                     { fr: "Actifs",                      en: "Active",                   ar: "نشطاء",               es: "Activos",               pt: "Ativos" },
  dash_inactifs:                   { fr: "Inactifs",                    en: "Inactive",                   ar: "غير نشطاء",           es: "Inactivos",             pt: "Inativos" },

  // ── Autres modules / équipes ──────────────────────────────────────────────
  dash_agents_terrain:             { fr: "Agents de terrain",           en: "Field agents",               ar: "الوكلاء الميدانيون",  es: "Agentes de campo",      pt: "Agentes de campo" },
  dash_assemblees_dividendes:      { fr: "Assemblées & Dividendes",     en: "Assemblies & Dividends",    ar: "الجمعيات & الأرباح",   es: "Asambleas & Dividendos", pt: "Assembleias & Dividendos" },
  dash_caisse_paiements:           { fr: "Caisse & Paiements",          en: "Cash & Payments",           ar: "الصندوق & المدفوعات", es: "Caja & Pagos",           pt: "Caixa & Pagamentos" },
  dash_comptabilite_gestion_stock: { fr: "Comptabilité Gestion du stock", en: "Accounting & Stock Management", ar: "المحاسبة وإدارة المخزون", es: "Contabilidad y Gestión de Inventario", pt: "Contabilidade e Gestão de Estoque" },
} as const;

export type TranslationKey = keyof typeof translations;

export function translate(key: TranslationKey, langue: Langue): string {
  return translations[key]?.[langue] ?? translations[key]?.["fr"] ?? key;
}  
