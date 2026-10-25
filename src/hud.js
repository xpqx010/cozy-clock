const parameters = new URLSearchParams(location.search);
const hour24 = parameters.get("hour24") === "true";
document.body.dataset.font = parameters.get("font") || "rounded";
document.documentElement.style.setProperty("--hud-color", parameters.get("hudColor") || parameters.get("color") || "#f5eadc");
document.documentElement.style.setProperty("--hud-opacity", String(Math.max(.1, Math.min(1, Number(parameters.get("opacity") || 100) / 100))));

function update() {
  const now = new Date();
  const hour = hour24 ? now.getHours() : (now.getHours() % 12 || 12);
  document.querySelector("#hud-time").textContent = `${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

let lastRightClick = 0;
document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const now = Date.now();
  if (now - lastRightClick < 500) window.cozyHud.close();
  lastRightClick = now;
});

document.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  const target = document.body;
  target.setPointerCapture(event.pointerId);
  let previousX = event.screenX;
  let previousY = event.screenY;
  const move = (moveEvent) => {
    const deltaX = moveEvent.screenX - previousX;
    const deltaY = moveEvent.screenY - previousY;
    previousX = moveEvent.screenX;
    previousY = moveEvent.screenY;
    window.cozyHud.moveBy(deltaX, deltaY);
  };
  const finish = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", finish);
    target.removeEventListener("pointercancel", finish);
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", finish);
  target.addEventListener("pointercancel", finish);
});

document.querySelector("#hud-time").addEventListener("wheel", (event) => {
  event.preventDefault();
  window.cozyHud.resizeFromWheel(event.deltaY < 0 ? 1 : -1);
}, { passive: false });

update();
setInterval(update, 1000);
