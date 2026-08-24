/**
 * RTL is a first-class mode here, not a variant: the site is Persian as well as
 * English, and `legacy/css/i18n.css` reverses the whole column order.
 *
 * A control therefore may not position anything with a PHYSICAL side. These
 * tests assert the logical property is the one in the class list, because that
 * is the thing that actually mirrors — jsdom applies no CSS, so asserting on a
 * computed offset here would pass whatever we wrote.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Input } from './Input';
import { Select } from './Select';
import { Table, type TableColumn } from './Table';

afterEach(() => {
  document.documentElement.removeAttribute('dir');
});

const renderRtl = (ui: React.ReactElement) => {
  document.documentElement.setAttribute('dir', 'rtl');
  return render(ui);
};

interface Row {
  slug: string;
  title: string;
  year: number;
}
const COLUMNS: TableColumn<Row>[] = [
  { key: 't', header: 'پروژه', cell: r => r.title },
  { key: 'y', header: 'سال', cell: r => r.year, align: 'end' },
];
const ROWS: Row[] = [{ slug: 'a', title: 'خانه قیطریه', year: 2021 }];

describe('direction safety', () => {
  it('pads for a leading icon with ps-, never pl-, so it mirrors in Persian', () => {
    renderRtl(<Input aria-label="جستجو" slots={{ leftIcon: <span>i</span> }} />);
    const cls = screen.getByLabelText('جستجو').className;
    expect(cls).toContain('ps-9');
    expect(cls).not.toMatch(/\bpl-9\b/);
  });

  it('positions a trailing icon with pe-, never pr-', () => {
    renderRtl(<Input aria-label="جستجو" slots={{ rightIcon: <span>i</span> }} />);
    const cls = screen.getByLabelText('جستجو').className;
    expect(cls).toContain('pe-9');
    expect(cls).not.toMatch(/\bpr-9\b/);
  });

  it('aligns table cells with text-start / text-end, never text-left / text-right', () => {
    renderRtl(<Table caption="پروژه‌ها" columns={COLUMNS} rows={ROWS} rowKey={r => r.slug} />);
    expect(screen.getByRole('columnheader', { name: 'پروژه' }).className).toContain('text-start');
    expect(screen.getByRole('columnheader', { name: 'سال' }).className).toContain('text-end');
    expect(screen.getByRole('columnheader', { name: 'سال' }).className).not.toContain('text-right');
  });

  it('keeps every control accessible under dir=rtl with Persian labels', async () => {
    const { container } = renderRtl(
      <>
        <Field label="عنوان" description="روی کارت پروژه دیده می‌شود" required>
          {aria => <Input {...aria} />}
        </Field>
        <Field label="وضعیت">
          {aria => (
            <Select
              {...aria}
              options={[{ value: 'built', label: 'ساخته‌شده' }]}
              placeholder="همه"
            />
          )}
        </Field>
        <Table caption="پروژه‌ها" columns={COLUMNS} rows={ROWS} rowKey={r => r.slug} />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
    expect(screen.getByLabelText(/عنوان/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /وضعیت/ })).toBeInTheDocument();
  });
});
