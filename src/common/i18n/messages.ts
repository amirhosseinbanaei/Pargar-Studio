// src/common/i18n/messages.ts
/**
 * The interface dictionary — every string the CHROME renders, in both locales.
 *
 * Ported from `legacy/data/i18n.js:11`, key structure preserved EXACTLY. The keys are not
 * an internal detail: the ported stylesheets, the shell module and the projects module all
 * name them, so renaming one here is a repo-wide rename, not a local edit.
 *
 * Nothing here is content. Project titles, blurbs, the studio manifesto and the contact
 * block live in the database as per-locale column pairs (`@/common/services/schema`) and
 * are rendered verbatim. This file is only the interface talking about itself.
 *
 * TWO PORTING NOTES, both from the tail of the legacy file:
 *
 *  - `legacy/data/i18n.js:326` re-assigns `ui.est`, `ui.projectsCount` and `studio.people`
 *    over their earlier definitions, because the originals baked the figure into the
 *    string ("Est. 2007", "76 Projects") and double-printed once the interface started
 *    supplying the number itself — and a baked-in "2007" could never become Persian
 *    digits. The MERGED values are what this file declares; the superseded ones are gone,
 *    not kept as dead entries.
 *  - Numbers stay in LATIN digits here, exactly as they do in the database
 *    (`legacy/data/projects.fa.part1.js:3`). `num()` in `./translator` converts at render
 *    time, which is the only place conversion may happen: a Persian numeral stored in a
 *    string cannot be searched, sorted or compared.
 */

/**
 * English is the SOURCE OF KEYS. `MessageKey` is derived from it and `fa` below is typed
 * as a total record over that key set, so a missing Persian string is a type error rather
 * than a runtime fallback nobody notices. That is stricter than the legacy runtime, whose
 * `t()` degraded fa -> en -> key silently; `./translator` keeps that degradation for
 * dynamic lookups (`term()` on a value from the database), where it is genuinely needed.
 */
export const en = {
  /* -- navigation ---------------------------------------------------- */
  'nav.projects': 'Projects',
  'nav.design': 'Design',
  'nav.media': 'Media',
  'nav.studio': 'Studio',
  'nav.contact': 'Contact',

  'cap.projects': 'Seventy-six built and drawn',
  'cap.design': 'Objects, marks and details',
  'cap.media': 'Published, awarded, shown',
  'cap.studio': 'Who we are and why',
  'cap.contact': 'Dezashib, Tehran',

  /* -- chrome -------------------------------------------------------- */
  'ui.close': 'Close',
  'ui.selectSection': 'Select a section',
  'ui.escToClose': 'Esc to close',
  'ui.home': 'Home',
  'ui.skip': 'Skip to navigation',
  'ui.open': 'Open',
  'ui.view': 'View',
  'ui.back': 'Back',
  'ui.allProjects': 'All projects',
  'ui.allWorks': 'All works',
  'ui.allMedia': 'All entries',
  'ui.clearAll': 'Clear all',
  'ui.loading': 'Loading',
  /**
   * ADDED IN PROMPT 4 alongside `ui.sections`, and for the same kind of reason: the legacy
   * site had no route-level failure state to name, because a failed panel simply never
   * mounted. A real route can fail, and `error.tsx` must say what failed in the reader's
   * language rather than in English on a Persian page.
   *
   * The Persian here is AUTHORED, not ported — the only three strings in this file that
   * are. Flagged in AGENTS.md for a native reader to confirm.
   */
  'ui.retry': 'Try again',
  'error.title': 'Something went wrong',
  'error.notFound': 'This page does not exist.',
  'ui.language': 'Language',
  /**
   * ADDED IN PROMPT 4, and the only key that is not in `legacy/data/i18n.js`. The legacy
   * markup hardcoded `aria-label="Sections"` on the column nav
   * (`legacy/index.html:106`), which announced English to a Persian reader on a page that
   * is otherwise entirely Persian. The Persian below is LIFTED from `ui.skip`
   * ("پرش به فهرست بخش‌ها"), not composed — the word is already in the dictionary.
   */
  'ui.sections': 'Sections',
  'ui.tehran': 'Tehran',
  'ui.est': 'Est.',
  'ui.projectsCount': 'Projects',
  'ui.projects': 'Projects',
  'ui.works': 'Works',
  'ui.entries': 'Entries',
  'ui.langEn': 'English',
  'ui.langFa': 'فارسی',

  /* -- filtering ----------------------------------------------------- */
  'filter.type': 'Type',
  'filter.status': 'Status',
  'filter.scale': 'Scale',
  'filter.year': 'Year',
  'filter.category': 'Category',
  'filter.kind': 'Kind',
  'filter.shown': 'Shown',
  'filter.nothing': 'Nothing in this category yet.',
  'filter.noMatch': 'No projects match these filters.',
  'filter.noKind': 'Nothing of this kind.',

  /* -- taxonomy: project type ---------------------------------------- */
  'type.Residential': 'Residential',
  'type.Villa': 'Villa',
  'type.Office': 'Office',
  'type.Hospitality': 'Hospitality',
  'type.Commercial': 'Commercial',
  'type.Complex': 'Complex',
  'type.Interior Design': 'Interior Design',
  'type.Renovation': 'Renovation',
  'type.Public': 'Public',
  'type.Urban Design': 'Urban Design',
  'type.Industrial': 'Industrial',

  /* -- taxonomy: status, scale --------------------------------------- */
  'status.Completed': 'Completed',
  'status.Under Construction': 'Under Construction',
  'status.Concept': 'Concept',

  'scale.Small': 'Small',
  'scale.Medium': 'Medium',
  'scale.Large': 'Large',

  /* -- taxonomy: design category ------------------------------------- */
  'cat.Branding': 'Branding',
  'cat.Detail Design': 'Detail Design',
  'cat.Product': 'Product',
  'cat.Furniture': 'Furniture',
  'cat.Signage': 'Signage',
  'cat.Exhibition': 'Exhibition',

  /* -- taxonomy: media kind ------------------------------------------ */
  'kind.Publication': 'Publication',
  'kind.Award': 'Award',
  'kind.Exhibition': 'Exhibition',
  'kind.Lecture': 'Lecture',

  /* -- specification rows -------------------------------------------- */
  'spec.type': 'Type',
  'spec.status': 'Status',
  'spec.scale': 'Scale',
  'spec.year': 'Year',
  'spec.location': 'Location',
  'spec.area': 'Area',
  'spec.client': 'Client',
  'spec.team': 'Team',
  'spec.scope': 'Scope',
  'spec.materials': 'Materials',
  'spec.outlet': 'Outlet',
  'spec.author': 'Author',
  'spec.project': 'Project',

  /* -- studio -------------------------------------------------------- */
  'studio.practice': 'Practice',
  'studio.founders': 'Founders',
  'studio.numbers': 'In numbers',
  'studio.history': 'History',
  'studio.awards': 'Awards',
  'studio.people': 'People',
  'studio.previously': 'Previously',
  'studio.name': 'The name',
  'studio.approach': 'Approach',

  /* -- contact ------------------------------------------------------- */
  'contact.address': 'Address',
  'contact.telephone': 'Telephone',
  'contact.email': 'Email',
  'contact.hours': 'Hours',
  'contact.elsewhere': 'Elsewhere',
  'contact.careers': 'Working with us',
  'contact.press': 'Press',
  'contact.findUs': 'Find us',

  /* -- the contact form (prompt 5) ----------------------------------- *
   * The legacy site had no form of any kind, so none of these keys are  *
   * ports: the Persian below is AUTHORED, like `ui.sections` and the    *
   * `error.*` pair in prompt 4, and is flagged in AGENTS.md for a       *
   * native reader to confirm.                                          */
  'form.write': 'Write to us',
  'form.intro': 'A message here reaches the studio directly. We answer within a few working days.',
  'form.name': 'Name',
  'form.email': 'Email',
  'form.subject': 'Subject',
  'form.message': 'Message',
  'form.send': 'Send message',
  'form.sent': 'Thank you — your message has reached the studio.',
  'form.failed': 'The message could not be sent. Please try again.',
  'form.tooMany':
    'Several messages have already come from this connection. Please try again later.',
  'form.errName': 'Please enter your name.',
  'form.errEmail': 'Please enter a valid email address.',
  'form.errSubject': 'Please enter a subject.',
  'form.errMessage': 'Please write at least a few words.',
  'form.errLong': 'This is longer than the studio inbox accepts.',

  /* -- media and design detail --------------------------------------- */
  'media.excerpt': 'Excerpt',
  'media.note': 'Note',
  'media.related': 'Related project',
  'design.about': 'About',
  'design.facts': 'Facts',

  /* -- brand and shell chrome (legacy/data/i18n.js:288) --------------- */
  'brand.name': 'Kavan Studio',
  'brand.tagline': 'Architecture & Design',
  /**
   * `legacy/data/studio.js:14`. It lives here rather than in `constants/site.ts` because
   * it is TRANSLATED (`legacy/data/studio.fa.js:10`) and a constant cannot be bilingual;
   * the studio page prints it under "The name".
   */
  'brand.meaning': 'kavān — the arc a thing travels through',
  'ui.irst': 'IRST',
  'ui.opened': 'section opened',
  'ui.returned': 'Returned to index',

  /* -- count nouns and drawing-plate captions (legacy/data/i18n.js:302) */
  'ui.worksCount': 'Works',
  'ui.entriesCount': 'Entries',
  'kindName.elevation': 'Elevation',
  'kindName.massing': 'Massing',
  'kindName.court': 'Courtyard',
  'kindName.section': 'Section',
  'kindName.plan': 'Plan',
  'kindName.screen': 'Screen',
  'kindName.contour': 'Site',
} as const;

/** Every key the interface may ask for. Derived, never hand-listed. */
export type MessageKey = keyof typeof en;

/**
 * Persian, verbatim from `legacy/data/i18n.js:142`. The zero-width non-joiners in
 * `پروژه‌ها`, `ساخته‌شده`, `نشانه‌گذاری` and friends are MEANINGFUL — they are what keeps
 * the words from joining across a morpheme boundary. Do not "clean up" the spacing, do
 * not normalize, and do not re-type these by hand.
 */
export const fa: Record<MessageKey, string> = {
  /* -- navigation ---------------------------------------------------- */
  'nav.projects': 'پروژه‌ها',
  'nav.design': 'طراحی',
  'nav.media': 'رسانه',
  'nav.studio': 'دفتر',
  'nav.contact': 'تماس',

  'cap.projects': 'هفتاد و شش کار، ساخته یا ترسیم‌شده',
  'cap.design': 'اشیا، نشانه‌ها و جزئیات',
  'cap.media': 'منتشرشده، جایزه‌گرفته، نمایش‌داده‌شده',
  'cap.studio': 'ما که هستیم و چرا',
  'cap.contact': 'دزاشیب، تهران',

  /* -- chrome -------------------------------------------------------- */
  'ui.close': 'بستن',
  'ui.selectSection': 'یک بخش را انتخاب کنید',
  'ui.escToClose': 'Esc برای بستن',
  'ui.home': 'خانه',
  'ui.skip': 'پرش به فهرست بخش‌ها',
  'ui.open': 'باز کردن',
  'ui.view': 'مشاهده',
  'ui.back': 'بازگشت',
  'ui.allProjects': 'همه پروژه‌ها',
  'ui.allWorks': 'همه کارها',
  'ui.allMedia': 'همه موارد',
  'ui.clearAll': 'پاک کردن همه',
  'ui.loading': 'در حال بارگذاری',
  'ui.retry': 'تلاش دوباره',
  'error.title': 'خطایی رخ داد',
  'error.notFound': 'این صفحه وجود ندارد.',
  'ui.language': 'زبان',
  'ui.sections': 'بخش‌ها',
  'ui.tehran': 'تهران',
  'ui.est': 'تأسیس',
  'ui.projectsCount': 'پروژه',
  'ui.projects': 'پروژه',
  'ui.works': 'کار',
  'ui.entries': 'مورد',
  'ui.langEn': 'English',
  'ui.langFa': 'فارسی',

  /* -- filtering ----------------------------------------------------- */
  'filter.type': 'نوع',
  'filter.status': 'وضعیت',
  'filter.scale': 'مقیاس',
  'filter.year': 'سال',
  'filter.category': 'دسته',
  'filter.kind': 'گونه',
  'filter.shown': 'مورد',
  'filter.nothing': 'هنوز چیزی در این دسته نیست.',
  'filter.noMatch': 'هیچ پروژه‌ای با این فیلترها همخوانی ندارد.',
  'filter.noKind': 'چیزی از این گونه نیست.',

  /* -- taxonomy: project type ---------------------------------------- */
  'type.Residential': 'مسکونی',
  'type.Villa': 'ویلا',
  'type.Office': 'اداری',
  'type.Hospitality': 'اقامتی و پذیرایی',
  'type.Commercial': 'تجاری',
  'type.Complex': 'مجتمع',
  'type.Interior Design': 'طراحی داخلی',
  'type.Renovation': 'بازسازی',
  'type.Public': 'عمومی',
  'type.Urban Design': 'طراحی شهری',
  'type.Industrial': 'صنعتی',

  /* -- taxonomy: status, scale --------------------------------------- */
  'status.Completed': 'ساخته‌شده',
  'status.Under Construction': 'در دست ساخت',
  'status.Concept': 'طرح مفهومی',

  'scale.Small': 'کوچک',
  'scale.Medium': 'متوسط',
  'scale.Large': 'بزرگ',

  /* -- taxonomy: design category ------------------------------------- */
  'cat.Branding': 'هویت بصری',
  'cat.Detail Design': 'طراحی جزئیات',
  'cat.Product': 'محصول',
  'cat.Furniture': 'مبلمان',
  'cat.Signage': 'نشانه‌گذاری',
  'cat.Exhibition': 'نمایشگاه',

  /* -- taxonomy: media kind ------------------------------------------ */
  'kind.Publication': 'انتشار',
  'kind.Award': 'جایزه',
  'kind.Exhibition': 'نمایشگاه',
  'kind.Lecture': 'سخنرانی',

  /* -- specification rows -------------------------------------------- */
  'spec.type': 'نوع',
  'spec.status': 'وضعیت',
  'spec.scale': 'مقیاس',
  'spec.year': 'سال',
  'spec.location': 'موقعیت',
  'spec.area': 'مساحت',
  'spec.client': 'کارفرما',
  'spec.team': 'تیم طراحی',
  'spec.scope': 'شرح خدمات',
  'spec.materials': 'مصالح',
  'spec.outlet': 'منبع',
  'spec.author': 'نویسنده',
  'spec.project': 'پروژه',

  /* -- studio -------------------------------------------------------- */
  'studio.practice': 'دفتر',
  'studio.founders': 'بنیان‌گذاران',
  'studio.numbers': 'در اعداد',
  'studio.history': 'تاریخچه',
  'studio.awards': 'جوایز',
  'studio.people': 'همکاران',
  'studio.previously': 'همکاران پیشین',
  'studio.name': 'نام',
  'studio.approach': 'رویکرد',

  /* -- contact ------------------------------------------------------- */
  'contact.address': 'نشانی',
  'contact.telephone': 'تلفن',
  'contact.email': 'ایمیل',
  'contact.hours': 'ساعت کار',
  'contact.elsewhere': 'جاهای دیگر',
  'contact.careers': 'همکاری با ما',
  'contact.press': 'روابط رسانه‌ای',
  'contact.findUs': 'روی نقشه',

  /* -- the contact form (prompt 5, AUTHORED) ------------------------- */
  'form.write': 'برای ما بنویسید',
  'form.intro': 'پیام شما مستقیم به دفتر می‌رسد. معمولاً ظرف چند روز کاری پاسخ می‌دهیم.',
  'form.name': 'نام',
  'form.email': 'ایمیل',
  'form.subject': 'موضوع',
  'form.message': 'پیام',
  'form.send': 'ارسال پیام',
  'form.sent': 'سپاسگزاریم — پیام شما به دفتر رسید.',
  'form.failed': 'پیام ارسال نشد. لطفاً دوباره تلاش کنید.',
  'form.tooMany': 'از این اتصال چند پیام فرستاده شده است. لطفاً بعداً دوباره تلاش کنید.',
  'form.errName': 'لطفاً نام خود را وارد کنید.',
  'form.errEmail': 'لطفاً یک نشانی ایمیل معتبر وارد کنید.',
  'form.errSubject': 'لطفاً موضوع را وارد کنید.',
  'form.errMessage': 'لطفاً دست‌کم چند کلمه بنویسید.',
  'form.errLong': 'این متن از اندازه‌ای که صندوق دفتر می‌پذیرد بلندتر است.',

  /* -- media and design detail --------------------------------------- */
  'media.excerpt': 'گزیده',
  'media.note': 'یادداشت',
  'media.related': 'پروژه مرتبط',
  'design.about': 'درباره',
  'design.facts': 'مشخصات',

  /* -- brand and shell chrome ---------------------------------------- */
  'brand.name': 'استودیو کاوان',
  'brand.tagline': 'معماری و طراحی',
  'brand.meaning':
    'کاوان — کمانی که هر چیز مسیرش را در آن می‌پیماید؛ هم‌خانواده پرگار: یکی دایره را می‌کشد، دیگری گشودگی همان دایره است',
  'ui.irst': 'به وقت تهران',
  'ui.opened': 'باز شد',
  'ui.returned': 'بازگشت به فهرست',

  /* -- count nouns and drawing-plate captions ------------------------ */
  'ui.worksCount': 'اثر',
  'ui.entriesCount': 'مورد',
  'kindName.elevation': 'نما',
  'kindName.massing': 'حجم',
  'kindName.court': 'حیاط',
  'kindName.section': 'مقطع',
  'kindName.plan': 'پلان',
  'kindName.screen': 'مشبک',
  'kindName.contour': 'سایت',
};

/** The two tables, keyed by locale. Consumed only by `./translator`. */
export const MESSAGES = { en, fa } as const;
