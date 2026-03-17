/**
 * 共用 footer：單一來源，各頁以 <footer id="app-footer-placeholder" class="app-footer"></footer> 引用
 */
(function () {
  var el = document.getElementById("app-footer-placeholder");
  if (!el) return;
  el.innerHTML =
    '<span>版本：2.3</span>' +
    '<span aria-hidden="true">｜</span>' +
    '<a href="index.html" class="app-footer__link">首頁</a>' +
    '<span aria-hidden="true">｜</span>' +
    '<a href="about.html" class="app-footer__link">關於族語單字小幫手</a>';
})();
