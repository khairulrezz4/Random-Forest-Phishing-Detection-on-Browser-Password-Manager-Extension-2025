// v0.2: UI logic for improved prototype
// Placeholder logic for toggles, status, vault count, and export logs

document.getElementById('autofill-toggle').addEventListener('change', function() {
  // Placeholder: just toggle UI, no backend logic yet
});

document.getElementById('open-vault').addEventListener('click', function() {
  alert('Password Vault feature coming soon!');
});

document.getElementById('add-password').addEventListener('click', function() {
  alert('Add Password feature coming soon!');
});

document.getElementById('export-logs').addEventListener('click', function() {
  // For now, export a simple log
  const log = 'Password Manager v0.2\nExported logs (placeholder)';
  const blob = new Blob([log], {type: 'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'logs.txt';
  a.click();
  URL.revokeObjectURL(url);
});

// Placeholder: set vault count to 2 for demo
window.onload = function() {
  document.getElementById('vault-count').textContent = '2';
};
