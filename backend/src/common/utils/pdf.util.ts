import PDFDocument from 'pdfkit';

export function buildSimpleTablePdf(
  title: string,
  columns: string[],
  rows: (string | number)[][],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { align: 'left' });
    doc.moveDown();

    const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / columns.length;

    doc.fontSize(9).font('Helvetica-Bold');
    columns.forEach((col, i) => {
      doc.text(col, doc.page.margins.left + i * columnWidth, doc.y, {
        width: columnWidth,
        continued: false,
      });
    });
    doc.moveDown(0.5);
    doc.font('Helvetica');

    rows.forEach((row) => {
      const y = doc.y;
      row.forEach((value, i) => {
        doc.text(String(value ?? ''), doc.page.margins.left + i * columnWidth, y, {
          width: columnWidth,
        });
      });
      doc.moveDown(0.3);
      if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
      }
    });

    doc.end();
  });
}
