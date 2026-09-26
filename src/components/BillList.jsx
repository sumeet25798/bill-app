import React, { useEffect, useState } from 'react';
import { openReceiptPreview } from '../receipt.js';
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
    function reprintBill(id) {
        const raw = localStorage.getItem('gb_bills');
        if (!raw) return load();
        const arr = JSON.parse(raw);
        const idx = arr.findIndex(b => b.id === id);
        if (idx === -1) return;
        const bill = arr[idx];
        if (!openReceiptPreview(bill, true)) return;
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
