/**
 * 漢堡選單開關：開啟/關閉 navDrawer，點 backdrop 關閉
 */
(function () {
  const hamburger = document.getElementById("navHamburger");
  const drawer = document.getElementById("navDrawer");
  const backdrop = document.getElementById("navDrawerBackdrop");

  function open() {
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    if (backdrop) backdrop.setAttribute("aria-hidden", "false");
    if (hamburger) hamburger.setAttribute("aria-expanded", "true");
  }

  function close() {
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (backdrop) backdrop.setAttribute("aria-hidden", "true");
    if (hamburger) hamburger.setAttribute("aria-expanded", "false");
  }

  function toggle() {
    if (drawer && drawer.classList.contains("is-open")) close();
    else open();
  }

  if (hamburger && drawer) {
    hamburger.addEventListener("click", toggle);
  }
  if (backdrop) {
    backdrop.addEventListener("click", close);
  }
})();
