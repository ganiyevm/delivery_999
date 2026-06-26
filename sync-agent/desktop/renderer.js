const state = { orders: [], currentIndex: 0, branch: null, lastResultPhone: '' };
const $ = id => document.getElementById(id);
const money = value => `${Number(value || 0).toLocaleString('uz-UZ')} so‘m`;
const currentOrder = () => state.orders[state.currentIndex] || null;

function setConnection(connected, message = '') {
    const element = $('connection');
    element.className = `connection ${connected ? 'online' : 'offline'}`;
    element.innerHTML = `<span></span>${connected ? 'Ulangan' : 'Ulanmagan'}`;
    element.title = message;
    const messageElement = $('connectionMessage');
    if (messageElement) {
        messageElement.textContent = connected ? '' : message;
        messageElement.classList.toggle('hidden', connected || !message);
    }
}

function orderAge(createdAt) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    return minutes < 1 ? 'Hozirgina' : `${minutes} daqiqa`;
}

function deliveryLabel(order) {
    if (order.deliveryType === 'pickup') return 'Olib ketish';
    if (order.deliveryType === 'yandex') return `Yandex${order.deliverySlot ? `, ${order.deliverySlot}` : ''}`;
    return 'Yetkazib berish';
}

function paymentLabel(method) {
    if (method === 'cash') return 'Naqd';
    if (method === 'click') return 'Click';
    return 'Payme';
}

function getOrderLocation(order) {
    const lat = Number(order?.deliveryLocation?.lat);
    const lng = Number(order?.deliveryLocation?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        return { lat, lng };
    }
    const match = String(order?.address || '').match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
    if (!match) return null;
    const parsedLat = Number.parseFloat(match[1]);
    const parsedLng = Number.parseFloat(match[2]);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
    return { lat: parsedLat, lng: parsedLng };
}

function mapUrls(location) {
    if (!location) return {};
    const lat = location.lat.toFixed(6);
    const lng = location.lng.toFixed(6);
    return {
        yandex: `https://yandex.uz/maps/?pt=${lng},${lat}&z=17`,
        google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        coords: `${lat}, ${lng}`,
    };
}

function renderOrder() {
    const order = currentOrder();
    $('emptyState').classList.toggle('hidden', Boolean(order));
    $('orderView').classList.toggle('hidden', !order);
    $('resultView').classList.add('hidden');
    if (!order) return;

    $('queueCount').textContent = `${state.currentIndex + 1} / ${state.orders.length}`;
    $('orderNumber').textContent = `#${order.orderNumber}`;
    $('orderAge').textContent = orderAge(order.createdAt);
    $('customerName').textContent = order.customerName || 'Noma’lum mijoz';
    $('customerPhone').textContent = order.phone || 'Telefon yo‘q';
    $('itemsList').replaceChildren(...order.items.map(item => {
        const row = document.createElement('div');
        row.className = 'item-row';
        const name = document.createElement('div');
        name.className = 'item-name';
        name.textContent = item.productName;
        const qty = document.createElement('div');
        qty.className = 'item-qty';
        qty.textContent = `${item.qty} dona`;
        const price = document.createElement('div');
        price.className = 'item-price';
        price.textContent = money(item.price * item.qty);
        row.append(name, qty, price);
        return row;
    }));
    $('deliveryType').textContent = deliveryLabel(order);
    $('paymentMethod').textContent = paymentLabel(order.paymentMethod);
    const address = [
        order.address,
        order.apartment && `xonadon ${order.apartment}`,
        order.entrance && `kirish ${order.entrance}`,
        order.floor && `${order.floor}-qavat`,
    ].filter(Boolean).join(', ');
    $('addressRow').classList.toggle('hidden', !address || order.deliveryType === 'pickup');
    $('address').textContent = address;
    const location = getOrderLocation(order);
    $('mapActions').classList.toggle('hidden', !location);
    $('openYandex').dataset.url = mapUrls(location).yandex || '';
    $('openGoogle').dataset.url = mapUrls(location).google || '';
    $('copyLocation').dataset.coords = mapUrls(location).coords || '';
    $('orderTotal').textContent = money(order.total);
    $('actionError').classList.add('hidden');
}

function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
}

function setBusy(busy) {
    $('acceptButton').disabled = busy;
    $('rejectButton').disabled = busy;
    $('submitReject').disabled = busy;
}

function showResult({ rejected = false, phone = '', orderNumber = '' }) {
    $('orderView').classList.add('hidden');
    $('emptyState').classList.add('hidden');
    $('resultView').classList.remove('hidden');
    $('resultIcon').textContent = rejected ? '!' : '✓';
    $('resultIcon').style.background = rejected ? 'var(--red-soft)' : 'var(--green-soft)';
    $('resultIcon').style.color = rejected ? 'var(--red)' : 'var(--green)';
    $('resultTitle').textContent = rejected ? 'Rad etish saqlandi' : 'Buyurtma qabul qilindi';
    $('resultText').textContent = rejected
        ? `#${orderNumber} bo‘yicha izoh saqlandi. Endi mijozga qo‘ng‘iroq qilib, mavjud muqobil dorilarni tushuntiring.`
        : `#${orderNumber} muvaffaqiyatli qabul qilindi.`;
    state.lastResultPhone = phone;
    $('resultPhone').classList.toggle('hidden', !rejected || !phone);
}

async function acceptCurrent() {
    const order = currentOrder();
    if (!order) return;
    setBusy(true);
    try {
        const result = await window.operatorAPI.act({ action: 'accept', orderId: order._id });
        showResult({ orderNumber: result.orderNumber });
    } catch (error) {
        showError($('actionError'), error.message);
    } finally { setBusy(false); }
}

function openReject() {
    if (!currentOrder()) return;
    $('rejectModal').classList.remove('hidden');
    $('rejectReason').focus();
}

function closeReject() {
    $('rejectModal').classList.add('hidden');
    $('rejectError').classList.add('hidden');
}

async function submitReject(event) {
    event.preventDefault();
    const order = currentOrder();
    if (!order) return;
    const reason = $('rejectReason').value;
    const comment = $('rejectComment').value.trim();
    if (!reason || comment.length < 5 || !$('callConfirmed').checked) {
        showError($('rejectError'), 'Sabab, batafsil izoh va qo‘ng‘iroq tasdig‘ini to‘ldiring.');
        return;
    }
    setBusy(true);
    try {
        const result = await window.operatorAPI.act({ action: 'reject', orderId: order._id, reason, comment });
        closeReject();
        showResult({ rejected: true, phone: result.phone || order.phone, orderNumber: result.orderNumber });
        $('rejectForm').reset();
    } catch (error) {
        showError($('rejectError'), error.message);
    } finally { setBusy(false); }
}

function playAlert() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    [0, 0.22, 0.44].forEach((delay, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = index === 1 ? 880 : 660;
        gain.gain.setValueAtTime(0.16, context.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + delay + 0.16);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + 0.17);
    });
}

window.operatorAPI.onOrders(data => {
    state.orders = data.orders || [];
    state.branch = data.branch;
    state.currentIndex = Math.min(state.currentIndex, Math.max(0, state.orders.length - 1));
    $('branchName').textContent = data.branch
        ? `№${String(data.branch.number).padStart(3, '0')} ${data.branch.name}`
        : 'Filial';
    setConnection(true);
    if ($('resultView').classList.contains('hidden')) renderOrder();
});
window.operatorAPI.onConnection(data => setConnection(data.connected, data.message));
window.operatorAPI.onAlert(() => playAlert());

$('hideButton').addEventListener('click', () => window.operatorAPI.hide());
$('copyPhone').addEventListener('click', async () => {
    const order = currentOrder();
    if (!order?.phone) return;
    await window.operatorAPI.copy(order.phone);
    $('copyPhone').querySelector('small').textContent = 'Nusxalandi';
});
$('openYandex').addEventListener('click', () => {
    const url = $('openYandex').dataset.url;
    if (url) window.operatorAPI.openExternal(url);
});
$('openGoogle').addEventListener('click', () => {
    const url = $('openGoogle').dataset.url;
    if (url) window.operatorAPI.openExternal(url);
});
$('copyLocation').addEventListener('click', async () => {
    const coords = $('copyLocation').dataset.coords;
    if (!coords) return;
    await window.operatorAPI.copy(coords);
    $('copyLocation').textContent = 'Nusxalandi';
    setTimeout(() => { $('copyLocation').textContent = 'Koordinata'; }, 1400);
});
$('acceptButton').addEventListener('click', acceptCurrent);
$('rejectButton').addEventListener('click', openReject);
$('closeReject').addEventListener('click', closeReject);
$('cancelReject').addEventListener('click', closeReject);
$('rejectForm').addEventListener('submit', submitReject);
$('resultPhone').addEventListener('click', () => window.operatorAPI.copy(state.lastResultPhone));
$('nextOrder').addEventListener('click', () => { state.currentIndex = 0; renderOrder(); });

window.operatorAPI.getInfo().then(info => {
    if (info.configError) setConnection(false, info.configError);
    $('branchName').title = info.envPath ? `Sozlamalar: ${info.envPath}` : 'Sozlama fayli topilmadi';
});
setInterval(() => {
    if (!$('orderView').classList.contains('hidden')) $('orderAge').textContent = orderAge(currentOrder()?.createdAt);
}, 30_000);
