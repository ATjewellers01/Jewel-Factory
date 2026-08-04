/**
 * Client-side PDF export for the manufacturer catalogue — an image-card grid
 * of whatever's currently in view (after search/category/karigar/size/weight/
 * status filters), matching the on-screen card layout. `jspdf` is dynamically
 * imported so it never lands in the initial page bundle.
 */

export type CataloguePdfProduct = {
  designNumber: string;
  category: string | null;
  subCategory: string | null;
  weightGrams: string | number | null;
  size: string | null;
  karigarCode: string | null;
  statusLabel: string;
  imageUrl: string | null;
};

async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    // Fetched through our own API (not directly from S3/CloudFront) — the
    // browser's own fetch() to that origin is subject to CORS, which isn't
    // configured there, so a direct fetch silently fails and the PDF ships
    // with blank image boxes.
    const proxied = `/api/manufacturer/catalog-pdf-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxied, { credentials: 'same-origin', cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormat(dataUrl: string): string {
  const match = /^data:image\/(\w+);/.exec(dataUrl);
  const ext = (match?.[1] ?? 'jpeg').toUpperCase();
  return ext === 'JPG' ? 'JPEG' : ext;
}

export async function downloadCataloguePdf(
  products: CataloguePdfProduct[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageW = 210;
  const pageH = 297;
  const marginX = 10;
  const marginTop = 20;
  const marginBottom = 12;
  const gap = 6;
  const cols = 3;
  const cardW = (pageW - marginX * 2 - gap * (cols - 1)) / cols;
  const imgSize = cardW - 4;
  const cardH = imgSize + 24;
  const rows = Math.max(1, Math.floor((pageH - marginTop - marginBottom) / (cardH + gap)));
  const perPage = cols * rows;

  function drawHeader() {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Jewel Factory — Catalogue', marginX, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`${products.length} design(s)`, marginX, 17);
    doc.setTextColor(0);
  }

  drawHeader();

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const posInPage = i % perPage;
    if (i > 0 && posInPage === 0) {
      doc.addPage();
      drawHeader();
    }
    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);
    const x = marginX + col * (cardW + gap);
    const y = marginTop + row * (cardH + gap);

    doc.setDrawColor(225);
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5);

    if (p.imageUrl) {
      const dataUrl = await imageToDataUrl(p.imageUrl);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, imageFormat(dataUrl), x + 2, y + 2, imgSize, imgSize, undefined, 'FAST');
        } catch {
          // Corrupt/unsupported image data — leave the card blank, text still renders.
        }
      }
    }

    let textY = y + imgSize + 7;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(p.designNumber, x + 2, textY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90);
    textY += 3.8;
    const catLine = [p.category, p.subCategory].filter(Boolean).join(' › ');
    if (catLine) { doc.text(catLine, x + 2, textY, { maxWidth: cardW - 4 }); textY += 3.6; }

    const specParts: string[] = [];
    const weight = p.weightGrams != null && p.weightGrams !== '' ? `${p.weightGrams}g` : '';
    if (weight) specParts.push(weight);
    if (p.size) specParts.push(`Size ${p.size}`);
    if (specParts.length) { doc.text(specParts.join(' · '), x + 2, textY); textY += 3.6; }

    if (p.karigarCode) { doc.text(`Karigar: ${p.karigarCode}`, x + 2, textY); textY += 3.6; }

    doc.text(p.statusLabel, x + 2, textY);
    doc.setTextColor(0);

    onProgress?.(i + 1, products.length);
  }

  doc.save(`jewel-factory-catalogue-${new Date().toISOString().slice(0, 10)}.pdf`);
}
