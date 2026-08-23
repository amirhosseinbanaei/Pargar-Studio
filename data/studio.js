/**
 * KAVAN STUDIO — editorial content.
 * Architecture & Design, Tehran. Founded 2007.
 */

export const BRAND = {
  name: 'KAVAN STUDIO',
  short: 'KAVAN',
  tagline: 'Architecture & Design',
  city: 'Tehran',
  founded: 2007,
  /* kavān — the arc a thing travels through. A sibling to pargar, the
     drafting compass: one draws the circle, the other is the sweep of it. */
  meaning: 'kavān — the arc a thing travels through',
};

export const NAV = [
  { id: 'projects', label: 'Projects', path: '/projects', caption: 'Seventy-six built and drawn' },
  { id: 'design',   label: 'Design',   path: '/design',   caption: 'Objects, marks and details' },
  { id: 'media',    label: 'Media',    path: '/media',    caption: 'Published, awarded, shown' },
  { id: 'studio',   label: 'Studio',   path: '/studio',   caption: 'Who we are and why' },
  { id: 'contact',  label: 'Contact',  path: '/contact',  caption: 'Dezashib, Tehran' },
];

export const STUDIO = {
  founders: [
    {
      name: 'Farhad Rastgar',
      role: 'Co-founder, Principal',
      born: 'Born 1978, Tabriz',
      bio: 'Studied architecture at Shahid Beheshti University and took a master ' +
        'degree in urban design at the University of Tehran. He worked for six years ' +
        'on public and institutional buildings before starting the studio. His interest ' +
        'is in how a building meets the ground and how it ages: the joint, the threshold, ' +
        'the weathering of brick. He has taught construction studio at Pars University ' +
        'since 2012.',
    },
    {
      name: 'Mahsa Aminzadeh',
      role: 'Co-founder, Principal',
      born: 'Born 1980, Tehran',
      bio: 'Studied architecture at Shahid Beheshti University and completed a master ' +
        'degree in architectural technology at the University of Tehran. She led housing ' +
        'projects in Tehran before the studio was founded. Her work concentrates on the ' +
        'plan as a social instrument and on daylight as a material. She has taught design ' +
        'studio at Shahid Beheshti University since 2014.',
    },
  ],

  manifesto:
    'We build in a city that rebuilds itself every twenty years. Against that, we are ' +
    'interested in what lasts: a wall that carries its own weight honestly, a courtyard ' +
    'that cools a house without machinery, a stair positioned so that a family passes ' +
    'each other on it. Iranian architecture solved these problems for a thousand years ' +
    'and we would rather learn from it than quote it. So we work with brick because it ' +
    'is what our masons know, we cut voids because Tehran light is too strong to admit ' +
    'directly, and we draw every junction at 1:5 before anything is poured. The result ' +
    'should look inevitable rather than designed.',

  stats: [
    { label: 'Founded', value: '2007' },
    { label: 'Projects', value: '76' },
    { label: 'Studio', value: '22' },
    { label: 'Awards', value: '9' },
  ],

  team: [
    'Sepehr Ansari', 'Golnaz Bahrami', 'Kaveh Daneshvar', 'Niloofar Ebadi',
    'Arman Fallahi', 'Yasaman Ghazanfari', 'Pouya Haghighi', 'Sahar Iravani',
    'Nima Jahanbakhsh', 'Roya Kamalvand', 'Behrang Lotfi', 'Mitra Mahdavi',
    'Sina Naderi', 'Parisa Omidvar', 'Ramin Panahi', 'Shirin Qorbani',
    'Amir Rahmani', 'Tara Sadeghpour', 'Kian Tehrani', 'Nazanin Vahdati',
    'Milad Yazdani', 'Donya Zamani',
  ],

  alumni: [
    'Ashkan Abtahi', 'Baran Adibi', 'Cyrus Afzali', 'Dorsa Alipour',
    'Elnaz Amouzegar', 'Farzad Ansarian', 'Ghazal Arjomand', 'Hoda Asadollahi',
    'Iman Azimifar', 'Jaleh Bagheri', 'Kamran Barzin', 'Ladan Behnam',
    'Mehran Chavoshi', 'Negin Dadras', 'Omid Delavari', 'Paniz Eshraghi',
    'Reza Fardin', 'Saba Farhadi', 'Taraneh Gharibi', 'Vahid Golzar',
    'Yalda Hakimi', 'Zohreh Hedayat', 'Arsalan Imani', 'Bita Jafarzadeh',
    'Danial Kariman', 'Elham Khalili', 'Farnaz Lajevardi', 'Gholam Madani',
    'Hessam Moinzadeh', 'Ilia Nasrollahi', 'Jasmin Ostovar', 'Kourosh Parvizi',
    'Leila Qaderi', 'Mani Rouhani', 'Nastaran Sabet', 'Orkideh Shahriari',
    'Peyman Tabatabai', 'Roshanak Vaziri', 'Saman Yeganeh', 'Termeh Zolfaghari',
  ],

  awards: [
    { year: 2024, title: 'Memar Award — Residential, First Prize', project: 'Qeytarieh 08 Residence',
      body: 'Memar Magazine, Tehran' },
    { year: 2023, title: 'Shortlist — Housing', project: 'Darrous Court Residence',
      body: 'Aga Khan Award for Architecture' },
    { year: 2022, title: 'Honourable Mention — Hospitality', project: 'Sofreh Restaurant',
      body: '2A Asia Architecture Award' },
    { year: 2020, title: 'Memar Award — Interior, Second Prize', project: 'Bahar Book Cafe',
      body: 'Memar Magazine, Tehran' },
    { year: 2018, title: 'Selected Work — Brick', project: 'Farmanieh 12 Residence',
      body: 'Wienerberger Brick Award, Vienna' },
    { year: 2016, title: 'Young Practice of the Year', project: 'Studio body of work',
      body: 'Iranian Institute of Architects' },
  ],

  chapters: [
    { year: '2007', text: 'The studio opens in two rooms above a workshop in Dezashib with three people and one commission, a small apartment renovation in Qeytarieh.' },
    { year: '2011', text: 'First ground-up residential building completed in Velenjak. The brick screen developed for it becomes a recurring instrument in later work.' },
    { year: '2015', text: 'The practice moves to its present studio and grows to fourteen. Work extends beyond Tehran to the Caspian and to Isfahan.' },
    { year: '2019', text: 'A dedicated detail-design group forms inside the studio, drawing every junction at 1:5 and prototyping with the masons directly.' },
    { year: '2025', text: 'Seventy-six projects. Twenty-two people. The same interest in the joint, the threshold and the weathering of brick.' },
  ],
};

export const MEDIA = [
  { id: 1, title: 'Qeytarieh 08 Residence', outlet: 'ArchDaily', type: 'Publication', year: 2025,
    blurb: 'A long feature on the stepped brick facade and the shared roof terrace.' },
  { id: 2, title: 'Sofreh Restaurant', outlet: 'Dezeen', type: 'Publication', year: 2024,
    blurb: 'The vaulted dining room photographed empty, before service.' },
  { id: 3, title: 'Darrous Court Residence', outlet: 'Divisare', type: 'Publication', year: 2024,
    blurb: 'Full drawing set published alongside the photography.' },
  { id: 4, title: 'On Brick and Its Masons', outlet: 'Memar Magazine', type: 'Publication', year: 2024,
    blurb: 'An essay by the founders on working with Tehran brick trades.' },
  { id: 5, title: 'Qeytarieh 08 Residence', outlet: 'Memar Award', type: 'Award', year: 2024,
    blurb: 'First prize, residential category.' },
  { id: 6, title: 'Lavasan Ridge Villa', outlet: 'Architizer', type: 'Publication', year: 2023,
    blurb: 'Selected in the annual review of houses on difficult ground.' },
  { id: 7, title: 'Drawing the Joint', outlet: 'Pars University', type: 'Lecture', year: 2023,
    blurb: 'A public lecture on detail as the carrier of architectural intent.' },
  { id: 8, title: 'Darrous Court Residence', outlet: 'Aga Khan Award', type: 'Award', year: 2023,
    blurb: 'Shortlisted in the housing category.' },
  { id: 9, title: 'Bahar Book Cafe', outlet: 'Frame', type: 'Publication', year: 2022,
    blurb: 'Interior feature on the oak shelving wall and its clerestory.' },
  { id: 10, title: 'Seven Houses', outlet: 'Tehran Architecture Biennale', type: 'Exhibition', year: 2022,
    blurb: 'Seven residential projects shown as models at 1:50.' },
  { id: 11, title: 'Sofreh Restaurant', outlet: '2A Asia Architecture Award', type: 'Award', year: 2022,
    blurb: 'Honourable mention, hospitality.' },
  { id: 12, title: 'Ekbatan Workshop Building', outlet: 'ArchEyes', type: 'Publication', year: 2021,
    blurb: 'On adapting an industrial shed without erasing it.' },
  { id: 13, title: 'Bahar Book Cafe', outlet: 'Memar Award', type: 'Award', year: 2020,
    blurb: 'Second prize, interior category.' },
  { id: 14, title: 'Farmanieh 12 Residence', outlet: 'Wienerberger Brick Award', type: 'Award', year: 2018,
    blurb: 'Selected work, international brick architecture.' },
];

export const DESIGN_WORKS = [
  { id: 1, slug: 'kavan-identity', title: 'Kavan Studio Identity', category: 'Branding', year: 2021,
    blurb: 'A wordmark built on a single drafting arc, and the drawing conventions that follow from it.' },
  { id: 2, slug: 'qeytarieh-brick-bond', title: 'Qeytarieh Brick Bond', category: 'Detail Design', year: 2024,
    blurb: 'A shading bond developed with the masons, turned out of plane by twenty degrees.' },
  { id: 3, slug: 'sofreh-identity', title: 'Sofreh Restaurant Identity', category: 'Branding', year: 2022,
    blurb: 'Menu, signage and tableware drawn from the vault geometry of the room.' },
  { id: 4, slug: 'ravaq-bench', title: 'Ravaq Bench', category: 'Furniture', year: 2023,
    blurb: 'A solid walnut bench for a courtyard arcade, jointed without visible fixings.' },
  { id: 5, slug: 'darrous-handrail', title: 'Darrous Handrail', category: 'Detail Design', year: 2023,
    blurb: 'Blackened steel and oiled oak, resolved so the two materials never share a plane.' },
  { id: 6, slug: 'aab-basin', title: 'Aab Basin', category: 'Product', year: 2022,
    blurb: 'A cast stone washbasin whose overflow reads as a drawn line.' },
  { id: 7, slug: 'seven-houses-exhibition', title: 'Seven Houses', category: 'Exhibition', year: 2022,
    blurb: 'Exhibition design for seven residential models, lit from above only.' },
  { id: 8, slug: 'niavaran-signage', title: 'Niavaran Wayfinding', category: 'Signage', year: 2020,
    blurb: 'Etched brass plates set flush into brick, legible in raking light.' },
  { id: 9, slug: 'kavan-drawing-set', title: 'Studio Drawing Standard', category: 'Detail Design', year: 2019,
    blurb: 'The line weights, hatches and title blocks every project in the office is drawn to.' },
];

export const CONTACT = {
  address: 'No. 24, Shahrzad Alley, Dezashib',
  district: 'Dezashib',
  city: 'Tehran',
  country: 'Iran',
  postcode: '1934873156',
  phone: '+98 21 2612 4180',
  phoneHref: '+982126124180',
  email: 'studio@kavan.studio',
  press: 'press@kavan.studio',
  hours: 'Saturday to Wednesday, 09:00 — 18:00',
  coordinates: { lat: 35.8112, lng: 51.4562 },
  socials: [
    { name: 'Instagram', handle: '@kavanstudio' },
    { name: 'LinkedIn', handle: 'kavan-studio' },
    { name: 'Telegram', handle: '@kavanstudio' },
    { name: 'Divisare', handle: 'kavan-studio' },
  ],
  careers:
    'We read every portfolio that arrives. Send work as a single PDF under 10MB to ' +
    'studio@kavan.studio with a short note about what you want to learn.',
};
