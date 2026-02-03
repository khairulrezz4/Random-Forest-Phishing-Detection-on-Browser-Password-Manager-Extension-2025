const credsKey = 'pm_credentials';
const statusLabel = document.getElementById('status-label');
const vaultCount = document.getElementById('vault-count');
const credentialsList = document.getElementById('credentials-list');
const showAddBtn = document.getElementById('show-add');
const addSection = document.getElementById('add-section');
const addForm = document.getElementById('add-form');
const cancelAddBtn = document.getElementById('cancel-add');
const autofillToggle = document.getElementById('autofill-toggle');

// For screenshot demo: always show 'Phishing' status
statusLabel.textContent = 'Phishing';
document.getElementById('status-box').querySelector('div').textContent = 'This site is detected as phishing.';

function loadCredentials() {
  chrome.storage.local.get([credsKey], (result) => {
    const creds = result[credsKey] || [];
    credentialsList.innerHTML = '';
    vaultCount.textContent = creds.length;
    creds.forEach((cred, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<b>${cred.site}</b><br>${cred.username}<br>Status: ${cred.status}<br>` +
        `<div class="cred-actions">
          <button onclick="alert('Fill not implemented')">Fill</button>
          <button onclick="window.open('${cred.site}','_blank')">Open</button>
          <button onclick="alert('Password: ${cred.password}')">Reveal</button>
          <button onclick="deleteCredential(${idx})">Delete</button>
        </div>`;
      credentialsList.appendChild(li);
    });
  });
}

function deleteCredential(idx) {
  chrome.storage.local.get([credsKey], (result) => {
    const creds = result[credsKey] || [];
    creds.splice(idx, 1);
    chrome.storage.local.set({[credsKey]: creds}, loadCredentials);
  });
}

window.deleteCredential = deleteCredential;

showAddBtn.onclick = () => {
  addSection.style.display = 'block';
  showAddBtn.style.display = 'none';
};
cancelAddBtn.onclick = () => {
  addSection.style.display = 'none';
  showAddBtn.style.display = 'block';
};
addForm.onsubmit = (e) => {
  e.preventDefault();
  const site = document.getElementById('site').value;
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const status = document.getElementById('status').value;
  chrome.storage.local.get([credsKey], (result) => {
    const creds = result[credsKey] || [];
    creds.push({site, username, password, status});
    chrome.storage.local.set({[credsKey]: creds}, () => {
      addForm.reset();
      addSection.style.display = 'none';
      showAddBtn.style.display = 'block';
      loadCredentials();
    });
  });
};
autofillToggle.onchange = () => {
  // Placeholder: just toggle UI
};

// Initial load
loadCredentials();
