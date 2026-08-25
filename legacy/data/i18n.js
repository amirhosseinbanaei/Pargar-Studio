/**
 * KAVAN STUDIO — interface dictionary.
 *
 * Every string the interface itself renders, in English and Persian. Editorial
 * content lives in projects.js and studio.js; nothing here is content.
 *
 * Numbers stay in Latin digits. The interface converts them at render time
 * with faDigits(), so a year written once reads correctly in both languages.
 */

export const STRINGS = {
  en: {
    /* -- navigation ---------------------------------------------------- */
    "nav.projects": "Projects",
    "nav.design": "Design",
    "nav.media": "Media",
    "nav.studio": "Studio",
    "nav.contact": "Contact",

    "cap.projects": "Seventy-six built and drawn",
    "cap.design": "Objects, marks and details",
    "cap.media": "Published, awarded, shown",
    "cap.studio": "Who we are and why",
    "cap.contact": "Dezashib, Tehran",

    /* -- chrome -------------------------------------------------------- */
    "ui.close": "Close",
    "ui.selectSection": "Select a section",
    "ui.escToClose": "Esc to close",
    "ui.home": "Home",
    "ui.skip": "Skip to navigation",
    "ui.open": "Open",
    "ui.view": "View",
    "ui.back": "Back",
    "ui.allProjects": "All projects",
    "ui.allWorks": "All works",
    "ui.allMedia": "All entries",
    "ui.clearAll": "Clear all",
    "ui.loading": "Loading",
    "ui.language": "Language",
    "ui.tehran": "Tehran",
    "ui.est": "Est. 2007",
    "ui.projectsCount": "76 Projects",
    "ui.projects": "Projects",
    "ui.works": "Works",
    "ui.entries": "Entries",
    "ui.langEn": "English",
    "ui.langFa": "فارسی",

    /* -- filtering ----------------------------------------------------- */
    "filter.type": "Type",
    "filter.status": "Status",
    "filter.scale": "Scale",
    "filter.year": "Year",
    "filter.category": "Category",
    "filter.kind": "Kind",
    "filter.shown": "Shown",
    "filter.nothing": "Nothing in this category yet.",
    "filter.noMatch": "No projects match these filters.",
    "filter.noKind": "Nothing of this kind.",

    /* -- taxonomy: project type ---------------------------------------- */
    "type.Residential": "Residential",
    "type.Villa": "Villa",
    "type.Office": "Office",
    "type.Hospitality": "Hospitality",
    "type.Commercial": "Commercial",
    "type.Complex": "Complex",
    "type.Interior Design": "Interior Design",
    "type.Renovation": "Renovation",
    "type.Public": "Public",
    "type.Urban Design": "Urban Design",
    "type.Industrial": "Industrial",

    /* -- taxonomy: status, scale --------------------------------------- */
    "status.Completed": "Completed",
    "status.Under Construction": "Under Construction",
    "status.Concept": "Concept",

    "scale.Small": "Small",
    "scale.Medium": "Medium",
    "scale.Large": "Large",

    /* -- taxonomy: design category ------------------------------------- */
    "cat.Branding": "Branding",
    "cat.Detail Design": "Detail Design",
    "cat.Product": "Product",
    "cat.Furniture": "Furniture",
    "cat.Signage": "Signage",
    "cat.Exhibition": "Exhibition",

    /* -- taxonomy: media kind ------------------------------------------ */
    "kind.Publication": "Publication",
    "kind.Award": "Award",
    "kind.Exhibition": "Exhibition",
    "kind.Lecture": "Lecture",

    /* -- specification rows -------------------------------------------- */
    "spec.type": "Type",
    "spec.status": "Status",
    "spec.scale": "Scale",
    "spec.year": "Year",
    "spec.location": "Location",
    "spec.area": "Area",
    "spec.client": "Client",
    "spec.team": "Team",
    "spec.scope": "Scope",
    "spec.materials": "Materials",
    "spec.outlet": "Outlet",
    "spec.author": "Author",
    "spec.project": "Project",

    /* -- studio -------------------------------------------------------- */
    "studio.practice": "Practice",
    "studio.founders": "Founders",
    "studio.numbers": "In numbers",
    "studio.history": "History",
    "studio.awards": "Awards",
    "studio.people": "Studio",
    "studio.previously": "Previously",
    "studio.name": "The name",
    "studio.approach": "Approach",

    /* -- contact ------------------------------------------------------- */
    "contact.address": "Address",
    "contact.telephone": "Telephone",
    "contact.email": "Email",
    "contact.hours": "Hours",
    "contact.elsewhere": "Elsewhere",
    "contact.careers": "Working with us",
    "contact.press": "Press",
    "contact.findUs": "Find us",

    /* -- media and design detail --------------------------------------- */
    "media.excerpt": "Excerpt",
    "media.note": "Note",
    "media.related": "Related project",
    "design.about": "About",
    "design.facts": "Facts",
  },

  fa: {
    /* -- navigation ---------------------------------------------------- */
    "nav.projects": "پروژه‌ها",
    "nav.design": "طراحی",
    "nav.media": "رسانه",
    "nav.studio": "دفتر",
    "nav.contact": "تماس",

    "cap.projects": "هفتاد و شش کار، ساخته یا ترسیم‌شده",
    "cap.design": "اشیا، نشانه‌ها و جزئیات",
    "cap.media": "منتشرشده، جایزه‌گرفته، نمایش‌داده‌شده",
    "cap.studio": "ما که هستیم و چرا",
    "cap.contact": "دزاشیب، تهران",

    /* -- chrome -------------------------------------------------------- */
    "ui.close": "بستن",
    "ui.selectSection": "یک بخش را انتخاب کنید",
    "ui.escToClose": "Esc برای بستن",
    "ui.home": "خانه",
    "ui.skip": "پرش به فهرست بخش‌ها",
    "ui.open": "باز کردن",
    "ui.view": "مشاهده",
    "ui.back": "بازگشت",
    "ui.allProjects": "همه پروژه‌ها",
    "ui.allWorks": "همه کارها",
    "ui.allMedia": "همه موارد",
    "ui.clearAll": "پاک کردن همه",
    "ui.loading": "در حال بارگذاری",
    "ui.language": "زبان",
    "ui.tehran": "تهران",
    "ui.est": "تأسیس 2007",
    "ui.projectsCount": "76 پروژه",
    "ui.projects": "پروژه",
    "ui.works": "کار",
    "ui.entries": "مورد",
    "ui.langEn": "English",
    "ui.langFa": "فارسی",

    /* -- filtering ----------------------------------------------------- */
    "filter.type": "نوع",
    "filter.status": "وضعیت",
    "filter.scale": "مقیاس",
    "filter.year": "سال",
    "filter.category": "دسته",
    "filter.kind": "گونه",
    "filter.shown": "مورد",
    "filter.nothing": "هنوز چیزی در این دسته نیست.",
    "filter.noMatch": "هیچ پروژه‌ای با این فیلترها همخوانی ندارد.",
    "filter.noKind": "چیزی از این گونه نیست.",

    /* -- taxonomy: project type ---------------------------------------- */
    "type.Residential": "مسکونی",
    "type.Villa": "ویلا",
    "type.Office": "اداری",
    "type.Hospitality": "اقامتی و پذیرایی",
    "type.Commercial": "تجاری",
    "type.Complex": "مجتمع",
    "type.Interior Design": "طراحی داخلی",
    "type.Renovation": "بازسازی",
    "type.Public": "عمومی",
    "type.Urban Design": "طراحی شهری",
    "type.Industrial": "صنعتی",

    /* -- taxonomy: status, scale --------------------------------------- */
    "status.Completed": "ساخته‌شده",
    "status.Under Construction": "در دست ساخت",
    "status.Concept": "طرح مفهومی",

    "scale.Small": "کوچک",
    "scale.Medium": "متوسط",
    "scale.Large": "بزرگ",

    /* -- taxonomy: design category ------------------------------------- */
    "cat.Branding": "هویت بصری",
    "cat.Detail Design": "طراحی جزئیات",
    "cat.Product": "محصول",
    "cat.Furniture": "مبلمان",
    "cat.Signage": "نشانه‌گذاری",
    "cat.Exhibition": "نمایشگاه",

    /* -- taxonomy: media kind ------------------------------------------ */
    "kind.Publication": "انتشار",
    "kind.Award": "جایزه",
    "kind.Exhibition": "نمایشگاه",
    "kind.Lecture": "سخنرانی",

    /* -- specification rows -------------------------------------------- */
    "spec.type": "نوع",
    "spec.status": "وضعیت",
    "spec.scale": "مقیاس",
    "spec.year": "سال",
    "spec.location": "موقعیت",
    "spec.area": "مساحت",
    "spec.client": "کارفرما",
    "spec.team": "تیم طراحی",
    "spec.scope": "شرح خدمات",
    "spec.materials": "مصالح",
    "spec.outlet": "منبع",
    "spec.author": "نویسنده",
    "spec.project": "پروژه",

    /* -- studio -------------------------------------------------------- */
    "studio.practice": "دفتر",
    "studio.founders": "بنیان‌گذاران",
    "studio.numbers": "در اعداد",
    "studio.history": "تاریخچه",
    "studio.awards": "جوایز",
    "studio.people": "همکاران",
    "studio.previously": "همکاران پیشین",
    "studio.name": "نام",
    "studio.approach": "رویکرد",

    /* -- contact ------------------------------------------------------- */
    "contact.address": "نشانی",
    "contact.telephone": "تلفن",
    "contact.email": "ایمیل",
    "contact.hours": "ساعت کار",
    "contact.elsewhere": "جاهای دیگر",
    "contact.careers": "همکاری با ما",
    "contact.press": "روابط رسانه‌ای",
    "contact.findUs": "روی نقشه",

    /* -- media and design detail --------------------------------------- */
    "media.excerpt": "گزیده",
    "media.note": "یادداشت",
    "media.related": "پروژه مرتبط",
    "design.about": "درباره",
    "design.facts": "مشخصات",
  },
};

/* -------------------------------------------------------------------------
   numerals
   ------------------------------------------------------------------------- */

export const DIGITS_FA = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Latin digits -> Persian digits. Leaves everything else alone. */
export const faDigits = (s) => String(s).replace(/[0-9]/g, (d) => DIGITS_FA[+d]);

/* --------------------------------------------------------------------------
   Chrome strings the shell needs that are not part of any panel.
   -------------------------------------------------------------------------- */
Object.assign(STRINGS.en, {
  'brand.name': 'Kavan Studio',
  'brand.tagline': 'Architecture & Design',
  'ui.irst': 'IRST',
  'ui.opened': 'section opened',
  'ui.returned': 'Returned to index',
});
Object.assign(STRINGS.fa, {
  'brand.name': 'استودیو کاوان',
  'brand.tagline': 'معماری و طراحی',
  'ui.irst': 'به وقت تهران',
  'ui.opened': 'باز شد',
  'ui.returned': 'بازگشت به فهرست',
});

/* Count nouns for the Design and Media rails, and the captions under the
   three drawing plates on a detail page. */
Object.assign(STRINGS.en, {
  'ui.worksCount': 'Works',
  'ui.entriesCount': 'Entries',
  'kindName.elevation': 'Elevation',
  'kindName.massing': 'Massing',
  'kindName.court': 'Courtyard',
  'kindName.section': 'Section',
  'kindName.plan': 'Plan',
  'kindName.screen': 'Screen',
  'kindName.contour': 'Site',
});
Object.assign(STRINGS.fa, {
  'ui.worksCount': 'اثر',
  'ui.entriesCount': 'مورد',
  'kindName.elevation': 'نما',
  'kindName.massing': 'حجم',
  'kindName.court': 'حیاط',
  'kindName.section': 'مقطع',
  'kindName.plan': 'پلان',
  'kindName.screen': 'مشبک',
  'kindName.contour': 'سایت',
});

/* Corrections: these three had their numbers baked into the string, which
   double-printed once the interface started supplying the figure itself (and
   would never have converted to Persian digits). "Studio" as the heading for
   the team also collided with the section title. */
Object.assign(STRINGS.en, {
  'ui.est': 'Est.',
  'ui.projectsCount': 'Projects',
  'studio.people': 'People',
});
Object.assign(STRINGS.fa, {
  'ui.est': 'تأسیس',
  'ui.projectsCount': 'پروژه',
  'studio.people': 'همکاران',
});
