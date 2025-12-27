import React, { useEffect, useState } from 'react';
// Backend/agent removed — list uses localStorage

export default function BillList() {
    const [bills, setBills] = useState([]);
    function load() {
        const raw = localStorage.getItem('gb_bills');
        const all = raw ? JSON.parse(raw) : [];
        setBills(all.sort((a, b) => b.createdAt - a.createdAt));
    }
    useEffect(() => { load(); }, []);


    function deleteBill(id) {
        if (!window.confirm('Delete this bill?')) return;
        const raw = localStorage.getItem('gb_bills');
        if (!raw) return load();
        const arr = JSON.parse(raw).filter(b => b.id !== id);
        localStorage.setItem('gb_bills', JSON.stringify(arr));
        load();
    }
    function openPrintPreview(bill) {
        // render receipt in the current tab so user sees it here
        const nItems = bill.lines.length;
        const nQty = bill.lines.reduce((s, i) => s + (i.qty || 0), 0);
        const rows = bill.lines.map(l => {
            const desc = (l.desc || '').toString().slice(0, 20);
            return `<tr class="line"><td class="desc">${desc}</td><td class="qty">${l.qty}</td><td class="price">₹${l.price.toFixed(2)}</td><td class="total">₹${l.total.toFixed(2)}</td></tr>`;
        }).join('');
        const billNo = (bill.id || '').toString().slice(0, 6).toUpperCase();
        const dateStr = new Date(bill.createdAt).toLocaleString();
        const html = `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Receipt</title>
    <style>
        body{font-family: 'Courier New', Courier, monospace; padding:10px; width:320px;}
        .center{text-align:center}
        h1{margin:6px 0; font-size:16px}
        .meta{font-size:11px; margin-bottom:6px}
        table{width:100%; border-collapse:collapse; font-size:12px}
        td{padding:2px 0}
        .sep{border-bottom:1px dashed #000; margin:6px 0}
        .desc{width:52%; text-align:left}
        .qty{width:12%; text-align:center}
        .price{width:18%; text-align:right}
        .total{width:18%; text-align:right}
        tfoot td{padding-top:6px}
        .summary{display:flex; justify-content:space-between; margin-top:6px}
        .grand{font-size:16px; font-weight:bold}
        .small{font-size:11px}
        .note{margin-top:10px; text-align:center; font-size:11px}
    </style>
</head>
<body>
    <div class="center">
        <div style="font-weight:bold">QCQ2Q6</div>
        <h1>ESTIMATE</h1>
    </div>
    <div class="meta">
        <div>DT: ${dateStr} &nbsp; &nbsp; BILL NO: ${billNo}</div>
    </div>
    <div class="sep"></div>
    <table>
        <thead>
            <tr><td class="desc"><strong>ITEM</strong></td><td class="qty"><strong>QTY</strong></td><td class="price"><strong>PRICE</strong></td><td class="total"><strong>TOTAL</strong></td></tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
    <div class="sep"></div>
    <div class="summary">
        <div class="small">SUBTOTAL</div>
        <div class="small">₹${bill.total.toFixed(2)}</div>
    </div>
    <div class="summary">
        <div class="small">NITEMS : ${nItems}</div>
        <div class="small">NQTY : ${nQty}</div>
    </div>
    <div class="sep"></div>
    <div style="display:flex; justify-content:space-between; align-items:center">
        <div><strong>GRAND TOTAL:</strong></div>
        <div class="grand">₹${bill.total.toFixed(2)}</div>
    </div>
    <div class="sep"></div>
    <div class="note">PAYMENT - CASH</div>
    <div class="note">NO EXCHANGE, NO RETURN</div>
</body>
</html>`;
        // replace current document with receipt HTML
        const doc = window.document;
        doc.open();
        doc.write(html);
        doc.close();
        // attempt to open print dialog automatically when reprinting, then restore app
        try {
            setTimeout(() => {
                try { window.print(); } catch (e) { /* ignore */ }
                setTimeout(() => { try { window.location.reload(); } catch (e) { /* ignore */ } }, 400);
            }, 300);
        } catch (e) { /* ignore */ }
    }

    function reprintBill(id) {
        const raw = localStorage.getItem('gb_bills');
        if (!raw) return load();
        const arr = JSON.parse(raw);
        const idx = arr.findIndex(b => b.id === id);
        if (idx === -1) return;
        const bill = arr[idx];
        openPrintPreview(bill);
        arr[idx] = Object.assign({}, bill, { printed: true, lastReprintedAt: Date.now(), reprintCount: (bill.reprintCount || 0) + 1 });
        localStorage.setItem('gb_bills', JSON.stringify(arr));
        load();
    }
    function cleanupOlderThan(hours = 24) {
        const cutoff = Date.now() - hours * 3600000;
        const raw = localStorage.getItem('gb_bills');
        if (!raw) return load();
        const arr = JSON.parse(raw).filter(b => b.createdAt >= cutoff);
        localStorage.setItem('gb_bills', JSON.stringify(arr));
        load();
    }
    return (
        <div>
            <h4>Local Bills</h4>
            <button onClick={async () => { cleanupOlderThan(24); }}>Cleanup older than 24 hours</button>
            {bills.map(b => (
                <div key={b.id} style={{ border: '1px solid #ddd', padding: 8, margin: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>{b.user} - ₹{b.total.toFixed(2)}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button style={{ background: '#FF6347', color: '#fff' }} onClick={() => deleteBill(b.id)}>Delete</button>
                            {b.printed ? (
                                <button style={{ background: '#1E90FF', color: '#fff' }} onClick={() => reprintBill(b.id)}>Reprint</button>
                            ) : null}
                        </div>
                    </div>
                    <div>{new Date(b.createdAt).toLocaleString()}</div>
                </div>
            ))}
        </div>
    );
}
