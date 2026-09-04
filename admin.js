function openAdmin(){
  const panel = document.getElementById("admin-panel");
  if (panel) panel.style.display = "flex";
}

function closeAdmin(){
  const panel = document.getElementById("admin-panel");
  if (panel) panel.style.display = "none";
}

function openUsers(){
  const panel = document.getElementById("users-panel");
  if (panel) panel.style.display = "flex";
  // loadUsers defined in app.js will fetch /users
  if (typeof loadUsers === "function") loadUsers();
}

function closeUsers(){
  const panel = document.getElementById("users-panel");
  if (panel) panel.style.display = "none";
}

function openMailbox(){
  const panel = document.getElementById("mailbox-panel");
  if (panel) panel.style.display = "flex";
  if (typeof loadMailbox === "function") loadMailbox();
}

function closeMailbox(){
  const panel = document.getElementById("mailbox-panel");
  if (panel) panel.style.display = "none";
}
