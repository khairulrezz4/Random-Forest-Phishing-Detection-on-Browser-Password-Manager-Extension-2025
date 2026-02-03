// Simple PIN-based authentication and credential storage
const pinKey = 'pm_pin';
const credsKey = 'pm_credentials';

const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const addCredBtn = document.getElementById('add-cred-btn');
const messageDiv = document.getElementById('message');

function showMessage(msg, isError=false) {
  messageDiv.textContent = msg;
  messageDiv.style.color = isError ? 'red' : 'green';
  setTimeout(() => { messageDiv.textContent = ''; }, 2000);
}

function showDashboard() {
  authSection.style.display = 'none';
  dashboardSection.style.display = 'block';
  loadCredentials();
}

function showAuth() {
  authSection.style.display = 'block';
  dashboardSection.style.display = 'none';
}

registerBtn.onclick = () => {
  const pin = document.getElementById('pin').value;
  if (!pin) return showMessage('Enter a PIN to register', true);
  chrome.storage.local.set({[pinKey]: pin}, () => {
    showMessage('Registered! Please login.');
  });
};

loginBtn.onclick = () => {
  const pin = document.getElementById('pin').value;
  chrome.storage.local.get([pinKey], (result) => {
    if (result[pinKey] === pin) {
      showDashboard();
    } else {
      showMessage('Incorrect PIN', true);
    }
  });
};

logoutBtn.onclick = () => {
  showAuth();
};

addCredBtn.onclick = () => {
  const site = document.getElementById('site').value;
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const status = document.getElementById('status').value;
  if (!site || !username || !password || !status) return showMessage('Fill all fields', true);
  chrome.storage.local.get([credsKey], (result) => {
    const creds = result[credsKey] || [];
    creds.push({site, username, password, status});
    chrome.storage.local.set({[credsKey]: creds}, () => {
      showMessage('Credential added!');
      loadCredentials();
    });
  });
};

function loadCredentials() {
  const list = document.getElementById('credentials-list');
  list.innerHTML = '';
  chrome.storage.local.get([credsKey], (result) => {
    const creds = result[credsKey] || [];
    creds.forEach((cred, idx) => {
      const li = document.createElement('li');
      li.textContent = `${cred.site} | ${cred.username} | ${cred.password} | Status: ${cred.status}`;
      list.appendChild(li);
    });
  });
}

// On load, show auth
showAuth();
