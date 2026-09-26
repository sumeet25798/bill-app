import React from 'react';

// Simple Web Bluetooth manager — best-effort for BLE-capable printers.
// Note: Many Bluetooth receipt printers use Classic Bluetooth (SPP) which
// is not accessible from browsers. This module attempts to connect to BLE
// devices and writes UTF-8 text to the first writable characteristic found.

const PrinterManager = (() => {
    let device = null;
    let server = null;
    let writeChar = null;

    function isAvailable() {
        return !!(navigator && navigator.bluetooth);
    }

    async function connect() {
        if (!isAvailable()) throw new Error('Web Bluetooth API not available in this browser');
        try {
            device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [] });
            if (!device) throw new Error('No device selected');
            device.addEventListener && device.addEventListener('gattserverdisconnected', onDisconnected);
            server = await device.gatt.connect();
            // iterate services & characteristics to find a writable characteristic
            const services = await server.getPrimaryServices();
            for (const svc of services) {
                try {
                    const chars = await svc.getCharacteristics();
                    for (const c of chars) {
                        const props = c.properties || {};
                        if (props.write || props.writeWithoutResponse) {
                            writeChar = c;
                            return { device, server, writeChar };
                        }
                    }
                } catch (e) {
                    // ignore service level failures and continue
                }
            }
            throw new Error('No writable characteristic found on device (BLE printers only)');
        } catch (e) {
            // clean up partial state
            try { if (server && server.connected) server.disconnect(); } catch (_) { }
            device = null; server = null; writeChar = null;
            throw e;
        }
    }

    function onDisconnected() {
        device = null; server = null; writeChar = null;
    }

    async function disconnect() {
        try {
            if (server && server.connected) server.disconnect();
        } finally { onDisconnected(); }
    }

    function isConnected() {
        return !!(server && server.connected && writeChar);
    }

    async function printText(text) {
        if (!isConnected()) throw new Error('Printer not connected');
        if (typeof text !== 'string') text = String(text);
        // Many printers expect ANSI/CP437 or ESC/POS commands. This sends UTF-8 text only.
        const encoder = new TextEncoder();
        const chunk = encoder.encode(text + '\n');
        // Some characteristics have limits; write in chunks
        const MTU = 180; // conservative chunk size
        for (let i = 0; i < chunk.length; i += MTU) {
            const slice = chunk.slice(i, i + MTU);
            await writeChar.writeValue(slice);
        }
        return true;
    }

    return { isAvailable, connect, disconnect, isConnected, printText };
})();

export default PrinterManager;
