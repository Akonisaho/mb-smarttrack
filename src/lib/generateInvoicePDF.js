// Client-side PDF generation using jsPDF + jspdf-autotable
// Always call as: await generateInvoicePDF(...)

const GREEN = [141, 198, 63];
const DARK  = [17, 17, 17];
const GREY  = [100, 100, 100];
const LGREY = [240, 240, 240];

function fmtR(n) { return 'R ' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fdate(d) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d || ''; }
}

function drawHeader(doc, firm, invId, issueDate, dueDate) {
  const W = 210, M = 18;

  // Green accent bar at top
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 4, 'F');

  // Logo / firm name (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.text('Smart', M, 18);
  const sw = doc.getTextWidth('Smart');
  doc.setTextColor(...GREEN);
  doc.text('Track', M + sw, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(firm.firm_name || 'Motsoeneng Bill', M, 24);
  if (firm.vat_number) doc.text('VAT: ' + firm.vat_number, M, 29);

  // Invoice label (right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  doc.text('TAX INVOICE', W - M, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(invId || '', W - M, 24, { align: 'right' });
  doc.text('Issued: ' + (issueDate || ''), W - M, 29, { align: 'right' });
  if (dueDate) doc.text('Due: ' + dueDate, W - M, 34, { align: 'right' });

  // Divider
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(M, 38, W - M, 38);
}

function drawClientBlock(doc, inv, clientName, y) {
  const M = 18, colW = 86;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text('BILLED TO', M, y);
  doc.text('ATTORNEY / MATTER', M + colW, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(clientName || inv.client || '', M, y + 6);
  doc.text(inv.attorney || '—', M + colW, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text('Matter: ' + (inv.matter_name || inv.matter_id || '—'), M, y + 12);
  doc.text('Period: ' + (inv.period_label || '—'), M + colW, y + 12);

  return y + 22;
}

function drawSummaryBar(doc, excl, vat, incl, units, rate, y) {
  const M = 18, W = 210, barW = W - 2 * M;
  const cols = [
    { l: 'Units', v: String(units || 0) },
    { l: 'Rate/Unit', v: 'R ' + (rate || 150) },
    { l: 'Subtotal', v: fmtR(excl) },
    { l: 'VAT 15%', v: fmtR(vat) },
    { l: 'Total Due', v: fmtR(incl), green: true },
  ];
  const cw = barW / cols.length;

  doc.setFillColor(...LGREY);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(M, y, barW, 18, 2, 2, 'FD');

  cols.forEach((c, i) => {
    const cx = M + i * cw + cw / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(c.l, cx, y + 6, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(c.green ? 11 : 9);
    doc.setTextColor(c.green ? GREEN[0] : DARK[0], c.green ? GREEN[1] : DARK[1], c.green ? GREEN[2] : DARK[2]);
    doc.text(c.v, cx, y + 13, { align: 'center' });
  });

  return y + 26;
}

function drawTotals(doc, excl, vat, incl, y) {
  const M = 18, W = 210, rX = W - M, lX = W - M - 70;
  const rows = [
    { l: 'Subtotal (excl. VAT)', v: fmtR(excl) },
    { l: 'VAT @ 15%', v: fmtR(vat) },
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  rows.forEach(r => {
    doc.setTextColor(...GREY);
    doc.text(r.l, lX, y);
    doc.setTextColor(...DARK);
    doc.text(r.v, rX, y, { align: 'right' });
    y += 6;
  });

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(lX, y, rX, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text('Total Due (incl. VAT)', lX, y);
  doc.setTextColor(...GREEN);
  doc.text(fmtR(incl), rX, y, { align: 'right' });

  return y + 12;
}

function drawBankDetails(doc, firm, outstanding, y) {
  if (!firm.bank_name && !firm.bank_account) return y;
  const M = 18, W = 210;

  doc.setFillColor(240, 255, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(M, y, W - 2 * M, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(22, 163, 74);
  doc.text('PAYMENT INSTRUCTIONS', M + 6, y + 7);

  const details = [
    firm.bank_name && ['Bank', firm.bank_name],
    firm.bank_account && ['Account No.', firm.bank_account],
    firm.bank_branch && ['Branch Code', firm.bank_branch],
    ['Reference', 'Invoice number'],
  ].filter(Boolean);

  const cw = (W - 2 * M - 12) / 2;
  details.forEach((d, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + 6 + col * (cw + 6);
    const dy = y + 14 + row * 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(d[0], x, dy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(d[1], x + 28, dy);
  });

  // Total due chip
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 163, 74);
  doc.text('Amount due: ' + fmtR(outstanding), W - M - 6, y + 22, { align: 'right' });

  return y + 44;
}

function drawFooter(doc, firm) {
  const W = 210, M = 18, y = 284;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  const footer = [
    firm.firm_name,
    firm.vat_number ? 'VAT: ' + firm.vat_number : null,
    firm.bank_name ? firm.bank_name + (firm.bank_account ? ' ' + firm.bank_account : '') : null,
    firm.email,
  ].filter(Boolean).join(' · ');
  doc.text(footer || 'Motsoeneng Bill', W / 2, y + 5, { align: 'center' });
  doc.text(firm.invoice_footer || 'This invoice is computer generated and valid without a signature.', W / 2, y + 10, { align: 'center' });
}

// Main export: simple invoice (portal / manager use)
export async function generateInvoicePDF(inv, firm = {}, clientName = '') {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const excl = (inv.total_units || 0) * (inv.rate || 150);
  const vat  = excl * 0.15;
  const incl = excl * 1.15;

  drawHeader(doc, firm, inv.id, fdate(inv.created_at?.substring(0, 10) || new Date().toISOString().split('T')[0]), inv.due_date ? fdate(inv.due_date) : null);

  let y = 44;
  y = drawClientBlock(doc, inv, clientName, y);
  y = drawSummaryBar(doc, excl, vat, incl, inv.total_units || 0, inv.rate || 150, y);
  y = drawTotals(doc, excl, vat, incl, y);
  y = drawBankDetails(doc, firm, incl, y + 4);
  drawFooter(doc, firm);

  doc.save(`Invoice-${inv.id || 'MB'}.pdf`);
}

// Detailed invoice with activities table (attorney page use)
export async function generateDetailedInvoicePDF(inv, acts, firm = {}) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const M = 18;

  const bill = (acts || []).filter(a => a.classification === 'billable');
  const rate = Number(inv.rate) || 150;
  const calcUnits = s => Math.max(1, Math.ceil((Number(s) || 0) / 360));
  const toHm = s => { s = Number(s) || 0; if (s <= 0) return '0m'; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m`; };
  const tU = bill.reduce((s, a) => s + calcUnits(a.duration_seconds), 0);
  const excl = tU * rate;
  const vat  = excl * 0.15;
  const incl = excl * 1.15;

  drawHeader(doc, firm, inv.id, fdate(new Date().toISOString().split('T')[0]), null);

  let y = 44;
  y = drawClientBlock(doc, inv, inv.client, y);
  y = drawSummaryBar(doc, excl, vat, incl, tU, rate, y);

  // Activities table
  if (bill.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('Billable Activities', M, y + 4);
    y += 8;

    doc.autoTable({
      startY: y,
      margin: { left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 2.5, textColor: DARK },
      headStyles: { fillColor: LGREY, textColor: GREY, fontStyle: 'bold', fontSize: 7 },
      head: [['Date', 'Description', 'Time', 'Units', 'Amount']],
      body: bill.map(a => [
        fdate(a.date),
        (a.window_title || a.app_display_name || '').substring(0, 55),
        toHm(a.duration_seconds),
        calcUnits(a.duration_seconds),
        fmtR(calcUnits(a.duration_seconds) * rate),
      ]),
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 80 },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 14, halign: 'right' },
        4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [252, 252, 252] },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  y = drawTotals(doc, excl, vat, incl, y);
  drawBankDetails(doc, firm, incl, y + 4);
  drawFooter(doc, firm);

  doc.save(`Invoice-${inv.id || 'MB'}.pdf`);
}
