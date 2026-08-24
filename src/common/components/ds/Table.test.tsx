import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Table, type TableColumn } from './Table';

interface Row {
  slug: string;
  title: string;
  year: number;
}

const ROWS: Row[] = [
  { slug: 'qeytarieh-08-residence', title: 'Qeytarieh 08 Residence', year: 2021 },
  { slug: 'niavaran-terraces', title: 'Niavaran Terraces', year: 2019 },
];

const COLUMNS: TableColumn<Row>[] = [
  { key: 'title', header: 'Project', cell: r => r.title },
  { key: 'year', header: 'Year', cell: r => r.year, align: 'end' },
];

describe('Table', () => {
  it('has no axe violations, with rows and when empty', async () => {
    const { container } = render(
      <>
        <Table caption="Projects" columns={COLUMNS} rows={ROWS} rowKey={r => r.slug} />
        <Table caption="Archived" columns={COLUMNS} rows={[]} rowKey={r => r.slug} />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names the table with its caption, so a screen reader can tell two apart', () => {
    render(<Table caption="Projects" columns={COLUMNS} rows={ROWS} rowKey={r => r.slug} />);
    expect(screen.getByRole('table', { name: 'Projects' })).toBeInTheDocument();
  });

  it('marks header cells as column headers', () => {
    render(<Table caption="Projects" columns={COLUMNS} rows={ROWS} rowKey={r => r.slug} />);
    const header = screen.getByRole('columnheader', { name: 'Project' });
    expect(header).toHaveAttribute('scope', 'col');
  });

  it('renders every row through its cell function', () => {
    render(<Table caption="Projects" columns={COLUMNS} rows={ROWS} rowKey={r => r.slug} />);
    expect(screen.getByText('Qeytarieh 08 Residence')).toBeInTheDocument();
    expect(screen.getByText('2019')).toBeInTheDocument();
  });

  it('spans the empty message across every column instead of leaving a blank body', () => {
    render(
      <Table
        caption="Projects"
        columns={COLUMNS}
        rows={[]}
        rowKey={r => r.slug}
        empty="No projects yet"
      />,
    );
    expect(screen.getByText('No projects yet')).toHaveAttribute('colspan', '2');
  });
});
