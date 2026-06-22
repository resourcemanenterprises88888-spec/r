let shoes = [];
 
let techProducts = [];
 
let shoelanders = [];
 
let marikinaCollection = [];
 
// =========================================================================
// 1. GLOBAL VARIABLES & STATE MANAGEMENT
// =========================================================================
let customerRegistry = [];
const OWNER_PAYROLL_ACCOUNT = {
    holder: "Christopher Jose Nyuda Rodriguez",
    number: "014763572417",
    swift: "GOTYPHM2XXX"
};
 
let staffRegistry = [];
let payrollHistory = [];
 
let currentUser = null;
let selectedItem = null;
let targetedOrderId = null; 
let pendingRegistration = null; 
let verificationCode = null; 
let isGcashPaid = false; 
 
const ADMIN_SESSION_KEY = 'resourceManAdminSession';
 
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : `https://${window.location.hostname}`;


// 🔥 GLOBAL KEY LISTENER FOR SECRET SEQUENCE ("qwerty")
const secretSequence = ['q', 'w', 'e', 'r', 't', 'y']; 
let keyBuffer = [];

// Single qwerty listener (prevents duplicate bindings and forces admin page visibility)
document.addEventListener('keydown', (event) => {
    if (!event.key) return;

    // Ignore typing inside inputs/textareas/contenteditable
    const el = document.activeElement;
    const tag = (el && el.tagName) ? el.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (el && el.isContentEditable)) return;

    keyBuffer.push(event.key.toLowerCase());

    if (keyBuffer.length > secretSequence.length) {
        keyBuffer.shift();
    }

    if (keyBuffer.join('') === secretSequence.join('')) {
        console.log("🔓 'qwerty' secret sequence activated!");
        keyBuffer = [];

        // Mark an admin session so updateUserUI() reveals all admin panels correctly
        currentUser = {
            name: "System Admin",
            email: "admin@resourceman.com",
            isAdmin: true,
            isBlocked: false
        };
        localStorage.setItem(ADMIN_SESSION_KEY, 'true');

        // Refresh UI state based on admin flag
        if (typeof updateUserUI === 'function') updateUserUI();

        // Find and show admin nav
        const adminNav = document.getElementById('nav-11');
        const adminView = document.getElementById('admin-view');

        // Show admin nav button
        if (adminNav) {
            adminNav.classList.remove('hidden-admin-nav');
            adminNav.style.display = 'flex';
        }

        // Hide all main views first
        const customerView = document.getElementById('customer-view');
        const shoeView = document.getElementById('shoe-view');
        const mainView = document.getElementById('main-view');
        const allViews = document.querySelectorAll('#customer-view, #shoe-view, #main-view, [class*="view"]:not(#admin-view)');

        allViews.forEach(view => {
            if (view && view !== adminView) {
                view.classList.add('hidden');
            }
        });

        // Show admin view
        if (adminView) {
            adminView.classList.remove('hidden');
        }

        alert("Admin portal unlocked!");
    }
});
 
// =========================================================================
// 2. GLOBAL WORDPRESS AUTH & SYNC ENGINE
// =========================================================================
 
window.WP_SYNC_CONFIG = {
    apiUrl: 'https://resourceman.top/storage',
    token: 'b3BlbnNlc2FtZQ==' 
};
 
window.syncToWordPress = async function(endpointType, payload) {
    const targetUrl = `https://resourceman.top/storage-bridge.php?route=${endpointType}`;
 
    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload) 
        });
 
        if (response.ok) {
            console.log(`🌐 [Global Storage Sync] ${endpointType.toUpperCase()} permanently saved!`);
        } else {
            console.warn(`⚠️ Save returned status: ${response.status}`);
        }
    } catch (error) {
        console.error(`❌ Save connection failed:`, error);
    }
};

// =========================================================================
// 3. REGISTRY CORE FUNCTIONS (Tied into Global Sync Engine)
// =========================================================================
function saveCustomerRegistry() {
    localStorage.setItem('resourceManCustomerRegistry', JSON.stringify(customerRegistry));
    window.syncToWordPress('customers', customerRegistry);
}
 
// ==========================================
// GLOBAL TWO-WAY SYNC FETCHERS
// ==========================================
async function loadCustomerRegistry() {
    try {
        const response = await fetch('https://resourceman.top/storage-bridge.php?route=customers', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
 
        if (response.ok) {
            const data = await response.json();
            customerRegistry = Array.isArray(data) ? data : (data.customers || data || []);
            localStorage.setItem('resourceManCustomerRegistry', JSON.stringify(customerRegistry));
            console.log("🌐 [Global Sync] Customers updated from cloud via Socket Bridge.");
        } else {
            console.warn(`⚠️ Server returned status: ${response.status}`);
            throw new Error("Server response not OK");
        }
    } catch (e) {
        console.warn("Offline fallback for customers:", e);
        const saved = localStorage.getItem('resourceManCustomerRegistry');
        if (saved) {
            try {
                customerRegistry = JSON.parse(saved);
            } catch (parseError) {
                customerRegistry = [];
            }
        } else {
            customerRegistry = [];
        }
    }
    if (typeof updateUserUI === "function") updateUserUI();
}

async function loadCatalog() {
    try {
        const response = await fetch(`${window.WP_SYNC_CONFIG.apiUrl}/catalog`, {
            method: 'GET',
            headers: { 'Authorization': `Basic ${window.WP_SYNC_CONFIG.token}` }
        });
        if (response.ok) {
            const data = await response.json();
            shoes = data.shoes || [];
            techProducts = data.techProducts || [];
            shoelanders = data.shoelanders || [];
            marikinaCollection = data.marikinaCollection || [];
            console.log("🌐 [Global Sync] Catalog items updated from cloud.");
        }
    } catch (e) {
        console.warn("Offline fallback for catalog:", e);
    }
}
 
async function loadPayrollData() {
    try {
        const response = await fetch(`${window.WP_SYNC_CONFIG.apiUrl}/payroll`, {
            method: 'GET',
            headers: { 'Authorization': `Basic ${window.WP_SYNC_CONFIG.token}` }
        });
        if (response.ok) {
            const data = await response.json();
            payrollHistory = data.payroll || data || [];
            localStorage.setItem('resourceManPayrollHistory', JSON.stringify(payrollHistory));
            console.log("🌐 [Global Sync] Payroll records updated from cloud.");
        }
    } catch (e) {
        const saved = localStorage.getItem('resourceManPayrollHistory');
        if (saved) payrollHistory = JSON.parse(saved);
    }
}
 
async function saveCatalog() {
    const data = { shoes, techProducts, shoelanders, marikinaCollection };
    try {
        await fetch(`${window.WP_SYNC_CONFIG.apiUrl}/catalog`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) { console.error("Sync failed", e); }
}

function deleteCustomer(email) {
    const clientIndex = customerRegistry.findIndex(c => c.email.toLowerCase() === email.toLowerCase());
    if (clientIndex === -1) return;
 
    const confirmed = confirm(`Delete customer ${customerRegistry[clientIndex].name}? This cannot be undone.`);
    if (!confirmed) return;
 
    customerRegistry.splice(clientIndex, 1);
    saveCustomerRegistry(); 
    buildAdminTerminalData();
    showToast('Customer profile removed.');
}
 
function adminDeleteAllDemoData() {
    const isAdminActive = localStorage.getItem('resourceManAdminSession') === 'true';
 
    if (!isAdminActive) {
        showToast('Admin terminal access required.');
        return;
    }
 
    if (!confirm("⚠️ WARNING: This will permanently delete ALL customers, staff records, payroll history, and product changes. Proceed?")) return;
 
    localStorage.removeItem('resourceManCustomerRegistry');
    localStorage.removeItem('resourceManStaffRegistry');
    localStorage.removeItem('resourceManPayrollHistory');
    localStorage.removeItem('resourceManCatalog');
 
    showToast("System database wiped. Reloading...");
    setTimeout(() => location.reload(), 1200);
}
 
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (overlay) overlay.classList.toggle('active');
}
 
function closeSidebarOnMobile() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
}
 
// 🔥 UPGRADED ADVANCED GLOBAL ROUTER ENGINE
window.navigateTo = function(sectionId) {
    if (typeof closeSidebarOnMobile === 'function') {
        closeSidebarOnMobile();
    }
    
    try {
        if (sectionId === undefined || sectionId === null) return;
        const cleanId = String(sectionId).trim();
        if (!cleanId) return;

        let targetSection = document.getElementById(`page-${cleanId}`) ||
                            document.getElementById(cleanId) || 
                            document.getElementById(`section-${cleanId}`) ||
                            document.getElementById(`panel-${cleanId}`) ||
                            document.getElementById(`content-${cleanId}`) ||
                            document.getElementById(`tab-${cleanId}`) ||
                            document.getElementsByClassName(cleanId)[0] ||
                            document.getElementsByClassName(`section-${cleanId}`)[0] ||
                            document.querySelector(`[data-section="${cleanId}"]`);

        if (!targetSection) {
            console.group("🔍 ResourceMan Layout Inspector");
            console.warn(`Section "${cleanId}" could not be found directly. Scanning rendered UI components...`);
            
            const elements = document.querySelectorAll('main div, section, [id], .section, [class*="content"], .page');
            let foundNames = [];
            elements.forEach(el => {
                if (el.id) foundNames.push(`   ID: #${el.id}`);
                if (el.className && typeof el.className === 'string') {
                    foundNames.push(`   Class: .${el.className.trim().split(/\s+/).join('.')}`);
                }
            });
            
            const uniqueNames = [...new Set(foundNames)].slice(0, 40);
            console.log("👉 ACTUAL HTML ELEMENT NAMES FOUND ON SCREEN:\n" + uniqueNames.join("\n"));
            console.groupEnd();
            return; 
        }

        const layoutSelectors = ['main > div', 'section', '.page-section', '.tab-content', '.content-panel', '.section', '.page'];
        layoutSelectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(panel => {
                    panel.style.setProperty('display', 'none', 'important');
                    panel.classList.remove('active');
                    panel.classList.add('hidden');
                });
            } catch (selectorErr) {}
        });

        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
        });
        const activeNav = document.getElementById(`nav-${cleanId}`);
        if (activeNav) {
            activeNav.classList.add('active');
        }

        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
        targetSection.style.setProperty('display', 'block', 'important');
        
        if (typeof targetSection.scrollIntoView === 'function') {
            targetSection.scrollIntoView({ behavior: 'auto', block: 'start' });
        }

    } catch (globalError) {
        console.error("Navigation safety bridge caught an execution error:", globalError);
    }
};

// EmailJS credentials 
let EMAIL_JS_USER_ID = localStorage.getItem('emailjs_user') || "etEscMwlpKLKSYMJu";
let EMAIL_JS_SERVICE_ID = localStorage.getItem('emailjs_service') || "service_9kbqvrg";
let EMAIL_JS_TEMPLATE_ID = localStorage.getItem('emailjs_template') || "template_3vuepya";
let EMAIL_SUPPORT_EMAIL = localStorage.getItem('email_support') || "zhiausse@gmail.com";
 
function isEmailJsEnabled() {
    // Treat missing/placeholder credentials as "not configured"
    const uidOk = typeof EMAIL_JS_USER_ID === 'string' && EMAIL_JS_USER_ID.trim() && EMAIL_JS_USER_ID !== "YOUR_EMAILJS_USER_ID";
    const sidOk = typeof EMAIL_JS_SERVICE_ID === 'string' && EMAIL_JS_SERVICE_ID.trim() && EMAIL_JS_SERVICE_ID !== "YOUR_SERVICE_ID";
    const tidOk = typeof EMAIL_JS_TEMPLATE_ID === 'string' && EMAIL_JS_TEMPLATE_ID.trim() && EMAIL_JS_TEMPLATE_ID !== "YOUR_TEMPLATE_ID";

    return uidOk && sidOk && tidOk;
}
 
function initEmailJS() {
    if (window.emailjs && isEmailJsEnabled()) {
        try { window.emailjs.init(EMAIL_JS_USER_ID); } catch (e) { console.warn('emailjs.init failed', e); }
    }
}
 
function saveEmailJsCredentials(uid, sid, tid, supportEmail) {
    if (uid) { EMAIL_JS_USER_ID = uid; localStorage.setItem('emailjs_user', uid); }
    if (sid) { EMAIL_JS_SERVICE_ID = sid; localStorage.setItem('emailjs_service', sid); }
    if (tid) { EMAIL_JS_TEMPLATE_ID = tid; localStorage.setItem('emailjs_template', tid); }
    if (supportEmail) { EMAIL_SUPPORT_EMAIL = supportEmail; localStorage.setItem('email_support', supportEmail); }
    initEmailJS();
}
 
function configureEmailJs() {
    const uid = prompt('EmailJS user ID:', EMAIL_JS_USER_ID === 'YOUR_EMAILJS_USER_ID' ? '' : EMAIL_JS_USER_ID);
    if (!uid) return false;
    const sid = prompt('EmailJS service ID:', EMAIL_JS_SERVICE_ID === 'YOUR_SERVICE_ID' ? '' : EMAIL_JS_SERVICE_ID);
    if (!sid) return false;
    const tid = prompt('EmailJS template ID:', EMAIL_JS_TEMPLATE_ID === 'YOUR_TEMPLATE_ID' ? '' : EMAIL_JS_TEMPLATE_ID);
    if (!tid) return false;
    const support = prompt('Admin/support email (receives notifications):', localStorage.getItem('email_support') || EMAIL_SUPPORT_EMAIL);
    saveEmailJsCredentials(uid.trim(), sid.trim(), tid.trim(), support ? support.trim() : null);
    showToast('EmailJS credentials saved for this browser.');
    return true;
}
 
function sendVerificationEmail(email) {
    const statusEl = document.getElementById('verify-status');
    if (!statusEl) return Promise.resolve();
 
    if (!window.emailjs || !isEmailJsEnabled()) {
        statusEl.innerHTML = `
            <p style="margin:0;">Email sending is not configured. Replace the EmailJS IDs in r4.js with your actual service settings to enable real verification emails.</p>
            <p style="margin: 10px 0 0; color: var(--success-color); font-weight: 600;">Dev fallback code: ${verificationCode}</p>
        `;
        return Promise.resolve();
    }
 
    initEmailJS();
    statusEl.innerHTML = `<p style="margin:0;">Sending verification code to ${email}...</p>`;
 
    const templateParams = {
        passcode: verificationCode,
        time: new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        email: email,
        to_email: email,
        verification_code: verificationCode,
        otp: verificationCode,
        one_time_password: verificationCode,
        code: verificationCode,
        from_name: "ResourceMan",
        subject: "ResourceMan Account Verification",
        message: `Your ResourceMan verification code is ${verificationCode}. Enter it on the site to complete registration.`,
        reply_to: EMAIL_SUPPORT_EMAIL
    };
 
    try {
        return window.emailjs.send(EMAIL_JS_SERVICE_ID, EMAIL_JS_TEMPLATE_ID, templateParams)
            .then(() => {
                statusEl.innerHTML = `<p style="margin:0;">Verification code sent to ${email}. Check your inbox (and spam folder).</p>`;
            })
            .catch(error => {
                console.error('EmailJS error', error);
                statusEl.innerHTML = `
                    <p style="margin:0;color:var(--danger);">Email sending failed (EmailJS error). You can still enter the dev fallback code shown above.</p>
                `;
                // Don't block registration flow
                return Promise.resolve();
            });
    } catch (error) {
        console.error('EmailJS send threw synchronously:', error);
        statusEl.innerHTML = `
            <p style="margin:0;color:var(--danger);">Email sending failed (unexpected error). You can still enter the dev fallback code shown above.</p>
        `;
        // Don't block registration flow
        return Promise.resolve();
    }
}
 
function sendAdminNotification(subject, message, replyEmail) {
    // Hard guard against EmailJS misconfiguration causing synchronous throws.
    if (
        !window.emailjs ||
        typeof window.emailjs.send !== 'function' ||
        !isEmailJsEnabled() ||
        !EMAIL_JS_USER_ID ||
        !EMAIL_JS_SERVICE_ID ||
        !EMAIL_JS_TEMPLATE_ID
    ) {
        console.log('Admin email notification disabled (EmailJS not configured):', subject, message);
        return Promise.resolve();
    }

    const templateParams = {
        from_name: "ResourceMan System",
        to_email: EMAIL_SUPPORT_EMAIL,
        subject,
        message,
        reply_to: replyEmail || EMAIL_SUPPORT_EMAIL
    };

    try {
        return window.emailjs.send(EMAIL_JS_SERVICE_ID, EMAIL_JS_TEMPLATE_ID, templateParams)
            .then(() => {
                console.log('Admin notification sent:', subject);
            })
            .catch(error => {
                console.error('Admin email error', error);
                return Promise.resolve();
            });
    } catch (error) {
        console.error('Admin email send threw synchronously:', error);
        return Promise.resolve();
    }
}
 
function renderShoes() {
    const container = document.getElementById('shoes-grid');
    container.innerHTML = '';
    renderItemCards(shoes, container);
}
 
function renderTechProducts() {
    const container = document.getElementById('tech-grid');
    container.innerHTML = '';
    renderItemCards(techProducts, container);
}
 
function renderShoelanders() {
    const container = document.getElementById('shoelanders-grid');
    if (!container) return;
    container.innerHTML = '';
    renderItemCards(shoelanders, container);
}
 
function renderMarikina() {
    const container = document.getElementById('marikina-grid');
    if (!container) return;
    container.innerHTML = '';
    renderItemCards(marikinaCollection, container);
}
 
function renderItemCards(items, container) {
    const isPriceUnlocked = (currentUser && !currentUser.isAdmin && !currentUser.isBlocked);
 
    items.forEach(item => {
        const displayedPrice = isPriceUnlocked ? item.price : "₱?,???";
 
        const div = document.createElement('div');
        div.className = "shoe-card";
        div.innerHTML = `
            <img src="${item.image}">
            <div class="shoe-card-body">
                <h3>${item.name}</h3>
                <p style="font-size: 14px; color: var(--text-muted); margin-top: 8px;">${item.desc}</p>
                <div class="shoe-card-meta" style="margin-top: 16px;">
                    <p class="price-text ${isPriceUnlocked ? 'price-unlocked-text' : 'price-locked-text'}">${displayedPrice}</p>
                    ${!isPriceUnlocked ? '<span class="lock-badge"><i class="fas fa-lock" style="font-size: 9px; margin-right: 4px;"></i>Sign in</span>' : ''}
                </div>
            </div>
        `;
        div.onclick = () => viewItem(item);
        container.appendChild(div);
    });
}
 
function viewItem(item) {
    selectedItem = item;
 
    document.getElementById('modal-shoe-image').src = item.image;
    document.getElementById('modal-shoe-name').textContent = item.name;
    document.getElementById('modal-shoe-desc').textContent = item.desc;
 
    const priceEl = document.getElementById('modal-shoe-price');
    const badgeEl = document.getElementById('price-status-badge');
    const buyBtn = document.getElementById('modal-buy-btn');
 
    if (currentUser && !currentUser.isAdmin && !currentUser.isBlocked) {
        priceEl.textContent = item.price;
        priceEl.className = "modal-price-val price-unlocked-text";
 
        badgeEl.textContent = "Member Price Unlocked";
        badgeEl.className = "badge-status badge-unlocked";
 
        buyBtn.textContent = `Buy - ${item.price}`;
        buyBtn.disabled = false;
        buyBtn.className = "btn-action";
 
    } else {
        priceEl.textContent = "₱?,???";
        priceEl.className = "modal-price-val price-locked-text";
 
        badgeEl.textContent = "Price Locked";
        badgeEl.className = "badge-status badge-locked";
 
        buyBtn.textContent = "Login to Unlock Price";
        buyBtn.className = "btn-action btn-disabled";
        buyBtn.disabled = true;
    }
 
  document.getElementById('modal-quantity').value = 1;
    document.getElementById('shoe-modal').classList.remove('hidden');
}
 
/* Wrapper for inline onclick="viewShoe(1)" in index.html
   Opens the shoe modal by looking up the item from the `shoes` catalog. */
window.viewShoe = function(viewId) {
    const viewIdNum = Number(viewId);
    if (!Number.isFinite(viewIdNum)) {
        console.warn('viewShoe: invalid id', viewId);
        showToast('Unable to open product (invalid id).');
        return;
    }

    const item = shoes.find(s => Number(s.id) === viewIdNum);
    if (!item) return;

    viewItem(item);
};
 
function closeShoeModal() {
    document.getElementById('shoe-modal').classList.add('hidden');
    selectedItem = null;
}
 
function handleProfileWidgetClick() {
    if (currentUser) {
        if (currentUser.isAdmin) {
            navigateTo(11);
        } else {
            navigateTo(10);
        }
    } else {
        navigateTo(10);
    }
}

function login(event) {
    if (event) event.preventDefault();
 
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    const role = document.getElementById('login-role')?.value || 'client';
 
    if (!email || !pass) {
        showToast("Please enter both email and password");
        return;
    }
 
    const clientMatch = customerRegistry.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (clientMatch) {
        if (clientMatch.role && clientMatch.role !== role) {
            showToast(`This account is registered as ${formatRoleLabel(clientMatch.role)}.`);
            return;
        }

        if (clientMatch.isBlocked) {
            showToast("⛔ Access Denied: Account restricted by admin.");
            return;
        }
 
        if (clientMatch.password === pass) {
            currentUser = clientMatch;
            currentUser.role = currentUser.role || role;
            localStorage.setItem('resourceManActiveUser', JSON.stringify(currentUser));
            updateUserUI();
            renderShoes();
            if (!document.getElementById('page-1')) {
                console.error("No #page-1 element found after rendering.");
            }
            showToast("Logged in. Real prices unlocked!");
            navigateTo(10);
        } else {
            showToast("Password incorrect. Access Denied.");
        }
    } else {
        showToast("Account missing. Please register first.");
    }
}
 
function register(event) {
    if (event) event.preventDefault();
 
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const role = document.getElementById('reg-role')?.value || 'client';
 
    if (!name || !email || !pass) {
        showToast("Please fill in all fields.");
        return;
    }

    const validEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!validEmailPattern.test(email)) {
        showToast("Please enter a valid email address.");
        return;
    }
 
    const emailExists = customerRegistry.some(c => c.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
        showToast("An account with this email already exists.");
        return;
    }
 
    const newClient = {
        id: 'cust_' + Date.now(),
        name: name,
        email: email,
        password: pass,
        role: role,
        isBlocked: false,
        purchaseHistory: []
    };
 
    // Initialize verification flow (page-22)
    pendingRegistration = newClient;
    verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
 
    const verifyEmailDisplay = document.getElementById('verify-email-display');
    if (verifyEmailDisplay) verifyEmailDisplay.textContent = email;
 
    // Store in-memory only until verifyEmail() succeeds
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-pass').value = '';
 
    // Send verification email (or show config warning in sendVerificationEmail)
    sendVerificationEmail(email)
        .then(() => {
            showToast("Verification code sent! Enter it to confirm your email.");
            navigateTo(22);
        })
        .catch(() => {
            showToast("Could not send verification email. Check console and EmailJS config.");
            // Still allow entering a code if you see Dev fallback code
            navigateTo(22);
        });
}

function formatRoleLabel(role) {
    if (role === 'brand-ambassador') return 'Brand Ambassador';
    if (role === 'technology-ambassador') return 'Technology Ambassador';
    return 'Client';
}

function verifyEmail() {
    const enteredCode = document.getElementById('verify-code-input').value.trim();
 
    if (!enteredCode) {
        showToast("Please enter the verification code.");
        return;
    }
 
    if (enteredCode !== verificationCode) {
        showToast("Incorrect code. Please try again.");
        return;
    }
 
    if (!pendingRegistration) {
        showToast("Registration session expired. Please try again.");
        return;
    }

    pendingRegistration.role = pendingRegistration.role || 'client';
    customerRegistry.push(pendingRegistration);
    saveCustomerRegistry();
    currentUser = pendingRegistration;
    localStorage.setItem('resourceManActiveUser', JSON.stringify(currentUser));
 
    document.getElementById('verify-code-input').value = '';
    pendingRegistration = null;
    verificationCode = null;
 
    updateUserUI();
    renderShoes();
    showToast("Email verified! Account created successfully.");
    sendAdminNotification(
        "New ResourceMan account created",
        `A new account was verified for ${currentUser.name} <${currentUser.email}>.\nPhone: ${currentUser.phone || 'not provided'}\nAddress: ${currentUser.address || 'not provided'}`,
        currentUser.email
    );
    navigateTo(10);
}
 
function cancelVerification() {
    pendingRegistration = null;
    verificationCode = null;
    document.getElementById('verify-code-input').value = '';
    navigateTo(21);
}
 
function logout() {
    currentUser = null;
    selectedItem = null;
    targetedOrderId = null;
    localStorage.removeItem('resourceManActiveUser');
 
    updateUserUI();
    const customerView = document.getElementById('customer-view');
    const customerEmptyView = document.getElementById('customer-empty-view');
    if (customerView) customerView.classList.add('hidden');
    if (customerEmptyView) customerEmptyView.classList.remove('hidden');
 
    renderShoes();
    renderTechProducts();
 
    showToast("Session disconnected.");
    navigateTo(1);
}
 
function toggleBlockCustomer(email) {
    const client = customerRegistry.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (!client) return;
 
    if (!currentUser || !currentUser.isAdmin) {
        showToast('Admin only.');
        return;
    }
 
    client.isBlocked = !client.isBlocked;
    saveCustomerRegistry();
 
    if (client.isBlocked && currentUser && currentUser.email === client.email) {
        currentUser = null;
        updateUserUI();
        renderShoes();
    }
 
    showToast(`${client.name} has been ${client.isBlocked ? '⚠️ RESTRICTED' : '✅ REINSTATED'}`);
    buildAdminTerminalData();
}

function updateUserUI() {
    const customerView = document.getElementById('customer-view');
    const customerEmptyView = document.getElementById('customer-empty-view');
    const topProfileChip = document.getElementById('top-profile-chip');
    const topProfileName = document.getElementById('top-profile-name');
    const topProfileRole = document.getElementById('top-profile-role');
    const topProfileAvatar = document.getElementById('top-profile-avatar');
 
    const adminView = document.getElementById('admin-view');
    const adminProductView = document.getElementById('admin-product-view');
    const adminPayrollView = document.getElementById('admin-payroll-view');
 
    const navPortalText = document.getElementById('nav-portal-text'); 
    const adminNavButton = document.getElementById('nav-11');
    const adminProductNavButton = document.getElementById('nav-12');
    const adminPayrollNavButton = document.getElementById('nav-13');
 
    if (customerView) customerView.classList.add('hidden');
    if (customerEmptyView) customerEmptyView.classList.add('hidden');
    if (adminView) adminView.classList.add('hidden');
    if (adminProductView) adminProductView.classList.add('hidden');
    if (adminPayrollView) adminPayrollView.classList.add('hidden');
    if (adminNavButton) adminNavButton.classList.add('hidden-admin-nav');
    if (adminProductNavButton) adminProductNavButton.classList.add('hidden-admin-nav');
    if (adminPayrollNavButton) adminPayrollNavButton.classList.add('hidden-admin-nav');
    if (topProfileChip) topProfileChip.classList.add('hidden');
 
    if (currentUser) {
        if (topProfileChip) {
            topProfileChip.classList.remove('hidden');
            if (topProfileName) topProfileName.textContent = currentUser.name || 'User';
            if (topProfileRole) topProfileRole.textContent = formatRoleLabel(currentUser.role || (currentUser.isAdmin ? 'admin' : 'client'));
            if (topProfileAvatar) topProfileAvatar.textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
        }

        if (currentUser.isAdmin) {
            if (adminView) adminView.classList.remove('hidden');
            if (adminNavButton) adminNavButton.classList.remove('hidden-admin-nav');
 
            if (adminProductView) adminProductView.classList.remove('hidden');
            if (adminProductNavButton) adminProductNavButton.classList.remove('hidden-admin-nav');
 
            if (adminPayrollView) adminPayrollView.classList.remove('hidden');
            if (adminPayrollNavButton) adminPayrollNavButton.classList.remove('hidden-admin-nav');
 
            if (navPortalText) navPortalText.textContent = "Admin Control";
            buildAdminTerminalData();
            buildAdminPayrollUI();
            buildAdminOrdersUI();
        } else {
            if (customerView) customerView.classList.remove('hidden');
            if (navPortalText) navPortalText.textContent = "Profile";
 
            document.getElementById('customer-profile-title').textContent = `Hi, ${currentUser.name}!`;
            document.getElementById('customer-profile-subtitle').textContent = currentUser.email;
            document.getElementById('profile-name-text').textContent = currentUser.name;
            document.getElementById('profile-email-text').textContent = currentUser.email;
            document.getElementById('profile-role-text').textContent = formatRoleLabel(currentUser.role || 'client');
            document.getElementById('profile-phone-text').textContent = currentUser.phone || 'Not set';
            document.getElementById('profile-address-text').textContent = currentUser.address || 'Not set';
            document.getElementById('profile-status-text').textContent = currentUser.isBlocked ? 'Blocked' : 'Active';
 
            const purchaseCount = currentUser.purchaseHistory ? currentUser.purchaseHistory.length : 0;
            document.getElementById('profile-orders-count').textContent = purchaseCount || 0;
 
            document.getElementById('contact-phone').value = currentUser.phone || '';
            document.getElementById('contact-address').value = currentUser.address || '';
 
            if (typeof buildCustomerCartTable === 'function') buildCustomerCartTable();
            if (typeof buildCustomerPurchaseTable === 'function') buildCustomerPurchaseTable();
 
            const page12 = document.getElementById('page-12');
            if (page12 && page12.classList.contains('active')) navigateTo(10);
        }
    } else {
        if (navPortalText) navPortalText.textContent = "Profile";
        if (customerEmptyView) customerEmptyView.classList.remove('hidden');
 
        const page11 = document.getElementById('page-11');
        const page12 = document.getElementById('page-12');
        if (page11 && page11.classList.contains('active')) navigateTo(1);
        if (page12 && page12.classList.contains('active')) navigateTo(1);
    }
 
    renderShoes();
    renderTechProducts();
    renderShoelanders();
    renderMarikina();
}
 
function parsePriceToNumber(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;
 
    const numeric = raw.replace(/₱/g, '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    if (!numeric) return null;
    const n = Number(numeric[0]);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
}
 
function formatPriceNumber(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return '';
    const intVal = Math.round(value);
    return `₱${intVal.toLocaleString('en-US')}`;
}
 
function normalizeLookupType(productType) {
    const t = String(productType || '').toLowerCase();
    if (t === 'shoe' || t === 'shoes' || t.includes('gibson elite')) return 'shoe';
    if (t === 'technology' || t === 'technologies') return 'technology';
    if (t === 'shoelander' || t === 'shoelanders' || t.includes('shoelanders best')) return 'shoelander';
    if (t === 'marikina' || t.includes('marikina')) return 'marikina';
    return null;
}
 
function getCatalogArray(productType) {
    const t = normalizeLookupType(productType); 
    if (!t) return null;
    if (t === 'shoe') return shoes;
    if (t === 'technology') return techProducts;
    if (t === 'shoelander') return shoelanders;
    if (t === 'marikina') return marikinaCollection;
    return null;
}
 
function findProductByIdOrName(productType, lookupMode, lookupValue) {
    const arr = getCatalogArray(productType);
    if (!arr) return null;
 
    const value = String(lookupValue || '').trim();
    if (!value) return null;
 
    if (lookupMode === 'id') {
        if (productType === 'shoe') {
            const asNum = parseInt(value, 10);
            if (!Number.isFinite(asNum)) return null;
            return arr.find(p => String(p.id) === String(asNum)) || null;
        }
        return arr.find(p => String(p.id).toLowerCase() === value.toLowerCase()) || null;
    }
 
    const q = value.toLowerCase();
    const matches = arr.filter(p => (p.name || '').toLowerCase() === q || (p.name || '').toLowerCase().includes(q));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return { __ambiguous: true, matches };
    return null;
}
 
function updateProductPriceForType(productType, lookupMode, lookupValue, newPriceInput, newDescInput, newImageInput) {
    if (!currentUser || !currentUser.isAdmin) {
        showToast('Admin only.');
        return;
    }
 
    const arr = getCatalogArray(productType);
    if (!arr) {
        showToast('Invalid product type.');
        return;
    }
 
    const product = findProductByIdOrName(productType, lookupMode, lookupValue);
    if (!product) {
        showToast('No product found for that lookup.');
        return;
    }
    if (product.__ambiguous) {
        showToast(`Lookup is ambiguous. Matches: ${product.matches.map(m => m.name).slice(0, 4).join(', ')}${product.matches.length > 4 ? '...' : ''}`);
        return;
    }
 
    const newPrice = parsePriceToNumber(newPriceInput);
    if (newPrice === null) {
        showToast('Invalid new price.');
        return;
    }
 
    product.price = formatPriceNumber(newPrice);
 
    const newDesc = String(newDescInput || '').trim();
    if (newDesc) product.desc = newDesc;
 
    const newImage = String(newImageInput || '').trim();
    if (newImage) product.image = newImage;
 
    saveCatalog();
    showToast(`Updated: ${product.name} price`);
    renderShoes();
    renderShoelanders();
    renderMarikina();
    renderTechProducts();
}
 
function adminUpdateProductPrice() {
    const productType = document.getElementById('admin-price-type')?.value;
    const lookupMode = document.getElementById('admin-price-lookup-mode')?.value;
    const lookupValue = document.getElementById('admin-price-lookup-value')?.value;
 
    const newPrice = document.getElementById('admin-price-new')?.value;
    const newDesc = document.getElementById('admin-price-desc-new')?.value;
    const newImage = document.getElementById('admin-price-image-new')?.value;
 
    updateProductPriceForType(productType, lookupMode, lookupValue, newPrice, newDesc, newImage);
}
 
function adminAddProduct() {
    if (!currentUser || !currentUser.isAdmin) {
        showToast('Admin only.');
        return;
    }
 
    const productType = document.getElementById('admin-add-type')?.value;
    const arr = getCatalogArray(productType);
    if (!arr) {
        showToast('Invalid product type.');
        return;
    }
 
    const newName = String(document.getElementById('admin-add-name')?.value || '').trim();
    if (!newName) {
        showToast('New Name is required.');
        return;
    }
 
    const newPrice = parsePriceToNumber(document.getElementById('admin-add-price')?.value);
    if (newPrice === null) {
        showToast('Invalid new price.');
        return;
    }
 
    const newImage = String(document.getElementById('admin-add-image')?.value || '').trim() || 'https://picsum.photos/600/400';
    const newDesc = String(document.getElementById('admin-add-desc')?.value || '').trim();
 
    const typeForObject = normalizeLookupType(productType);
    if (!typeForObject) {
        showToast('Invalid product type.');
        return;
    }
 
    // NOTE: your current HTML does not include admin-add-id/admin-add-image-file, so we treat ID as auto-generated.
    let newId = null;
 
    if (typeForObject === 'shoe') {
        const maxId = arr.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
        newId = maxId + 1;
        if (arr.some(p => String(p.id) === String(newId))) {
            showToast('Duplicate ID for shoes.');
            return;
        }
    } else {
        const prefix = typeForObject === 'technology' ? 'tech-' : 'other-';
        const nums = arr
            .map(p => String(p.id).toLowerCase().startsWith(prefix) ? Number(String(p.id).slice(prefix.length)) : NaN)
            .filter(n => Number.isFinite(n));
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        newId = `${prefix}${next}`;

        if (arr.some(p => String(p.id).toLowerCase() === String(newId).toLowerCase())) {
            showToast('Duplicate ID for this product type.');
            return;
        }
    }

    const obj = {
        id: newId,
        type: typeForObject,
        name: newName,
        price: formatPriceNumber(newPrice),
        image: newImage,
        desc: newDesc || ''
    };
 
    arr.unshift(obj);
 
    saveCatalog();
    showToast(`Added product: ${obj.name}`);

    renderShoes();
    renderShoelanders();
    renderMarikina();
    renderTechProducts();
}


function saveProfile() {
    if (!currentUser || currentUser.isAdmin) return;
    currentUser.phone = document.getElementById('contact-phone').value.trim();
    currentUser.address = document.getElementById('contact-address').value.trim();
    showToast("Shipping metrics updated successfully.");
}

function buildCustomerPurchaseTable() {
    const container = document.getElementById('customer-purchase-rows');
    if (!container) return;
    container.innerHTML = '';
 
    const purchase = currentUser?.purchaseHistory || [];
 
    if (purchase.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted); font-style: italic;">No purchases found.</td></tr>';
        return;
    }
 
    purchase.forEach(order => {
        let deliveryInfo = '';
        let statusClass = 'pill-transit';
 
        if (order.delivered === true) {
            statusClass = 'pill-delivered';
            deliveryInfo = `<div style="font-size:11px;color:#22c55e;margin-top:4px;"><i class="fas fa-check-circle"></i> Delivered in ${order.deliveryDays} day(s)</div>`;
        } else if (order.status === 'Paid' || order.status === 'Pending') {
            const expectedDays = order.expectedDays || '3-7';
            deliveryInfo = `<div style="font-size:11px;color:#eab308;margin-top:4px;"><i class="fas fa-truck"></i> Expected: ${expectedDays} days</div>`;
        } else if (order.status === 'Delivered') {
            deliveryInfo = '<div style="font-size:11px;color:#22c55e;margin-top:4px;"><i class="fas fa-check-circle"></i> Completed</div>';
        }
 
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="mono-id">${order.id}</td>
            <td style="font-weight: 500; color: #ffffff;">${order.item}</td>
            <td>${order.cost}</td>
            <td>
                <span class="pill-status ${statusClass}">${order.status}</span>
                ${deliveryInfo}
            </td>
            <td style="text-align: right;">
                <button onclick="askCancelOrder('${order.id}')" class="btn-cancel">Cancel</button>
            </td>
        `;
        container.appendChild(tr);
    });
}
 
function buildCustomerCartTable() {
    const container = document.getElementById('customer-cart-rows');
    if (!container) return;
    container.innerHTML = '';
 
    const cart = currentUser?.cartHistory || [];
    const checkoutBtn = document.getElementById('checkout-all-btn');
 
    if (cart.length === 0) {
        if (checkoutBtn) checkoutBtn.style.display = 'none';
        container.innerHTML = `<tr><td colspan="5" style="padding: 24px; text-align: center; color: var(--text-muted); font-style: italic;">No items in cart yet.</td></tr>`;
        return;
    }
 
    if (checkoutBtn) checkoutBtn.style.display = 'block';
    cart.forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="mono-id">${order.id}</td>
            <td style="font-weight: 500; color: #ffffff;">${order.item}</td>
            <td>${order.cost}<br><small style="color:var(--text-muted)">via ${order.payment || 'N/A'}</small></td>
            <td>
                <span class="pill-status ${order.status === 'Delivered' ? 'pill-delivered' : 'pill-transit'}">
                    ${order.status}
                </span>
            </td>
            <td style="text-align: right;">
                <button onclick="askCancelOrder('${order.id}')" class="btn-cancel">Cancel Order</button>
            </td>
        `;
        container.appendChild(tr);
    });
}
 
function checkoutCart() {
    if (!currentUser || !currentUser.cartHistory || currentUser.cartHistory.length === 0) return;
    document.getElementById('payment-modal').classList.remove('hidden');
    toggleGcashPaymentDetails(); 
}
 
function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
    isGcashPaid = false;
    const statusEl = document.getElementById('gcash-payment-status');
    if (statusEl) statusEl.textContent = '';
}
 
function confirmCheckoutWithPayment() {
    if (!currentUser || !currentUser.cartHistory || currentUser.cartHistory.length === 0) {
        showToast("Your cart is empty!");
        return;
    }
 
    const selectedPayment = document.querySelector('input[name="payment-method"]:checked')?.value || "COD";
 
    const itemsToMove = currentUser.cartHistory.map(item => ({
        ...item,
        status: 'Pending',
        payment: selectedPayment,
        id: 'ORDER-' + Math.floor(1000 + Math.random() * 9000)
    }));
 
    const totalCostValue = itemsToMove.reduce((sum, i) => sum + (parsePriceToNumber(i.cost) || 0), 0);
    const formattedTotal = formatPriceNumber(totalCostValue);
    const itemList = itemsToMove.map(i => i.item).join(', ');
 
    const payment = {
        id: 'PAY-' + Date.now().toString().slice(-6),
        customerName: currentUser.name,
        customerEmail: currentUser.email,
        itemName: itemList,
        amount: formattedTotal,
        paymentMethod: selectedPayment,
        date: new Date().toLocaleString()
    };
 
    pendingManualPayments.push(payment);
 
    currentUser.purchaseHistory = currentUser.purchaseHistory || [];
    currentUser.purchaseHistory = currentUser.purchaseHistory.concat(itemsToMove);
    currentUser.cartHistory = [];
 
    saveCustomerRegistry();
 
    showToast(`Order placed! Total: ${formattedTotal} - Awaiting payment approval.`);
 
    buildCustomerCartTable();
    buildCustomerPurchaseTable();
    closePaymentModal();
 
    if (currentUser.isAdmin) {
        showPendingPayments();
    }
}
 
async function confirmGcashPayment() {
    const statusEl = document.getElementById('gcash-payment-status');
    const authButton = document.querySelector('#gcash-payment-details .btn-sync');
 
    if (!currentUser || !currentUser.cartHistory.length) return;
 
    if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opening Secure PayLingo Gateway...';
    if (authButton) authButton.disabled = true;
 
    const items = currentUser.cartHistory.map(item => {
        const unitAmount = parsePriceToNumber(item.cost) || 0;
        return {
            price_data: {
                currency: 'php',
                product_data: { name: item.item },
                unit_amount: Math.round(unitAmount * 100), 
            },
            quantity: 1,
        };
    });
 
    try {
        const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '' : 'https://your-resource-man-backend.onrender.com';
 
        const response = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items, customerEmail: currentUser.email })
        });
 
        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error(data.error || 'Gateway connection failed');
        }
    } catch (error) {
        console.error('Actual Payment Error:', error);
        if (statusEl) {
            statusEl.innerHTML = `✗ Gateway Error: ${error.message}`;
            statusEl.style.color = "var(--danger)";
        }
        if (authButton) authButton.disabled = false;
        showToast("Actual payment service unavailable.");
    }
}
 
function toggleGcashPaymentDetails() {
    const selectedPayment = document.querySelector('input[name="payment-method"]:checked')?.value;
    const gcashDetails = document.getElementById('gcash-payment-details');
 
    if (gcashDetails) {
        gcashDetails.style.display = selectedPayment === 'GCash' ? 'block' : 'none';
        isGcashPaid = false;
        const statusEl = document.getElementById('gcash-payment-status');
        if (statusEl) statusEl.textContent = '';
    }
}
 
function askCancelOrder(orderId) {
    targetedOrderId = orderId;
    document.getElementById('cancel-reason-modal').classList.remove('hidden');
}
 
function closeCancelModal() {
    document.getElementById('cancel-reason-modal').classList.add('hidden');
    targetedOrderId = null;
}
 
function confirmCancelOrder() {
    if (!targetedOrderId || !currentUser) return;
 
    const selectedReasonEl = document.querySelector('input[name="cancel-reason"]:checked');
    const cancellationReason = selectedReasonEl ? selectedReasonEl.value : "No reason provided";
 
    const cart = currentUser.cartHistory || [];
    const purchase = currentUser.purchaseHistory || [];
 
    if (cart.some(o => o.id === targetedOrderId)) {
        currentUser.cartHistory = cart.filter(order => order.id !== targetedOrderId);
    }
    if (purchase.some(o => o.id === targetedOrderId)) {
        currentUser.purchaseHistory = purchase.filter(order => order.id !== targetedOrderId);
    }
 
    showToast(`Order ${targetedOrderId} cancelled. Reason: "${cancellationReason}"`);
    sendAdminNotification(
        "ResourceMan order cancellation",
        `Customer ${currentUser.name} <${currentUser.email}> cancelled order ${targetedOrderId}.\nReason: ${cancellationReason}`,
        currentUser.email
    );
 
    saveCustomerRegistry();
    closeCancelModal();
    if (typeof buildCustomerCartTable === 'function') buildCustomerCartTable();
    if (typeof buildCustomerPurchaseTable === 'function') buildCustomerPurchaseTable();
}
 
function buildAdminTerminalData() {
    document.getElementById('stat-profiles').textContent = customerRegistry.length;
 
    let totalOrdersCount = 0;
    let blockedCount = 0;
 
    customerRegistry.forEach(c => {
        totalOrdersCount += (c.purchaseHistory || []).length;
        if (c.isBlocked) blockedCount++;
    });
 
    document.getElementById('stat-orders').textContent = totalOrdersCount;
    document.getElementById('stat-blocked').textContent = blockedCount;
 
    const container = document.getElementById('admin-customer-rows');
    container.innerHTML = '';
 
    customerRegistry.forEach(client => {
        const tr = document.createElement('tr');
        if (client.isBlocked) tr.className = "row-blocked";
 
        const ordersSummary = (client.purchaseHistory || [])
            .map(h => `<div style="font-size: 12px; color: #a1a1aa;">${h.id}: ${h.item} (${h.payment || 'N/A'})</div>`)
            .join('') || '<span style="font-size: 12px; color: #52525b; font-style: italic;">No orders</span>';
 
        const contactBlock = `<div style="font-size: 12px; color: #e4e4e7;">${client.phone || 'No Phone'}</div><div style="font-size: 11px; color: var(--text-muted); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${client.address || 'No Address'}</div>`;
 
        tr.innerHTML = `
            <td>
                <div class="inline-block-tag" style="font-weight: 600; color: #ffffff;">
                    ${client.name}
                    ${client.isBlocked ? '<span class="badge-blocked-alert">Blocked</span>' : ''}
                </div>
            </td>
            <td style="font-family: monospace; font-size: 12px; color: #a1a1aa;">${client.email}</td>
            <td style="font-family: monospace; font-size: 12px; color: #eab308; font-weight: 700;">${client.password}</td>
            <td>${contactBlock}</td>
            <td>${ordersSummary}</td>
            <td style="text-align: center;">
                <button onclick="deleteCustomer('${client.email}')" class="btn-delete">Delete Customer</button>
            </td>
        `;
 
        container.appendChild(tr);
    });
}
 
function buildAdminOrdersUI() {
    const container = document.getElementById('admin-orders-rows');
    if (!container) return;
    container.innerHTML = '';
 
    let allOrders = [];
    customerRegistry.forEach(client => {
        const history = client.purchaseHistory || [];
        history.forEach(order => {
            allOrders.push({
                ...order,
                clientName: client.name,
                clientEmail: client.email
            });
        });
    });
 
    if (allOrders.length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted); font-style: italic;">No purchase history found in system.</td></tr>`;
        return;
    }
 
    allOrders.reverse().forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="mono-id">${order.id}</td>
            <td>
                <div style="font-weight: 600; color: #ffffff;">${order.clientName}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${order.clientEmail}</div>
            </td>
            <td style="font-weight: 500; color: #ffffff;">${order.item}</td>
            <td class="price-unlocked-text">${order.cost}</td>
            <td><span class="pill-status pill-delivered">${order.payment || 'N/A'}</span></td>
            <td><span class="pill-status ${order.status === 'Delivered' ? 'pill-delivered' : 'pill-transit'}">${order.status}</span></td>
        `;
        container.appendChild(tr);
    });
}
 
function buildAdminPayrollUI() {
    const staffContainer = document.getElementById('admin-staff-rows');
    const historyContainer = document.getElementById('admin-payroll-history-rows');
    const ownerAccountDisplay = document.getElementById('admin-owner-account-info');
 
    let totalRevenue = 0;
    customerRegistry.forEach(client => {
        const history = client.purchaseHistory || [];
        history.forEach(order => {
            totalRevenue += (parsePriceToNumber(order.cost) || 0);
        });
    });
 
    if (ownerAccountDisplay) {
        ownerAccountDisplay.innerHTML = `
            <p><strong>Owner:</strong> ${OWNER_PAYROLL_ACCOUNT.holder}</p>
            <p><strong>Account:</strong> ${OWNER_PAYROLL_ACCOUNT.number} | <strong>SWIFT:</strong> ${OWNER_PAYROLL_ACCOUNT.swift}</p>
            <div style="background: var(--surface-secondary); padding: 16px; border-radius: 8px; border-left: 4px solid var(--primary);">
                <h4 style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Total Owner Revenue (Sales)</h4>
                <div style="font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 12px;">${formatPriceNumber(totalRevenue)}</div>
                <p style="font-size: 13px; margin-bottom: 4px;">Payable to: <strong>${OWNER_PAYROLL_ACCOUNT.holder}</strong></p>
                <p style="font-size: 11px; color: var(--text-muted);">Acc: ${OWNER_PAYROLL_ACCOUNT.number} | SWIFT: ${OWNER_PAYROLL_ACCOUNT.swift}</p>
            </div>
        `;
    }
 
    if (!staffContainer || !historyContainer) return;
 
    staffContainer.innerHTML = '';
    staffRegistry.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600; color:#fff;">${s.name}</td>
            <td style="color:var(--text-muted);">${s.position}</td>
            <td class="price-unlocked-text">${formatPriceNumber(s.salary)}</td>
            <td style="text-align:right;">
                <button onclick="adminDeleteStaff('${s.id}')" class="btn-delete">Remove</button>
            </td>
        `;
        staffContainer.appendChild(tr);
    });
 
    historyContainer.innerHTML = '';
    payrollHistory.forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="mono-id">${h.id}</td>
            <td>${h.date}</td>
            <td>${h.count} Staff</td>
            <td style="font-weight:700; color:#fff;">${h.total}</td>
            <td><span class="pill-status pill-delivered">${h.status}</span></td>
        `;
        historyContainer.appendChild(tr);
    });
}
 
function adminAddStaff() {
    const name = document.getElementById('staff-name')?.value.trim();
    const pos = document.getElementById('staff-pos')?.value.trim();
    const salary = parsePriceToNumber(document.getElementById('staff-salary')?.value);
 
    if (!name || !pos || salary === null) {
        showToast("Please fill all staff fields correctly.");
        return;
    }
 
    const newStaff = {
        id: 'EMP-' + Math.floor(1000 + Math.random() * 9000),
        name, position: pos, salary
    };
 
    staffRegistry.push(newStaff);
    savePayrollData();
    showToast(`Staff ${name} added.`);
    buildAdminPayrollUI();
}
 
function adminDeleteStaff(id) {
    staffRegistry = staffRegistry.filter(s => s.id !== id);
    savePayrollData();
    buildAdminPayrollUI();
}
 
function adminProcessPayroll() {
    if (staffRegistry.length === 0) {
        showToast("No staff members to pay.");
        return;
    }
 
    const totalAmount = staffRegistry.reduce((sum, s) => sum + s.salary, 0);
    const payrollEntry = {
        id: 'PAY-' + Date.now().toString().slice(-6),
        date: new Date().toLocaleDateString(),
        count: staffRegistry.length,
        total: formatPriceNumber(totalAmount),
        status: 'Disbursed'
    };
 
    payrollHistory.unshift(payrollEntry);
    savePayrollData();
    showToast(`Processed payroll for ${staffRegistry.length} employees.`);
    buildAdminPayrollUI();
}
 
function addToCart() {
    if (!selectedItem) return;
 
    const item = selectedItem;
    const quantityInput = parseInt(document.getElementById('modal-quantity').value, 10);
    const quantity = Number.isInteger(quantityInput) && quantityInput > 0 ? quantityInput : 1;
 
    if (!currentUser) {
        showToast("Please sign in to make a purchase.");
        closeShoeModal();
        navigateTo(10);
        return;
    }
 
    if (currentUser.isAdmin) {
        showToast("Admin profiles cannot issue checkout transactions.");
        closeShoeModal();
        return;
    }
const rawPrice = item.price.replace(/[^0-9\.]/g, '').replace(/,/g, '');
    const baseValue = parseFloat(rawPrice) || 0;
    const totalValue = baseValue * quantity;
    const formattedTotal = `₱${totalValue.toLocaleString('en-US')}`;
    const displayName = quantity > 1 ? `${item.name} x${quantity}` : item.name;
 
    const txId = "TX-" + Math.floor(1000 + Math.random() * 9000);
 
    (currentUser.cartHistory || (currentUser.cartHistory = [])).unshift({
        id: txId,
        item: displayName,
        cost: formattedTotal,
        status: "In Transit"
    });
 
    saveCustomerRegistry();
    showToast(`Success! ${displayName} added to cart.`);
    if (typeof buildCustomerCartTable === 'function') buildCustomerCartTable();
 
    sendAdminNotification(
        "New ResourceMan purchase recorded",
        `Customer ${currentUser.name} <${currentUser.email}> purchased ${displayName} for ${formattedTotal}.\nOrder ID: ${txId}`,
        currentUser.email
    );
    closeShoeModal();
}
 
function handleAdminImageUpload(mode) {
    let fileInputId, imagePreviewId, filenameDisplayId, urlInputId;
 
    if (mode === 'update') {
        fileInputId = 'admin-price-image-file';
        imagePreviewId = 'admin-price-image-preview';
        filenameDisplayId = 'admin-price-image-filename';
        urlInputId = 'admin-price-image-new';
    } else if (mode === 'add') {
        fileInputId = 'admin-add-image-file';
        imagePreviewId = 'admin-add-image-preview';
        filenameDisplayId = 'admin-add-image-filename';
        urlInputId = 'admin-add-image';
    } else {
        console.error('Invalid mode for handleAdminImageUpload:', mode);
        return;
    }
 
    const fileInput = document.getElementById(fileInputId);
    const imagePreview = document.getElementById(imagePreviewId);
    const filenameDisplay = document.getElementById(filenameDisplayId);
    const urlInput = document.getElementById(urlInputId);
 
    if (!fileInput || !imagePreview || !filenameDisplay || !urlInput) {
        console.error('Missing elements for image upload handler:', { fileInputId, imagePreviewId, filenameDisplayId, urlInputId });
        return;
    }
 
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            urlInput.value = e.target.result; 
        };
        reader.readAsDataURL(file);
        filenameDisplay.textContent = file.name;
    } else {
        imagePreview.src = ''; 
        urlInput.value = ''; 
        filenameDisplay.textContent = 'No file selected';
    }
}
 
function sendTestEmail() {
    verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
 
    try {
        showToast('Preparing test verification...');
        sendVerificationEmail(EMAIL_SUPPORT_EMAIL)
            .then(() => {
                showToast('Test verification triggered (check fallback or inbox).');
            })
            .catch(() => {
                showToast('Test send failed. Check console for details.');
            });
 
        sendAdminNotification(
            'Test notification from ResourceMan',
            `This is a system test. Verification code: ${verificationCode}`,
            EMAIL_SUPPORT_EMAIL
        );

        if (!isEmailJsEnabled() || !window.emailjs) {
            console.log('Dev test verification code:', verificationCode);
            alert(`Dev test verification code: ${verificationCode}`);
        }
    } catch (err) {
        console.error('Test email error', err);
        showToast('Error while attempting test send.');
    }
}
 
function sendLiveTest() {
    if (!window.emailjs) {
        alert('EmailJS library not loaded. Make sure r4.html includes the EmailJS script.');
        return;
    }
 
    if (!isEmailJsEnabled()) {
        const ok = configureEmailJs();
        if (!ok) { showToast('Live test cancelled'); return; }
    }
 
    verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    sendVerificationEmail(EMAIL_SUPPORT_EMAIL)
        .then(() => {
            showToast(`Live verification sent to ${EMAIL_SUPPORT_EMAIL}`);
        })
        .catch(() => {
            showToast('Live send failed. Check console for details.');
        });
 
    sendAdminNotification('Live test notification', `Live test code: ${verificationCode}`, EMAIL_SUPPORT_EMAIL);
}
 
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2500);
}
 
// ==========================================
// INQUIRY SUBMISSION
// ==========================================
function submitInquiry(event) {
    event.preventDefault();

    const name = document.getElementById('inquiry-name').value.trim();
    const email = document.getElementById('inquiry-email').value.trim();
    const subject = document.getElementById('inquiry-subject').value;
    const message = document.getElementById('inquiry-message').value.trim();

    if (!name || !email || !subject || !message) {
        showToast('Please fill in all fields.');
        return;
    }

    const inquiry = {
        id: 'INQ-' + Date.now().toString().slice(-6),
        name,
        email,
        subject,
        message,
        date: new Date().toLocaleString(),
        replied: false
    };

    // Store to localStorage for admin visibility
    const inquiries = JSON.parse(localStorage.getItem('resourceManInquiries') || '[]');
    inquiries.unshift(inquiry);
    localStorage.setItem('resourceManInquiries', JSON.stringify(inquiries));

    // Sync to global storage
    window.syncToWordPress('inquiries', inquiries);

    // Send admin notification
    sendAdminNotification(
        `New Inquiry: ${subject}`,
        `From: ${name} <${email}>\nSubject: ${subject}\nMessage: ${message}`,
        email
    );

    // Reset form
    document.getElementById('inquiry-form').reset();
    showToast('Your inquiry has been sent! We\'ll get back to you soon.');
}

// ==========================================
// 1. SECRET ADMIN SEQUENCE ("qwerty")
// ==========================================
// Already handled by the global keydown listener above (lines 82-113).
// Duplicate removed to prevent conflicts.

// ==========================================
// 2. FIXED GLOBAL NAVIGATION HELPER ENGINE
// ==========================================
window.navigateTo = function(sectionId) {
    try {
        if (sectionId === undefined || sectionId === null) return;
        const cleanId = String(sectionId).trim();
        if (!cleanId) return;

        let targetSection = document.getElementById(`page-${cleanId}`) ||
                            document.getElementById(cleanId) || 
                            document.getElementById(`section-${cleanId}`) ||
                            document.getElementById(`panel-${cleanId}`) ||
                            document.getElementById(`content-${cleanId}`) ||
                            document.getElementById(`tab-${cleanId}`) ||
                            document.getElementsByClassName(cleanId)[0] ||
                            document.getElementsByClassName(`section-${cleanId}`)[0] ||
                            document.querySelector(`[data-section="${cleanId}"]`);

        if (!targetSection) {
            console.group("🔍 ResourceMan Layout Inspector");
            console.warn(`Section "${cleanId}" could not be found directly. Scanning rendered UI components...`);
            
            const elements = document.querySelectorAll('main div, section, [id], .section, [class*="content"], .page');
            let foundNames = [];
            elements.forEach(el => {
                if (el.id) foundNames.push(`   ID: #${el.id}`);
                if (el.className && typeof el.className === 'string') {
                    foundNames.push(`   Class: .${el.className.trim().split(/\s+/).join('.')}`);
                }
            });
            
            const uniqueNames = [...new Set(foundNames)].slice(0, 40);
            console.log("👉 ACTUAL HTML ELEMENT NAMES FOUND ON SCREEN:\n" + uniqueNames.join("\n"));
            console.groupEnd();
            return; 
        }

        const layoutSelectors = ['.page', '.page-section', '.content-panel', '.section'];
        layoutSelectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(panel => {
                    if (panel !== targetSection) {
                        panel.style.setProperty('display', 'none', 'important');
                        panel.classList.add('hidden');
                        panel.classList.remove('active');
                    }
                });
            } catch (selectorErr) {}
        });

        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
        });
        const activeNav = document.getElementById(`nav-${cleanId}`);
        if (activeNav) {
            activeNav.classList.add('active');
        }

        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
        targetSection.style.setProperty('display', 'block', 'important');
        
        if (typeof targetSection.scrollIntoView === 'function') {
            targetSection.scrollIntoView({ behavior: 'auto', block: 'start' });
        }

    } catch (globalError) {
        console.error("Navigation safety bridge caught an execution error:", globalError);
    }
};

// ==========================================
// ADMIN UI MANAGER (PAGE 12)
// ==========================================
 
function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => { btn.classList.remove('active'); });
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');
 
    document.querySelectorAll('.admin-panel-section').forEach(panel => { panel.classList.remove('active'); });
    document.getElementById(`admin-panel-${tabName}`).classList.add('active');
 
    if (tabName === 'navigation') {
        renderNavigationEditor();
        renderPageEditor();
    }
    if (tabName === 'products') {
        loadProductsForAdmin();
    }
}
 
function loadProductsForAdmin() {
    const typeSelect = document.getElementById('admin-price-type');
    const productSelect = document.getElementById('admin-select-product');
    if (!typeSelect || !productSelect) return;
    const type = typeSelect.value;
    let arr = [];
    if (type === 'shoe') arr = shoes;
    else if (type === 'shoelander') arr = shoelanders;
    else if (type === 'marikina') arr = marikinaCollection;
    else if (type === 'technology') arr = techProducts;
 
    productSelect.innerHTML = '<option value="">-- Select a product to Edit --</option>';
    if (arr && arr.length > 0) {
        arr.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${p.price})`;
            productSelect.appendChild(opt);
        });
    }
}
 
function populateProductFields() {
    const type = document.getElementById('admin-price-type').value;
    const id = document.getElementById('admin-select-product').value;
    if (!id) return;
    const arr = getCatalogArray(type);
    if (!arr) return;
    const p = arr.find(item => String(item.id) === String(id));
    if (p) {
        document.getElementById('admin-edit-name').value = p.name;
        document.getElementById('admin-edit-price').value = p.price.replace(/₱/g, '').replace(/,/g, '');
        document.getElementById('admin-edit-desc').value = p.desc || '';
    }
}
 
function updateProduct() {
    if (!currentUser || !currentUser.isAdmin) { showToast('Admin access required.'); return; }
    const type = document.getElementById('admin-price-type').value;
    const id = document.getElementById('admin-select-product').value;
    const newName = document.getElementById('admin-edit-name').value.trim();
    const newPriceRaw = document.getElementById('admin-edit-price').value;
    const newDesc = document.getElementById('admin-edit-desc').value.trim();
    if (!id || !newName || !newPriceRaw) { showToast('Please fill all fields.'); return; }
    const arr = getCatalogArray(type);
    if (!arr) return;
    const pIndex = arr.findIndex(item => String(item.id) === String(id));
    if (pIndex === -1) { showToast('Product not found.'); return; }
    const newPrice = parsePriceToNumber(newPriceRaw);
    if (newPrice === null) { showToast('Invalid price format.'); return; }
    arr[pIndex].name = newName;
    arr[pIndex].price = formatPriceNumber(newPrice);
    arr[pIndex].desc = newDesc;
    saveCatalog();
    showToast(`Updated ${newName}`);
    loadProductsForAdmin();
    renderShoes();
    renderShoelanders();
    renderMarikina();
    renderTechProducts();
}
 
function deleteProduct() {
    if (!currentUser || !currentUser.isAdmin) { showToast('Admin access required.'); return; }
    const type = document.getElementById('admin-price-type').value;
    const id = document.getElementById('admin-select-product').value;
    if (!id) { showToast('Select a product to delete.'); return; }
    if (!confirm('Delete this product?')) return;
    const arr = getCatalogArray(type);
    if (!arr) return;
    const pIndex = arr.findIndex(item => String(item.id) === String(id));
    if (pIndex > -1) {
        arr.splice(pIndex, 1);
        saveCatalog();
        showToast('Deleted');
        document.getElementById('admin-select-product').value = '';
        document.getElementById('admin-edit-name').value = '';
        document.getElementById('admin-edit-price').value = '';
        document.getElementById('admin-edit-desc').value = '';
        loadProductsForAdmin();
        renderShoes();
        renderShoelanders();
        renderMarikina();
        renderTechProducts();
    }
}
 
function addNewProduct() {
    if (!currentUser || !currentUser.isAdmin) { showToast('Admin access required.'); return; }
    const type = document.getElementById('admin-add-type').value;
    const name = document.getElementById('admin-add-name').value.trim();
    const priceRaw = document.getElementById('admin-add-price').value;
    const desc = document.getElementById('admin-add-desc').value.trim();
    if (!name || !priceRaw) { showToast('Name and Price required.'); return; }
    const price = parsePriceToNumber(priceRaw);
    if (price === null) { showToast('Invalid price.'); return; }
    const arr = getCatalogArray(type);
    if (!arr) { showToast('Invalid product type.'); return; }
    let prefix = 'prod-';
    if (type === 'technology') prefix = 'tech-';
    else if (type === 'shoelander') prefix = 'sl-';
    const existingIds = arr.map(p => parseInt(String(p.id).replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const newProduct = { id: prefix + (maxId + 1), type: normalizeLookupType(type), name: name, price: formatPriceNumber(price), image: 'https://picsum.photos/600/400', desc: desc };
    arr.unshift(newProduct);
    saveCatalog();
    showToast(`Added ${name}`);
    document.getElementById('admin-add-name').value = '';
    document.getElementById('admin-add-price').value = '';
    document.getElementById('admin-add-desc').value = '';
    loadProductsForAdmin();
    renderShoes();
    renderShoelanders();
    renderMarikina();
    renderTechProducts();
}
 
function renderNavigationEditor() {
    const container = document.getElementById('nav-editor-rows');
    if (!container) return;
    container.innerHTML = '';
    const navItems = document.querySelectorAll('.sidebar .nav-item');
    navItems.forEach((nav, index) => {
        if (nav.classList.contains('hidden-admin-nav')) return;
        const span = nav.querySelector('span');
        const currentLabel = span ? span.textContent : 'Untitled';
        const navId = nav.id || `nav-${index}`;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${currentLabel}</td><td><input type="text" class="form-input" id="input-nav-${navId}" value="${currentLabel}"></td><td><button onclick="updateNavLabel('${navId}')" class="btn-action">Save</button></td>`;
        container.appendChild(tr);
    });
}
 
function updateNavLabel(navId) {
    if (!currentUser || !currentUser.isAdmin) return;
    const input = document.getElementById(`input-nav-${navId}`);
    if (!input) return;
    const newLabel = input.value.trim();
    if (!newLabel) return;
    const navItem = document.getElementById(navId);
    const span = navItem.querySelector('span');
    if (span) span.textContent = newLabel;
    showToast('Label updated');
}
 
function renderPageEditor() {
    const container = document.getElementById('page-editor-rows');
    if (!container) return;
    container.innerHTML = '';
    const pages = [
        { id: 1, name: 'Home' },
        { id: 3, name: 'Shoes' },
        { id: 4, name: 'Tech' },
        { id: 6, name: 'Shoelanders' },
        { id: 7, name: 'Marikina' }
    ];
    pages.forEach(p => {
        const pageEl = document.getElementById(`page-${p.id}`);
        if (!pageEl) return;
        const h1 = pageEl.querySelector('h1');
        const currentTitle = h1 ? h1.textContent : 'No Title';
        const sub = pageEl.querySelector('.page-subtitle');
        const currentSub = sub ? sub.textContent : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.name}</td><td>${currentTitle}</td><td><input type="text" class="form-input" id="input-title-${p.id}" value="${currentTitle}"></td><td>${currentSub}</td><td><input type="text" class="form-input" id="input-sub-${p.id}" value="${currentSub}"></td><td><button onclick="updatePageContent(${p.id})" class="btn-action">Save</button></td>`;
        container.appendChild(tr);
    });
}
 
function updatePageContent(pageId) {
    if (!currentUser || !currentUser.isAdmin) return;
    const titleInput = document.getElementById(`input-title-${pageId}`);
    const subInput = document.getElementById(`input-sub-${pageId}`);
    if (!titleInput) return;
    const newTitle = titleInput.value.trim();
    const newSub = subInput ? subInput.value.trim() : '';
    const pageEl = document.getElementById(`page-${pageId}`);
    if (!pageEl) return;
    const h1 = pageEl.querySelector('h1');
    if (h1) h1.textContent = newTitle;
    let sub = pageEl.querySelector('.page-subtitle');
    if (newSub) {
        if (!sub) { 
            sub = document.createElement('p'); 
            sub.className = 'page-subtitle'; 
            if (h1) h1.parentNode.insertBefore(sub, h1.nextSibling); 
        }
        sub.textContent = newSub;
    } else if (sub) { 
        sub.remove(); 
    }
    showToast(`Page ${pageId} updated`);
}

function addNavItem() {
    if (!currentUser || !currentUser.isAdmin) {
        showToast('Admin access required.');
        return;
    }
 
    const navId = document.getElementById('admin-add-nav-id').value.trim();
    const navLabel = document.getElementById('admin-add-nav-label').value.trim();
    const navIcon = document.getElementById('admin-add-nav-icon').value.trim() || 'fa-link';
    const navPage = document.getElementById('admin-add-nav-page').value.trim();
 
    if (!navId || !navLabel || !navPage) {
        showToast('Nav ID, Label, and Page are required.');
        return;
    }
 
    const existingNav = document.getElementById(`nav-${navId}`);
    if (existingNav) {
        showToast('Nav ID already exists!');
        return;
    }
 
    const newNav = document.createElement('a');
    newNav.id = `nav-${navId}`;
    newNav.className = 'nav-item';
    newNav.onclick = function() { navigateTo(navPage); };
    newNav.innerHTML = `<i class="fas ${navIcon}"></i><span data-label="${navLabel}">${navLabel}</span>`;
 
    const navContainer = document.getElementById('main-nav-container');
    if (navContainer) {
        navContainer.appendChild(newNav);
        showToast(`Navigation item added: ${navLabel}`);
    }
 
    document.getElementById('admin-add-nav-id').value = '';
    document.getElementById('admin-add-nav-label').value = '';
    document.getElementById('admin-add-nav-icon').value = '';
    document.getElementById('admin-add-nav-page').value = '';
}
 
function deleteNavItem(navId) {
    if (!currentUser || !currentUser.isAdmin) {
        showToast('Admin access required.');
        return;
    }
 
    if (!confirm('Delete this navigation item?')) return;
 
    const navItem = document.getElementById(navId);
    if (navItem) {
        const label = navItem.querySelector('span').textContent;
        navItem.remove();
        showToast(`Deleted: ${label}`);
    }
}

// ==========================================
// MANUAL PAYMENT APPROVAL SYSTEM
// ==========================================
 
buildAdminOrdersUI = function() {
    const container = document.getElementById('admin-orders-rows');
    if (!container) return;
    container.innerHTML = '';
 
    const allOrders = [];
    customerRegistry.forEach(client => {
        const history = client.purchaseHistory || [];
        history.forEach(order => {
            allOrders.push({
                ...order,
                clientName: client.name,
                clientEmail: client.email
            });
        });
    });
 
    if (allOrders.length === 0) {
        container.innerHTML = '<tr><td colspan="7" style="padding: 24px; text-align: center; color: var(--text-muted); font-style: italic;">No purchase history found in system.</td></tr>';
        return;
    }
 
    allOrders.reverse().forEach(order => {
        let actionButtons = '';
 
        if (order.status === 'Pending') {
            actionButtons = `
                <button onclick="quickApprove('${order.clientEmail}', '${order.id}')" style="background:#22c55e;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;margin-right:4px;font-size:12px;">Approve</button>
                <button onclick="quickReject('${order.clientEmail}', '${order.id}')" style="background:#ef4444;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;">Reject</button>
            `;
        } else {
            actionButtons = `<span style="color:var(--text-muted);font-size:12px;">${order.status}</span>`;
        }
 
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="mono-id">${order.id}</td>
            <td>
                <div style="font-weight: 600; color: #ffffff;">${order.clientName}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${order.clientEmail}</div>
            </td>
            <td style="font-weight: 500; color: #ffffff;">${order.item}</td>
            <td class="price-unlocked-text">${order.cost}</td>
            <td><span class="pill-status pill-delivered">${order.payment || 'N/A'}</span></td>
            <td>${actionButtons}</td>
        `;
        container.appendChild(tr);
    });
};
 
function quickApprove(email, orderId) {
    const customer = customerRegistry.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (!customer || !customer.purchaseHistory) return;
 
    const order = customer.purchaseHistory.find(o => o.id === orderId);
    if (!order) return;
 
    if (!confirm(`Approve payment of ${order.cost} from ${customer.name}?`)) return;
 
    order.status = 'Paid';
    saveCustomerRegistry();
    buildAdminOrdersUI();
    showToast('Payment Approved!');
}
 
function quickReject(email, orderId) {
    const customer = customerRegistry.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (!customer || !customer.purchaseHistory) return;
 
    if (!confirm(`Reject payment from ${customer.name}? Order will be removed.`)) return;
 
    customer.purchaseHistory = customer.purchaseHistory.filter(o => o.id !== orderId);
    saveCustomerRegistry();
    buildAdminOrdersUI();
    showToast('Payment Rejected - Order removed');
}
 
confirmCheckoutWithPayment = function() {
    if (!currentUser || !currentUser.cartHistory || currentUser.cartHistory.length === 0) {
        showToast("Your cart is empty!");
        return;
    }
 
    const selectedPayment = document.querySelector('input[name="payment-method"]:checked')?.value || "COD";
 
    const itemsToMove = currentUser.cartHistory.map(item => ({
        ...item,
        status: 'Pending',
        payment: selectedPayment,
        id: 'ORDER-' + Math.floor(1000 + Math.random() * 9000)
    }));
 
    const totalCostValue = itemsToMove.reduce((sum, i) => sum + (parsePriceToNumber(i.cost) || 0), 0);
    const formattedTotal = formatPriceNumber(totalCostValue);
 
    currentUser.purchaseHistory = currentUser.purchaseHistory || [];
    currentUser.purchaseHistory = currentUser.purchaseHistory.concat(itemsToMove);
    currentUser.cartHistory = [];
 
    saveCustomerRegistry();
 
    showToast(`Order placed! Total: ${formattedTotal} - Awaiting approval.`);
    createFireworks();
    createConfetti();
 
    buildCustomerCartTable();
    buildCustomerPurchaseTable();
    closePaymentModal();
};

const pageEditorData = [
    { id: 1, name: 'Home' },
    { id: 3, name: 'Our Shoes' },
    { id: 4, name: 'Technologies' },
    { id: 6, name: 'Shoelanders' },
    { id: 7, name: 'Marikina' },
    { id: 30, name: 'Inquiry' }
];
 
function renderPageEditor() {
    const container = document.getElementById('page-editor-rows');
    if (!container) return;
    container.innerHTML = '';
 
    pageEditorData.forEach(p => {
        const pageEl = document.getElementById(`page-${p.id}`);
        if (!pageEl) return;
 
        const h1 = pageEl.querySelector('h1');
        const currentTitle = h1 ? h1.textContent : 'No Title';
 
        const sub = pageEl.querySelector('.page-subtitle') || pageEl.querySelector('p');
        const currentSub = sub ? sub.textContent : '';
 
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;color:#fff;">${p.name}</td>
            <td style="color:#22c55e;font-size:13px;font-weight:500;">${currentTitle}</td>
            <td><input type="text" class="form-input" id="title-${p.id}" value="${currentTitle}" style="width:150px;background:#18181b;border:1px solid #3f3f46;"></td>
            <td style="color:#eab308;font-size:13px;font-weight:500;">${currentSub || '-'}</td>
            <td><input type="text" class="form-input" id="subtitle-${p.id}" value="${currentSub}" placeholder="Enter subtitle text..." style="width:200px;background:#18181b;border:1px solid #3f3f46;"></td>
            <td><button onclick="savePageContent(${p.id})" class="btn-action" style="padding:8px 14px;font-size:12px;">Save</button></td>
        `;
        container.appendChild(tr);
    });
}
 
function savePageContent(pageId) {
    const titleInput = document.getElementById(`title-${pageId}`);
    const subInput = document.getElementById(`subtitle-${pageId}`);
 
    const newTitle = titleInput.value.trim();
    const newSub = subInput.value.trim();
 
    const pageEl = document.getElementById(`page-${pageId}`);
    if (!pageEl) return;
 
    const h1 = pageEl.querySelector('h1');
    if (h1) h1.textContent = newTitle;
 
    let sub = pageEl.querySelector('.page-subtitle');
 
    if (newSub) {
        if (!sub) {
            sub = document.createElement('p');
            sub.className = 'page-subtitle';
            sub.style.cssText = 'color:var(--text-muted);margin-top:8px;';
            if (h1) h1.parentNode.insertBefore(sub, h1.nextSibling);
        }
        sub.textContent = newSub;
    } else if (sub) {
        sub.remove();
    }
 
    showToast('Saved!');
    renderPageEditor();
}
 
const originalSwitchAdminTab = switchAdminTab;
switchAdminTab = function(tabName) {
    originalSwitchAdminTab(tabName);
    if (tabName === 'navigation') {
        setTimeout(renderPageEditor, 200);
    }
};

// ==========================================
// MANUAL DELIVERY TRACKING SYSTEM
// ==========================================
 
buildAdminOrdersUI = function() {
    const container = document.getElementById('admin-orders-rows');
    if (!container) return;
    container.innerHTML = '';
 
    const allOrders = [];
    customerRegistry.forEach(client => {
        const history = client.purchaseHistory || [];
        history.forEach(order => {
            allOrders.push({
                ...order,
                clientName: client.name,
                clientEmail: client.email
            });
        });
    });
 
    if (allOrders.length === 0) {
        container.innerHTML = '<tr><td colspan="8" style="padding: 24px; text-align: center; color: var(--text-muted);">No orders found.</td></tr>';
        return;
    }
 
    allOrders.reverse().forEach(order => {
        let deliveryBadge = '';
        let actionButtons = '';
 
        if (order.delivered === true) {
            deliveryBadge = `<span style="background:#22c55e;color:#fff;padding:4px 8px;border-radius:4px;font-size:11px;">Delivered (${order.deliveryDays || '?'} days)</span>`;
            actionButtons = '<span style="color:var(--text-muted);font-size:11px;">Completed</span>';
        } else if (order.status === 'Paid' || order.status === 'Pending') {
            deliveryBadge = '<span style="background:#eab308;color:#000;padding:4px 8px;border-radius:4px;font-size:11px;">In Transit</span>';
            actionButtons = `
                <button onclick="markDelivered('${order.clientEmail}', '${order.id}')" style="background:#22c55e;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:11px;">Mark Delivered</button>
            `;
        } else {
            deliveryBadge = `<span style="background:#71717a;color:#fff;padding:4px 8px;border-radius:4px;font-size:11px;">${order.status}</span>`;
            actionButtons = '<span style="color:var(--text-muted);font-size:11px;">-</span>';
        }
 
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:#facc15;font-family:monospace;font-weight:600;">${order.id}</td>
            <td><div style="font-weight:600;color:#fff;">${order.clientName}</div><small style="color:var(--text-muted);">${order.clientEmail}</small></td>
            <td style="font-weight:500;color:#fff;">${order.item}</td>
            <td style="color:#facc15;font-weight:700;">${order.cost}</td>
            <td><span class="pill-status pill-delivered">${order.payment || 'N/A'}</span></td>
            <td>${deliveryBadge}</td>
            <td>${actionButtons}</td>
        `;
        container.appendChild(tr);
    });
};
 
function markDelivered(email, orderId) {
    const customer = customerRegistry.find(c => c.email.toLowerCase() === email.toLowerCase());
 
    if (!customer || !customer.purchaseHistory) {
        showToast('Customer not found');
        return;
    }
 
    const order = customer.purchaseHistory.find(o => o.id === orderId);
    if (!order) {
        showToast('Order not found');
        return;
    }
 
    const days = prompt('How many days did delivery take?', '3');
    if (days === null) return;
 
    let deliveryDays = parseInt(days, 10);
    if (isNaN(deliveryDays) || deliveryDays < 1) {
        deliveryDays = 1;
    }
 
    order.delivered = true;
    order.deliveryDays = deliveryDays;
    order.deliveryDate = new Date().toLocaleDateString();
    order.status = 'Delivered';
 
    saveCustomerRegistry();
    buildAdminOrdersUI();
    showToast(`Marked as Delivered (${deliveryDays} days)!`);
}
 
window.shoes = shoes;
window.techProducts = techProducts;
window.shoelanders = shoelanders;
window.marikinaCollection = marikinaCollection;
 
function loadAllProductImages() {
    const container = document.getElementById('all-product-images');
    if (!container) return;
    container.innerHTML = '';
 
    const allProducts = [
        { name: 'Shoes', items: shoes },
        { name: 'Shoelanders', items: shoelanders },
        { name: 'Marikina', items: marikinaCollection },
        { name: 'Technologies', items: techProducts }
    ];
 
    let count = 0;
    allProducts.forEach(cat => {
        cat.items.forEach(item => {
            count++;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px;background:#18181b;border-radius:8px;margin-bottom:8px;';
            row.innerHTML = `
                <img id="preview-${item.id}" src="${item.image}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;">
                <div style="flex:1;min-width:120px;">
                    <p style="color:#fff;font-weight:600;margin:0;font-size:13px;">${item.name}</p>
                    <p style="color:#71717a;font-size:11px;margin:0;">${cat.name}</p>
                </div>
                <label style="background:#3b82f6;border:none;padding:8px 12px;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">
                    <input type="file" id="file-${item.id}" accept="image/*" onchange="previewImage('${item.id}')" style="display:none;">
                    Choose File
                </label>
                <button onclick="saveProductImage('${item.id}', '${cat.name}')" style="background:#22c55e;border:none;padding:8px 14px;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">Save</button>
            `;
            container.appendChild(row);
        });
    });
 
    if (count === 0) {
        container.innerHTML = '<p style="color:#71717a;">No products found</p>';
    }
}
 
function previewImage(itemId) {
    const fileInput = document.getElementById(`file-${itemId}`);
    const preview = document.getElementById(`preview-${itemId}`);
 
    const file = fileInput.files[0];
    if (file && preview) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            const urlInput = document.getElementById(`url-${itemId}`);
            if (urlInput) urlInput.value = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}
 
function saveProductImage(itemId, category) {
    const preview = document.getElementById(`preview-${itemId}`);
    const newUrl = preview ? preview.src : '';
 
    if (!newUrl) {
        alert('No image! Choose a file first.');
        return;
    }
 
    let arr = null;
    if (category === 'Shoes') arr = shoes;
    else if (category === 'Shoelanders') arr = shoelanders;
    else if (category === 'Marikina') arr = marikinaCollection;
    else if (category === 'Technologies') arr = techProducts;
 
    if (arr) {
        const item = arr.find(p => p.id == itemId);
        if (item) {
            item.image = newUrl;
            localStorage.setItem('resourceManCatalog', JSON.stringify({
                shoes: shoes, techProducts: techProducts,
                shoelanders: shoelanders, marikinaCollection: marikinaCollection
            }));
            alert(`Image saved for ${item.name}!`);
            if (typeof renderShoes === 'function') renderShoes();
            if (typeof renderShoelanders === 'function') renderShoelanders();
            if (typeof renderMarikina === 'function') renderMarikina();
            if (typeof renderTechProducts === 'function') renderTechProducts();

        }
    }
}
 
function loadBackgroundImages() {
    const container = document.getElementById('all-background-images');
    const hero = document.getElementById('hero-image');
    const heroSrc = hero ? hero.src : '';
 
    if (container) {
        container.innerHTML = '';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px;background:#18181b;border-radius:8px;margin-bottom:8px;';
        row.innerHTML = `
            <img id="bg-preview" src="${heroSrc}" style="width:120px;height:80px;object-fit:cover;border-radius:4px;">
            <div style="flex:1;"><p style="color:#fff;font-weight:600;">Home Page Hero Image</p></div>
            <label style="background:#3b82f6;border:none;padding:8px 12px;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">
                <input type="file" id="bg-file" accept="image/*" onchange="previewBg()" style="display:none;">
                Choose File
            </label>
            <button onclick="saveBgImage()" style="background:#22c55e;border:none;padding:8px 14px;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">Save</button>
        `;
        container.appendChild(row);
    }
}
 
function previewBg() {
    const fileInput = document.getElementById('bg-file');
    const preview = document.getElementById('bg-preview');
    const file = fileInput.files[0];
    if (file && preview) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}
 
function saveBgImage() {
    const preview = document.getElementById('bg-preview');
    const hero = document.getElementById('hero-image');
    if (preview && hero) {
        hero.src = preview.src;
        localStorage.setItem('resourceManHeroImage', preview.src);
        alert('Background image saved!');
    }
}
 
const categoryDesigns = JSON.parse(localStorage.getItem('categoryDesigns')) || {};
 
function loadCategoryDesign() {
    const categoryEl = document.getElementById('design-category');
    const options = document.getElementById('design-options');

    if (!categoryEl || !options) return;

    const category = categoryEl.value;
    if (!category) {
        options.style.display = 'none';
        return;
    }

    const design = categoryDesigns[category] || {};

    document.getElementById('design-bg').value = design.bg || '#09090b';
    document.getElementById('design-header').value = design.header || '#fafafa';
    document.getElementById('design-text').value = design.text || '#fafafa';
    document.getElementById('design-accent').value = design.accent || '#eab308';
    document.getElementById('design-card').value = design.card || '#18181b';
    document.getElementById('design-price').value = design.price || '#eab308';
    document.getElementById('design-css').value = design.css || '';

    options.style.display = 'block';

    // Ensure preview matches saved values immediately after refresh
    // (prevents "back to default" feeling).
    if (typeof applyCategoryDesign === 'function') {
        applyCategoryDesign();
    }
}
 
function saveCategoryDesign() {
    const category = document.getElementById('design-category').value;
    if (!category) {
        alert('Select a category first!');
        return;
    }

    categoryDesigns[category] = {
        bg: document.getElementById('design-bg').value,
        header: document.getElementById('design-header').value,
        text: document.getElementById('design-text').value,
        accent: document.getElementById('design-accent').value,
        card: document.getElementById('design-card').value,
        price: document.getElementById('design-price').value,
        css: document.getElementById('design-css').value
    };

    // Remember last edited category so refresh can re-apply its CSS reliably
    localStorage.setItem('categoryDesigns_lastSavedCategory', category);

    // Local persistence (always)
    localStorage.setItem('categoryDesigns', JSON.stringify(categoryDesigns));

    // Global/cloud persistence (best-effort; no-op if not configured/routable)
    try {
        if (typeof window.syncToWordPress === 'function') {
            window.syncToWordPress('categoryDesigns', categoryDesigns);
        }
    } catch (e) {
        console.warn('Global sync for categoryDesigns skipped:', e);
    }

    // Avoid alert/toast spam; keep UX stable
    if (typeof showToast === 'function') showToast(`Design saved (${category})`);
}
 
function applyCategoryDesign() {
    const category = document.getElementById('design-category').value;
    if (!category) return;

    const design = categoryDesigns[category];
    if (!design) return;

    // Map category -> the page id(s) where cards for that category exist
    // (IDs are from index.html)
    const pageMap = {
        'shoes': ['page-3'],
        'shoelanders': ['page-6'],
        'marikina': ['page-7'],
        'technology': ['page-4']
    };

    const pageIds = pageMap[category] || [];
    if (pageIds.length === 0) return;

    // Apply to each page section for this category
    pageIds.forEach(pageId => {
        const page = document.getElementById(pageId);
        if (!page) return;

        if (design.bg) page.style.background = design.bg;

        const h1 = page.querySelector('h1');
        if (h1 && design.header) h1.style.color = design.header;

        // Cards use `.shoe-card` across the app for catalog sections
        const cards = page.querySelectorAll('.shoe-card');
        cards.forEach(card => {
            if (design.card) card.style.background = design.card;

            const price = card.querySelector('.price-text');
            if (price && design.price) price.style.color = design.price;
        });
    });

    // Inject/update global custom CSS once
    if (design.css) {
        const style = document.getElementById('custom-category-style') || document.createElement('style');
        style.id = 'custom-category-style';
        style.textContent = design.css;
        if (!style.parentNode) document.head.appendChild(style);
    }

    // Also re-apply the save-time styling to any already-rendered cards immediately
    // (covers cases where cards were rendered before “Apply Preview”)
    // No alert spam; keep existing UX stable.
}

window.addEventListener('load', () => {
    // Re-apply saved hero/background image globally
    const savedHeroImage = localStorage.getItem('resourceManHeroImage');
    const heroEl = document.getElementById('hero-image');
    if (savedHeroImage && heroEl) {
        heroEl.src = savedHeroImage;
    }

    // If admin preview is already rendered/open
    const bgPreviewEl = document.getElementById('bg-preview');
    if (savedHeroImage && bgPreviewEl) {
        bgPreviewEl.src = savedHeroImage;
    }

    // Ensure the editor reflects saved values for the current select state
    // (prevents the “back to default” feeling in the editor UI itself).
    if (typeof loadCategoryDesign === 'function') {
        loadCategoryDesign();
    }

    // Re-apply saved category design backgrounds for ALL categories (not just page-3)
    const pageMap = {
        'shoes': ['page-3'],
        'shoelanders': ['page-6'],
        'marikina': ['page-7'],
        'technology': ['page-4']
    };

    Object.keys(categoryDesigns).forEach(cat => {
        const design = categoryDesigns[cat];
        if (!design) return;

        const pageIds = pageMap[cat] || [];
        pageIds.forEach(pageId => {
            const page = document.getElementById(pageId);
            if (!page) return;

            if (design.bg) page.style.background = design.bg;

            const h1 = page.querySelector('h1');
            if (h1 && design.header) h1.style.color = design.header;

            const cards = page.querySelectorAll('.shoe-card');
            cards.forEach(card => {
                if (design.card) card.style.background = design.card;
                const price = card.querySelector('.price-text');
                if (price && design.price) price.style.color = design.price;
            });
        });
    });

    // Apply custom CSS (if any) globally using a single injected style tag.
    // Fix: do NOT depend on the editor select being correctly set on load.
    // Prefer selected category css when available; otherwise use first saved css.
    const selectedCategoryEl = document.getElementById('design-category');
    const selectedCategory = selectedCategoryEl ? selectedCategoryEl.value : null;

    let cssToApply = '';
    if (selectedCategory && categoryDesigns[selectedCategory] && categoryDesigns[selectedCategory].css) {
        cssToApply = categoryDesigns[selectedCategory].css;
    } else {
        for (const k of Object.keys(categoryDesigns)) {
            if (categoryDesigns[k] && categoryDesigns[k].css) {
                cssToApply = categoryDesigns[k].css;
                break;
            }
        }
    }

    const style = document.getElementById('custom-category-style') || document.createElement('style');
    style.id = 'custom-category-style';
    style.textContent = cssToApply || '';
});
