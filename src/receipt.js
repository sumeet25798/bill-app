function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]);
}

function billNumber(bill) {
    const number = Number(bill.billNumber);
    return number > 0 ? String(number).padStart(4, '0') : String(bill.id || '').slice(0, 6).toUpperCase();
}

function dateParts(timestamp) {
    const date = new Date(timestamp);
    return {
        date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    };
}

function money(value) {
    return Number(value || 0).toFixed(2);
}

function quantity(value) {
    const amount = Number(value || 0);
    return Number.isInteger(amount) ? `${amount}Pc` : String(amount);
}

export function formatReceiptText(bill) {
    const { date, time } = dateParts(bill.createdAt);
    const columns = (index, line) => [
        String(index).padStart(2).slice(-2),
        String(line.desc || 'Item').slice(0, 12).padEnd(12),
        quantity(line.qty).slice(0, 3).padStart(3),
        money(line.price).slice(-5).padStart(5),
        money(line.total).slice(-6).padStart(6),
    ].join(' ');
    const rules = '-'.repeat(32);
    const rows = bill.lines.map((line, index) => columns(index + 1, line));

    return [
        'ESTIMATE',
        `BILL NO: ${billNumber(bill)}`,
        `DATE: ${date} TIME: ${time}`,
        rules,
        'SL ITEM NAME  QTY  RATE AMOUNT',
        ...rows,
        rules,
        `TOTAL: Rs ${money(bill.total)}`,
        '',
        '',
    ].join('\n');
}

export function openReceiptPreview(bill, autoPrint = false) {
    const preview = window.open('', '_blank');
    if (!preview) {
        window.alert('Allow pop-ups to open the receipt preview.');
        return false;
    }

    const { date, time } = dateParts(bill.createdAt);
    const rows = bill.lines.map((line, index) => `
        <tr>
            <td class="sl">${index + 1}</td>
            <td class="item">${escapeHtml(line.desc || 'Item')}</td>
            <td class="qty">${escapeHtml(quantity(line.qty))}</td>
            <td class="rate">${money(line.price)}</td>
            <td class="amount">${money(line.total)}</td>
        </tr>`).join('');

    preview.document.open();
    preview.document.write(`<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bill ${billNumber(bill)}</title>
    <style>
        * { box-sizing: border-box; }
        body { width: 54mm; margin: 0 auto; padding: 3mm 2mm; color: #000; font: 10px/1.3 "Courier New", monospace; }
        .toolbar { display: flex; justify-content: space-between; gap: 6px; margin: 0 0 12px; }
        .toolbar button { padding: 6px 8px; font: inherit; }
        h1 { margin: 0 0 8px; text-align: center; font-size: 15px; }
        .meta { margin-bottom: 8px; }
        .rule { border-top: 1px dashed #000; margin: 7px 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8px; }
        th, td { padding: 3px 1px; overflow-wrap: anywhere; }
        th { border-bottom: 1px solid #000; text-align: left; }
        .sl { width: 7%; text-align: left; }
        .item { width: 34%; text-align: left; }
        .qty { width: 16%; text-align: center; }
        .rate { width: 20%; text-align: right; }
        .amount { width: 23%; text-align: right; }
        .total { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
        @page { size: 58mm auto; margin: 0; }
        @media print {
            .no-print { display: none !important; }
            body { width: 54mm; padding: 2mm; }
            .toolbar { display: none; }
            tr { break-inside: avoid; }
        }
    </style>
    <script>
        function backToBilling() {
            let billingUrl = '/';
            try {
                if (window.opener && !window.opener.closed) {
                    billingUrl = window.opener.location.href;
                    window.opener.focus();
                }
            } catch { }
            window.close();
            window.setTimeout(() => {
                if (!window.closed) window.location.replace(billingUrl);
            }, 0);
        }
    </script>
</head>
<body>
    <div class="toolbar">
        <button class="no-print" type="button" onclick="backToBilling()">← Back to Billing</button>
        <button class="no-print" type="button" onclick="window.print()">Print</button>
    </div>
    <h1>ESTIMATE</h1>
    <div class="meta">BILL NO: ${billNumber(bill)}<br />DATE: ${date} TIME: ${time}</div>
    <div class="rule"></div>
    <table>
        <thead><tr><th class="sl">SL</th><th class="item">ITEM NAME</th><th class="qty">QTY</th><th class="rate">RATE</th><th class="amount">AMOUNT</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>
    <div class="rule"></div>
    <div class="total"><span>TOTAL</span><span>Rs ${money(bill.total)}</span></div>
</body>
</html>`);
    preview.document.close();

    if (autoPrint) preview.setTimeout(() => preview.print(), 300);
    return true;
}