/**
 * Client-side Excel export for the manufacturer's Customers list
 * (app/manufacturer/stores/page.tsx). `xlsx` is dynamically imported so it
 * never lands in the initial page bundle — same convention as
 * lib/catalogue-pdf.ts's jsPDF import.
 */

export type CustomerExcelRow = {
  companyName: string;
  slug: string;
  email: string | null;
  phone: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  city: string | null;
};

export async function downloadCustomersExcel(rows: CustomerExcelRow[], filename = 'customers.xlsx') {
  const XLSX = await import('xlsx');

  const sheetData = rows.map((r, i) => ({
    'Sr No.': i + 1,
    'Company Name': r.companyName,
    Slug: r.slug,
    Email: r.email ?? '',
    Phone: r.phone ?? '',
    'Owner Name': r.ownerName ?? '',
    'Owner Phone': r.ownerPhone ?? '',
    City: r.city ?? '',
  }));

  const sheet = XLSX.utils.json_to_sheet(sheetData);
  // Reasonable fixed column widths rather than XLSX's default auto-fit
  // (which is very narrow) — keeps company names/emails readable without
  // the user needing to resize every column by hand after opening it.
  sheet['!cols'] = [
    { wch: 8 }, { wch: 28 }, { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Customers');
  XLSX.writeFile(workbook, filename);
}
