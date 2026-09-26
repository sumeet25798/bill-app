import React, { useState, useEffect, useRef } from 'react';
import PrinterManager from './PrinterManager.jsx';
import { openReceiptPreview, formatReceiptText } from '../receipt.js';
// Backend/agent removed — use localStorage-only flows
import { v4 as uuidv4 } from 'uuid';

export default function BillForm({ onSaved }) {
    const [desc, setDesc] = useState('General Item');
    const [qty, setQty] = useState('');
    const [price, setPrice] = useState('');
    const [userName, setUserName] = useState(localStorage.getItem('gb_user') || 'User1');
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]); // available users
    const [products, setProducts] = useState([]); // available product descriptions
    const [addingUser, setAddingUser] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const [addingProduct, setAddingProduct] = useState(false);
    const [newProductName, setNewProductName] = useState('');

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
        const uarr = su ? JSON.parse(su) : ['User1'];
        const parr = sp ? JSON.parse(sp) : ['General Item'];
        setUsers(uarr);
        setProducts(parr);
        // ensure userName exists in users
        if (!uarr.includes(userName)) {
            setUserName(uarr[0] || 'User1');
            localStorage.setItem('gb_user', uarr[0] || 'User1');
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
        setAddingUser(true);
    }

    function saveNewUser() {
        const name = newUserName.trim();
        if (!name) return;
        const next = Array.from(new Set([...(users || []), name]));
        saveUsers(next);
        setUserName(name);
        localStorage.setItem('gb_user', name);
        setNewUserName('');
        setAddingUser(false);
    }

    function addNewProduct() {
        setAddingProduct(true);
    }

    function saveNewProduct() {
        const name = newProductName.trim();
        if (!name) return;
        const next = Array.from(new Set([...(products || []), name]));
        saveProducts(next);
        setDesc(name);
        setNewProductName('');
        setAddingProduct(false);
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
        const history = JSON.parse(localStorage.getItem('gb_bills') || '[]');
        const lastBillNumber = history.reduce((max, bill) => Math.max(max, Number(bill.billNumber) || 0), 0);
        const nextBillNumber = Math.max(Number(localStorage.getItem('gb_next_bill_number')) || 1, lastBillNumber + 1);
        localStorage.setItem('gb_next_bill_number', String(nextBillNumber + 1));
        const id = uuidv4();
        const total = items.reduce((s, i) => s + (i.total || 0), 0);
        return { id, billNumber: nextBillNumber, user: userName, lines: items, total, createdAt: Date.now() };
    }

    function saveBillToHistory(bill) {
        const raw = localStorage.getItem('gb_bills');
        const arr = raw ? JSON.parse(raw) : [];
        const copy = Object.assign({}, bill);
        if (typeof copy.printed === 'undefined') copy.printed = false;
        arr.push(copy);
        localStorage.setItem('gb_bills', JSON.stringify(arr));
    }

    async function handlePrintPreview() {
        const bill = buildBill();
        if (!bill) return alert('Cart is empty');
        if (!openReceiptPreview(bill)) return;
        // mark as printed (print preview is treated as a printed copy)
        bill.printed = true;
        saveBillToHistory(bill);
        clearCart();
        onSaved && onSaved();
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
        // Try to print via Web Bluetooth (BLE) printers. Many receipt printers
        // use Classic Bluetooth (SPP) and are not reachable from browsers —
        // in that case this will fail and fall back to print preview.
        try {
            if (!PrinterManager.isAvailable()) throw new Error('Web Bluetooth not available in this browser');
            if (!PrinterManager.isConnected()) {
                await PrinterManager.connect();
            }
            await PrinterManager.printText(formatReceiptText(bill));
            // mark as printed when actually sent to printer
            bill.printed = true;
            saveBillToHistory(bill);
            clearCart();
            onSaved && onSaved();
            alert('Sent to printer (if compatible).');
        } catch (e) {
            console.warn('Bluetooth print failed, falling back to preview:', e);
            // fallback — treat fallback preview as a printed copy so Reprint shows
            try {
                bill.printed = true;
                if (!openReceiptPreview(bill, true)) return;
                saveBillToHistory(bill);
                clearCart();
                onSaved && onSaved();
                alert('Opened print preview as fallback.');
            } catch (err) { console.error(err); alert('Failed to print or preview: ' + (err.message || err)); }
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
                            setUserName(v); localStorage.setItem('gb_user', v);
                        }}>
                            {(users || []).map(u => <option key={u} value={u}>{u}</option>)}
                            <option value="__add__">+ Add user...</option>
                        </select>
                    </div>
                </div>
                {addingUser && (
                    <div className="bill-add-row">
                        <input aria-label="New user name" autoFocus value={newUserName} onChange={e => setNewUserName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNewUser(); }} type="text" />
                        <button type="button" onClick={saveNewUser}>Save</button>
                        <button type="button" onClick={() => { setAddingUser(false); setNewUserName(''); }}>Cancel</button>
                    </div>
                )}

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
                {addingProduct && (
                    <div className="bill-add-row">
                        <input aria-label="New item name" autoFocus value={newProductName} onChange={e => setNewProductName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNewProduct(); }} type="text" />
                        <button type="button" onClick={saveNewProduct}>Save</button>
                        <button type="button" onClick={() => { setAddingProduct(false); setNewProductName(''); }}>Cancel</button>
                    </div>
                )}
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
                <button ref={addBtnRef} onClick={addItem}>Add To Cart</button>
            </div>

            <div style={{ marginTop: 12 }}>
                {items.map(i => (
                    <div key={i.id} style={{ border: '1px solid #ddd', padding: 8, marginBottom: 8 }}>
                        <div>{i.desc} - {i.qty} x ₹{i.price} = ₹{i.total.toFixed(2)}</div>
                        <button onClick={() => removeItem(i.id)}>Remove</button>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button style={{ background: '#3CB371', color: '#fff' }} onClick={handlePrintPreview}>Print Preview</button>
                <button style={{ background: '#FF6347', color: '#fff' }} onClick={() => { clearCart(); }}>Clear Bill</button>
                <button style={{ background: '#1E90FF', color: '#fff' }} onClick={handleShare}>Share Bill</button>
                <button style={{ background: '#800080', color: '#fff' }} onClick={handleBluetoothPrint}>Bluetooth Print</button>
            </div>
        </div>
    );
}
