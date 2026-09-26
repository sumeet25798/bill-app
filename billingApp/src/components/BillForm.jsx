import React, { useState, useEffect, useRef } from 'react';
import PrinterManager from './PrinterManager.jsx';
// Backend/agent removed — use localStorage-only flows
import { v4 as uuidv4 } from 'uuid';

export default function BillForm({ onSaved }) {
    const [desc, setDesc] = useState('General Item');
    const [qty, setQty] = useState('');
    const [price, setPrice] = useState('');
    const [userName, setUserName] = useState(localStorage.getItem('gb_user') || 'User');
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]); // available users
    const [products, setProducts] = useState([]); // available product descriptions

    const descRef = useRef(null);
    const qtyRef = useRef(null);
    const priceRef = useRef(null);
    const addBtnRef = useRef(null);

    useEffect(() => {
        const saved = localStorage.getItem('gb_cart');
        if (saved) setItems(JSON.parse(saved));
        // load saved users and products
        const su = localStorage.getItem('gb_users');
        const sp = localStorage.getItem('gb_products');
        const uarr = su ? JSON.parse(su) : ['User'];
        const parr = sp ? JSON.parse(sp) : ['General Item'];
        setUsers(uarr);
        setProducts(parr);
        // ensure userName exists in users
        if (!uarr.includes(userName)) {
            setUserName(uarr[0] || 'User');
            localStorage.setItem('gb_user', uarr[0] || 'User');
        }
        // focus first input on mount
        setTimeout(() => {
            // if desc is a select, focus qty instead so flow continues
            qtyRef.current && qtyRef.current.focus();
        }, 50);
    }, []);

    function saveCart(next) {
        setItems(next);
        localStorage.setItem('gb_cart', JSON.stringify(next));
    }

    function saveUsers(next) {
        setUsers(next);
        localStorage.setItem('gb_users', JSON.stringify(next));
    }

    function saveProducts(next) {
        setProducts(next);
        localStorage.setItem('gb_products', JSON.stringify(next));
    }

    function addNewUser() {
        const name = window.prompt('Enter user name');
        if (!name) return;
        const next = Array.from(new Set([...(users || []), name]));
        saveUsers(next);
        setUserName(name);
        localStorage.setItem('gb_user', name);
    }

    function addNewProduct() {
        const name = window.prompt('Enter item name');
        if (!name) return;
        const next = Array.from(new Set([...(products || []), name]));
        saveProducts(next);
        setDesc(name);
        // focus quantity for new entry
        setTimeout(() => qtyRef.current && qtyRef.current.focus(), 50);
    }

    function addItem() {
        const q = Number(qty), p = Number(price);
        if (!q || !p) return alert('Quantity and price required');
        const line = { id: uuidv4(), desc: desc || 'General Item', qty: q, price: p, total: q * p };
        const next = [...items, line];
        saveCart(next);
        setQty(''); setPrice(''); setDesc('General Item');
        // focus quantity for next entry
        setTimeout(() => qtyRef.current && qtyRef.current.focus(), 50);
    }

    function removeItem(id) {
        const next = items.filter(i => i.id !== id);
        saveCart(next);
    }

    function clearCart() {
        saveCart([]);
    }

    function buildBill() {
        if (items.length === 0) return null;
        const id = uuidv4();
        const total = items.reduce((s, i) => s + (i.total || 0), 0);
        return { id, user: userName, lines: items, total, createdAt: Date.now() };
    }

    function saveBillToHistory(bill) {
        const raw = localStorage.getItem('gb_bills');
        const arr = raw ? JSON.parse(raw) : [];
        const copy = Object.assign({}, bill);
        if (typeof copy.printed === 'undefined') copy.printed = false;
        arr.push(copy);
        localStorage.setItem('gb_bills', JSON.stringify(arr));
    }

    function openPrintPreview(bill, autoPrint = false) {
        // open in the same tab instead of a new tab
        // render receipt in the current tab (replace document) so user sees it here
        // build receipt-style layout (monospace, narrow width suitable for thermal printer)
        const nItems = bill.lines.length;
        const nQty = bill.lines.reduce((s, i) => s + (i.qty || 0), 0);
        const rows = bill.lines.map(l => {
            // ensure desc trimmed to 20 chars for narrow receipts
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
    <div style="text-align:center; margin-top:12px;">
        <button onclick="try { window.location.reload(); } catch(e){ window.location.href='/' }" style="padding:8px 12px; color: red; font-size:14px;">Back to App</button>
    </div>
</body>
</html>`;
        // replace current document with receipt HTML
        const doc = window.document;
        doc.open();
        doc.write(html);
        doc.close();
        // optionally open the print dialog automatically (only when autoPrint===true)
        if (autoPrint) {
            try {
                // Use onafterprint handler to reload the app AFTER the print job
                // completes. Relying on a short timeout caused mobile browsers to
                // reload the app before the print snapshot was taken, producing
                // the wrong printed content (the home page). onafterprint is
                // supported in most modern mobile browsers and avoids racing.
                const cleanup = () => {
                    try {
                        // remove handlers to avoid leaking
                        window.onafterprint = null;
                        window.onbeforeprint = null;
                    } catch (e) { /* ignore */ }
                    try { window.location.reload(); } catch (e) { /* ignore */ }
                };
                window.onafterprint = cleanup;
                // Some browsers fire beforeprint; keep it minimal
                window.onbeforeprint = () => { };
                // give the document a brief moment to finish layout, then trigger print
                setTimeout(() => {
                    try { window.print(); } catch (e) {
                        // if print fails, cleanup and reload so user can continue
                        cleanup();
                    }
                }, 300);
            } catch (e) { /* ignore */ }
        }
    }

    async function handlePrintPreview() {
        const bill = buildBill();
        if (!bill) return alert('Cart is empty');
        // Open preview only; do NOT auto-print, mark as printed, or clear the cart.
        openPrintPreview(bill, false);
    }

    async function handleShare() {
        const bill = buildBill();
        if (!bill) return alert('Cart is empty');
        const text = `Bill for ${bill.user}\nTotal: ₹${bill.total.toFixed(2)}\nItems:\n` + bill.lines.map(l => `${l.desc} - ${l.qty} x ₹${l.price} = ₹${l.total}`).join('\n');
        if (navigator.share) {
            try { await navigator.share({ title: 'Bill', text }); return; } catch (e) { /* ignore */ }
        }
        try { await navigator.clipboard.writeText(text); alert('Bill copied to clipboard'); } catch (e) { alert(text); }
        // save to history too
        saveBillToHistory(bill);
        clearCart();
        onSaved && onSaved();
    }

    async function handleBluetoothPrint() {
        const bill = buildBill();
        if (!bill) return alert('Cart is empty');
        // For the Print button we open the print preview and trigger
        // the browser print dialog automatically so the user can print the
        // items currently in the cart. After showing the dialog we mark the
        // bill as printed, save it, and clear the cart.
        try {
            openPrintPreview(bill, true);
            // treat this as a printed copy
            bill.printed = true;
            saveBillToHistory(bill);
            clearCart();
            onSaved && onSaved();
        } catch (e) {
            console.error('Failed to open print preview:', e);
            alert('Failed to open print preview: ' + (e.message || e));
        }
    }

    // keyboard handling: Enter moves to next input or triggers add
    function onDescKey(e) { if (e.key === 'Enter') { e.preventDefault(); qtyRef.current && qtyRef.current.focus(); } }
    function onQtyKey(e) { if (e.key === 'Enter') { e.preventDefault(); priceRef.current && priceRef.current.focus(); } }
    function onPriceKey(e) { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }

    return (
        <div>
            <h3 style={{ marginBottom: 10 }}>Billing App</h3>

            <section className="bill-card">
                <div className="bill-row">
                    <label className="bill-label">User</label>
                    <div className="bill-control">
                        <select className="bill-select" value={userName} onChange={e => {
                            const v = e.target.value;
                            if (v === '__add__') { addNewUser(); return; }
                            // If switching to a different user while cart has items,
                            // save current cart as a bill for the previous user.
                            if (v !== userName && items && items.length > 0) {
                                const bill = buildBill();
                                if (bill) {
                                    // mark as printed so Reprint option is available
                                    bill.printed = true;
                                    bill.printedAt = Date.now();
                                    saveBillToHistory(bill);
                                    clearCart();
                                    onSaved && onSaved();
                                }
                            }
                            setUserName(v); localStorage.setItem('gb_user', v);
                        }}>
                            {(users || []).map(u => <option key={u} value={u}>{u}</option>)}
                            <option value="__add__">+ Add user...</option>
                        </select>
                    </div>
                </div>

                <div className="bill-row">
                    <label className="bill-label">Item description</label>
                    <div className="bill-control">
                        <select ref={descRef} className="bill-select" value={desc} onChange={e => {
                            const v = e.target.value;
                            if (v === '__add__') { addNewProduct(); return; }
                            setDesc(v);
                        }} onKeyDown={onDescKey}>
                            {(products || []).map(p => <option key={p} value={p}>{p}</option>)}
                            <option value="__add__">+ Add item...</option>
                        </select>
                    </div>
                </div>
            </section>
            <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <label>Quantity</label>
                    <input ref={qtyRef} value={qty} onKeyDown={onQtyKey} onChange={e => setQty(e.target.value)} type="number" />
                </div>
                <div style={{ flex: 1 }}>
                    <label>Price</label>
                    <input ref={priceRef} value={price} onKeyDown={onPriceKey} onChange={e => setPrice(e.target.value)} type="number" />
                </div>
            </div>
            <div style={{ marginTop: 8 }}>
                <button style={{ backgroundColor: '#333', color: '#fff' }} ref={addBtnRef} onClick={addItem}>Add To Cart</button>
            </div>

            <div style={{ marginTop: 12 }}>
                {items.map(i => (
                    <div key={i.id} style={{ border: '1px solid #ddd', padding: 8, marginBottom: 8 }}>
                        <div>{i.desc} - {i.qty} x ₹{i.price} = ₹{i.total.toFixed(2)}</div>
                        <button style={{ backgroundColor: '#333', color: '#fff' }} onClick={() => removeItem(i.id)}>Remove</button>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button style={{ background: '#3CB371', color: '#fff' }} onClick={handlePrintPreview}>Print Preview</button>
                <button style={{ background: '#FF6347', color: '#fff' }} onClick={() => { clearCart(); }}>Clear Bill</button>
                <button style={{ background: '#1E90FF', color: '#fff' }} onClick={handleShare}>Share Bill</button>
                <button style={{ background: '#800080', color: '#fff' }} onClick={handleBluetoothPrint}>Print</button>
            </div>
        </div>
    );
}
