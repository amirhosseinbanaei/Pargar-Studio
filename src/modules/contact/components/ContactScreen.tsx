// src/modules/contact/components/ContactScreen.tsx
/**
 * The contact page: where the studio is, and the one form on the public site.
 *
 * Ported from `legacy/js/ui/panel.js:447` — the tall band, the three-column detail grid,
 * and the site-plan slot beside the address. A Server Component; the only client JavaScript
 * below it is the form's own leaf.
 *
 * ─── ~~THE DRAWN SITE PLAN~~ TWO PHOTOGRAPH SLOTS SINCE PROMPT 14 ────────────────
 * Both pictures on this page were generated from CONSTANTS: an `elevation` at
 * `kavan-dezashib-street` across the top, and a `court` at `kavan-dezashib-site` beside the
 * address with a pin over it. Neither was ever a fact about this studio — that was the
 * point of the fixed seeds, and prompt 5's decision that seeding from the address would
 * "silently redraw the plan the first time an editor fixes a typo in it" was correct for
 * as long as the alternative was another generated picture.
 *
 * Prompt 14 gave the record a cover and a gallery, so the alternative is now a real
 * photograph and both slots take one — the cover on the band, the gallery's first image on
 * the plan. With neither uploaded the boxes are empty. THERE IS STILL NO EMBEDDED MAP and
 * that half of the decision is unchanged and unrelated: no third-party script, no consent
 * question, no tile bill. The coordinates are still the caption.
 *
 * ─── LATIN RUNS ARE ISOLATED ──────────────────────────────────────────────────────
 * Phone, both email addresses, every social handle and the coordinate pair go through
 * `<Lat>`, which is `legacy/js/ui/panel.js:47`'s helper and the `.lat` rule already in
 * `i18n.css`. Without it the bidirectional algorithm reorders them against the Persian
 * around them at a line boundary, and `+98 21 2612 4180` comes apart into two halves.
 *
 * ─── THE SOCIALS ARE TEXT, NOT LINKS ──────────────────────────────────────────────
 * The legacy markup rendered them as `<a href="#">`. A placeholder href is a dead link,
 * and the record carries a platform name and a handle but no URL — so the honest port is
 * the name and the handle as text. Inventing `https://instagram.com/<handle>` would trade
 * a link that goes nowhere for a link that may go somewhere wrong. When the dashboard
 * grows a URL column, these become anchors.
 */
import Image from 'next/image';
import { GalleryBand } from '@/common/components/collection';
import { Lat } from '@/common/components/layout';
import { mediaUrl } from '@/common/constants/uploads';
import type { Dictionary } from '@/common/i18n';
import type { Contact } from '@/common/schemas/contact';
import { ContactForm } from './ContactForm';

/**
 * `.band--tall` runs the full content width — `100vw` less `.stage`'s
 * `clamp(1.25rem, 4.5vw, 5rem)` on each side, about 92vw at every width.
 */
const BAND_SIZES = '92vw';

/**
 * `.cmapwrap` is a two-column grid (`panel.css:745`) collapsing to one below 900px, and
 * `.cmap` is its first column. So the plate is about half the ~92vw content region on a
 * wide screen and the whole of it on a narrow one.
 */
const PLAN_SIZES = '(max-width: 900px) 92vw, 46vw';

export interface ContactScreenProps {
  contact: Contact;
  dictionary: Dictionary;
}

/**
 * `locale` was a third prop until prompt 8. Its only job was reaching `ContactForm`, which
 * needed it to build a dictionary in the browser; the form reads both from
 * `NextIntlClientProvider` now, so the screen has nothing left to forward.
 */
export function ContactScreen({ contact, dictionary }: ContactScreenProps) {
  const { t, num, list } = dictionary;

  // The gallery's first image fills the site-plan slot; the rest become a band below it.
  // The COVER is separate and fills the hero band at the top — see below.
  const [planImage, ...restOfGallery] = contact.gallery;

  return (
    <div className="route route--solo" id="main">
      <div className="route__main">
        <div className="sheet">
          {/*
            THE BAND HOLDS THE RECORD'S COVER NOW, OR NOTHING (prompt 14).
            It used to draw `elevation` at the fixed seed `kavan-dezashib-street` — seeded
            from a CONSTANT, so it depicted no particular street and nothing an editor saved
            could change it. The cover column this table gained is the honest occupant.
            Empty, the band keeps its ratio, ground and hairline from `panel.css`.
          */}
          <section className="band band--tall">
            <div className="band__art">
              {contact.cover && (
                <Image
                  src={mediaUrl(contact.cover.path)}
                  alt={contact.cover.alt}
                  fill
                  sizes={BAND_SIZES}
                  className="band__photo"
                />
              )}
            </div>
            <div className="band__cap">
              <span className="band__k">{contact.district}</span>
              <span className="band__v">{t('brand.name')}</span>
            </div>
          </section>

          <div className="cgrid">
            <div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.address')}</p>
                <p className="cblock__v">
                  {contact.address}
                  <br />
                  {list([contact.city, contact.country])}
                  <br />
                  {/* The postcode is shaped, not isolated: digits become Persian numerals
                      in Persian, so there is no Latin run left to isolate. */}
                  <span className="text-t-lo">{num(contact.postcode)}</span>
                </p>
              </div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.telephone')}</p>
                <p className="cblock__v">
                  {/* NOT shaped: a phone number is dialled, and Persian numerals in a
                      `tel:` label are read by nobody's dialler. */}
                  <a className="magnet" href={`tel:${contact.phoneHref}`}>
                    <Lat>{contact.phone}</Lat>
                  </a>
                </p>
              </div>
            </div>

            <div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.email')}</p>
                <p className="cblock__v">
                  <a className="magnet" href={`mailto:${contact.email}`}>
                    <Lat>{contact.email}</Lat>
                  </a>
                </p>
                <p className="cblock__v cblock__v--sm">
                  <a className="magnet" href={`mailto:${contact.press}`}>
                    <Lat>{contact.press}</Lat>
                  </a>
                  <span className="text-t-xlo">{` · ${t('contact.press')}`}</span>
                </p>
              </div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.hours')}</p>
                {/* NOT shaped, matching `legacy/js/ui/panel.js:494`: the postcode is a
                    figure, but the opening hours are prose the Persian record writes in
                    its own way, and a component does not re-space stored copy. */}
                <p className="cblock__v cblock__v--sm">{contact.hours}</p>
              </div>
            </div>

            <div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.elsewhere')}</p>
                <div className="socials">
                  {contact.socials.map(social => (
                    <span key={social.handle}>
                      {`${social.name} `}
                      <Lat>{social.handle}</Lat>
                    </span>
                  ))}
                </div>
              </div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.careers')}</p>
                <p className="cblock__v cblock__v--sm">{contact.careers}</p>
              </div>
            </div>
          </div>

          <h2 className="sheet__h">{t('contact.findUs')}</h2>
          <div className="cmapwrap">
            {/*
              ─── THE DRAWN SITE PLAN IS GONE, AND SO IS ITS PIN (prompt 14) ───────────
              `legacy/js/ui/panel.js:508` drew `court` at the fixed seed
              `kavan-dezashib-site` with a pin over it: a courtyard nobody had built, seeded
              from a constant. Prompt 14's rule for a constant-seeded band applies, so the
              slot takes the first image of this record's gallery instead.

              THE PIN GOES WITH THE DRAWING RATHER THAN SURVIVING IT. A pin marks a point on
              a PLAN; over a photograph it would assert that the studio is at the centre of
              whatever was photographed, which nothing in the record says. The coordinates
              stay — they were always the caption, and they are the fact the pin stood for.
            */}
            <div className="cmap">
              {planImage && (
                <Image
                  src={mediaUrl(planImage.path)}
                  alt={planImage.alt}
                  fill
                  sizes={PLAN_SIZES}
                  className="cmap__photo"
                />
              )}
              <span className="cmap__note">
                {`${contact.district} — `}
                <Lat>{`${contact.lat}, ${contact.lng}`}</Lat>
              </span>
            </div>
            <div className="cmap__aside">
              <div className="prose">
                <p>{`${list([contact.address, contact.city])}.`}</p>
              </div>
            </div>
          </div>

          {/* Everything past the site-plan slot. Nothing until somebody uploads. */}
          <GalleryBand images={restOfGallery} heading={t('ui.photographs')} />

          <h2 className="sheet__h">{t('form.write')}</h2>
          <p className="cblock__v cblock__v--sm">{t('form.intro')}</p>
          <div className="pt-6">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
